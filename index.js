const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const app = express();

const mongoURI = "mongodb+srv://Smyle:stranac55@cluster0.qnqljpv.mongodb.net/?appName=Cluster0"; 
mongoose.connect(mongoURI).then(() => console.log("Sub-Zero V12: Admin Commands & Fixes Online ❄️"));

app.use(cors());
app.use(express.json());

const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true },
    pureName: { type: String, unique: true },
    password: { type: String },
    color: { type: String },
    isAdmin: { type: Boolean, default: false },
    lastIp: String,
    status: { type: String, default: "User" }
});

const BanSchema = new mongoose.Schema({ ip: String, reason: String });
const MessageSchema = new mongoose.Schema({ 
    user: String, text: String, color: String, time: String, 
    status: String, isSystem: { type: Boolean, default: false },
    isAlert: { type: Boolean, default: false } 
});

const User = mongoose.model('User', UserSchema);
const IPBan = mongoose.model('IPBan', BanSchema);
const Message = mongoose.model('Message', MessageSchema);

async function sysMsg(text, color = "#44ff44", isAlert = false) {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    await Message.create({ user: "SYSTEM", text, color, status: "SYS", time, isSystem: true, isAlert });
}

app.get('/auth', async (req, res) => {
    const { mode, user, pass, cb } = req.query;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const callback = cb || 'authCB';

    const isBanned = await IPBan.findOne({ ip });
    if (isBanned) return res.send(`${callback}({success:false, msg:'IP BANNED'});`);

    if (mode === 'register') {
        try {
            const tag = Math.floor(1000 + Math.random() * 9000).toString();
            const randomColor = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
            await User.create({ username: `${user}#${tag}`, pureName: user.toLowerCase(), password: pass, color: randomColor, lastIp: ip });
            return res.send(`${callback}({success:true, msg:'Created!'});`);
        } catch(e) { return res.send(`${callback}({success:false, msg:'Username taken'});`); }
    } else {
        const found = await User.findOne({ pureName: user?.toLowerCase(), password: pass });
        if (!found) return res.send(`${callback}({success:false, msg:'Login failed'});`);
        
        found.lastIp = ip;
        await found.save();

        if(found.isAdmin) {
            await sysMsg("⚠️ THE ADMIN IS HERE ⚠️", "#ff0000", true);
        } else {
            await sysMsg(`${found.username} joined the room`, "#44ff44");
        }
        
        return res.send(`${callback}({success:true, user: "${found.username}", color: "${found.color}", isAdmin: ${found.isAdmin}, status: "${found.status}", pass: "${found.password}"});`);
    }
});

app.get('/send_safe', async (req, res) => {
    const { user, text, pass } = req.query;
    const sender = await User.findOne({ username: user, password: pass });
    if (!sender) return res.send("console.log('Auth error');");

    // ADMIN BEFEHLE
    if (sender.isAdmin) {
        if (text.startsWith('/ipban ')) {
            const targetName = text.split(' ')[1];
            const targetUser = await User.findOne({ username: targetName });
            if (targetUser) {
                await IPBan.create({ ip: targetUser.lastIp, reason: "Admin" });
                await sysMsg(`${targetName} was IP-Banned.`, "#ff4444");
            }
            return res.send("console.log('Banned');");
        }
        if (text === '/clear') {
            await Message.deleteMany({});
            await sysMsg("Chat cleared by Admin.", "#ffcc00");
            return res.send("console.log('Cleared');");
        }
    }

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    await Message.create({ user, text, color: sender.color, status: sender.status, time });
    return res.send("console.log('Sent');");
});

app.get('/logout_notify', async (req, res) => {
    const { user } = req.query;
    if(user) await sysMsg(`${user} left the room`, "#ff4444");
    res.send("console.log('Logged out');");
});

app.get('/messages_jsonp', async (req, res) => {
    const msgs = await Message.find().sort({ _id: -1 }).limit(50);
    return res.send(`${req.query.callback}(${JSON.stringify(msgs.reverse())});`);
});

app.listen(process.env.PORT || 10000);
