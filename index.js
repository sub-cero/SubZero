const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const app = express();

// DATABASE CONNECTION
const mongoURI = "mongodb+srv://Smyle:stranac55@cluster0.qnqljpv.mongodb.net/?appName=Cluster0"; 
mongoose.connect(mongoURI).then(() => console.log("Sub-Zero V35: Ultimate Online ❄️")).catch(err => console.error(err));

// MIDDLEWARE (Large limit for images)
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
    isShadowBanned: { type: Boolean, default: false },
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
    pfp: String, // Store snapshot of PFP
    userIp: String 
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

// --- HELPER FUNCTIONS ---

async function sysMsg(text, color = "#44ff44", isAlert = false, forUser = null, isReset = false, room = "Main", resetReason = "") {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    try {
        return await Message.create({ 
            user: "SYSTEM", text, color, status: "SYS", time, 
            isSystem: true, isAlert, forUser, isReset, room, resetReason 
        });
    } catch (e) {}
}

// CHECK LEAVING USERS (Runs every 15s)
setInterval(async () => {
    try {
        const minuteAgo = Date.now() - 60000;
        const lostUsers = await User.find({ lastSeen: { $lt: minuteAgo }, isOnlineNotify: true });
        for (let u of lostUsers) {
            // LEAVE = RED
            await sysMsg(`${u.username} left the room.`, "#ff4444", false, null, false, "Main");
            u.isOnlineNotify = false;
            await u.save();
        }
    } catch (e) {}
}, 15000);

// --- ROUTES ---

// 1. GET PROFILE
app.get('/get_profile', async (req, res) => {
    try {
        const { target, cb } = req.query;
        const found = await User.findOne({ username: target });
        if (!found) return res.send(`${cb}({success:false});`);
        res.send(`${cb}(${JSON.stringify({
            username: found.username, 
            color: found.color || "#ffffff",
            isAdmin: found.isAdmin, 
            status: found.status, 
            customStatus: found.customStatus, 
            bio: found.bio,
            pfp: found.pfp || "",
            level: found.level, xp: found.xp, xpNeeded: found.level * 100,
            messages: found.messagesSent, joinedAt: new Date(found.joinedAt).toLocaleDateString(),
            isOnline: found.lastSeen > Date.now() - 60000
        })});`);
    } catch (e) { res.send(`${req.query.cb}({success:false});`); }
});

// 2. UPDATE PROFILE (SAFE GET) - For Text/Color
app.get('/update_profile_safe', async (req, res) => {
    try {
        const { user, bio, color, cb } = req.query;
        const updateFields = {};
        if (bio !== undefined) updateFields.bio = bio.substring(0, 150);
        if (color !== undefined) updateFields.color = color;

        const result = await User.updateOne({ username: user }, { $set: updateFields });
        if (result.matchedCount > 0) res.send(`${cb}({success:true, color: "${color}", bio: "${bio}"});`);
        else res.send(`${cb}({success:false});`);
    } catch (e) { res.send(`${req.query.cb}({success:false});`); }
});

// 3. UPDATE PROFILE (POST) - For Images (PFP)
app.post('/update_profile_post', async (req, res) => {
    try {
        const { user, pass, bio, customStatus, pfp } = req.body;
        // Verify User
        const me = await User.findOne({ username: user, password: pass });
        if(!me) return res.json({ success: false, msg: "Auth fail" });

        if(bio !== undefined) me.bio = bio.substring(0, 150);
        if(customStatus !== undefined) me.customStatus = customStatus;
        if(pfp !== undefined) me.pfp = pfp; // Save Base64 string

        await me.save();
        res.json({ success: true, color: me.color });
    } catch (e) {
        res.status(500).json({ success: false, msg: "Server Error" });
    }
});

// 4. AUTH & JOIN
app.get('/auth', async (req, res) => {
    try {
        const { mode, user, pass, passConfirm, cb } = req.query;
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const callback = cb || 'authCB';
        
        // IP BAN CHECK
        const ipBanned = await IPBan.findOne({ ip });
        if (ipBanned) return res.send(`${callback}({success:false, msg:'IP_BANNED', isBanned: true});`);

        if (mode === 'check') {
            const pureName = user?.trim().toLowerCase();
            const existing = await User.findOne({ pureName });
            const isValid = /^[a-zA-Z0-9]{5,}$/.test(user || ""); 
            return res.send(`${callback}(${JSON.stringify({ taken: !!existing, valid: isValid })});`);
        }

        if (mode === 'register') {
            const validate = (str) => /^[a-zA-Z0-9]{5,}$/.test(str);
            if (!validate(user) || !validate(pass)) return res.send(`${callback}({success:false, msg:'Invalid chars'});`);
            if (pass !== passConfirm) return res.send(`${callback}({success:false, msg:'Mismatch'});`);
            try {
                const existing = await User.findOne({ pureName: user.trim().toLowerCase() });
                if (existing) return res.send(`${callback}({success:false, msg:'Taken'});`);
                
                const tag = Math.floor(1000 + Math.random() * 9000).toString();
                const randomColor = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
                
                await User.create({ 
                    username: `${user.trim()}#${tag}`, 
                    pureName: user.trim().toLowerCase(), 
                    password: pass, 
                    color: randomColor, 
                    lastIp: ip, 
                    lastSeen: Date.now() 
                });
                return res.send(`${callback}({success:true, msg:'Created'});`);
            } catch(e) { return res.send(`${callback}({success:false, msg:'Error'});`); }
        } else {
            // LOGIN
            const found = await User.findOne({ pureName: user?.trim().toLowerCase(), password: pass });
            if (!found) return res.send(`${callback}({success:false, msg:'Login failed'});`);
            
            // USER BAN CHECK
            if (found.isBanned && !found.isAdmin) {
                if (found.banExpires > 0 && Date.now() > found.banExpires) {
                    found.isBanned = false; found.banExpires = 0; await found.save();
                } else { 
                    const timeLeft = Math.ceil((found.banExpires - Date.now()) / 60000);
                    return res.send(`${callback}({success:false, msg: 'BANNED', isBanned: true, banTimeLeft: timeLeft + " min"});`); 
                }
            }

            found.lastIp = ip; found.lastSeen = Date.now();
            
            // JOIN MESSAGE
            if (!found.isOnlineNotify) {
                // Admin = Flash Red, User = Green
                if (found.isAdmin) {
                    await sysMsg("⚠️ THE ADMIN IS HERE! ⚠️", "#ff0000", false, null, false, "Main");
                } else {
                    await sysMsg(`${found.username} joined`, "#44ff44", false, null, false, "Main");
                }
                found.isOnlineNotify = true;
            }
            await found.save();
            return res.send(`${callback}({success:true, user: "${found.username}", color: "${found.color || '#fff'}", isAdmin: ${found.isAdmin}, status: "${found.status}", pass: "${found.password}", pfp: "${found.pfp || ""}"});`);
        }
    } catch(e) { res.send(`${cb || 'authCB'}({success:false, msg:'Server Error'});`); }
});

// 5. SEND MESSAGE & ADMIN COMMANDS
app.get('/send_safe', async (req, res) => {
    try {
        const { user, text, pass, room } = req.query;
        const currentRoom = room || "Main";
        const sender = await User.findOne({ username: user, password: pass });
        if (!sender) return res.send("console.log('Auth error');");
        if (sender.isBanned && !sender.isAdmin) return res.send("console.log('Banned');");

        // XP Logic
        sender.messagesSent++;
        sender.xp += 10;
        if (sender.xp >= sender.level * 100) {
            sender.level++; sender.xp = 0;
            await sysMsg(`${sender.username} reached Level ${sender.level}! ✨`, "#ffaa00", false, null, false, currentRoom);
        }
        await sender.save();
        await User.findOneAndUpdate({ username: user }, { typingAt: 0 }); // Stop typing
        
        // ADMIN COMMANDS
        if (sender.isAdmin && text.startsWith('/')) {
            const args = text.split(' '); const cmd = args[0].toLowerCase();
            
            if (cmd === '/alert') {
                const msg = args.slice(1).join(' ');
                await Config.findOneAndUpdate({ key: 'global_alert' }, { value: msg }, { upsert: true });
                setTimeout(async () => { await Config.deleteOne({ key: 'global_alert' }); }, 15000);
                return res.send("1");
            }
            
            if (cmd === '/clear') { 
                await Message.deleteMany({ room: currentRoom }); 
                await sysMsg("Chat cleared", "#ffff00", false, null, false, currentRoom); 
                return res.send("1"); 
            }
            
            if (cmd === '/ban' || cmd === '/ipban') {
                const t = await User.findOne({ username: { $regex: `#${args[1]}$` } });
                if(t && !t.isAdmin) {
                    t.isBanned = true; 
                    // Arg 2 is minutes
                    t.banExpires = (parseInt(args[2]) > 0) ? Date.now() + (parseInt(args[2]) * 60000) : 0;
                    if(cmd === '/ipban' && t.lastIp) await IPBan.create({ ip: t.lastIp });
                    await t.save(); 
                    await sysMsg(`${t.username} BANNED.`, "#ff0000", false, null, false, currentRoom);
                }
                return res.send("1");
            }
            
            if (cmd === '/reset') {
                const rId = Date.now().toString(); 
                const reason = args.slice(1).join(' ') || "Update";
                await Message.deleteMany({}); await DirectMessage.deleteMany({}); await Friendship.deleteMany({});
                await User.deleteMany({ isAdmin: false }); 
                await User.updateMany({ isAdmin: true }, { isOnlineNotify: false, lastIp: "", typingAt: 0, lastSeen: 0, level: 1, xp: 0, messagesSent: 0 });
                await Config.findOneAndUpdate({ key: 'reset_trigger' }, { value: rId }, { upsert: true }); 
                await Config.findOneAndUpdate({ key: 'reset_reason' }, { value: reason }, { upsert: true });
                await sysMsg("SYSTEM RESET", "#ff0000", true, null, true, "Main", reason);
                return res.send("1");
            }
            
            if (cmd === '/unban') {
                const t = await User.findOne({ username: { $regex: `#${args[1]}$` } });
                if(t) { 
                    t.isBanned = false; t.banExpires = 0; t.isShadowBanned = false; 
                    await t.save(); 
                    if(t.lastIp) await IPBan.deleteMany({ ip: t.lastIp }); 
                    await sysMsg(`${t.username} WAS UNBANNED.`, "#44ff44", false, null, false, currentRoom); 
                }
                return res.send("1");
            }
        }

        // SAVE MESSAGE (Card or Text)
        await Message.create({ 
            user, text, 
            color: sender.color, 
            status: sender.status, 
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
            room: currentRoom, 
            userIp: sender.lastIp,
            pfp: sender.pfp // Snapshot current PFP for chat history consistency
        });
        res.send("1");
    } catch(e) { res.send("0"); }
});

// 6. DELETE MSG
app.get('/delete', async (req, res) => {
    const { id, user, pass } = req.query;
    const requester = await User.findOne({ username: user, password: pass });
    if (!requester) return;
    
    if (requester.isAdmin) {
        await Message.findByIdAndUpdate(id, { text: "$$ADMIN_DEL$$", isSystem: false });
    } else {
        const msg = await Message.findById(id);
        if (msg && msg.user === requester.username) {
            await Message.findByIdAndUpdate(id, { text: "$$USER_DEL$$", isSystem: false });
        }
    }
    res.send("1");
});

// 7. TYPING
app.get('/typing', async (req, res) => {
    const { user, room } = req.query;
    await User.findOneAndUpdate({ username: user }, { typingAt: Date.now(), typingRoom: room });
    res.send("1");
});

// 8. LOGOUT NOTIFY
app.get('/logout_notify', async (req, res) => {
    const { user } = req.query;
    const found = await User.findOne({ username: user });
    if (found) {
        await sysMsg(`${found.username} LEFT THE ROOM.`, "#ff4444", false, null, false, "Main");
        found.isOnlineNotify = false;
        await found.save();
    }
    res.send("1");
});

// 9. CHECK UPDATES (The Heartbeat)
app.get('/check_updates', async (req, res) => {
    const { callback, user, room } = req.query;
    if (user) await User.updateOne({ username: user }, { lastSeen: Date.now() });
    
    // Counts for room dots
    const rooms = ["Main", "English", "German", "Buy & Sell"];
    const counts = {};
    for (let r of rooms) counts[r] = await Message.countDocuments({ room: r });
    
    // Typing
    const typingNow = await User.findOne({ typingAt: { $gt: Date.now() - 3000 }, typingRoom: room, username: { $ne: user } });
    
    // Online
    const onlineCount = await User.countDocuments({ lastSeen: { $gt: Date.now() - 60000 } });
    
    // Self Status
    let myColor = "#ffffff";
    let myPfp = "";
    let isBanned = false;
    let banTimeLeft = "";
    let globalAlert = null;
    let resetTrigger = null;
    let resetReason = "";

    // Config Check
    const ga = await Config.findOne({ key: 'global_alert' });
    if(ga) globalAlert = ga.value;
    const rt = await Config.findOne({ key: 'reset_trigger' });
    if(rt) resetTrigger = rt.value;
    const rr = await Config.findOne({ key: 'reset_reason' });
    if(rr) resetReason = rr.value;

    if (user) { 
        const me = await User.findOne({ username: user }); 
        if (me) {
            myColor = me.color;
            myPfp = me.pfp;
            isBanned = me.isBanned;
            if(isBanned && me.banExpires > 0) {
                banTimeLeft = Math.ceil((me.banExpires - Date.now()) / 60000) + " min";
            }
        } 
    }

    res.send(`${callback}(${JSON.stringify({ 
        counts, onlineCount, typingUser: typingNow ? typingNow.username : null,
        myColor, myPfp,
        isBanned, banTimeLeft,
        globalAlert, resetTrigger, resetReason
    })});`);
});

// 10. FETCH MESSAGES
app.get('/messages_jsonp', async (req, res) => {
    const { user, pass, room, callback } = req.query;
    const requester = await User.findOne({ username: user, password: pass });
    
    let msgs = await Message.find({ room: room || "Main" }).sort({ _id: -1 }).limit(50);
    msgs = msgs.reverse();
    const enrichedMsgs = [];
    const userCache = {};

    for (let m of msgs) {
        let msgObj = m.toObject();
        // If sender PFP is missing in msg, try fetch from user
        if (!msgObj.pfp || msgObj.pfp === "") {
            if (!userCache[msgObj.user]) {
                const u = await User.findOne({ username: msgObj.user });
                userCache[msgObj.user] = u ? u.pfp : "";
            }
            msgObj.pfp = userCache[msgObj.user];
        }
        
        // Admin sees IPs
        if (requester && requester.isAdmin && !msgObj.isSystem) {
            // IP is already in msg object as userIp
        } else {
            delete msgObj.userIp;
        }
        enrichedMsgs.push(msgObj);
    }
    res.send(`${callback}(${JSON.stringify(enrichedMsgs)});`);
});

app.use((err, req, res, next) => {
    if (err.type === 'entity.too.large') {
        res.status(413).json({ success: false, msg: 'File too large' });
    } else {
        res.status(500).json({ success: false, msg: 'Server Error' });
    }
});

app.listen(process.env.PORT || 10000);
