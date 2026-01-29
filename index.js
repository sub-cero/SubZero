const express = require('express');
const cors = require('cors');
const app = express();
const server = require('http').createServer(app);

app.use(cors());
app.use(express.json());

let messages = [];

// Route zum Nachrichten senden
app.post('/send', (req, res) => {
    const msg = { 
        user: req.body.user || 'User', 
        text: req.body.text, 
        time: new Date().toLocaleTimeString() 
    };
    messages.push(msg);
    if (messages.length > 50) messages.shift(); // Nur die letzten 50 behalten
    res.json({ success: true });
});

// Route zum Nachrichten empfangen
app.get('/messages', (req, res) => {
    res.json(messages);
});

app.get('/', (req, res) => res.send('SERVER_IS_ALIVE'));

const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => console.log('HTTP Chat Online'));
