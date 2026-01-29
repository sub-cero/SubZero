const express = require('express');
const app = express();
const server = require('http').createServer(app);

// WICHTIG: Die CORS-Einstellungen müssen GENAU so hier stehen
const io = require('socket.io')(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"],
    credentials: true
  },
  allowEIO3: true
});

app.get('/', (req, res) => {
  res.send('SERVER_IS_ALIVE');
});

io.on('connection', (socket) => {
  console.log('User verbunden: ' + socket.id);
  socket.on('message', (data) => {
    io.emit('message', data);
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('Server läuft auf Port ' + PORT);
});
