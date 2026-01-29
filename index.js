const express = require('express');
const app = express();
const server = require('http').createServer(app);

// Socket.io Setup mit expliziten CORS-Regeln für Neocities
const io = require('socket.io')(server, {
  cors: {
    origin: ["https://lachelmann.neocities.org", "http://lachelmann.neocities.org"],
    methods: ["GET", "POST"],
    credentials: true
  },
  allowEIO3: true // Wichtig für Kompatibilität mit mobilen Browsern
});

app.get('/', (req, res) => {
  res.send('SERVER_IS_ALIVE');
});

io.on('connection', (socket) => {
  console.log('User verbunden: ' + socket.id);
  
  socket.on('message', (data) => {
    // Zeitstempel hinzufügen
    const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    io.emit('message', {
      user: data.user || 'Anonym',
      text: data.text,
      color: data.color || '#fff',
      time: time
    });
  });
});

// Render nutzt oft Port 10000 oder den zugewiesenen PORT
const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('Server läuft auf Port ' + PORT);
});
