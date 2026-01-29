const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http, {
  cors: {
    origin: "*", // Erlaubt Neocities den Zugriff
    methods: ["GET", "POST"]
  }
});

// NEU: Diese Zeile löst das "CAN NOT GET /"
app.get('/', (req, res) => {
  res.send('<h1>Subzero Chat-Server ist ONLINE!</h1><p>Du kannst dieses Fenster jetzt schliessen und den Chat auf Neocities nutzen.</p>');
});

io.on('connection', (socket) => {
  console.log('Ein Nutzer ist verbunden');
  socket.on('message', (data) => {
    io.emit('message', data);
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log('Server läuft auf Port ' + PORT);
});
