const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const path = require('path');

// Public folder and HTML render engine setup
app.use(express.static(path.join(__dirname, 'public')));
app.set('views', path.join(__dirname, 'public'));
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');

require('./routes')(app);

let users = [];
let allSockets = [];

// Socket.io setup
io.on('connection', client => {
  const username = client.handshake.query.username;
  users.push({ id: client.id, username });
  allSockets.push(client);

  console.log(`\nClient connected: ${username}`);
  sendUsersList();

  // Remove socket from users' list on disconnect
  client.on('disconnect', reason => {
    users = users.filter(({ id }) => id != client.id);
    allSockets = allSockets.filter(({ id }) => id != client.id);

    console.log(`\nClient disconnected: ${username} (reason: ${reason})`);
    sendUsersList();
  });

  require('./socketRoutes')(io, client, allSockets);
});

const port = process.env.PORT || 3000;
server.listen(port, console.log(`Server started on port ${port}`));

function sendUsersList() {
  if (users.length) {
    console.log('Online users:');
    users.forEach(({ id, username }) =>
      console.log(`id=${id}, username=${username}`)
    );
  } else {
    console.log('No online users');
  }

  // Send updated list of users to all connected sockets
  io.sockets.emit('users-list-update', users);
}
