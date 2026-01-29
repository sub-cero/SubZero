const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"],
    allowedHeaders: ["*"],
    credentials: true
  },
  allowEIO3: true // Wichtig für ältere Browser/iPads
});

app.get('/', (req, res) => {
  res.send('Server aktiv!');
});

io.on('connection', (socket) => {
  socket.on('message', (data) => {
    const timeStr = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    io.emit('message', {
      name: data.name,
      text: data.text,
      color: data.color,
      time: timeStr
    });
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log('Server läuft!');
});
