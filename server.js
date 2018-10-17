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

// Socket.io setup
io.on('connection', client => {
  console.log(`Client connected: ${client.id}`);

  require('./socketRoutes')(io, client);
});

const port = process.env.PORT || 3000;
server.listen(port, console.log(`Server started on port ${port}`));
