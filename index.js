const express = require('express');
const app = express();
const server = require('http').createServer(app);

const io = require('socket.io')(server, {
  cors: {
    origin: true, // Akzeptiert die anfragende Domain automatisch
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"]
  }
});

// Diese Header sind für Safari lebenswichtig
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.header('origin'));
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,POST');
  next();
});

app.get('/check', (req, res) => {
  res.send('VERBINDUNG_OK');
});

app.get('/', (req, res) => { res.send('SERVER_IS_ALIVE'); });

io.on('connection', (socket) => {
  socket.on('message', (data) => { io.emit('message', data); });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => { console.log('Tunnel online'); });
