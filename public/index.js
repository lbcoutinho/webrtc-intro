// HTML elements
const myVideo = document.querySelector('#myVideo');
const peerVideo = document.querySelector('#peerVideo');
const signalingLog = document.querySelector('#signalingLog');
const sendSignal = document.querySelector('#sendSignal');

// Chat HTML elements
const username = document.querySelector('#username');
const name = document.querySelector('#name');
const message = document.querySelector('#message');
const sendBtn = document.querySelector('#send');
const chat = document.querySelector('#chat');
const ROOM = '#1';
const SIGNAL_ROOM = 'signal_room';

const socket = io('http://localhost:3000');

// Signaling variables
const configuration = {
  iceServers: [{ url: 'stun:stun.l.google.com:19302' }]
};

let rtcPeerConn;

// Steam initialization
function startStream() {
  // Other constraints option: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
  const constraints = {
    audio: true,
    video: { width: 240, height: 240 }
  };

  navigator.mediaDevices
    .getUserMedia(constraints)
    .then(stream => {
      myVideo.src = window.URL.createObjectURL(stream);
      myVideo.load();
      myVideo.play();
    })
    .catch(err => {
      console.log('Error on mediaDevices.getUserMedia: ', err);
    });
}

function setupChat() {
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

function setupSignaling() {
  sendSignal.addEventListener('click', e => {
    addSignalingLog('Sending signal: start-signaling');
    socket.emit('start-signaling', {
      type: 'start-signaling',
      // type: 'start_signaling',
      message: 'Are you ready for a call?',
      room: SIGNAL_ROOM
    });
    e.preventDefault();
  });
}

function addChatMessage(msg) {
  chat.innerHTML += msg + '<br>';
}

function addSignalingLog(msg) {
  socket.emit('log', {
    message: `${username.value}: ${msg}`,
    room: SIGNAL_ROOM
  });
}

// Invoke functions
window.onload = function() {
  console.log('--- Start');

  // startStream();
  setupChat();
  setupSignaling();

  socket.emit('join-room', ROOM);
  socket.emit('join-room', SIGNAL_ROOM);

  // Chat events
  socket.on('new-client', msg => {
    addChatMessage(msg);
  });
  socket.on('message', data => {
    addChatMessage(`${data.name}: ${data.message}`);
  });

  // Signaling events
  socket.on('log', data => {
    signalingLog.innerHTML += `${data.message}<br>`;
  });

  socket.on('start-signaling-received', data => {
    addSignalingLog(`Signal received: ${data.type}`);
    console.log('Signal received: ', data);

    if (!rtcPeerConn) {
      initConnection();
    }
  });

  socket.on('ice-candidate-received', data => {
    addSignalingLog(`Signal received: ${data.type}`);
    console.log('Signal received: ', data);

    const message = JSON.parse(data.message);
    rtcPeerConn.addIceCandidate(new RTCIceCandidate(message.candidate));
  });

  socket.on('sdp-offer-received', data => {
    addSignalingLog(`Signal received: ${data.type}`);
    console.log('Signal received: ', data);

    if (!rtcPeerConn) {
      initConnection();
    }

    // If SDP offer is received then return answer
    const message = JSON.parse(data.message);
    rtcPeerConn.setRemoteDescription(
      new RTCSessionDescription(message.sdp),
      () => {
        addSignalingLog('setRemoteDescription callback');
        console.log('setRemoteDescription callback');
        console.log(rtcPeerConn.remoteDescription);
        if (rtcPeerConn.remoteDescription.type == 'offer') {
          rtcPeerConn.createAnswer(sendLocalDescription, logError);
        }
      },
      logError
    );
  });
};

function initConnection() {
  addSignalingLog('Init RTCPeerConnection');
  rtcPeerConn = new RTCPeerConnection(configuration);

  rtcPeerConn.onicecandidate = e => {
    if (e.candidate) {
      addSignalingLog('Sending ICE candidate');
      console.log('Sending ICE candidate', e.candidate);

      socket.emit('new-ice-candidate', {
        type: 'ICE',
        message: JSON.stringify({ candidate: e.candidate }),
        room: SIGNAL_ROOM
      });
    }
  };

  // Trigger when receive SDP offer, then return own offer to peer
  rtcPeerConn.onnegotiationneeded = () => {
    addSignalingLog('Starting onnegotiationneeded');
    rtcPeerConn.createOffer(sendLocalDescription, logError);
  };

  // Show peer stream when it arrives
  rtcPeerConn.onaddstream = e => {
    addSignalingLog('Starting onaddstream');
    console.log('Starting onaddstream', e);
    peerVideo.src = URL.createObjectURL(e.stream);
  };

  // Show local stream
  navigator.mediaDevices
    .getUserMedia({
      audio: false,
      video: { width: 240, height: 240 }
    })
    .then(stream => {
      addSignalingLog('Adding local steam');
      console.log('Adding local steam', stream);
      myVideo.src = URL.createObjectURL(stream);
      rtcPeerConn.addStream(stream);
    })
    .catch(logError);
}

// SDP = Session Description Protocol. Message contains info about browser codecs, resolution and etc.
function sendLocalDescription(desc) {
  rtcPeerConn.setLocalDescription(desc, () => {
    addSignalingLog('Sending signal : SDP');
    console.log('sendLocalDescription - desc: ', desc);
    console.log('sendLocalDescription - localDescription: ');
    console.log(rtcPeerConn.localDescription);

    socket.emit(
      'sdp-offer',
      {
        type: 'SDP',
        message: JSON.stringify({ sdp: rtcPeerConn.localDescription }),
        room: SIGNAL_ROOM
      },
      logError
    );
  });
}

function logError(err) {
  addSignalingLog(`${err.name}: ${err.message}`);
}
