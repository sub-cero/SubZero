const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

let messages = [];
let users = {}; 

// --- ADMIN CONFIGURATION ---
// Change "123" to your private master password!
users["admin"] = { password: "123", color: "#ff3333", isAdmin: true };

app.get('/', (req, res) => res.send('SUB_ZERO_V5_STABLE_ONLINE'));

app.get('/check_user', (req, res) => {
    const { user, cb } = req.query;
    res.send(`${cb}({available: ${!users[user]}});`);
});

app.get('/auth', (req, res) => {
    const { mode, user, pass, cb } = req.query;
    if (mode === 'register') {
        if (users[user]) return res.send(`${cb}({success:false, msg:'Username taken'});`);
        users[user] = { password: pass, color: "#00d4ff", isAdmin: false };
        return res.send(`${cb}({success:true, msg:'Account frozen! Please login.'});`);
    } else {
        if (users[user] && users[user].password === pass) {
            return res.send(`${cb}({success:true, user: "${user}", color: "${users[user].color}", isAdmin: ${users[user].isAdmin}});`);
        }
        res.send(`${cb}({success:false, msg:'Wrong credentials'});`);
    }
});

app.get('/messages_jsonp', (req, res) => {
    const callback = req.query.callback || 'displayMessages';
    res.setHeader('Content-Type', 'application/javascript');
    res.send(`${callback}(${JSON.stringify(messages)});`);
});

app.get('/send_safe', (req, res) => {
    const { user, text, color, pass } = req.query;

    // ADMIN COMMANDS
    if (users[user]?.isAdmin && users[user].password === pass) {
        if (text === '/clear') {
            messages = [];
            return res.send("console.log('Chat cleared');");
        }
        if (text === '/reset') {
            messages = [];
            users = { "admin": { password: pass, color: "#ff3333", isAdmin: true } };
            return res.send("console.log('System Hard Reset Done');");
        }
    }

    if (text && users[user] && users[user].password === pass) {
        messages.push({
            user: user,
            text: text,
            color: users[user].isAdmin ? "#ff3333" : (color || "#00d4ff"),
            isAdmin: users[user].isAdmin,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
        if (messages.length > 200) messages.shift();
    }
    res.send("console.log('Processed');");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log('Ice Server V5 Running'));
