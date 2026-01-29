const express = require('express');
const app = express();
const server = require('http').createServer(app);

// Maximale Freiheit für die Verbindung von Neocities
const io = require('socket.io')(server, {
  cors: {
    origin: "*", // Erlaubt JEDER Seite (auch Neocities) den Zugriff
    methods: ["GET", "POST"],
    allowedHeaders: ["my-custom-header"],
    credentials: true
  },
  allowEIO3: true, // Abwärtskompatibilität für mobile Browser
  transports: ['polling', 'websocket']
});

app.get('/', (req, res) => {
  res.send('SERVER_IS_ALIVE');
});

io.on('connection', (socket) => {
  console.log('Verbindung hergestellt: ' + socket.id);
  
  socket.on('message', (data) => {
    io.emit('message', {
      user: data.user || 'User',
      text: data.text,
      color: data.color || '#fff',
      time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
    });
  });
});

// Port-Zuweisung für Render
const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('Chat-Server läuft auf Port ' + PORT);
});
