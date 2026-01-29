const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http, {
  cors: {
    origin: "*", // Erlaubt deiner Neocities-Seite den Zugriff
    methods: ["GET", "POST"]
  }
});

// Was passiert, wenn jemand den Chat betritt?
io.on('connection', (socket) => {
  console.log('Ein Nutzer ist verbunden');

  // Wenn eine Nachricht reinkommt...
  socket.on('message', (data) => {
    // ...schicke sie sofort an ALLE verbundenen Nutzer weiter
    io.emit('message', data);
  });

  socket.on('disconnect', () => {
    console.log('Ein Nutzer hat den Chat verlassen');
  });
});

// Der Port wird von Render automatisch zugewiesen
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log('Server läuft auf Port ' + PORT);
});
