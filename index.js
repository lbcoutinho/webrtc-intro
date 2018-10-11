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

// Express routes
app.get('/intro', (req, res) => {
  res.render('intro/intro.html');
});

app.get('/', (req, res) => {
  res.render('index.html');
});

// Socket.io setup
io.on('connection', client => {
  console.log(`Client connected: ${client.id}`);

  client.on('join-room', room => {
    console.log(`join-room: ${room}`);

    client.join(room, () => {
      console.log('client rooms = ', client.rooms);
      io.to(room).emit('new-client', `New client in the room ${room}.`);
    });
  });

  client.on('send', data => {
    io.to(data.room).emit('message', data);
  });
});

const port = 3000;
server.listen(port, console.log(`Server started on port ${port}`));
