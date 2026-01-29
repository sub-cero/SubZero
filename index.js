const express = require('express');
const cors = require('cors');
const app = express();

// Wir erlauben ALLES, damit Safari nicht meckert
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let messages = [];

app.get('/', (req, res) => {
    res.send('SERVER_IS_RUNNING_WELL');
});

app.get('/messages', (req, res) => {
    res.json(messages);
});

// Wir fügen eine GET-Variante zum Senden hinzu (Safari blockiert GET fast nie)
app.get('/send_get', (req, res) => {
    const { user, text } = req.query;
    if (text) {
        messages.push({
            user: user || "User",
            text: text,
            time: new Date().toLocaleTimeString()
        });
        if (messages.length > 50) messages.shift();
        return res.send("OK");
    }
    res.send("FEHLER");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log('Server läuft auf Port ' + PORT);
});
