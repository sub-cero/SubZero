const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const app = express();

const mongoURI = "mongodb+srv://Smyle:stranac55@cluster0.qnqljpv.mongodb.net/?appName=Cluster0"; 
mongoose.connect(mongoURI).then(() => console.log("Sub-Zero V32: System Online ❄️")).catch(err => console.error("Mongo Error:", err));

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- SCHEMAS ---

const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true },
    pureName: { type: String, unique: true },
    password: { type: String },
    color: { type: String, default: "#ffffff" },
    isAdmin: { type: Boolean, default: false },
    isBanned: { type: Boolean, default: false },
    banExpires: { type: Number, default: 0 },
    lastIp: String,
    status: { type: String, default: "User" },
    customStatus: { type: String, default: "Newcomer" },
    bio: { type: String, default: "No bio set." },
    pfp: { type: String, default: "" }, 
    level: { type: Number, default: 1 },
    xp: { type: Number, default: 0 },
    messagesSent: { type: Number, default: 0 },
    lastSeen: { type: Number, default: 0 },
    isOnlineNotify: { type: Boolean, default: false },
    typingAt: { type: Number, default: 0 },
    typingRoom: { type: String, default: "" },
    joinedAt: { type: Number, default: Date.now() }
}, { strict: false });

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
    userIp: String 
});

const DirectMessageSchema = new mongoose.Schema({
    sender: String, receiver: String, text: String, time: String, color: String, seen: { type: Boolean, default: false }
});

const ConfigSchema = new mongoose.Schema({ key: String, value: String });

const User = mongoose.model('User', UserSchema);
const IPBan = mongoose.model('IPBan', BanSchema);
const Message = mongoose.model('Message', MessageSchema);
const DirectMessage = mongoose.model('DirectMessage', DirectMessageSchema);
const Config = mongoose.model('Config', ConfigSchema);

// --- SYSTEM FUNCTIONS ---

async function sysMsg(text, color = "#44ff44", room = "Main") {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    try {
        return await Message.create({ 
            user: "SYSTEM", text, color, status: "SYS", time, 
            isSystem: true, room: room || "Main"
        });
    } catch (e) {}
}

setInterval(async () => {
    try {
        const minuteAgo = Date.now() - 60000;
        const lostUsers = await User.find({ lastSeen: { $lt: minuteAgo }, isOnlineNotify: true });
        for (let u of lostUsers) {
            await sysMsg(`${u.username} left the room.`, "#ff4444", "Main");
            u.isOnlineNotify = false;
            await u.save();
        }
    } catch (e) {}
}, 15000);

// --- ENDPOINTS ---

app.get('/get_profile', async (req, res) => {
    try {
        const { target, cb } = req.query;
        const found = await User.findOne({ username: target });
        if (!found) return res.send(`${cb}({success:false});`);
        res.send(`${cb}(${JSON.stringify({
            username: found.username, color: found.color || "#ffffff",
            isAdmin: found.isAdmin, status: found.status, customStatus: found.customStatus, bio: found.bio,
            level: found.level, xp: found.xp, xpNeeded: found.level * 100,
            messages: found.messagesSent, joinedAt: new Date(found.joinedAt).toLocaleDateString(),
            isOnline: found.lastSeen > Date.now() - 60000,
            pfp: found.pfp || ""
        })});`);
    } catch (e) { res.send(`${req.query.cb}({success:false});`); }
});

app.get('/update_profile_safe', async (req, res) => {
    try {
        const { user, bio, color, cb } = req.query;
        const updateFields = {};
        if (bio !== undefined) updateFields.bio = bio.substring(0, 150);
        if (color !== undefined) updateFields.color = color;
        const result = await User.updateOne({ username: user }, { $set: updateFields });
        if (result.matchedCount > 0) res.send(`${cb}({success:true, color: "${color}"});`);
        else res.send(`${cb}({success:false});`);
    } catch (e) { res.send(`${req.query.cb}({success:false});`); }
});

app.post('/update_profile_post', async (req, res) => {
    try {
        const { user, pass, bio, customStatus, pfp } = req.body;
        const updateDoc = {};
        if(bio !== undefined) updateDoc.bio = bio.substring(0, 150);
        if(customStatus !== undefined) updateDoc.customStatus = customStatus;
        if(pfp !== undefined) updateDoc.pfp = pfp;

        const result = await User.updateOne({ username: user, password: pass }, { $set: updateDoc });
        res.json({ success: result.matchedCount > 0 });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.get('/auth', async (req, res) => {
    try {
        const { mode, user, pass, cb } = req.query;
        const callback = cb || 'authCB';
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        
        if (mode === 'check') {
            const existing = await User.findOne({ pureName: user?.trim().toLowerCase() });
            return res.send(`${callback}(${JSON.stringify({ taken: !!existing, valid: user?.length >= 5 })});`);
        }

        if (mode === 'register') {
            const pureName = user.trim().toLowerCase();
            const existing = await User.findOne({ pureName });
            if (existing) return res.send(`${callback}({success:false, msg:'Taken'});`);
            const tag = Math.floor(1000 + Math.random() * 9000).toString();
            const randomColor = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
            await User.create({ username: `${user.trim()}#${tag}`, pureName, password: pass, color: randomColor, lastIp: ip, lastSeen: Date.now() });
            return res.send(`${callback}({success:true, msg:'Created'});`);
        } else {
            const found = await User.findOne({ pureName: user?.trim().toLowerCase(), password: pass });
            if (!found) return res.send(`${callback}({success:false, msg:'Fail'});`);
            if (found.isBanned && !found.isAdmin) return res.send(`${callback}({success:false, isBanned: true});`);
            
            found.lastIp = ip; found.lastSeen = Date.now();
            if (!found.isOnlineNotify) {
                const joinCol = found.isAdmin ? "#ff0000" : "#44ff44";
                await sysMsg(found.isAdmin ? `⚠️ THE ADMIN IS HERE! ⚠️` : `${found.username} joined`, joinCol);
                found.isOnlineNotify = true;
            }
            await found.save();
            return res.send(`${callback}({success:true, user: "${found.username}", color: "${found.color}", isAdmin: ${found.isAdmin}, status: "${found.status}", pass: "${found.password}", pfp: "${found.pfp || ""}"});`);
        }
    } catch(e) { res.send(`${cb}({success:false});`); }
});

app.get('/typing', async (req, res) => {
    const { user, room } = req.query;
    await User.findOneAndUpdate({ username: user }, { typingAt: Date.now(), typingRoom: room });
    res.send("1");
});

app.get('/send_safe', async (req, res) => {
    try {
        const { user, text, pass, room } = req.query;
        const sender = await User.findOne({ username: user, password: pass });
        if (!sender || sender.isBanned) return res.send("0");
        
        await Message.create({ 
            user, text, color: sender.color, status: sender.status, 
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
            room: room || "Main", userIp: sender.lastIp
        });
        await User.findOneAndUpdate({ username: user }, { typingAt: 0 });
        res.send("1");
    } catch(e) { res.send("0"); }
});

app.get('/check_updates', async (req, res) => {
    const { callback, user, room } = req.query;
    if (user) await User.updateOne({ username: user }, { lastSeen: Date.now() });
    
    const typingNow = await User.findOne({ typingAt: { $gt: Date.now() - 3000 }, typingRoom: room, username: { $ne: user } });
    const onlineCount = await User.countDocuments({ lastSeen: { $gt: Date.now() - 60000 } });
    const me = user ? await User.findOne({ username: user }) : null;

    res.send(`${callback}(${JSON.stringify({ 
        onlineCount, 
        typingUser: typingNow ? typingNow.username : null,
        isBanned: me ? me.isBanned : false,
        banTimeLeft: me && me.banExpires > 0 ? Math.ceil((me.banExpires - Date.now()) / 60000) + " min" : ""
    })});`);
});

app.get('/messages_jsonp', async (req, res) => {
    const { room, callback, user, pass } = req.query;
    const requester = await User.findOne({ username: user, password: pass });
    let msgs = await Message.find({ room: room || "Main" }).sort({ _id: -1 }).limit(50);
    msgs = msgs.reverse();

    const enriched = [];
    for(let m of msgs) {
        let obj = m.toObject();
        const u = await User.findOne({ username: m.user });
        if(u) { obj.pfp = u.pfp; obj.color = u.color; }
        if(requester?.isAdmin) { obj.userIp = m.userIp; }
        enriched.push(obj);
    }
    res.send(`${callback}(${JSON.stringify(enriched)});`);
});

app.listen(process.env.PORT || 10000);
