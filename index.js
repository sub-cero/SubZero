const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const app = express();

const mongoURI = "mongodb+srv://Smyle:stranac55@cluster0.qnqljpv.mongodb.net/?appName=Cluster0"; 
mongoose.connect(mongoURI).then(() => console.log("Sub-Zero V15: Admin Power + Dots Online 🛡️"));

app.use(cors());
app.use(express.json());

const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true },
    pureName: { type: String, unique: true },
    password: { type: String },
    color: { type: String },
    isAdmin: { type: Boolean, default: false },
    isBanned: { type: Boolean, default: false },
    lastIp: String,
    status: { type: String, default: "User" }
});

const BanSchema = new mongoose.Schema({ ip: String });
const MessageSchema = new mongoose.Schema({ 
    user: String, text: String, color: String, time: String, 
    status: String, 
    room: { type: String, default: "Main" },
    isSystem: { type: Boolean, default: false },
    isAlert: { type: Boolean, default: false },
    isReset: { type: Boolean, default: false },
    forUser: { type: String, default: null } 
});

const User = mongoose.model('User', UserSchema);
const IPBan = mongoose.model('IPBan', BanSchema);
const Message = mongoose.model('Message', MessageSchema);

async function sysMsg(text, color = "#44ff44", isAlert = false, forUser = null, isReset = false, room = "Main") {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    await Message.create({ user: "SYSTEM", text, color, status: "SYS", time, isSystem: true, isAlert, forUser, isReset, room });
}

app.get('/logout_notify', async (req, res) => {
    const { user, room } = req.query;
    if (user) await sysMsg(`${user} left the room.`, "#ff4444", false, null, false, room || "Main");
    res.send("console.log('Logout logged');");
});

app.get('/auth', async (req, res) => {
    const { mode, user, pass, cb } = req.query;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const callback = cb || 'authCB';
    const ipBanned = await IPBan.findOne({ ip });
    if (ipBanned) return res.send(`${callback}({success:false, msg:'IP_BANNED'});`);
    if (mode === 'register') {
        try {
            const tag = Math.floor(1000 + Math.random() * 9000).toString();
            const randomColor = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
            await User.create({ username: `${user.trim()}#${tag}`, pureName: user.trim().toLowerCase(), password: pass, color: randomColor, lastIp: ip });
            return res.send(`${callback}({success:true, msg:'Created!'});`);
        } catch(e) { return res.send(`${callback}({success:false, msg:'Username taken'});`); }
    } else {
        const found = await User.findOne({ pureName: user?.trim().toLowerCase(), password: pass });
        if (!found) return res.send(`${callback}({success:false, msg:'Login failed'});`);
        if (found.isBanned && !found.isAdmin) return res.send(`${callback}({success:false, msg:'USER_BANNED'});`);
        found.lastIp = ip;
        await found.save();
        await sysMsg(found.isAdmin ? "⚠️ THE ADMIN IS HERE ⚠️" : `${found.username} joined`, found.isAdmin ? "#ff0000" : "#44ff44", found.isAdmin);
        return res.send(`${callback}({success:true, user: "${found.username}", color: "${found.color}", isAdmin: ${found.isAdmin}, status: "${found.status}", pass: "${found.password}"});`);
    }
});

app.get('/delete', async (req, res) => {
    const { id, user, pass } = req.query;
    const admin = await User.findOne({ username: user, password: pass, isAdmin: true });
    if (admin) {
        await Message.findByIdAndDelete(id);
        res.send("console.log('Deleted');");
    } else {
        res.send("console.log('Unauthorized');");
    }
});

app.get('/send_safe', async (req, res) => {
    const { user, text, pass, room } = req.query;
    const currentRoom = room || "Main";
    const sender = await User.findOne({ username: user, password: pass });
    if (!sender) return res.send("console.log('Auth error');");
    if (sender.isAdmin && text.startsWith('/')) {
        const args = text.split(' ');
        const cmd = args[0];
        if (cmd === '/help') {
            const helpText = "Commands: /clear, /ban [ID] [Reason], /ipban [ID], /unban [ID/IP], /reset";
            await sysMsg(helpText, "#00d4ff", false, user, false, currentRoom);
            return res.send("console.log('Help sent');");
        }
        if (cmd === '/clear') {
            await Message.deleteMany({ room: currentRoom });
            await sysMsg("Chat cleared by Admin", "#ffff00", false, null, false, currentRoom);
            return res.send("console.log('Cleared');");
        }
        if (cmd === '/ban' || cmd === '/ipban') {
            const targetId = args[1];
            const reason = args.slice(2).join(' ') || "No reason provided";
            const target = await User.findOne({ username: { $regex: new RegExp(targetId, 'i') } });
            if(target) {
                if(target.isAdmin) {
                    await sysMsg("Error: You cannot ban an Admin!", "#ff4444", false, user, false, currentRoom);
                    return res.send("console.log('Protect Admin');");
                }
                target.isBanned = true;
                if(cmd === '/ipban') await IPBan.create({ ip: target.lastIp });
                await target.save();
                await sysMsg(`${target.username} was banned. Reason: ${reason}`, "#ffff00", false, null, false, currentRoom);
            }
            return res.send("console.log('Banned');");
        }
        if (cmd === '/unban') {
            const targetId = args[1];
            const target = await User.findOne({ username: { $regex: new RegExp(targetId, 'i') } });
            if(target) {
                target.isBanned = false;
                await target.save();
                await IPBan.deleteOne({ ip: target.lastIp });
                await sysMsg(`${target.username} was unbanned.`, "#ffff00", false, null, false, currentRoom);
            } else {
                await IPBan.deleteOne({ ip: targetId });
            }
            return res.send("console.log('Unbanned');");
        }
        if (cmd === '/reset') {
            await User.deleteMany({ isAdmin: false });
            await Message.deleteMany({});
            await sysMsg("SYSTEM RESET: Only Admins remained.", "#ff0000", true, null, true, currentRoom);
            return res.send("console.log('Reset');");
        }
    }
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    await Message.create({ user, text, color: sender.color, status: sender.status, time, room: currentRoom });
    res.send("console.log('Sent');");
});

app.get('/check_updates', async (req, res) => {
    const { callback } = req.query;
    const rooms = ["Main", "Love", "Find friends", "Beef"];
    const counts = {};
    for (let r of rooms) {
        counts[r] = await Message.countDocuments({ room: r });
    }
    res.send(`${callback}(${JSON.stringify(counts)});`);
});

app.get('/messages_jsonp', async (req, res) => {
    const { user, pass, room } = req.query;
    const currentRoom = room || "Main";
    const check = await User.findOne({ username: user, password: pass });
    if (check && check.isBanned && !check.isAdmin) return res.send(`${req.query.callback}({banned: true});`);
    const msgs = await Message.find({ room: currentRoom, $or: [{ forUser: null }, { forUser: user }] }).sort({ _id: -1 }).limit(50);
    res.send(`${req.query.callback}(${JSON.stringify(msgs.reverse())});`);
});

app.listen(process.env.PORT || 10000);
