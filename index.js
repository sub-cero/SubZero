const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const app = express();

const mongoURI = "mongodb+srv://Smyle:stranac55@cluster0.qnqljpv.mongodb.net/?appName=Cluster0"; 
mongoose.connect(mongoURI).then(() => console.log("Sub-Zero V8.1: API Online ❄️"));

app.use(cors());
app.use(express.json());

const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true },
    pureName: { type: String, unique: true },
    password: { type: String },
    color: { type: String, default: "#00d4ff" },
    isAdmin: { type: Boolean, default: false },
    isBanned: { type: Boolean, default: false },
    banReason: { type: String, default: "" },
    status: { type: String, default: "Newbie" },
    tag: String,
    lastMsgTime: { type: Number, default: 0 }
});

const MessageSchema = new mongoose.Schema({
    user: String, text: String, color: String, time: String, 
    isAdmin: Boolean, status: String
});

const User = mongoose.model('User', UserSchema);
const Message = mongoose.model('Message', MessageSchema);

app.get('/', (req, res) => res.send("API ACTIVE"));

app.get('/check_user', async (req, res) => {
    const cb = req.query.cb || 'console.log';
    const exists = await User.findOne({ pureName: req.query.user.trim() });
    res.send(`${cb}({available: ${!exists}});`);
});

app.get('/auth', async (req, res) => {
    const { mode, user, pass, cb } = req.query;
    const callback = cb || 'authCB';
    if (mode === 'register') {
        try {
            const tag = Math.floor(1000 + Math.random() * 9000).toString();
            await User.create({ username: `${user.trim()}#${tag}`, pureName: user.trim(), password: pass, tag: tag });
            res.send(`${callback}({success:true, msg:'Registered! ID: #${tag}'});`);
        } catch(e) { res.send(`${callback}({success:false, msg:'Username taken'});`); }
    } else {
        const found = await User.findOne({ pureName: user.trim(), password: pass });
        if (!found) return res.send(`${callback}({success:false, msg:'Invalid credentials'});`);
        if (found.isBanned) return res.send(`${callback}({isBanned: true, reason: "${found.banReason}"});`);
        res.send(`${callback}({success:true, user: "${found.username}", color: "${found.color}", isAdmin: ${found.isAdmin}, status: "${found.status}"});`);
    }
});

app.get('/messages_jsonp', async (req, res) => {
    const { callback = 'displayMessages', user } = req.query;
    if (user) {
        const check = await User.findOne({ username: user });
        if (check && check.isBanned) return res.send(`showBanScreen("${check.banReason}");`);
        if (check && !check.isBanned) res.send(`hideBanScreen();`);
    }
    const msgs = await Message.find().sort({ _id: -1 }).limit(50);
    res.send(`${callback}(${JSON.stringify(msgs.reverse())});`);
});

app.get('/send_safe', async (req, res) => {
    const { user, text, color, pass } = req.query;
    const sender = await User.findOne({ username: user, password: pass });
    if (!sender || sender.isBanned) return res.send("showBanScreen();");

    const now = Date.now();
    if (!sender.isAdmin && now - sender.lastMsgTime < 3000) return res.send("alert('Slow mode! 3s');");

    if (text.startsWith('/')) {
        const p = text.split(' ');
        if (p[0] === '/status') { sender.status = p.slice(1).join(' ').substring(0, 20); await sender.save(); }
        if (sender.isAdmin) {
            if (p[0] === '/ban') await User.findOneAndUpdate({ tag: p[1] }, { isBanned: true, banReason: p.slice(2).join(' ') || "No reason" });
            if (p[0] === '/unban') await User.findOneAndUpdate({ tag: p[1] }, { isBanned: false });
            if (p[0] === '/clear') await Message.deleteMany({});
        }
        return res.send("console.log('Action done');");
    }

    sender.lastMsgTime = now; await sender.save();
    await Message.create({
        user: user, text: text, color: sender.isAdmin ? "#ff3333" : color,
        isAdmin: sender.isAdmin, status: sender.status,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    res.send("console.log('Sent');");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0');
