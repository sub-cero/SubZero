const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ['polling', 'websocket'] 
});

app.get('/', (req, res) => {
  res.send('SERVER_IS_ALIVE');
});

io.on('connection', (socket) => {
  console.log('Verbunden: ' + socket.id);
  socket.on('message', (data) => {
    io.emit('message', data);
  });
});

// Port-Fix für Render
const PORT = process.env.PORT || 10000; 
server.listen(PORT, '0.0.0.0', () => {
  console.log('Server läuft auf Port ' + PORT);
});
