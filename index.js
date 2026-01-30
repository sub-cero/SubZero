const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const app = express();

const mongoURI = "mongodb+srv://Smyle:stranac55@cluster0.qnqljpv.mongodb.net/?appName=Cluster0"; 
mongoose.connect(mongoURI).then(() => console.log("Sub-Zero V8.6: Messages Fixed ❄️"));

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

function getRandomIceColor() {
    const colors = ["#00d4ff", "#00ffcc", "#0080ff", "#00ffff", "#a0fbff", "#44ff44", "#ffff00", "#ff00ff"];
    return colors[Math.floor(Math.random() * colors.length)];
}

app.get('/check_user', async (req, res) => {
    const exists = await User.findOne({ pureName: req.query.user?.trim() });
    res.send(`${req.query.cb || 'console.log'}({available: ${!exists}});`);
});

app.get('/auth', async (req, res) => {
    const { mode, user, pass, cb } = req.query;
    const callback = cb || 'authCB';
    if (mode === 'register') {
        try {
            const tag = Math.floor(1000 + Math.random() * 9000).toString();
            await User.create({ username: `${user.trim()}#${tag}`, pureName: user.trim(), password: pass, tag: tag, color: getRandomIceColor() });
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
    const dataString = JSON.stringify(msgs.reverse());
    res.send(`${callback}(${dataString});`);
});

app.get('/send_safe', async (req, res) => {
    const { user, text, pass } = req.query;
    const sender = await User.findOne({ username: user, password: pass });
    if (!sender || sender.isBanned) return res.send("showBanScreen();");

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (text.startsWith('/')) {
        const p = text.split(' ');
        let sMsg = "";
        if (p[0] === '/status') { sender.status = p.slice(1).join(' ').substring(0, 20); await sender.save(); sMsg = "Status updated"; }
        if (sender.isAdmin) {
            if (p[0] === '/ban') { await User.findOneAndUpdate({ tag: p[1] }, { isBanned: true, banReason: p.slice(2).join(' ') }); sMsg = "User banned"; }
            if (p[0] === '/unban') { await User.findOneAndUpdate({ tag: p[1] }, { isBanned: false }); sMsg = "User unbanned"; }
            if (p[0] === '/clear') { await Message.deleteMany({}); sMsg = "Chat cleared"; }
        }
        if(sMsg) await Message.create({ user: "SYSTEM", text: sMsg, color: "#ffff00", time, status: "SYS" });
        return res.send("console.log('OK');");
    }

    await Message.create({ user, text, color: sender.isAdmin ? "#ff3333" : sender.color, status: sender.status, time });
    res.send("console.log('Sent');");
});

app.listen(process.env.PORT || 10000, '0.0.0.0');
