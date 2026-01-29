const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

let messages = [];

app.get('/', (req, res) => res.send('SERVER_IS_ALIVE'));

// NEU: Diese Route tarnt die Nachrichtenliste als JavaScript-Datei
app.get('/messages_jsonp', (req, res) => {
    const callback = req.query.callback || 'displayMessages';
    res.setHeader('Content-Type', 'application/javascript');
    res.send(`${callback}(${JSON.stringify(messages)});`);
});

app.get('/send_safe', (req, res) => {
    const { user, text } = req.query;
    if (text) {
        messages.push({
            user: user || "iPhone",
            text: text,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
        if (messages.length > 50) messages.shift();
    }
    res.send("console.log('Sent');");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log('Matrix Server Online'));
