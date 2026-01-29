const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.get('/', (req, res) => {
  res.send('Chat-Server aktiv!');
});

io.on('connection', (socket) => {
  socket.on('message', (data) => {
    // Wir senden die Daten 1:1 an alle zurück
    io.emit('message', data);
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log('Server läuft auf Port ' + PORT);
});
