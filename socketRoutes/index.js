module.exports = (io, socket) => {
  socket.on('join-room', room => {
    socket.join(room, () => {
      io.to(room).emit('new-client', `New client in the room ${room}.`);
    });
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
  });

  socket.on('send-file-metadata', data => {
    socket.to(data.room).emit('file-metadata-received', data);
  });

  socket.on('log', data => {
    io.to(data.room).emit('log', data);
  });
};
