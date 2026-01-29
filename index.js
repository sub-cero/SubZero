const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// Test-Endpunkt
app.get('/check', (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.send('VERBINDUNG_OK');
});

app.get('/', (req, res) => { res.send('SERVER_IS_ALIVE'); });

io.on('connection', (socket) => {
  socket.on('message', (data) => { io.emit('message', data); });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => { console.log('Check-Server online'); });
