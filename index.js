const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const app = express();

const mongoURI = "mongodb+srv://Smyle:stranac55@cluster0.qnqljpv.mongodb.net/?appName=Cluster0"; 
mongoose.connect(mongoURI).then(() => console.log("Sub-Zero V9.2: Fixed & Online ❄️"));

app.use(cors());
app.use(express.json());

const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true },
    pureName: { type: String, unique: true },
    password: { type: String },
    color: { type: String },
    isAdmin: { type: Boolean, default: false },
    isBanned: { type: Boolean, default: false },
    banReason: { type: String, default: "" },
    status: { type: String, default: "Newbie" },
    tag: String
});

const MessageSchema = new mongoose.Schema({
    user: String, text: String, color: String, time: String, status: String
});

const User = mongoose.model('User', UserSchema);
const Message = mongoose.model('Message', MessageSchema);

app.get('/check_user', async (req, res) => {
    const exists = await User.findOne({ pureName: req.query.user?.trim() });
    return res.send(`${req.query.cb || 'console.log'}({available: ${!exists}});`);
});

app.get('/auth', async (req, res) => {
    const { mode, user, pass, cb } = req.query;
    const callback = cb || 'authCB';
    if (mode === 'register') {
        try {
            const tag = Math.floor(1000 + Math.random() * 9000).toString();
            await User.create({ username: `${user.trim()}#${tag}`, pureName: user.trim(), password: pass, tag: tag, color: "#00d4ff" });
            return res.send(`${callback}({success:true, msg:'Account created! ID: #${tag}'});`);
        } catch(e) { return res.send(`${callback}({success:false, msg:'Username taken'});`); }
    } else {
        const found = await User.findOne({ pureName: user?.trim(), password: pass });
        if (!found) return res.send(`${callback}({success:false, msg:'Invalid Login'});`);
        if (found.isBanned) return res.send(`${callback}({isBanned: true, reason: "${found.banReason}"});`);
        return res.send(`${callback}({success:true, user: "${found.username}", color: "${found.isAdmin ? '#ff3333' : found.color}", isAdmin: ${found.isAdmin}, status: "${found.status}"});`);
    }
});

app.get('/messages_jsonp', async (req, res) => {
    const { callback = 'displayMessages', user } = req.query;
    if (user) {
        const check = await User.findOne({ username: user });
        if (check && check.isBanned) return res.send(`showBanScreen("${check.banReason}");`);
    }
    const msgs = await Message.find().sort({ _id: -1 }).limit(50);
    return res.send(`${callback}(${JSON.stringify(msgs.reverse())});`);
});

app.get('/send_safe', async (req, res) => {
    const { user, text, pass } = req.query;
    const sender = await User.findOne({ username: user, password: pass });
    if (!sender || sender.isBanned) return res.send("showBanScreen();");

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (text.startsWith('/')) {
        const p = text.split(' ');
        if (sender.isAdmin && p[0] === '/clear') await Message.deleteMany({});
        return res.send("console.log('Command Processed');");
    }

    await Message.create({ user, text, color: sender.isAdmin ? "#ff3333" : sender.color, status: sender.status, time });
    return res.send("console.log('Sent');");
});

app.listen(process.env.PORT || 10000, '0.0.0.0');
