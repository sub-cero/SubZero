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
  res.send('Server ist bereit!');
});

io.on('connection', (socket) => {
  socket.on('message', (data) => {
    io.emit('message', {
      name: data.name,
      text: data.text,
      color: data.color
    });
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log('Server läuft auf Port ' + PORT);
});
