const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const app = express();

const mongoURI = "mongodb+srv://Smyle:stranac55@cluster0.qnqljpv.mongodb.net/?appName=Cluster0"; 
mongoose.connect(mongoURI).then(() => console.log("Sub-Zero V16: System Online ❄️")).catch(err => console.error(err));

app.use(cors());
// Limit für große Bilder
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- SCHEMAS ---

const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true },
    pureName: { type: String, unique: true },
    password: { type: String },
    color: { type: String },
    isAdmin: { type: Boolean, default: false },
    isBanned: { type: Boolean, default: false },
    banExpires: { type: Number, default: 0 },
    isShadowBanned: { type: Boolean, default: false },
    lastIp: String,
    status: { type: String, default: "User" },
    customStatus: { type: String, default: "Newcomer ❄️" },
    bio: { type: String, default: "No bio set." },
    pfp: { type: String, default: "" }, // Profilbild String (Base64)
    level: { type: Number, default: 1 },
    xp: { type: Number, default: 0 },
    messagesSent: { type: Number, default: 0 },
    lastSeen: { type: Number, default: 0 },
    isOnlineNotify: { type: Boolean, default: false },
    typingAt: { type: Number, default: 0 },
    typingRoom: { type: String, default: "" },
    joinedAt: { type: Number, default: Date.now() }
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
    forUser: { type: String, default: null },
    replyTo: { user: String, text: String }
});

const FriendshipSchema = new mongoose.Schema({
    requester: String, recipient: String, 
    status: { type: String, enum: ['pending', 'accepted', 'blocked'], default: 'pending' }
});

const DirectMessageSchema = new mongoose.Schema({
    sender: String, receiver: String, text: String, time: String, color: String, seen: { type: Boolean, default: false }
});

const ConfigSchema = new mongoose.Schema({ key: String, value: String });

const User = mongoose.model('User', UserSchema);
const IPBan = mongoose.model('IPBan', BanSchema);
const Message = mongoose.model('Message', MessageSchema);
const Friendship = mongoose.model('Friendship', FriendshipSchema);
const DirectMessage = mongoose.model('DirectMessage', DirectMessageSchema);
const Config = mongoose.model('Config', ConfigSchema);

// --- SYSTEM FUNCTIONS ---

async function sysMsg(text, color = "#44ff44", isAlert = false, forUser = null, isReset = false, room = "Main", resetReason = "") {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return await Message.create({ 
        user: "SYSTEM", text, color, status: "SYS", time, 
        isSystem: true, isAlert, forUser, isReset, room, resetReason 
    });
}

setInterval(async () => {
    try {
        const minuteAgo = Date.now() - 60000;
        const lostUsers = await User.find({ lastSeen: { $lt: minuteAgo }, isOnlineNotify: true });
        for (let u of lostUsers) {
            await sysMsg(`${u.username} left the room.`, "#ff4444", false, null, false, "Main");
            u.isOnlineNotify = false;
            await u.save();
        }
    } catch (e) {}
}, 30000);

// --- ENDPOINTS ---

app.get('/get_profile', async (req, res) => {
    const { target, cb } = req.query;
    const found = await User.findOne({ username: target });
    if (!found) return res.send(`${cb}({success:false});`);
    const profileData = {
        username: found.username, color: found.color, isAdmin: found.isAdmin,
        status: found.status, customStatus: found.customStatus, bio: found.bio,
        pfp: found.pfp,
        level: found.level, xp: found.xp, xpNeeded: found.level * 100,
        messages: found.messagesSent, joinedAt: new Date(found.joinedAt).toLocaleDateString(),
        isOnline: found.lastSeen > Date.now() - 60000
    };
    res.send(`${cb}(${JSON.stringify(profileData)});`);
});

app.post('/update_profile_post', async (req, res) => {
    const { user, pass, bio, customStatus, pfp } = req.body;
    const me = await User.findOne({ username: user, password: pass });
    if (me) {
        if (bio !== undefined && bio !== null) me.bio = bio.substring(0, 150);
        if (customStatus !== undefined && customStatus !== null) me.customStatus = customStatus.substring(0, 30);
        // Profilbild speichern
        if (pfp !== undefined && pfp !== null) me.pfp = pfp;
        await me.save();
        res.json({ success: true });
    } else {
        res.json({ success: false, msg: "Auth failed" });
    }
});

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
    const ipBanned = await IPBan.findOne({ ip });
    if (ipBanned) return res.send(`${callback}({success:false, msg:'IP_BANNED', isBanned: true});`);

    const minuteAgo = Date.now() - 60000;
    const onlineCount = await User.countDocuments({ lastSeen: { $gt: minuteAgo } });

    if (mode === 'check') {
        const pureName = user?.trim().toLowerCase();
        const existing = await User.findOne({ pureName });
        const isValid = /^[a-zA-Z0-9]{5,}$/.test(user || ""); 
        return res.send(`${callback}(${JSON.stringify({ taken: !!existing, valid: isValid })});`);
    }

    if (mode === 'register') {
        if (onlineCount >= 150) return res.send(`${callback}({success:false, msg:'Server full'});`);
        const validate = (str) => /^[a-zA-Z0-9]{5,}$/.test(str);
        if (!validate(user) || !validate(pass)) return res.send(`${callback}({success:false, msg:'Invalid chars'});`);
        if (pass !== passConfirm) return res.send(`${callback}({success:false, msg:'Mismatch'});`);
        try {
            const pureName = user.trim().toLowerCase();
            const existing = await User.findOne({ pureName });
            if (existing) return res.send(`${callback}({success:false, msg:'Taken'});`);
            const tag = Math.floor(1000 + Math.random() * 9000).toString();
            const randomColor = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
            await User.create({ username: `${user.trim()}#${tag}`, pureName, password: pass, color: randomColor, lastIp: ip, lastSeen: Date.now() });
            return res.send(`${callback}({success:true, msg:'Created!'});`);
        } catch(e) { return res.send(`${callback}({success:false, msg:'Error'});`); }
    } else {
        const found = await User.findOne({ pureName: user?.trim().toLowerCase(), password: pass });
        if (!found) return res.send(`${callback}({success:false, msg:'Login failed'});`);
        const alreadyOnline = found.lastSeen > minuteAgo;
        if (!alreadyOnline && onlineCount >= 150 && !found.isAdmin) return res.send(`${callback}({success:false, msg:'Full'});`);
        if (found.isBanned && !found.isAdmin) {
            if (found.banExpires > 0 && Date.now() > found.banExpires) {
                found.isBanned = false; found.banExpires = 0; await found.save();
            } else { return res.send(`${callback}({success:false, msg: 'BANNED', isBanned: true});`); }
        }
        found.lastIp = ip; found.lastSeen = Date.now();
        if (!found.isOnlineNotify) {
            await sysMsg(found.isAdmin ? `${found.username}` : `${found.username} joined`, found.isAdmin ? "#ff0000" : "#44ff44", found.isAdmin);
            found.isOnlineNotify = true;
        }
        await found.save();
        // Hier pfp mitsenden!
        return res.send(`${callback}({success:true, user: "${found.username}", color: "${found.color}", isAdmin: ${found.isAdmin}, status: "${found.status}", pass: "${found.password}", pfp: "${found.pfp || ""}"});`);
    }
});

app.get('/delete', async (req, res) => {
    const { id, user, pass } = req.query;
    const requester = await User.findOne({ username: user, password: pass });
    if (!requester) return res.send("console.log('Auth failed');");
    const msg = await Message.findById(id);
    if (!msg) return res.send("console.log('Message not found');");

    if (requester.isAdmin) {
        await Message.findByIdAndUpdate(id, { text: "$$ADMIN_DEL$$", isSystem: false });
        res.send("console.log('Deleted by Admin');");
    } else if (msg.user === requester.username) {
        await Message.findByIdAndUpdate(id, { text: "$$USER_DEL$$", isSystem: false });
        res.send("console.log('Deleted by User');");
    } else {
        res.send("console.log('Unauthorized');");
    }
});

app.get('/typing', async (req, res) => {
    const { user, room } = req.query;
    await User.findOneAndUpdate({ username: user }, { typingAt: Date.now(), typingRoom: room });
    res.send("console.log('Typing...');");
});

app.get('/send_safe', async (req, res) => {
    const { user, text, pass, room, replyUser, replyText } = req.query;
    const currentRoom = room || "Main";
    const sender = await User.findOne({ username: user, password: pass });
    if (!sender) return res.send("console.log('Auth error');");
    if (sender.isBanned && !sender.isAdmin) return res.send("console.log('Banned');");

    sender.messagesSent++;
    sender.xp += Math.floor(Math.random() * 10) + 5;
    if (sender.xp >= sender.level * 100) {
        sender.level++; sender.xp = 0;
        await sysMsg(`${sender.username} reached Level ${sender.level}! ✨`, "#ffaa00", false, null, false, currentRoom);
    }
    await sender.save();
    await User.findOneAndUpdate({ username: user }, { typingAt: 0 });
    
    if (sender.isAdmin && text.startsWith('/')) {
        const args = text.split(' '); const cmd = args[0].toLowerCase();
        if (cmd === '/help') { await sysMsg("Admin: /clear, /ban [ID], /ipban [ID], /unban [ID], /reset [Reason], /alert [Text], /shadow [ID]", "#00d4ff", false, user, false, currentRoom); return res.send("console.log('Help');"); }
        if (cmd === '/alert') {
            await Config.findOneAndUpdate({ key: 'global_alert' }, { value: args.slice(1).join(' ') }, { upsert: true });
            setTimeout(async () => { await Config.deleteOne({ key: 'global_alert' }); }, 15000);
            return res.send("console.log('Alert');");
        }
        if (cmd === '/shadow') {
            const t = await User.findOne({ username: { $regex: `#${args[1]}$` } });
            if(t && !t.isAdmin) { t.isShadowBanned = !t.isShadowBanned; await t.save(); }
            return res.send("console.log('Shadow');");
        }
        if (cmd === '/clear') { await Message.deleteMany({ room: currentRoom }); await sysMsg("Chat cleared", "#ffff00", false, null, false, currentRoom); return res.send("console.log('Cleared');"); }
        if (cmd === '/ban' || cmd === '/ipban') {
            const t = await User.findOne({ username: { $regex: `#${args[1]}$` } });
            if(t && !t.isAdmin) {
                t.isBanned = true; t.banExpires = (parseInt(args[2]) > 0) ? Date.now() + (parseInt(args[2]) * 60000) : 0;
                if(cmd === '/ipban' && t.lastIp) await IPBan.create({ ip: t.lastIp });
                await t.save(); await sysMsg(`${t.username} banned.`, "#ffff00", false, null, false, currentRoom);
            }
            return res.send("console.log('Banned');");
        }
        if (cmd === '/reset') {
            const rId = Date.now().toString(); const reason = args.slice(1).join(' ') || "Update";
            await Message.deleteMany({}); await DirectMessage.deleteMany({}); await Friendship.deleteMany({});
            await User.deleteMany({ isAdmin: false }); await User.updateMany({ isAdmin: true }, { isOnlineNotify: false, lastIp: "", typingAt: 0, lastSeen: 0, level: 1, xp: 0, messagesSent: 0 });
            await Config.findOneAndUpdate({ key: 'reset_trigger' }, { value: rId }, { upsert: true }); await Config.findOneAndUpdate({ key: 'reset_reason' }, { value: reason }, { upsert: true });
            await sysMsg("SYSTEM RESET", "#ff0000", true, null, true, "Main", reason);
            return res.send("console.log('Reset');");
        }
        if (cmd === '/unban') {
            const t = await User.findOne({ username: { $regex: `#${args[1]}$` } });
            if(t) { t.isBanned = false; t.banExpires = 0; t.isShadowBanned = false; await t.save(); if(t.lastIp) await IPBan.deleteMany({ ip: t.lastIp }); await sysMsg(`${t.username} was unbanned.`, "#44ff44", false, null, false, currentRoom); }
            return res.send("console.log('Unbanned');");
        }
    }
    let replyObj = null;
    if (replyUser && replyText) { replyObj = { user: replyUser, text: replyText.substring(0, 50) + "..." }; }
    await Message.create({ user, text, color: sender.color, status: sender.status, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), room: currentRoom, forUser: sender.isShadowBanned ? user : null, replyTo: replyObj });
    res.send("console.log('Sent');");
});

app.get('/friend_request', async (req, res) => { res.send(""); });
app.get('/get_social', async (req, res) => { 
    const { user, pass, cb } = req.query; 
    const me = await User.findOne({ username: user, password: pass });
    if (!me) return res.send("");
    const friends = await Friendship.find({ $or: [{ requester: me.username }, { recipient: me.username }], status: 'accepted' });
    const requests = await Friendship.find({ recipient: me.username, status: 'pending' });
    res.send(`${cb}(${JSON.stringify({ friends, requests, blocked: [] })});`);
});
app.get('/handle_request', async (req, res) => {
    const { user, pass, requestId, action } = req.query;
    const me = await User.findOne({ username: user, password: pass });
    if (me && action === 'accept') await Friendship.findByIdAndUpdate(requestId, { status: 'accepted' });
    else if (me) await Friendship.findByIdAndDelete(requestId);
    res.send("loadSocial();");
});
app.get('/send_dm', async (req, res) => { 
    const { user, pass, target, text } = req.query;
    const me = await User.findOne({ username: user, password: pass });
    if (me) await DirectMessage.create({ sender: me.username, receiver: target, text, time: "Now", color: me.color });
    res.send("loadMsgs();");
});
app.get('/get_dms', async (req, res) => { 
    const { user, pass, target, cb } = req.query;
    const me = await User.findOne({ username: user, password: pass });
    const dms = await DirectMessage.find({ $or: [{ sender: me.username, receiver: target }, { sender: target, receiver: me.username }] }).limit(50);
    res.send(`${cb}(${JSON.stringify(dms.reverse())});`);
});

app.get('/check_updates', async (req, res) => {
    const { callback, user, room } = req.query;
    if (user) await User.updateOne({ username: user }, { lastSeen: Date.now() });
    
    const rooms = ["Main", "English", "German", "Buy & Sell"];
    const counts = {};
    for (let r of rooms) counts[r] = await Message.countDocuments({ room: r });
    
    const typingNow = await User.findOne({ typingAt: { $gt: Date.now() - 3000 }, typingRoom: room, username: { $ne: user } });
    const resetTrigger = await Config.findOne({ key: 'reset_trigger' });
    const globalAlert = await Config.findOne({ key: 'global_alert' });
    const dmCount = user ? await DirectMessage.countDocuments({ receiver: user, seen: false }) : 0;
    
    // WICHTIG: Sende das eigene PFP zurück, damit Header sich aktualisiert
    let myPfp = "";
    if (user) { const me = await User.findOne({ username: user }); if (me) myPfp = me.pfp; }

    res.send(`${callback}(${JSON.stringify({ 
        counts, dmCount, onlineFriends: [], onlineCount: 0, 
        resetTrigger: resetTrigger ? resetTrigger.value : null, globalAlert: globalAlert ? globalAlert.value : null,
        typingUser: typingNow ? typingNow.username : null,
        myPfp: myPfp // NEU
    })});`);
});

app.get('/messages_jsonp', async (req, res) => {
    const { user, pass, room, callback } = req.query;
    const requester = await User.findOne({ username: user, password: pass });
    
    let msgs = await Message.find({ room: room || "Main" }).sort({ _id: -1 }).limit(50);
    msgs = msgs.reverse();
    const enrichedMsgs = [];
    const userCache = {};

    for (let m of msgs) {
        let msgObj = m.toObject();
        // Caching für User-Daten (PFP und Admin-Status)
        if (!userCache[msgObj.user]) {
            const u = await User.findOne({ username: msgObj.user });
            userCache[msgObj.user] = u ? { pfp: u.pfp, lastIp: u.lastIp, isAdmin: u.isAdmin } : { pfp: "", lastIp: "", isAdmin: false };
        }
        msgObj.pfp = userCache[msgObj.user].pfp;
        if (requester && requester.isAdmin && !msgObj.isSystem && msgObj.user !== "SYSTEM") {
            if (!userCache[msgObj.user].isAdmin) msgObj.userIp = userCache[msgObj.user].lastIp;
        }
        enrichedMsgs.push(msgObj);
    }
    res.send(`${callback}(${JSON.stringify(enrichedMsgs)});`);
});

app.listen(process.env.PORT || 10000);
