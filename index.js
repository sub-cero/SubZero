const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());

let messages = [];

app.get('/', (req, res) => res.send('SERVER_IS_ALIVE'));

app.get('/messages', (req, res) => {
    res.json(messages);
});

// Der JSONP-Sender: Safari denkt, es lädt nur ein Script
app.get('/send_safe', (req, res) => {
    const { user, text } = req.query;
    if (text) {
        messages.push({
            user: user || "User",
            text: text,
            time: new Date().toLocaleTimeString()
        });
        if (messages.length > 50) messages.shift();
    }
    // Wir schicken gültigen JavaScript-Code zurück, damit Safari zufrieden ist
    res.send("console.log('Message received');");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log('Safe-Server Online'));
