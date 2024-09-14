let mediaRecorder;
let recordedChunks = [];
let stream;
let timerInterval;
let startTime;
let pausedTime = 0;
const MAX_RECORDINGS = 3;

const cameraRecordButton = document.getElementById('cameraRecordButton');
const screenRecordButton = document.getElementById('screenRecordButton');
const combinedRecordButton = document.getElementById('combinedRecordButton');
const stopButton = document.getElementById('stopButton');
const preview = document.getElementById('preview');
const recordingsList = document.getElementById('recordingsList');
const timerDisplay = document.getElementById('timer');
const recordingWarning = document.getElementById('recordingWarning');
const saveButton = document.getElementById('saveButton');
const newButton = document.getElementById('newButton');
const pauseButton = document.getElementById('pauseButton');
const resumeButton = document.getElementById('resumeButton');
let isPaused = false;
let cameraStream;

const textOverlayInput = document.getElementById('textOverlayInput');
const addOverlayButton = document.getElementById('addOverlayButton');
let textOverlay = '';

cameraRecordButton.addEventListener('click', () => handleRecord('camera'));
screenRecordButton.addEventListener('click', () => handleRecord('screen'));
combinedRecordButton.addEventListener('click', () => handleRecord('combined'));
stopButton.addEventListener('click', stopRecording);
saveButton.addEventListener('click', saveRecording);
newButton.addEventListener('click', prepareNewRecording);
pauseButton.addEventListener('click', pauseRecording);
resumeButton.addEventListener('click', resumeRecording);
document.getElementById('clearDataButton').addEventListener('click', clearData);

/**
 * Handles the recording process based on the selected mode.
 * @param {string} mode - The recording mode ('camera', 'screen', or 'combined').
 */
async function handleRecord(mode) {
    console.log(`${mode} record button clicked`);
    if (recordingsList.children.length >= MAX_RECORDINGS) {
        alert('Please delete or save a recording before making a new one.');
        return;
    }

    try {
        console.log("Requesting media stream");
        stream = await getMediaStream(mode);
        console.log("Media stream obtained");
        preview.srcObject = stream;
        showRecordingUI(mode);
        startRecording();
    } catch (error) {
        console.error('Error accessing media devices:', error);
        alert(`Unable to access ${mode === 'camera' ? 'camera and microphone' : mode === 'screen' ? 'screen' : 'screen and camera'}. Please grant permission and try again.`);
    }
}

/**
 * Gets the appropriate media stream based on the recording mode.
 * @param {string} mode - The recording mode.
 * @returns {Promise<MediaStream>} The media stream.
 */
async function getMediaStream(mode) {
    switch (mode) {
        case 'camera':
            return navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
        case 'screen':
            return getCombinedScreenAudioStream();
        case 'combined':
            return getCombinedCameraScreenStream();
        default:
            throw new Error('Invalid recording mode');
    }
}

/**
 * Gets a combined stream of screen capture and audio.
 * @returns {Promise<MediaStream>} The combined stream.
 */
async function getCombinedScreenAudioStream() {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true
    });
    const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: true
    });
    return new MediaStream([...screenStream.getTracks(), ...audioStream.getAudioTracks()]);
}

/**
 * Gets a combined stream of camera, screen capture, and audio.
 * @returns {Promise<MediaStream>} The combined stream.
 */
async function getCombinedCameraScreenStream() {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true
    });
    cameraStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
    });
    const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: true
    });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = screenStream.getVideoTracks()[0].getSettings().width;
    canvas.height = screenStream.getVideoTracks()[0].getSettings().height;

    const screenVideo = document.createElement('video');
    screenVideo.srcObject = screenStream;
    await screenVideo.play();

    const cameraVideo = document.createElement('video');
    cameraVideo.srcObject = cameraStream;
    await cameraVideo.play();

    function drawCanvas() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);
        const cameraWidth = canvas.width / 4;
        const cameraHeight = (cameraWidth * cameraVideo.videoHeight) / cameraVideo.videoWidth;
        ctx.drawImage(cameraVideo, canvas.width - cameraWidth - 20, 20, cameraWidth, cameraHeight);
        requestAnimationFrame(drawCanvas);
    }
    drawCanvas();

    const canvasStream = canvas.captureStream(30);

    const combinedTracks = [...canvasStream.getTracks(), ...audioStream.getAudioTracks()];
    const combinedStream = new MediaStream(combinedTracks);

    const cameraFeed = document.getElementById('cameraFeed');
    cameraFeed.srcObject = cameraStream;
    document.getElementById('cameraContainer').classList.remove('hidden');

    return combinedStream;
}

/**
 * Shows the recording UI elements.
 * @param {string} mode - The recording mode.
 */
function showRecordingUI(mode) {
    preview.classList.remove('hidden');
    timerDisplay.classList.remove('hidden');
    stopButton.classList.remove('hidden');
    pauseButton.classList.remove('hidden');
    cameraRecordButton.classList.add('hidden');
    screenRecordButton.classList.add('hidden');
    combinedRecordButton.classList.add('hidden');
    saveButton.classList.add('hidden');
    newButton.classList.add('hidden');
    resumeButton.classList.add('hidden');
    document.querySelector('.app-title').classList.add('hidden');
    document.getElementById('clearDataButton').classList.add('hidden');

    const recordingType = mode.charAt(0).toUpperCase() + mode.slice(1) + ' Recording';
    document.querySelector('.recording-type').textContent = recordingType;
    document.querySelector('.recording-type').classList.remove('hidden');
}

/**
 * Hides the recording UI elements.
 */
function hideRecordingUI() {
    preview.classList.add('hidden');
    timerDisplay.classList.add('hidden');
    stopButton.classList.add('hidden');
    pauseButton.classList.add('hidden');
    resumeButton.classList.add('hidden');
    saveButton.classList.remove('hidden');
    newButton.classList.remove('hidden');
    cameraRecordButton.classList.remove('hidden');
    screenRecordButton.classList.remove('hidden');
    combinedRecordButton.classList.remove('hidden');
    document.querySelector('.app-title').classList.remove('hidden');
    document.querySelector('.recording-type').classList.add('hidden');
    document.getElementById('cameraContainer').classList.add('hidden');
    document.getElementById('clearDataButton').classList.remove('hidden');
}

/**
 * Starts the recording process.
 */
function startRecording() {
    if (!stream) {
        console.error("No media stream available");
        return;
    }

    try {
        const options = {
            mimeType: 'video/webm; codecs=vp9',
            videoBitsPerSecond: 1500000,
            audioBitsPerSecond: 128000
        };

        mediaRecorder = new MediaRecorder(stream, options);
        console.log("MediaRecorder initialized with options:", options);

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunks, {
                type: 'video/webm'
            });
            const url = URL.createObjectURL(blob);
            preview.src = url;
            preview.srcObject = null;
            preview.classList.remove('hidden');
            preview.controls = true;
            preview.muted = false;
            preview.play();
            saveButton.classList.remove('hidden');
            newButton.classList.remove('hidden');
        };

        mediaRecorder.start();
        stopButton.disabled = false;
        pauseButton.classList.remove('hidden');
        recordedChunks = [];
        startTimer();
        document.body.classList.add('recording-active');
    } catch (error) {
        console.error("Error initializing MediaRecorder:", error);
    }
}

/**
 * Pauses the current recording.
 */
function pauseRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.pause();
        isPaused = true;
        pauseButton.classList.add('hidden');
        resumeButton.classList.remove('hidden');
        pauseTimer();
    }
}

/**
 * Resumes a paused recording.
 */
function resumeRecording() {
    if (mediaRecorder && mediaRecorder.state === 'paused') {
        mediaRecorder.resume();
        isPaused = false;
        pauseButton.classList.remove('hidden');
        resumeButton.classList.add('hidden');
        resumeTimer();
    }
}

/**
 * Stops the current recording.
 */
function stopRecording() {
    if (mediaRecorder) {
        mediaRecorder.stop();
        stopButton.disabled = true;
        saveButton.disabled = false;
        stopTimer();
        document.body.classList.remove('recording-active');

        pauseButton.classList.add('hidden');
        resumeButton.classList.add('hidden');

        stopAllTracks();

        document.getElementById('cameraContainer').classList.add('hidden');
    }
}

/**
 * Saves the recorded video with a custom name.
 */
function saveRecording() {
    const customName = prompt("Enter a name for your recording:", `recording_${Date.now()}`);
    if (!customName) {
        return;
    }

    const blob = new Blob(recordedChunks, {
        type: 'video/webm'
    });
    const url = URL.createObjectURL(blob);
    addRecordingToList(url, blob, customName);

    const successMessage = document.getElementById('successMessage');
    const recordingType = document.querySelector('.recording-type').textContent;
    successMessage.textContent = `${recordingType} saved successfully as "${customName}"`;

    successMessage.classList.remove('hidden');
    successMessage.classList.add('show');
    setTimeout(() => {
        successMessage.classList.remove('show');
        successMessage.classList.add('hidden');
    }, 2000);

    hideRecordingUI();

    saveButton.classList.add('hidden');
    newButton.classList.add('hidden');

    cameraRecordButton.classList.remove('hidden');
    screenRecordButton.classList.remove('hidden');
    combinedRecordButton.classList.remove('hidden');
    cameraRecordButton.disabled = false;
    screenRecordButton.disabled = false;
    combinedRecordButton.disabled = false;

    recordedChunks = [];
    saveToLocalStorage();
}

/**
 * Prepares the UI for a new recording.
 */
function prepareNewRecording() {
    hideRecordingUI();
    cameraRecordButton.classList.remove('hidden');
    screenRecordButton.classList.remove('hidden');
    combinedRecordButton.classList.remove('hidden');
    cameraRecordButton.disabled = false;
    screenRecordButton.disabled = false;
    combinedRecordButton.disabled = false;
    preview.src = '';
    preview.srcObject = null;
    timerDisplay.textContent = '00:00';
    document.getElementById('cameraContainer').classList.add('hidden');

    saveButton.classList.add('hidden');
    newButton.classList.add('hidden');
    updateClearDataButtonVisibility();
}

/**
 * Starts the recording timer.
 */
function startTimer() {
    startTime = Date.now();
    pausedTime = 0;
    updateTimer();
    timerInterval = setInterval(updateTimer, 1000);
}

/**
 * Pauses the recording timer.
 */
function pauseTimer() {
    clearInterval(timerInterval);
    pausedTime += Date.now() - startTime;
}

/**
 * Resumes the recording timer.
 */
function resumeTimer() {
    startTime = Date.now();
    updateTimer();
    timerInterval = setInterval(updateTimer, 1000);
}

/**
 * Stops the recording timer.
 */
function stopTimer() {
    clearInterval(timerInterval);
    pausedTime = 0;
}

/**
 * Updates the timer display.
 */
function updateTimer() {
    const elapsedTime = (Date.now() - startTime) + pausedTime;
    const seconds = Math.floor(elapsedTime / 1000);
    const minutes = Math.floor(seconds / 60);
    const formattedTime = `${padZero(minutes)}:${padZero(seconds % 60)}`;
    timerDisplay.textContent = formattedTime;
}

/**
 * Pads a number with leading zeros.
 * @param {number} number - The number to pad.
 * @returns {string} The padded number as a string.
 */
function padZero(number) {
    return number.toString().padStart(2, '0');
}

/**
 * Adds a recording to the list of recordings.
 * @param {string} url - The URL of the recorded video.
 * @param {Blob} blob - The recorded video blob.
 * @param {string} customName - The custom name for the recording.
 */
function addRecordingToList(url, blob, customName) {
    if (recordingsList.children.length >= MAX_RECORDINGS) {
        recordingWarning.classList.remove('hidden');
        return;
    }

    const fileSize = (blob.size / (1024 * 1024)).toFixed(2);
    const recordingTime = new Date().toLocaleString();

    const li = createRecordingItem(url, `Size: ${fileSize} MB`, `Recorded: ${recordingTime}`, customName);
    recordingsList.insertBefore(li, recordingsList.firstChild);

    checkRecordingAvailability();
    saveToLocalStorage();
}

/**
 * Creates a recording item element.
 * @param {string} url - The URL of the recorded video.
 * @param {string} sizeText - The size of the recording.
 * @param {string} timeText - The recording time.
 * @param {string} customName - The custom name for the recording.
 * @returns {HTMLElement} The created recording item element.
 */
function createRecordingItem(url, sizeText, timeText, customName) {
    const li = document.createElement('div');
    li.classList.add('recording-item');
    const video = document.createElement('video');
    video.src = url;
    video.controls = true;

    const detailsDiv = document.createElement('div');
    detailsDiv.classList.add('recording-details');

    detailsDiv.innerHTML = `
        <p>${customName || 'Unnamed Recording'}</p>
        <p>${sizeText}</p>
        <p>${timeText}</p>
    `;

    const controlsDiv = document.createElement('div');
    controlsDiv.classList.add('recording-controls');

    const downloadButton = document.createElement('a');
    downloadButton.href = url;
    downloadButton.download = `${customName || 'recording'}_${Date.now()}.webm`;
    downloadButton.innerText = 'Download';
    downloadButton.classList.add('download-button');

    const deleteButton = document.createElement('button');
    deleteButton.innerText = 'Delete';
    deleteButton.classList.add('delete-button');
    deleteButton.addEventListener('click', () => {
        li.remove();
        recordingWarning.classList.add('hidden');
        checkRecordingAvailability();
        saveToLocalStorage();
    });

    controlsDiv.appendChild(downloadButton);
    controlsDiv.appendChild(deleteButton);

    li.appendChild(video);
    li.appendChild(detailsDiv);
    li.appendChild(controlsDiv);

    return li;
}

/**
 * Checks the availability of recording slots and updates UI accordingly.
 */
function checkRecordingAvailability() {
    if (recordingsList.children.length >= MAX_RECORDINGS) {
        cameraRecordButton.disabled = true;
        screenRecordButton.disabled = true;
        combinedRecordButton.disabled = true;
        recordingWarning.classList.remove('hidden');
    } else {
        cameraRecordButton.disabled = false;
        screenRecordButton.disabled = false;
        combinedRecordButton.disabled = false;
        recordingWarning.classList.add('hidden');
    }

    updateClearDataButtonVisibility();
}

/**
 * Updates the visibility of the Clear Data button.
 */
function updateClearDataButtonVisibility() {
    const clearDataButton = document.getElementById('clearDataButton');
    if (recordingsList.children.length > 0 || localStorage.getItem('recordings')) {
        clearDataButton.classList.remove('hidden');
    } else {
        clearDataButton.classList.add('hidden');
    }
}

/**
 * Stops all active media tracks.
 */
function stopAllTracks() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
}

/**
 * Saves the current recordings to local storage.
 */
function saveToLocalStorage() {
    const recordings = Array.from(recordingsList.children).map(item => {
        const video = item.querySelector('video');
        const details = item.querySelector('.recording-details');
        return {
            url: video.src,
            name: details.querySelector('p:first-child').textContent,
            size: details.querySelector('p:nth-child(2)').textContent,
            time: details.querySelector('p:last-child').textContent
        };
    });
    localStorage.setItem('recordings', JSON.stringify(recordings));
}

/**
 * Loads saved recordings from local storage.
 */
function loadFromLocalStorage() {
    const recordings = JSON.parse(localStorage.getItem('recordings')) || [];
    recordings.forEach(recording => {
        const li = createRecordingItem(recording.url, recording.size, recording.time, recording.name);
        recordingsList.insertBefore(li, recordingsList.firstChild);
    });
}

/**
 * Clears all saved recordings from local storage.
 */
function clearData() {
    localStorage.removeItem('recordings');
    while (recordingsList.firstChild) {
        recordingsList.firstChild.remove();
    }
    updateClearDataButtonVisibility();
}

// Load saved recordings on page load
document.addEventListener('DOMContentLoaded', () => {
    loadFromLocalStorage();
    updateClearDataButtonVisibility();
});

function clearData() {
    if (confirm("Are you sure you want to clear all saved recordings?")) {
        localStorage.removeItem('recordings');
        while (recordingsList.firstChild) {
            recordingsList.firstChild.remove();
        }
        updateClearDataButtonVisibility();
    }
}