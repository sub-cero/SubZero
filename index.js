const express = require('express');
const cors = require('cors');
const app = express();
const server = require('http').createServer(app);

// Erlaubt den Zugriff von Neocities
app.use(cors({
    origin: "*",
    methods: ["GET", "POST"]
}));

// WICHTIG: Erlaubt dem Server, JSON-Daten zu lesen
app.use(express.json());

let messages = [];

// Kontroll-Seite
app.get('/', (req, res) => {
    res.send('SERVER_IS_RUNNING_WELL');
});

// Nachrichten abrufen
app.get('/messages', (req, res) => {
    res.json(messages);
});

// Nachricht empfangen
app.post('/send', (req, res) => {
    try {
        const { user, text } = req.body;
        
        if (!text) {
            return res.status(400).json({ success: false, error: "Kein Text" });
        }

        const newMessage = {
            user: user || "User",
            text: text,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        messages.push(newMessage);
        if (messages.length > 50) messages.shift();

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: "Server-Fehler" });
    }
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => {
    console.log('Server aktiv auf Port ' + PORT);
});
