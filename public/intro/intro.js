// HTML elements
const video = document.querySelector('video');
const videoSelector = document.querySelector('#videoSelector');
const audioSelector = document.querySelector('#audioSelector');

const takePictureBtn = document.querySelector('#takePictureBtn');
const pictureCanvas = document.querySelector('#pictureCanvas');
const pictureImg = document.querySelector('#pictureImg');
const videoTag = document.querySelector('#videoTag');

let width = 240; // Same as media width
let height = 0; // Calculated later based on image ratio
let streaming = false; // Used to determine when the video has loaded

// Steam initialization
function startStream() {
  console.log('startStream');

  const audioSource = audioSelector.value || audioSelector.options[0].value;
  const videoSource = videoSelector.value || videoSelector.options[0].value;

  // Other constraints option: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
  const constraints = {
    audio: {
      deviceId: { exact: audioSource }
    },
    video: {
      deviceId: { exact: videoSource },
      width: { max: 240 },
      height: { max: 240 }
    }
  };

  navigator.mediaDevices
    .getUserMedia(constraints)
    .then(stream => {
      console.log('startStream#then: ', stream);
      video.src = window.URL.createObjectURL(stream);
      video.className = "grayscale-filter";
      video.load();
      video.play();
    })
    .catch(err => {
      console.log('Error on mediaDevices.getUserMedia: ', err);
      // User reject share request
      // MediaStreamError { name: "SecurityError", message: "The operation is insecure.", constraint: "", stack: "" }

      // Stream already in user in another browser
      // MediaStreamError { name: "SourceUnavailableError", message: "Failed to allocate videosource", constraint: "", stack: "" }

      // Wrong definition of constraints
      // MediaStreamError { name: "OverconstrainedError", message: "Constraints could be not satisfied.", constraint: "deviceId", stack: "" }
    });
}

// Setup available devices (cameras and microphones) in selectors
function setDevices() {
  console.log('setDevices');
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
    console.log('enumerateDevices() not supported.');
    document.querySelector('#audioDevices').style.visibility = 'hidden';
    document.querySelector('#videoDevices').style.visibility = 'hidden';
    return;
  }

  videoSelector.onchange = startStream;
  audioSelector.onchange = startStream;

  navigator.mediaDevices
    .enumerateDevices()
    .then(devices => {
      console.log('setDevices#then: ', devices);
      devices.forEach(({ deviceId, kind, label }) => {
        const opt = document.createElement('option');
        opt.value = deviceId;
        opt.text = label || `${kind} - ${deviceId}`;

        // Add only known device kinds and  unique values
        if (
          kind == 'videoinput' &&
          videoSelector.innerHTML.indexOf(`value="${deviceId}"`) == -1
        ) {
          videoSelector.appendChild(opt);
        } else if (
          kind == 'audioinput' &&
          audioSelector.innerHTML.indexOf(`value="${deviceId}"`) == -1
        ) {
          audioSelector.appendChild(opt);
        } else if (kind != 'videoinput' && kind != 'audioinput') {
          console.log(
            `Device type not recognized, ignoring device: kind: ${kind}, id: ${deviceId}`
          );
        }
      });

      // Start stream only after devices are retrieved and set
      startStream();
    })
    .catch(err => {
      console.log('mediaDevices.enumerateDevices: ', err);
    });
}

// Take picture functions
function takePicture() {
  console.log('takePicture - width = ', width, '/ height = ', height);

  const context = pictureCanvas.getContext('2d');
  pictureCanvas.width = width;
  pictureCanvas.height = height;
  context.drawImage(videoTag, 0, 0, width, height);

  const data = pictureCanvas.toDataURL('image/png');
  pictureImg.setAttribute('src', data);
}

function setTakePictureBtn() {
  takePictureBtn.addEventListener(
    'click',
    e => {
      takePicture();
      e.preventDefault();
    },
    false
  );
}

function setVideoCanPlay() {
  videoTag.addEventListener(
    'canplay',
    e => {
      console.log('canplay - streaming = ', streaming);
      if (!streaming) {
        height = videoTag.videoHeight / (videoTag.videoWidth / width);
        if (isNaN(height)) {
          height = width / (4 / 3);
        }

        console.log('width = ', width, '/ height = ', height);

        videoTag.setAttribute('width', width);
        videoTag.setAttribute('height', height);
        pictureCanvas.setAttribute('width', width);
        pictureCanvas.setAttribute('height', height);
        streaming = true;
      }
    },
    false
  );
}

// Invoke functions
window.onload = function() {
  console.log('--- Start');
  setDevices();
  // Take picture functions
  setTakePictureBtn(takePictureBtn, videoTag, pictureCanvas, pictureImg);
  setVideoCanPlay(videoTag, pictureCanvas, pictureImg);
};
