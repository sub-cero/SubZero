const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http, {
  cors: {
    origin: "*", // Erlaubt Neocities den Zugriff
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  socket.on('message', (data) => {
    io.emit('message', data);
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log('Server läuft auf Port ' + PORT);
});
