// HTML elements
const username = document.querySelector('#username');
const connectBtn = document.querySelector('#connectBtn');
const onlineUsers = document.querySelector('#onlineUsers');
const localVideo = document.querySelector('#localVideo');
const remoteVideo = document.querySelector('#remoteVideo');
const signalingLog = document.querySelector('#signalingLog');
const callBtn = document.querySelector('#callBtn');
const hangupBtn = document.querySelector('#hangupBtn');
const shareScreenBtn = document.querySelector('#shareScreenBtn');
const stopSharingBtn = document.querySelector('#stopSharingBtn');
const sendFileBtn = document.querySelector('#sendFileBtn');
const fileInput = document.querySelector('#fileInput');
const fileProgress = document.querySelector('#fileProgress');
const receivedFileLink = document.querySelector('#receivedFileLink');

// Chat HTML elements
const name = document.querySelector('#name');
const message = document.querySelector('#message');
const sendBtn = document.querySelector('#send');
const chat = document.querySelector('#chat');
const ROOM = 'global-chat-room';

const isFirefox = navigator.userAgent.indexOf('Firefox') !== -1;
const host =
  window.location.hostname == 'localhost'
    ? 'http://localhost:3000'
    : window.location.hostname;
let socket;

// Signaling variables
const configuration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

let rtcPeerConn;
let signalRoom;

// Data channel variables
const dataChannelOptions = {
  ordered: false, // No guaranteed delivery, unreliable but faster
  maxPacketLifeTime: 1000 // in ms
};

let dataChannel;
let receivedFileMetadata;
let receivedFileBuffer = [];
let receivedFileSize = 0;

function setupChat() {
  sendBtn.addEventListener('click', e => {
    socket.emit('send', {
      name: name.value,
      message: message.value,
      room: ROOM
    });
    e.preventDefault();
  });
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
        candidate: JSON.stringify(candidate),
        room: signalRoom
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
      createAndSendOffer();
    } catch (err) {
      logError(err);
    } finally {
      rtcPeerConn._negotiating = false;
    }
  };

  // Show remote stream when it arrives
  rtcPeerConn.ontrack = e => {
    addSignalingLog('Remote track received', e);
    remoteVideo.srcObject = e.streams[0];
    callBtn.disabled = true;
    hangupBtn.disabled = false;
    shareScreenBtn.disabled = false;
  };

  // Setup handler for new data channel
  rtcPeerConn.ondatachannel = e => {
    addSignalingLog('Data channel received', e);
    dataChannel = e.channel;
    addDataChannelHandlers();
  };

  addSignalingLog('Starting local stream');
  try {
    // Show local stream
    // Other constraints option: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: { width: 240, height: 240 }
    });
    localVideo.srcObject = stream;
    // Adding the stream tracks to the connection triggers the negotiation with the peer
    stream.getTracks().forEach(track => rtcPeerConn.addTrack(track, stream));
  } catch (err) {
    logError(err);
  }
}

async function createAndSendOffer() {
  addSignalingLog('Setting local description with offer');
  const offer = await rtcPeerConn.createOffer();
  await rtcPeerConn.setLocalDescription(offer);

  addSignalingLog('Sending SDP offer', offer);
  socket.emit(
    'send-sdp',
    {
      desc: JSON.stringify(rtcPeerConn.localDescription),
      room: signalRoom
    },
    logError
  );
}

function closeConnection() {
  if (rtcPeerConn) {
    rtcPeerConn.onnicecandidate = null;
    rtcPeerConn.onnotificationneeded = null;
    rtcPeerConn.ontrack = null;

    if (remoteVideo.srcObject) {
      remoteVideo.srcObject.getTracks().forEach(track => track.stop());
      remoteVideo.srcObject = null;
    }

    if (localVideo.srcObject) {
      localVideo.srcObject.getTracks().forEach(track => track.stop());
      localVideo.srcObject = null;
    }

    if (dataChannel) {
      dataChannel.onopen = null;
      dataChannel.ondatachannel = null;
      dataChannel.onmessage = null;
      dataChannel = null;
    }

    rtcPeerConn.close();
    rtcPeerConn = null;
    signalRoom = null;

    callBtn.disabled = false;
    hangupBtn.disabled = true;
    shareScreenBtn.disabled = true;
  }
}

function addDataChannelHandlers() {
  dataChannel.onopen = () => {
    addSignalingLog('Data channel open', dataChannel);
  };

  dataChannel.onmessage = e => {
    addSignalingLog(
      `File slice received: ${receivedFileSize} - ${receivedFileSize +
        e.data.byteLength}`,
      e.data
    );
    // Add file slide to the buffer
    receivedFileBuffer.push(e.data);
    receivedFileSize += e.data.byteLength;
    fileProgress.value = receivedFileSize;
    // Provide a link to download the file when completed
    if (receivedFileSize == receivedFileMetadata.size) {
      const file = new Blob(receivedFileBuffer);
      receivedFileLink.innerText = null;
      receivedFileLink.href = URL.createObjectURL(file);
      receivedFileLink.download = receivedFileMetadata.name;
      receivedFileLink.appendChild(
        document.createTextNode(
          `${receivedFileMetadata.name} (${receivedFileSize} bytes)`
        )
      );
      receivedFileBuffer = [];
      receivedFileSize = 0;
    }
  };
}

function sliceAndSendFile(file) {
  const fileSize = file.size;
  const chunkSize = 64 * 1024; // bytes
  let offset = 0;

  // The file chunks are read by invoking this function recursively
  function chunkReader(_offset, _chunkSize) {
    const reader = new FileReader();
    reader.onload = e => {
      const slice = e.target.result;

      if (e.target.error != null) {
        addSignalingLog(
          `Error reading file: ${e.target.error}`,
          e.target.error
        );
        return;
      }

      addSignalingLog(
        `Sending file slice: ${offset} - ${offset + slice.byteLength}`
      );
      dataChannel.send(slice);

      offset += slice.byteLength;
      fileProgress.value = offset;

      if (fileSize > offset) {
        // Read next chunk
        chunkReader(offset, chunkSize);
      } else {
        addSignalingLog('Completed file reading');
      }
    };

    const slice = file.slice(_offset, _offset + _chunkSize);
    reader.readAsArrayBuffer(slice);
  }

  // Now let's start the read with the first block
  chunkReader(offset, chunkSize);
}

function setupButtons() {
  callBtn.addEventListener('click', e => {
    socket.emit('call-user', { id: onlineUsers.value });
  });

  hangupBtn.addEventListener('click', e => {
    addSignalingLog('Closing connection');
    socket.emit(
      'close-connection',
      {
        room: signalRoom
      },
      logError
      );
    closeConnection();
  });

  shareScreenBtn.addEventListener('click', async e => {
    try {
      addSignalingLog('Starting screen share');
      // On local environment works only on Firefox
      let stream;
      if (isFirefox) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { mediaSource: 'screen', width: 340, height: 260 }
        });
      } else {
        // navigator.getDisplayMedia API is available on Chrome v70+
        // Chrome v70 does not support constraints on getDisplayMedia
        // https://groups.google.com/forum/#!searchin/discuss-webrtc/getdisplaymedia|sort:date/discuss-webrtc/6ImvPjWQvbE/insmIVtHBgAJ
        stream = await navigator.getDisplayMedia({
          audio: false,
          video: true
        });
      }
      stream.getTracks().forEach(track => rtcPeerConn.addTrack(track, stream));

      createAndSendOffer();

      shareScreenBtn.style = 'display: none';
      stopSharingBtn.style = '';
    } catch (err) {
      logError(err);
    }
  });

  stopSharingBtn.addEventListener('click', async e => {
    try {
      addSignalingLog('Stoping screen share');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 240, height: 240 }
      });
      stream.getTracks().forEach(track => rtcPeerConn.addTrack(track, stream));

      createAndSendOffer();

      stopSharingBtn.style = 'display: none';
      shareScreenBtn.style = '';
    } catch (err) {
      logError(err);
    }
  });

  sendFileBtn.addEventListener('click', e => {
    addSignalingLog('Sending file');
    const file = fileInput.files[0];
    fileProgress.max = file.size;
    sliceAndSendFile(file);
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.value) {
      const file = fileInput.files[0];
      addSignalingLog(`File selected: ${file.name} (${file.size})`);
      addSignalingLog('Sending file metadata');
      socket.emit('send-file-metadata', {
        metadata: { name: file.name, size: file.size },
        room: signalRoom
      });
      sendFileBtn.disabled = false;
    } else {
      sendFileBtn.disabled = true;
    }
  });

  onlineUsers.addEventListener('change', () => {
    const hasValue = onlineUsers.value;
    callBtn.disabled = !hasValue;
  });
}

function addSignalingLog(msg, obj) {
  socket.emit('log', {
    message: `${new Date().toLocaleString('pt-BR')} - ${
      username.value
    }: ${msg}`,
    room: signalRoom
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

function initSocket() {
  console.log('Init Socket');
  const namespace = 'mot';
  socket = io(`${host}?username=${username.value}`);
  setupChat();
  setupButtons();

  socket.emit('join-room', ROOM);

  socket.on('users-list-update', data => {
    // Remove all options
    while (onlineUsers.options.length > 0) {
      onlineUsers.remove(0);
    }

    // Recreate options with updated list
    data.forEach(({ username, id }) => {
      if (socket.id != id) {
        onlineUsers.appendChild(new Option(username, id));
      }
    });
  });

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
    signalingLog.scrollTop = signalingLog.scrollHeight;
  });

  socket.on('joined-signal-room', room => {
    signalRoom = room;
    addSignalingLog(`Joined signal room: ${room}`);
    initConnection();
    // Create data channel
    addSignalingLog('Creating data channel');
    dataChannel = rtcPeerConn.createDataChannel(
      'data-channel',
      dataChannelOptions
    );
    addDataChannelHandlers();
  });

  socket.on('ice-candidate-received', async data => {
    addSignalingLog('ICE candidate received', data);

    const candidate = JSON.parse(data.candidate);
    await rtcPeerConn.addIceCandidate(new RTCIceCandidate(candidate));
  });

  socket.on('sdp-received', async data => {
    if (!signalRoom) {
      signalRoom = data.room;
    }
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
            desc: JSON.stringify(rtcPeerConn.localDescription),
            room: signalRoom
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

  socket.on('close-connection-received', () => {
    addSignalingLog('Close connection received');
    socket.emit('leave-room', signalRoom);
    closeConnection();
  });

  socket.on('file-metadata-received', data => {
    addSignalingLog(
      `File metadata received: ${data.metadata.name} (${data.metadata.size})`,
      data
    );
    receivedFileMetadata = {
      name: data.metadata.name,
      size: data.metadata.size
    };
  });
}

// Invoke functions
window.onload = function() {
  connectBtn.addEventListener('click', () => {
    if (!socket && username.value) {
      initSocket();
      connectBtn.innerHTML = 'Disconnect';
    } else if (socket) {
      socket.disconnect();
      // Remove all options
      while (onlineUsers.options.length > 0) {
        onlineUsers.remove(0);
      }
      connectBtn.innerHTML = 'Connect';
      socket = null;
    }
  });
};
