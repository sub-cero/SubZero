const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const app = express();

// --- KONFIGURATION ---
const mongoURI = "mongodb+srv://Smyle:stranac55@cluster0.qnqljpv.mongodb.net/?appName=Cluster0"; 
mongoose.connect(mongoURI).then(() => console.log("Sub-Zero V32: Stable Backend Online ❄️")).catch(err => console.error("DB Error:", err));

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
    pfp: String, 
    userIp: String 
});

const ConfigSchema = new mongoose.Schema({ key: String, value: String });

// --- MODELS ---
const User = mongoose.model('User', UserSchema);
const IPBan = mongoose.model('IPBan', BanSchema);
const Message = mongoose.model('Message', MessageSchema);
const Config = mongoose.model('Config', ConfigSchema);

// --- SYSTEM NACHRICHTEN ---
async function sysMsg(text, color = "#44ff44", room = "Main", isReset = false, reason = "") {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    try {
        return await Message.create({ 
            user: "SYSTEM", text, color, status: "SYS", time, 
            isSystem: true, room: room || "Main", isReset, resetReason: reason
        });
    } catch (e) {}
}

// --- AUTOMATISCHER LEAVE CHECK (Alle 15s) ---
setInterval(async () => {
    try {
        const minuteAgo = Date.now() - 60000;
        const lostUsers = await User.find({ lastSeen: { $lt: minuteAgo }, isOnlineNotify: true });
        for (let u of lostUsers) {
            // LEAVE NACHRICHT IN ROT
            await sysMsg(`${u.username} left the room.`, "#ff4444", "Main");
            u.isOnlineNotify = false;
            await u.save();
        }
    } catch (e) {}
}, 15000);

// --- ENDPOINTS ---

// 1. LOGIN & REGISTER
app.get('/auth', async (req, res) => {
    try {
        const { mode, user, pass, passConfirm, cb } = req.query;
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const callback = cb || 'authCB';
        
        // IP Check
        const ipBanned = await IPBan.findOne({ ip });
        if (ipBanned) return res.send(`${callback}({success:false, msg:'IP_BANNED', isBanned: true});`);

        // Check Availability
        if (mode === 'check') {
            const pureName = user?.trim().toLowerCase();
            const existing = await User.findOne({ pureName });
            const isValid = user && user.length >= 5; 
            return res.send(`${callback}(${JSON.stringify({ taken: !!existing, valid: isValid })});`);
        }

        // Register
        if (mode === 'register') {
            if (user.length < 5) return res.send(`${callback}({success:false, msg:'Too short'});`);
            if (pass !== passConfirm) return res.send(`${callback}({success:false, msg:'Mismatch'});`);
            
            try {
                const existing = await User.findOne({ pureName: user.trim().toLowerCase() });
                if (existing) return res.send(`${callback}({success:false, msg:'Taken'});`);
                
                const tag = Math.floor(1000 + Math.random() * 9000).toString();
                const randomColor = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
                
                await User.create({ 
                    username: `${user.trim()}#${tag}`, pureName: user.trim().toLowerCase(), 
                    password: pass, color: randomColor, lastIp: ip, lastSeen: Date.now() 
                });
                return res.send(`${callback}({success:true, msg:'Created'});`);
            } catch(e) { return res.send(`${callback}({success:false, msg:'Error'});`); }
        } 
        
        // Login
        else {
            const found = await User.findOne({ pureName: user?.trim().toLowerCase(), password: pass });
            if (!found) return res.send(`${callback}({success:false, msg:'Login failed'});`);
            
            // Bann Check
            if (found.isBanned && !found.isAdmin) {
                if (found.banExpires > 0 && Date.now() > found.banExpires) {
                    found.isBanned = false; found.banExpires = 0; await found.save();
                } else { 
                    const timeLeft = Math.ceil((found.banExpires - Date.now()) / 60000);
                    return res.send(`${callback}({success:false, msg: 'BANNED', isBanned: true, banTimeLeft: timeLeft + " min"});`); 
                }
            }

            found.lastIp = ip; found.lastSeen = Date.now();
            
            // Join Nachricht (Nur wenn Status offline war)
            if (!found.isOnlineNotify) {
                if (found.isAdmin) {
                    // ADMIN JOIN (Rot & Warnung)
                    await sysMsg("⚠️ THE ADMIN IS HERE! ⚠️", "#ff0000", "Main");
                } else {
                    // USER JOIN (Grün)
                    await sysMsg(`${found.username} joined`, "#44ff44", "Main");
                }
                found.isOnlineNotify = true;
            }
            await found.save();
            return res.send(`${callback}({success:true, user: "${found.username}", color: "${found.color || '#fff'}", isAdmin: ${found.isAdmin}, status: "${found.status}", pass: "${found.password}", pfp: "${found.pfp || ""}"});`);
        }
    } catch(e) { res.send(`${cb || 'authCB'}({success:false, msg:'Server Error'});`); }
});

// 2. PROFIL ABFRAGEN
app.get('/get_profile', async (req, res) => {
    try {
        const { target, cb } = req.query;
        const found = await User.findOne({ username: target });
        if (!found) return res.send(`${cb}({success:false});`);
        res.send(`${cb}(${JSON.stringify({
            username: found.username, color: found.color || "#ffffff",
            isAdmin: found.isAdmin, status: found.status, customStatus: found.customStatus, 
            bio: found.bio, pfp: found.pfp || "",
            level: found.level, messages: found.messagesSent, 
            joinedAt: new Date(found.joinedAt).toLocaleDateString(),
            isOnline: found.lastSeen > Date.now() - 60000
        })});`);
    } catch (e) { res.send(`${req.query.cb}({success:false});`); }
});

// 3. PROFIL UPDATES (Safe via GET & POST für Bilder)
app.get('/update_profile_safe', async (req, res) => {
    try {
        const { user, bio, color, cb } = req.query;
        await User.updateOne({ username: user }, { $set: { bio: bio?.substring(0, 150), color } });
        res.send(`${cb}({success:true, color:"${color}"});`);
    } catch (e) { res.send(`${req.query.cb}({success:false});`); }
});

app.post('/update_profile_post', async (req, res) => {
    try {
        const { user, pass, bio, customStatus, pfp } = req.body;
        const updateDoc = {};
        if(bio !== undefined) updateDoc.bio = bio.substring(0, 150);
        if(customStatus !== undefined) updateDoc.customStatus = customStatus;
        if(pfp !== undefined) updateDoc.pfp = pfp; 

        await User.updateOne({ username: user, password: pass }, { $set: updateDoc });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

// 4. NACHRICHTEN SENDEN & ADMIN BEFEHLE
app.get('/send_safe', async (req, res) => {
    try {
        const { user, text, pass, room } = req.query;
        const currentRoom = room || "Main";
        const sender = await User.findOne({ username: user, password: pass });
        
        if (!sender) return res.send("0"); // Auth fail
        if (sender.isBanned && !sender.isAdmin) return res.send("0"); // Ban fail

        // XP System
        sender.messagesSent++;
        sender.xp += 10;
        if (sender.xp >= sender.level * 100) {
            sender.level++; sender.xp = 0;
            await sysMsg(`${sender.username} reached Level ${sender.level}! ✨`, "#ffff00", currentRoom);
        }
        await sender.save();
        await User.findOneAndUpdate({ username: user }, { typingAt: 0 }); // Typing stop

        // --- ADMIN COMMANDS ---
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
                await sysMsg("CHAT CLEARED", "#ffff00", currentRoom); 
                return res.send("1"); 
            }
            if (cmd === '/ban' || cmd === '/ipban') {
                const target = await User.findOne({ username: { $regex: `#${args[1]}$` } });
                if(target && !target.isAdmin) {
                    target.isBanned = true; 
                    target.banExpires = (parseInt(args[2]) > 0) ? Date.now() + (parseInt(args[2]) * 60000) : 0;
                    if(cmd === '/ipban' && target.lastIp) await IPBan.create({ ip: target.lastIp });
                    await target.save(); 
                    await sysMsg(`${target.username} BANNED.`, "#ff0000", currentRoom);
                }
                return res.send("1");
            }
            if (cmd === '/unban') {
                const target = await User.findOne({ username: { $regex: `#${args[1]}$` } });
                if(target) { 
                    target.isBanned = false; target.banExpires = 0; 
                    await target.save(); 
                    if(target.lastIp) await IPBan.deleteMany({ ip: target.lastIp }); 
                    await sysMsg(`${target.username} WAS UNBANNED.`, "#44ff44", currentRoom); 
                }
                return res.send("1");
            }
            if (cmd === '/reset') {
                const reason = args.slice(1).join(' ') || "Maintenance";
                await Message.deleteMany({}); 
                await User.deleteMany({ isAdmin: false }); 
                await User.updateMany({ isAdmin: true }, { isOnlineNotify: false, lastIp: "", typingAt: 0, lastSeen: 0, level: 1, xp: 0, messagesSent: 0 });
                // Reset Trigger aktualisieren (ID ändert sich -> Frontend erkennt Wipe)
                await Config.findOneAndUpdate({ key: 'reset_trigger' }, { value: Date.now().toString() }, { upsert: true }); 
                await Config.findOneAndUpdate({ key: 'reset_reason' }, { value: reason }, { upsert: true });
                await sysMsg("SYSTEM RESET INITIATED", "#ff0000", "Main", true, reason);
                return res.send("1");
            }
        }

        // Normale Nachricht (inkl. $$MARKET$$)
        await Message.create({ 
            user, text, 
            color: sender.color, 
            status: sender.status, 
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
            room: currentRoom, 
            pfp: sender.pfp,
            userIp: sender.lastIp 
        });
        res.send("1");
    } catch(e) { res.send("0"); }
});

// 5. NACHRICHTEN LÖSCHEN
app.get('/delete', async (req, res) => {
    const { id, user, pass } = req.query;
    const reqUser = await User.findOne({ username: user, password: pass });
    if (!reqUser) return;
    
    if (reqUser.isAdmin) {
        await Message.findByIdAndUpdate(id, { text: "$$ADMIN_DEL$$", isSystem: false });
    } else {
        const msg = await Message.findById(id);
        if (msg && msg.user === reqUser.username) {
            await Message.findByIdAndUpdate(id, { text: "$$USER_DEL$$", isSystem: false });
        }
    }
    res.send("1");
});

// 6. HEARTBEAT (Update Check)
app.get('/check_updates', async (req, res) => {
    const { callback, user, room } = req.query;
    if (user) await User.updateOne({ username: user }, { lastSeen: Date.now() });
    
    // Room Dots (Nachrichten zählen)
    const rooms = ["Main", "English", "German", "Buy & Sell"];
    const counts = {};
    for (let r of rooms) counts[r] = await Message.countDocuments({ room: r });
    
    // Typing
    const typingNow = await User.findOne({ typingAt: { $gt: Date.now() - 3000 }, typingRoom: room, username: { $ne: user } });
    
    // Online Counter
    const onlineCount = await User.countDocuments({ lastSeen: { $gt: Date.now() - 60000 } });
    
    // User Status & Configs
    let me = null;
    let globalAlert = null;
    let resetTrigger = null;
    let resetReason = "";

    const ga = await Config.findOne({ key: 'global_alert' }); if(ga) globalAlert = ga.value;
    const rt = await Config.findOne({ key: 'reset_trigger' }); if(rt) resetTrigger = rt.value;
    const rr = await Config.findOne({ key: 'reset_reason' }); if(rr) resetReason = rr.value;

    if (user) me = await User.findOne({ username: user });

    res.send(`${callback}(${JSON.stringify({ 
        counts, onlineCount, 
        typingUser: typingNow ? typingNow.username : null,
        myColor: me ? me.color : "#ffffff",
        myPfp: me ? me.pfp : "",
        isBanned: me ? me.isBanned : false,
        banTimeLeft: me && me.banExpires > 0 ? Math.ceil((me.banExpires - Date.now()) / 60000) + " min" : "",
        globalAlert, resetTrigger, resetReason
    })});`);
});

// 7. NACHRICHTEN LADEN
app.get('/messages_jsonp', async (req, res) => {
    const { room, callback } = req.query;
    let msgs = await Message.find({ room: room || "Main" }).sort({ _id: -1 }).limit(50);
    res.send(`${callback}(${JSON.stringify(msgs.reverse())});`);
});

// 8. TYPING & LOGOUT
app.get('/typing', async (req, res) => {
    await User.findOneAndUpdate({ username: req.query.user }, { typingAt: Date.now(), typingRoom: req.query.room });
    res.send("1");
});

app.get('/logout_notify', async (req, res) => {
    const { user, room } = req.query;
    const found = await User.findOne({ username: user });
    if (found) {
        await sysMsg(`${found.username} left the room.`, "#ff4444", room || "Main");
        found.isOnlineNotify = false; await found.save();
    }
    res.send("1");
});

app.listen(process.env.PORT || 10000);
