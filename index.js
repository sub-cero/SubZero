const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const app = express();

const mongoURI = "mongodb+srv://Smyle:stranac55@cluster0.qnqljpv.mongodb.net/?appName=Cluster0"; 
mongoose.connect(mongoURI).then(() => console.log("Sub-Zero V9.5: Color & System Messages Online ❄️"));

app.use(cors());
app.use(express.json());

const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true },
    pureName: { type: String, unique: true },
    password: { type: String },
    color: { type: String },
    isAdmin: { type: Boolean, default: false },
    isBanned: { type: Boolean, default: false },
    status: { type: String, default: "User" },
    tag: String
});

const MessageSchema = new mongoose.Schema({
    user: String, text: String, color: String, time: String, status: String, isSystem: { type: Boolean, default: false }
});

const User = mongoose.model('User', UserSchema);
const Message = mongoose.model('Message', MessageSchema);

// Hilfsfunktion für System-Nachrichten
async function sendSystemMsg(text) {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    await Message.create({ user: "SYSTEM", text, color: "#44ff44", status: "SYS", time, isSystem: true });
}

app.get('/auth', async (req, res) => {
    const { mode, user, pass, cb } = req.query;
    const callback = cb || 'authCB';
    
    if (mode === 'register') {
        try {
            const tag = Math.floor(1000 + Math.random() * 9000).toString();
            // Zufällige helle Farbe generieren
            const randomColor = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
            await User.create({ username: `${user.trim()}#${tag}`, pureName: user.trim(), password: pass, tag: tag, color: randomColor });
            return res.send(`${callback}({success:true, msg:'Account created!'});`);
        } catch(e) { return res.send(`${callback}({success:false, msg:'Username taken'});`); }
    } else {
        const found = await User.findOne({ pureName: user?.trim(), password: pass });
        if (!found) return res.send(`${callback}({success:false, msg:'Invalid Login'});`);
        if (found.isBanned) return res.send(`${callback}({isBanned: true});`);
        
        // System-Nachricht beim Joinen
        await sendSystemMsg(`${found.username} joined the room`);
        
        return res.send(`${callback}({success:true, user: "${found.username}", color: "${found.color}", isAdmin: ${found.isAdmin}, status: "${found.status}", pass: "${found.password}"});`);
    }
});

// Logout-Endpunkt für "Left the room"
app.get('/logout_notify', async (req, res) => {
    const { user } = req.query;
    if(user) await sendSystemMsg(`${user} left the room`);
    res.send("console.log('Logged out');");
});

app.get('/messages_jsonp', async (req, res) => {
    const msgs = await Message.find().sort({ _id: -1 }).limit(50);
    res.send(`${req.query.callback}(${JSON.stringify(msgs.reverse())});`);
});

app.get('/send_safe', async (req, res) => {
    const { user, text, pass } = req.query;
    const sender = await User.findOne({ username: user, password: pass });
    if (!sender) return res.send("console.log('Auth Error');");
    
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    await Message.create({ user, text, color: sender.color, status: sender.status, time });
    res.send("console.log('Sent');");
});

app.listen(process.env.PORT || 10000, '0.0.0.0');
