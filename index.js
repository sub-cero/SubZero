const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http, {
  cors: {
    origin: "*", // Erlaubt Neocities den Zugriff
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Bestätigungsseite für den Browser
app.get('/', (req, res) => {
  res.send('<h1>Subzero Chat-Server ist ONLINE</h1>');
});

io.on('connection', (socket) => {
  console.log('Ein Nutzer hat sich verbunden');

  socket.on('message', (data) => {
    // Schickt die Nachricht an alle (auch an dich selbst)
    io.emit('message', {
      name: data.name,
      text: data.text,
      color: data.color,
      time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
    });
  });

  socket.on('disconnect', () => {
    console.log('Ein Nutzer ist gegangen');
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log('Server läuft auf Port ' + PORT);
});
