const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, {
  cors: {
    origin: "*", // Erlaubt JEDER Seite den Zugriff
    methods: ["GET", "POST"],
    transports: ['websocket', 'polling'],
    credentials: true
  },
  allowEIO3: true // WICHTIG: Erlaubt ältere Verbindungsarten (oft bei Handys nötig)
});

app.get('/', (req, res) => {
  res.send('<h1>Server ist aktiv!</h1>');
});

io.on('connection', (socket) => {
  console.log('Nutzer verbunden');
  socket.on('message', (data) => {
    io.emit('message', data);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('Server läuft auf Port ' + PORT);
});
