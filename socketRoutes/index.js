module.exports = (io, socket) => {
  socket.on('join-room', room => {

    socket.join(room, () => {
      io.to(room).emit('new-client', `New client in the room ${room}.`);
    });
  });

  socket.on('send', data => {
    io.to(data.room).emit('message', data);
  });

  socket.on('start-signaling', data => {
    // Use socket.to so all clients in the room receive the message except the sender
    socket.to(data.room).emit('start-signaling-received', data);
  });

  socket.on('new-ice-candidate', data => {
    socket.to(data.room).emit('ice-candidate-received', data);
  });

  socket.on('sdp-offer', data => {
    socket.to(data.room).emit('sdp-offer-received', data);
  });

  // socket.on('signal', data => {
  //   socket.to(data.room).emit('signaling-message', data);
  // });

  socket.on('log', data => {
    io.to(data.room).emit('log', data);
  })
}