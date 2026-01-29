const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

let messages = [];
let users = {}; 

// Admin Account - ÄNDERE DAS PASSWORT!
users["admin"] = { password: "123", color: "#ff0000", isAdmin: true };

app.get('/', (req, res) => res.send('SUB_ZERO_SERVER_V3_COLD'));

app.get('/auth', (req, res) => {
    const { mode, user, pass, cb } = req.query;
    if (!user || !pass) return res.send(`${cb}({success:false, msg:'Input fehlt'});`);
    
    if (mode === 'register') {
        if (users[user]) return res.send(`${cb}({success:false, msg:'Name besetzt'});`);
        users[user] = { password: pass, color: "#00d4ff", isAdmin: false };
        return res.send(`${cb}({success:true, msg:'Eingefroren! Log dich ein.'});`);
    } else {
        if (users[user] && users[user].password === pass) {
            return res.send(`${cb}({success:true, user: "${user}", color: "${users[user].color}", isAdmin: ${users[user].isAdmin}});`);
        }
        res.send(`${cb}({success:false, msg:'Zugriff verweigert'});`);
    }
});

app.get('/messages_jsonp', (req, res) => {
    const callback = req.query.callback || 'displayMessages';
    res.setHeader('Content-Type', 'application/javascript');
    res.send(`${callback}(${JSON.stringify(messages)});`);
});

app.get('/send_safe', (req, res) => {
    const { user, text, color, pass } = req.query;
    
    if (text === '/clear' && users[user]?.isAdmin && users[user].password === pass) {
        messages = [];
        return res.send("console.log('Ice Melted');");
    }

    if (text && users[user] && users[user].password === pass) {
        messages.push({
            user: user,
            text: text,
            color: users[user].isAdmin ? "#ff3333" : (color || "#00d4ff"),
            isAdmin: users[user].isAdmin,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
        if (messages.length > 100) messages.shift();
    }
    res.send("console.log('Crystalized');");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log('Ice Server Live'));
