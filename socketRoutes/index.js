module.exports = (io, socket, allSockets) => {
  socket.on('call-user', ({ id }) => {
    const filterResult = allSockets.filter(s => s.id == id);

    if (filterResult.length) {
      const targetSocket = filterResult[0];
      const signalRoom = socket.id + targetSocket.id;

      socket.join(signalRoom);
      targetSocket.join(signalRoom);

      io.to(socket.id).emit('joined-signal-room', signalRoom);
    }
  });

  socket.on('join-room', room => {
    socket.join(room, () => {
      io.to(room).emit('new-client', `New client in the room ${room}.`);
    });
  });

  socket.on('leave-room', room => {
    socket.leave(room);
  });

  socket.on('send', data => {
    io.to(data.room).emit('message', data);
  });

  socket.on('new-ice-candidate', data => {
    // Use socket.to so all clients in the room receive the message except the sender
    socket.to(data.room).emit('ice-candidate-received', data);
  });

  socket.on('send-sdp', data => {
    socket.to(data.room).emit('sdp-received', data);
  });

  socket.on('close-connection', data => {
    socket.to(data.room).emit('close-connection-received', data);
    socket.leave(data.room);
  });

  socket.on('send-file-metadata', data => {
    socket.to(data.room).emit('file-metadata-received', data);
  });

  socket.on('log', data => {
    io.to(data.room).emit('log', data);
  });
};
