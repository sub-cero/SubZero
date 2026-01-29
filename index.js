const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

let messages = [];

// Kontroll-Link: https://subzero-hc18.onrender.com/
app.get('/', (req, res) => res.send('SERVER_IS_ALIVE'));

// Nachrichten abrufen
app.get('/messages', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.json(messages);
});

// Nachricht empfangen (Tarnkappen-Technik für Safari)
app.get('/send_safe', (req, res) => {
    const { user, text } = req.query;
    if (text) {
        messages.push({
            user: user || "User",
            text: text,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
        // Speicherlimit: Nur die letzten 50 Nachrichten behalten
        if (messages.length > 50) messages.shift();
    }
    res.send("console.log('OK');");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log('Server online!'));
