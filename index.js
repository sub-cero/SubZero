const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"],
    credentials: true
  },
  allowEIO3: true 
});

// Test-Seite
app.get('/', (req, res) => {
  res.send('<h1>Server Status: ONLINE</h1><p>Wenn du das siehst, läuft der Server!</p>');
});

io.on('connection', (socket) => {
  console.log('Ein User ist verbunden: ' + socket.id);
  
  socket.on('message', (data) => {
    io.emit('message', data);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('Server läuft auf Port ' + PORT);
});
