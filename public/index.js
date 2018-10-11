// HTML elements
const myVideo = document.querySelector('#myVideo');
const peerVideo = document.querySelector('#peerVideo');

// Chat HTML elements
const name = document.querySelector('#name');
const message = document.querySelector('#message');
const sendBtn = document.querySelector('#send');
const chat = document.querySelector('#chat');
const ROOM = '#1';

// Steam initialization
function startStream() {
  console.log('startStream');

  // Other constraints option: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
  const constraints = {
    audio: true,
    video: { width: 240, height: 240 }
  };

  navigator.mediaDevices
    .getUserMedia(constraints)
    .then(stream => {
      console.log('startStream#then: ', stream);
      myVideo.src = window.URL.createObjectURL(stream);
      myVideo.load();
      myVideo.play();
    })
    .catch(err => {
      console.log('Error on mediaDevices.getUserMedia: ', err);
    });
}

function setupChat(socket) {
  sendBtn.addEventListener(
    'click',
    e => {
      socket.emit('send', {
        name: name.value,
        message: message.value,
        room: ROOM
      });
      e.preventDefault();
    },
    false
  );
}

function displayMessage(msg) {
  chat.innerHTML += msg + '<br>';
}

// Invoke functions
window.onload = function() {
  console.log('--- Start');
  const socket = io('http://localhost:3000');

  startStream();
  setupChat(socket);

  socket.emit('join-room', ROOM);
  socket.on('new-client', msg => {
    displayMessage(msg);
  });
  socket.on('message', data => {
    displayMessage(`${data.name}: ${data.message}`);
  });
};
