const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

let messages = [];
let users = {}; // Format: { "username": { password: "123", color: "#0f0", isAdmin: false } }

// Admin direkt anlegen (Ändere hier dein Passwort!)
users["admin"] = { password: "dein_geheimes_passwort", color: "#ff0000", isAdmin: true };

app.get('/', (req, res) => res.send('MATRIX_SERVER_V2_ONLINE'));

// Registrierung & Login via JSONP
app.get('/auth', (req, res) => {
    const { mode, user, pass, cb } = req.query;
    if (mode === 'register') {
        if (users[user]) return res.send(`${cb}({success:false, msg:'Name vergeben'});`);
        users[user] = { password: pass, color: "#00ff00", isAdmin: false };
        return res.send(`${cb}({success:true, msg:'Registriert!'});`);
    } else {
        if (users[user] && users[user].password === pass) {
            return res.send(`${cb}({success:true, user: "${user}", color: "${users[user].color}", isAdmin: ${users[user].isAdmin}});`);
        }
        res.send(`${cb}({success:false, msg:'Daten falsch'});`);
    }
});

app.get('/messages_jsonp', (req, res) => {
    const callback = req.query.callback || 'displayMessages';
    res.setHeader('Content-Type', 'application/javascript');
    res.send(`${callback}(${JSON.stringify(messages)});`);
});

app.get('/send_safe', (req, res) => {
    const { user, text, color, pass } = req.query;
    
    // Admin Clear Befehl
    if (text === '/clear' && users[user] && users[user].isAdmin && users[user].password === pass) {
        messages = [];
        return res.send("console.log('Cleared');");
    }

    if (text && users[user] && users[user].password === pass) {
        messages.push({
            user: user,
            text: text,
            color: users[user].isAdmin ? "#ff0000" : (color || "#0f0"),
            isAdmin: users[user].isAdmin,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
        if (messages.length > 50) messages.shift();
    }
    res.send("console.log('OK');");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log('Server V2 läuft!'));
