const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const app = express();

const mongoURI = "mongodb+srv://Smyle:stranac55@cluster0.qnqljpv.mongodb.net/?appName=Cluster0"; 
mongoose.connect(mongoURI).then(() => console.log("Sub-Zero V16: Online-Status & Messenger Active ❄️"));

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
    status: { type: String, default: "User" },
    lastSeen: { type: Number, default: 0 } 
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

const FriendshipSchema = new mongoose.Schema({
    requester: String, 
    recipient: String, 
    status: { type: String, enum: ['pending', 'accepted', 'blocked'], default: 'pending' }
});

const DirectMessageSchema = new mongoose.Schema({
    sender: String,
    receiver: String,
    text: String,
    time: String,
    color: String,
    seen: { type: Boolean, default: false }
});

const User = mongoose.model('User', UserSchema);
const IPBan = mongoose.model('IPBan', BanSchema);
const Message = mongoose.model('Message', MessageSchema);
const Friendship = mongoose.model('Friendship', FriendshipSchema);
const DirectMessage = mongoose.model('DirectMessage', DirectMessageSchema);

async function sysMsg(text, color = "#44ff44", isAlert = false, forUser = null, isReset = false, room = "Main") {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    await Message.create({ user: "SYSTEM", text, color, status: "SYS", time, isSystem: true, isAlert, forUser, isReset, room });
}

app.get('/logout_notify', async (req, res) => {
    const { user, room } = req.query;
    if (user) await sysMsg(`${user} left the room.`, "#666666", false, null, false, room || "Main");
    res.send("console.log('Logout logged');");
});

app.get('/auth', async (req, res) => {
    const { mode, user, pass, cb } = req.query;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const callback = cb || 'authCB';
    
    const validate = (str) => /^[a-zA-Z0-9]{5,}$/.test(str);
    if (!validate(user) || !validate(pass)) {
        return res.send(`${callback}({success:false, msg:'Min. 5 chars, no special characters!'});`);
    }

    const ipBanned = await IPBan.findOne({ ip });
    if (ipBanned) return res.send(`${callback}({success:false, msg:'IP_BANNED'});`);
    
    if (mode === 'register') {
        try {
            const pureName = user.trim().toLowerCase();
            const existing = await User.findOne({ pureName });
            if (existing) return res.send(`${callback}({success:false, msg:'Username taken'});`);

            const tag = Math.floor(1000 + Math.random() * 9000).toString();
            const randomColor = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
            await User.create({ 
                username: `${user.trim()}#${tag}`, 
                pureName, 
                password: pass, 
                color: randomColor, 
                lastIp: ip,
                lastSeen: Date.now() 
            });
            return res.send(`${callback}({success:true, msg:'Created!'});`);
        } catch(e) { return res.send(`${callback}({success:false, msg:'Error during registration'});`); }
    } else {
        const found = await User.findOne({ pureName: user?.trim().toLowerCase(), password: pass });
        if (!found) return res.send(`${callback}({success:false, msg:'Login failed'});`);
        if (found.isBanned && !found.isAdmin) return res.send(`${callback}({success:false, msg:'USER_BANNED'});`);
        
        found.lastIp = ip;
        found.lastSeen = Date.now();
        await found.save();
        
        await sysMsg(found.isAdmin ? `${found.username}` : `${found.username} joined`, found.isAdmin ? "#ff0000" : "#666666", found.isAdmin);
        return res.send(`${callback}({success:true, user: "${found.username}", color: "${found.color}", isAdmin: ${found.isAdmin}, status: "${found.status}", pass: "${found.password}"});`);
    }
});

app.get('/delete', async (req, res) => {
    const { id, user, pass } = req.query;
    const admin = await User.findOne({ username: user, password: pass, isAdmin: true });
    if (admin) {
        await Message.findByIdAndUpdate(id, { text: "DELETED_BY_ADMIN" });
        res.send("console.log('Marked as deleted');");
    } else {
        res.send("console.log('Unauthorized');");
    }
});

app.get('/send_safe', async (req, res) => {
    const { user, text, pass, room } = req.query;
    const currentRoom = room || "Main";
    const sender = await User.findOne({ username: user, password: pass });
    
    if (!sender) return res.send("console.log('Auth error');");
    if (sender.isBanned && !sender.isAdmin) return res.send("console.log('Banned');");
    
    if (sender.isAdmin && text.startsWith('/')) {
        const args = text.split(' ');
        const cmd = args[0].toLowerCase();
        if (cmd === '/help') {
            const helpText = "Commands: /clear, /ban [Name#1234], /ipban [Name#1234], /unban [Name#1234], /reset";
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
            const target = await User.findOne({ username: targetId });
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
            const target = await User.findOne({ username: targetId });
            if(target) {
                target.isBanned = false;
                await target.save();
                await IPBan.deleteOne({ ip: target.lastIp });
                await sysMsg(`${target.username} was unbanned.`, "#ffff00", false, null, false, currentRoom);
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

app.get('/friend_request', async (req, res) => {
    const { user, pass, targetName } = req.query;
    const sender = await User.findOne({ username: user, password: pass });
    if (!sender) return res.send("alert('Auth failed');");
    const target = await User.findOne({ username: targetName });
    if (!target) return res.send("alert('User not found!');");
    if (sender.username === target.username) return res.send("alert('Cannot add yourself');");
    
    const existing = await Friendship.findOne({ $or: [{ requester: sender.username, recipient: target.username }, { requester: target.username, recipient: sender.username }] });
    if (existing) return res.send("alert('Already exists');");
    
    await new Friendship({ requester: sender.username, recipient: target.username }).save();
    res.send("alert('Request sent');");
});

app.get('/get_social', async (req, res) => {
    const { user, pass, cb } = req.query;
    const me = await User.findOne({ username: user, password: pass });
    if (!me) return res.send("");
    const friends = await Friendship.find({ $or: [{ requester: me.username }, { recipient: me.username }], status: 'accepted' });
    const requests = await Friendship.find({ recipient: me.username, status: 'pending' });
    res.send(`${cb}(${JSON.stringify({ friends, requests })});`);
});

app.get('/handle_request', async (req, res) => {
    const { user, pass, requestId, action } = req.query;
    const me = await User.findOne({ username: user, password: pass });
    if (!me) return res.send("");

    if (action === 'accept') await Friendship.findByIdAndUpdate(requestId, { status: 'accepted' });
    else await Friendship.findByIdAndDelete(requestId);
    res.send("loadSocial();");
});

app.get('/send_dm', async (req, res) => {
    const { user, pass, target, text } = req.query;
    const me = await User.findOne({ username: user, password: pass });
    if (me && !me.isBanned) {
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        await DirectMessage.create({ sender: me.username, receiver: target, text, time, color: me.color });
    }
    res.send("loadMsgs();");
});

app.get('/get_dms', async (req, res) => {
    const { user, pass, target, cb } = req.query;
    const me = await User.findOne({ username: user, password: pass });
    if (!me) return res.send("");
    
    await DirectMessage.updateMany({ sender: target, receiver: me.username, seen: false }, { seen: true });
    const dms = await DirectMessage.find({ $or: [{ sender: me.username, receiver: target }, { sender: target, receiver: me.username }] }).sort({ _id: -1 }).limit(50);
    res.send(`${cb}(${JSON.stringify(dms.reverse())});`);
});

app.get('/check_updates', async (req, res) => {
    const { callback, user } = req.query;
    if (user) await User.findOneAndUpdate({ username: user }, { lastSeen: Date.now() });

    const rooms = ["Main", "Love", "Find friends", "Beef"];
    const counts = {};
    for (let r of rooms) counts[r] = await Message.countDocuments({ room: r });
    
    const minuteAgo = Date.now() - 60000;
    const onlineList = await User.find({ lastSeen: { $gt: minuteAgo } }, 'username');
    const onlineFriends = onlineList.map(f => f.username);

    let dmCount = 0;
    if (user) dmCount = await DirectMessage.countDocuments({ receiver: user, seen: false });
    
    res.send(`${callback}(${JSON.stringify({ counts, dmCount, onlineFriends })});`);
});

app.get('/messages_jsonp', async (req, res) => {
    const { user, pass, room } = req.query;
    const check = await User.findOne({ username: user, password: pass });
    if (check && check.isBanned && !check.isAdmin) return res.send(`${req.query.callback}([{isSystem: true, text: 'ACCOUNT_BANNED', color: '#ff0000'}]);`);
    
    const msgs = await Message.find({ room: room || "Main", $or: [{ forUser: null }, { forUser: user }] }).sort({ _id: -1 }).limit(50);
    res.send(`${req.query.callback}(${JSON.stringify(msgs.reverse())});`);
});

app.listen(process.env.PORT || 10000);
