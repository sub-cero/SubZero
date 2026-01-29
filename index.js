const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.get('/', (req, res) => {
  res.send('<h1>Server ist Live!</h1>');
});

io.on('connection', (socket) => {
  console.log('User verbunden: ' + socket.id);

  socket.on('message', (data) => {
    // Zeitstempel generieren
    const now = new Date();
    const timeStr = now.getHours().toString().padStart(2, '0') + ":" + 
                    now.getMinutes().toString().padStart(2, '0');
    
    io.emit('message', {
      name: data.name || 'Anonym',
      text: data.text || '',
      color: data.color || '#ffffff',
      time: timeStr
    });
  });

  socket.on('disconnect', () => {
    console.log('User getrennt');
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log('Server läuft auf Port ' + PORT);
});
