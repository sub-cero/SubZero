const express = require('express');
const cors = require('cors');
const app = express();

// CORS so einstellen, dass es POST-Anfragen von überall erlaubt
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let messages = [];

// Route zum Senden
app.post('/send', (req, res) => {
    console.log("Nachricht empfangen:", req.body);
    if (req.body && req.body.text) {
        const msg = { 
            user: req.body.user || 'User', 
            text: req.body.text, 
            time: new Date().toLocaleTimeString() 
        };
        messages.push(msg);
        if (messages.length > 50) messages.shift();
        return res.status(200).json({ success: true });
    }
    res.status(400).json({ success: false, error: 'Kein Text' });
});

// Route zum Laden
app.get('/messages', (req, res) => {
    res.json(messages);
});

app.get('/', (req, res) => res.send('SERVER_IS_ALIVE'));

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log('HTTP Server läuft auf ' + PORT));
