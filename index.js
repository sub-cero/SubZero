const express = require('express');
const app = express();
const server = require('http').createServer(app);

const io = require('socket.io')(server, {
  cors: {
    origin: "*", // Erlaubt Zugriff von überall
    methods: ["GET", "POST"]
  }
});

app.get('/', (req, res) => {
  res.send('SERVER_IS_ALIVE');
});

io.on('connection', (socket) => {
  console.log('User connected: ' + socket.id);
  socket.on('message', (data) => {
    io.emit('message', data);
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('Running on port ' + PORT);
});
