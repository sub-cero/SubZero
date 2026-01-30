const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const app = express();

const mongoURI = "mongodb+srv://Smyle:stranac55@cluster0.qnqljpv.mongodb.net/?appName=Cluster0"; 
mongoose.connect(mongoURI).then(() => console.log("Sub-Zero V16: System Online ❄️"));

app.use(cors());
app.use(express.json());

const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true },
    pureName: { type: String, unique: true },
    password: { type: String },
    color: { type: String },
    isAdmin: { type: Boolean, default: false },
    isBanned: { type: Boolean, default: false },
    isShadowBanned: { type: Boolean, default: false },
    lastIp: String,
    status: { type: String, default: "User" },
    lastSeen: { type: Number, default: 0 },
    isOnlineNotify: { type: Boolean, default: false },
    typingAt: { type: Number, default: 0 },
    typingRoom: { type: String, default: "" }
});

const BanSchema = new mongoose.Schema({ ip: String });

const MessageSchema = new mongoose.Schema({ 
    user: String, text: String, color: String, time: String, 
    status: String, 
    room: { type: String, default: "Main" },
    isSystem: { type: Boolean, default: false },
    isAlert: { type: Boolean, default: false },
    isReset: { type: Boolean, default: false },
    resetReason: { type: String, default: "" },
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

const ConfigSchema = new mongoose.Schema({
    key: String,
    value: String
});

const User = mongoose.model('User', UserSchema);
const IPBan = mongoose.model('IPBan', BanSchema);
const Message = mongoose.model('Message', MessageSchema);
const Friendship = mongoose.model('Friendship', FriendshipSchema);
const DirectMessage = mongoose.model('DirectMessage', DirectMessageSchema);
const Config = mongoose.model('Config', ConfigSchema);

async function sysMsg(text, color = "#44ff44", isAlert = false, forUser = null, isReset = false, room = "Main", resetReason = "") {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    await Message.create({ user: "SYSTEM", text, color, status: "SYS", time, isSystem: true, isAlert, forUser, isReset, room, resetReason });
}

setInterval(async () => {
    const minuteAgo = Date.now() - 60000;
    const lostUsers = await User.find({ lastSeen: { $lt: minuteAgo }, isOnlineNotify: true });
    
    for (let u of lostUsers) {
        await sysMsg(`${u.username} left the room.`, "#ff4444", false, null, false, "Main");
        u.isOnlineNotify = false;
        await u.save();
    }
}, 30000);

app.get('/logout_notify', async (req, res) => {
    const { user, room } = req.query;
    const found = await User.findOne({ username: user });
    if (found) {
        await sysMsg(`${found.username} left the room.`, "#ff4444", false, null, false, room || "Main");
        found.isOnlineNotify = false;
        await found.save();
    }
    res.send("console.log('Logout logged');");
});

app.get('/auth', async (req, res) => {
    const { mode, user, pass, passConfirm, cb } = req.query;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const callback = cb || 'authCB';
    
    if (mode === 'check') {
        const pureName = user?.trim().toLowerCase();
        const existing = await User.findOne({ pureName });
        const isValid = /^[a-zA-Z0-9]{5,}$/.test(user || ""); 
        return res.send(`${callback}(${JSON.stringify({ taken: !!existing, valid: isValid })});`);
    }

    const ipBanned = await IPBan.findOne({ ip });
    if (ipBanned) return res.send(`${callback}({success:false, msg:'IP_BANNED'});`);
    
    if (mode === 'register') {
        const validate = (str) => /^[a-zA-Z0-9]{5,}$/.test(str);
        if (!validate(user) || !validate(pass)) {
            return res.send(`${callback}({success:false, msg:'Min. 5 chars, no special characters!'});`);
        }
        if (pass !== passConfirm) {
            return res.send(`${callback}({success:false, msg:'Passwords do not match!'});`);
        }

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
            return res.send(`${callback}({success:true, msg:'Created! Please login now.'});`);
        } catch(e) { return res.send(`${callback}({success:false, msg:'Error during registration'});`); }
    } else {
        const found = await User.findOne({ pureName: user?.trim().toLowerCase(), password: pass });
        if (!found) return res.send(`${callback}({success:false, msg:'Login failed'});`);
        if (found.isBanned && !found.isAdmin) return res.send(`${callback}({success:false, msg:'USER_BANNED'});`);
        
        found.lastIp = ip;
        found.lastSeen = Date.now();
        
        if (!found.isOnlineNotify) {
            await sysMsg(found.isAdmin ? `${found.username}` : `${found.username} joined`, found.isAdmin ? "#ff0000" : "#44ff44", found.isAdmin);
            found.isOnlineNotify = true;
        }
        
        await found.save();
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

app.get('/admin_action', async (req, res) => {
    const { mode, text, user, pass } = req.query;
    const admin = await User.findOne({ username: user, password: pass, isAdmin: true });
    if (!admin) return res.send("console.log('Denied');");

    if (mode === 'alert') {
        await Config.findOneAndUpdate({ key: 'global_alert' }, { value: text }, { upsert: true });
        setTimeout(async () => { await Config.deleteOne({ key: 'global_alert' }); }, 15000);
        res.send("console.log('Alert set');");
    }

    if (mode === 'reset_all') {
        await User.deleteMany({ isAdmin: false });
        await Message.deleteMany({});
        await sysMsg("SYSTEM RESET", "#ff0000", true, null, true, "Main", text || "Manual System Reset");
        res.send("console.log('Global reset executed');");
    }
});

app.get('/typing', async (req, res) => {
    const { user, room } = req.query;
    await User.findOneAndUpdate({ username: user }, { typingAt: Date.now(), typingRoom: room });
    res.send("console.log('Typing...');");
});

app.get('/send_safe', async (req, res) => {
    const { user, text, pass, room } = req.query;
    const currentRoom = room || "Main";
    const sender = await User.findOne({ username: user, password: pass });
    
    if (!sender) return res.send("console.log('Auth error');");
    if (sender.isBanned && !sender.isAdmin) return res.send("console.log('Banned');");

    await User.findOneAndUpdate({ username: user }, { typingAt: 0 });
    
    if (sender.isAdmin && text.startsWith('/')) {
        const args = text.split(' ');
        const cmd = args[0].toLowerCase();
        const targetInput = args[1];

        if (cmd === '/help') {
            const helpText = "Admin Commands: /clear, /ban [ID], /ipban [ID], /unban [ID], /reset [Reason], /alert [Text], /shadow [ID]";
            await sysMsg(helpText, "#00d4ff", false, user, false, currentRoom);
            return res.send("console.log('Help sent');");
        }
        if (cmd === '/alert') {
            const alertMsg = args.slice(1).join(' ');
            await Config.findOneAndUpdate({ key: 'global_alert' }, { value: alertMsg }, { upsert: true });
            setTimeout(async () => { await Config.deleteOne({ key: 'global_alert' }); }, 15000);
            return res.send("console.log('Alert via command set');");
        }
        if (cmd === '/shadow') {
            const target = await User.findOne({ username: { $regex: `#${targetInput}$` } });
            if(target && !target.isAdmin) {
                target.isShadowBanned = !target.isShadowBanned;
                await target.save();
                await sysMsg(`Shadow status for ${target.username} toggled.`, "#ff00ff", false, user, false, currentRoom);
            }
            return res.send("console.log('Shadow ban toggled');");
        }
        if (cmd === '/clear') {
            await Message.deleteMany({ room: currentRoom });
            await sysMsg("Chat cleared by Admin", "#ffff00", false, null, false, currentRoom);
            return res.send("console.log('Cleared');");
        }
        if (cmd === '/ban' || cmd === '/ipban') {
            const target = await User.findOne({ username: { $regex: `#${targetInput}$` } });
            if(target) {
                if(target.isAdmin) {
                    await sysMsg("Error: You cannot ban an Admin!", "#ff4444", false, user, false, currentRoom);
                    return res.send("console.log('Protect Admin');");
                }
                target.isBanned = true;
                if(cmd === '/ipban') await IPBan.create({ ip: target.lastIp });
                await target.save();
                await sysMsg(`${target.username} was banned.`, "#ffff00", false, null, false, currentRoom);
            }
            return res.send("console.log('Banned');");
        }
        if (cmd === '/unban') {
            const target = await User.findOne({ username: { $regex: `#${targetInput}$` } });
            if(target) {
                target.isBanned = false;
                target.isShadowBanned = false;
                await target.save();
                await IPBan.deleteOne({ ip: target.lastIp });
                await sysMsg(`${target.username} was unbanned.`, "#44ff44", false, null, false, currentRoom);
            }
            return res.send("console.log('Unbanned');");
        }
        if (cmd === '/reset') {
            const reason = args.slice(1).join(' ') || "Manual System Reset";
            await User.deleteMany({ isAdmin: false });
            await Message.deleteMany({});
            await sysMsg("SYSTEM RESET", "#ff0000", true, null, true, "Main", reason);
            return res.send("console.log('Reset');");
        }
    }
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const forUserValue = sender.isShadowBanned ? user : null;
    
    await Message.create({ 
        user, 
        text, 
        color: sender.color, 
        status: sender.status, 
        time, 
        room: currentRoom,
        forUser: forUserValue 
    });
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
    const blocked = await Friendship.find({ $or: [{ requester: me.username }, { recipient: me.username }], status: 'blocked' });
    res.send(`${cb}(${JSON.stringify({ friends, requests, blocked })});`);
});

app.get('/handle_request', async (req, res) => {
    const { user, pass, requestId, action } = req.query;
    const me = await User.findOne({ username: user, password: pass });
    if (!me) return res.send("");

    if (action === 'accept') await Friendship.findByIdAndUpdate(requestId, { status: 'accepted' });
    else if (action === 'block') await Friendship.findByIdAndUpdate(requestId, { status: 'blocked' });
    else await Friendship.findByIdAndDelete(requestId);
    res.send("loadSocial();");
});

app.get('/send_dm', async (req, res) => {
    const { user, pass, target, text } = req.query;
    const me = await User.findOne({ username: user, password: pass });
    if (me && !me.isBanned) {
        await User.findOneAndUpdate({ username: user }, { typingAt: 0 });
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
    const { callback, user, room } = req.query;
    const me = user ? await User.findOne({ username: user }) : null;
    if (me) await User.findOneAndUpdate({ username: user }, { lastSeen: Date.now() });

    const rooms = ["Main", "Love", "Find friends", "Beef"];
    const counts = {};
    for (let r of rooms) counts[r] = await Message.countDocuments({ room: r });
    
    const minuteAgo = Date.now() - 60000;
    const onlineList = await User.find({ lastSeen: { $gt: minuteAgo } }, 'username');
    const onlineFriends = onlineList.map(f => f.username);

    const typingNow = await User.findOne({ 
        typingAt: { $gt: Date.now() - 3000 }, 
        typingRoom: room,
        username: { $ne: user }
    });

    const resetMsg = await Message.findOne({ isReset: true }).sort({ _id: -1 });
    const globalAlert = await Config.findOne({ key: 'global_alert' });

    let dmCount = 0;
    if (user) dmCount = await DirectMessage.countDocuments({ receiver: user, seen: false });
    
    res.send(`${callback}(${JSON.stringify({ 
        counts, 
        dmCount, 
        onlineFriends, 
        isBanned: me ? me.isBanned : false,
        resetTrigger: resetMsg ? resetMsg._id : null,
        resetReason: resetMsg ? resetMsg.resetReason : null,
        globalAlert: globalAlert ? globalAlert.value : null,
        typingUser: typingNow ? typingNow.username : null
    })});`);
});

app.get('/messages_jsonp', async (req, res) => {
    const { user, pass, room } = req.query;
    const check = await User.findOne({ username: user, password: pass });
    if (check && check.isBanned && !check.isAdmin) return res.send(`${req.query.callback}([{isSystem: true, text: 'ACCOUNT_BANNED', color: '#ff0000'}]);`);
    
    const msgs = await Message.find({ room: room || "Main", $or: [{ forUser: null }, { forUser: user }] }).sort({ _id: -1 }).limit(50);
    res.send(`${req.query.callback}(${JSON.stringify(msgs.reverse())});`);
});

app.listen(process.env.PORT || 10000);
