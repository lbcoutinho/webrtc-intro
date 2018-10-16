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
// Other constraints option: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
const constraints = {
  audio: true,
  video: { width: 240, height: 240 }
};

const configuration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

let rtcPeerConn;

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

function addChatMessage(msg) {
  chat.innerHTML += msg + '<br>';
}

async function initConnection() {
  rtcPeerConn = new RTCPeerConnection(configuration);
  // Sends ICE candidate if it exists
  rtcPeerConn.onicecandidate = ({ candidate }) => {
    if (candidate) {
      addSignalingLog('Sending ICE candidate', candidate);

      socket.emit('new-ice-candidate', {
        type: 'ICE',
        candidate: JSON.stringify(candidate),
        room: SIGNAL_ROOM
      });
    }
  };

  // Sends answer when receives SDP offer
  rtcPeerConn.onnegotiationneeded = async () => {
    // There is a bug on Googel Chrome that calls onnegotiationneede twice, one for each track on the stream
    // https://github.com/mdn/samples-server/issues/57
    // The variable _negotiating was introduced to guarantee we don't have concurrent negotiations running
    if (rtcPeerConn._negotiating) return;
    rtcPeerConn._negotiating = true;

    addSignalingLog('Starting onnegotiationneeded');
    try {
      addSignalingLog('Setting local description with offer');
      const offer = await rtcPeerConn.createOffer();
      await rtcPeerConn.setLocalDescription(offer);

      addSignalingLog('Sending SDP offer', offer);
      socket.emit(
        'send-sdp',
        {
          type: 'SDP',
          desc: JSON.stringify(rtcPeerConn.localDescription),
          room: SIGNAL_ROOM
        },
        logError
      );
    } catch (err) {
      logError(err);
    } finally {
      rtcPeerConn._negotiating = false;
    }
  };

  // Show remote stream when it arrives
  rtcPeerConn.ontrack = e => {
    if (peerVideo.srcObject) return;
    addSignalingLog('Remote track received', e);
    peerVideo.srcObject = e.streams[0];
  };

  addSignalingLog('Starting local stream');
  try {
    // Show local stream
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    myVideo.srcObject = stream;
    // Adding the stream tracks to the connection triggers the negotiation with the peer
    stream.getTracks().forEach(track => rtcPeerConn.addTrack(track, stream));
  } catch (err) {
    logError(err);
  }
}

function setupSignaling() {
  sendSignal.addEventListener('click', e => {
    initConnection();
  });
}

function addSignalingLog(msg, obj) {
  socket.emit('log', {
    message: `${new Date().toLocaleString('pt-BR')} - ${
      username.value
    }: ${msg}`,
    room: SIGNAL_ROOM
  });
  if (obj) {
    console.log(msg, obj);
  }
}

function logError(err) {
  const msg = `${err.name}: ${err.message}`;
  addSignalingLog(msg);
  console.error(msg);
}

// Invoke functions
window.onload = function() {
  console.log('--- Start');

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

  socket.on('ice-candidate-received', async data => {
    addSignalingLog('ICE candidate received', data);

    const candidate = JSON.parse(data.candidate);
    await rtcPeerConn.addIceCandidate(new RTCIceCandidate(candidate));
  });

  socket.on('sdp-received', async data => {
    addSignalingLog('SDP received', data);

    if (!rtcPeerConn) {
      initConnection();
    }

    // If SDP offer is received then return answer
    const desc = JSON.parse(data.desc);
    if (desc.type == 'offer') {
      addSignalingLog('Setting remote description with offer received');
      await rtcPeerConn.setRemoteDescription(new RTCSessionDescription(desc));
      try {
        addSignalingLog('Setting local description with answer');
        const answer = await rtcPeerConn.createAnswer();
        await rtcPeerConn.setLocalDescription(answer);

        addSignalingLog('Sending SDP answer', answer);
        socket.emit(
          'send-sdp',
          {
            type: 'SDP',
            desc: JSON.stringify(rtcPeerConn.localDescription),
            room: SIGNAL_ROOM
          },
          logError
        );
      } catch (err) {
        logError(err);
      }
    } else if (desc.type == 'answer') {
      addSignalingLog('Setting remote description with answer received');
      await rtcPeerConn.setRemoteDescription(new RTCSessionDescription(desc));
    }
  });
};
