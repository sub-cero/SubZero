const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const app = express();

// --- KONFIGURATION ---
const mongoURI = "mongodb+srv://Smyle:stranac55@cluster0.qnqljpv.mongodb.net/?appName=Cluster0"; 
mongoose.connect(mongoURI).then(() => console.log("Sub-Zero V41: Smart Sorting Online ❄️")).catch(err => console.error("DB Error:", err));

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
    joinedAt: { type: Number, default: Date.now() },
    friends: { type: [String], default: [] },
    friendRequests: { type: [String], default: [] },
    ratingSum: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 }
}, { strict: false });

const ReviewSchema = new mongoose.Schema({
    target: String, 
    author: String, 
    stars: Number, 
    text: String,   
    date: { type: Number, default: Date.now() }
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
    pfp: String, 
    userIp: String 
});

const ConfigSchema = new mongoose.Schema({ key: String, value: String });

// --- MODELS ---
const User = mongoose.model('User', UserSchema);
const Review = mongoose.model('Review', ReviewSchema);
const IPBan = mongoose.model('IPBan', BanSchema);
const Message = mongoose.model('Message', MessageSchema);
const Config = mongoose.model('Config', ConfigSchema);

// --- HELPER ---
async function recalcRatings(username) {
    const reviews = await Review.find({ target: username });
    let sum = 0;
    reviews.forEach(r => sum += r.stars);
    await User.updateOne({ username: username }, { ratingSum: sum, ratingCount: reviews.length });
}

async function sysMsg(text, color = "#44ff44", room = "Main", isReset = false, reason = "") {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    try {
        return await Message.create({ 
            user: "SYSTEM", text, color, status: "SYS", time, 
            isSystem: true, room: room || "Main", isReset, resetReason: reason
        });
    } catch (e) {}
}

// --- LOOP ---
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

app.get('/auth', async (req, res) => {
    try {
        const { mode, user, pass, passConfirm, cb } = req.query;
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const callback = cb || 'authCB';
        
        const ipBanned = await IPBan.findOne({ ip });
        if (ipBanned) return res.send(`${callback}({success:false, msg:'IP_BANNED', isBanned: true});`);

        if (mode === 'check') {
            const pureName = user?.trim().toLowerCase();
            const existing = await User.findOne({ pureName });
            const isValid = user && user.length >= 5; 
            return res.send(`${callback}(${JSON.stringify({ taken: !!existing, valid: isValid })});`);
        }

        if (mode === 'register') {
            if (user.length < 5) return res.send(`${callback}({success:false, msg:'Too short'});`);
            if (pass !== passConfirm) return res.send(`${callback}({success:false, msg:'Mismatch'});`);
            try {
                const existing = await User.findOne({ pureName: user.trim().toLowerCase() });
                if (existing) return res.send(`${callback}({success:false, msg:'Taken'});`);
                const tag = Math.floor(1000 + Math.random() * 9000).toString();
                const randomColor = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
                await User.create({ username: `${user.trim()}#${tag}`, pureName: user.trim().toLowerCase(), password: pass, color: randomColor, lastIp: ip, lastSeen: Date.now() });
                return res.send(`${callback}({success:true, msg:'Created'});`);
            } catch(e) { return res.send(`${callback}({success:false, msg:'Error'});`); }
        } else {
            const found = await User.findOne({ pureName: user?.trim().toLowerCase(), password: pass });
            if (!found) return res.send(`${callback}({success:false, msg:'Login failed'});`);
            if (found.isBanned && !found.isAdmin) {
                if (found.banExpires > 0 && Date.now() > found.banExpires) {
                    found.isBanned = false; found.banExpires = 0; await found.save();
                } else { 
                    const timeLeft = Math.ceil((found.banExpires - Date.now()) / 60000);
                    return res.send(`${callback}({success:false, msg: 'BANNED', isBanned: true, banTimeLeft: timeLeft + " min"});`); 
                }
            }
            found.lastIp = ip; found.lastSeen = Date.now();
            if (!found.isOnlineNotify) {
                if (found.isAdmin) await sysMsg("⚠️ THE ADMIN IS HERE! ⚠️", "#ff0000", "Main");
                else await sysMsg(`${found.username} joined`, "#44ff44", "Main");
                found.isOnlineNotify = true;
            }
            if(!found.friends) found.friends = [];
            if(!found.friendRequests) found.friendRequests = [];
            await found.save();
            return res.send(`${callback}({success:true, user: "${found.username}", color: "${found.color || '#fff'}", isAdmin: ${found.isAdmin}, status: "${found.status}", pass: "${found.password}", pfp: "${found.pfp || ""}", friends: ${JSON.stringify(found.friends)}, requests: ${JSON.stringify(found.friendRequests)}});`);
        }
    } catch(e) { res.send(`${cb || 'authCB'}({success:false, msg:'Server Error'});`); }
});

app.get('/get_profile', async (req, res) => {
    try {
        const { target, cb } = req.query;
        const found = await User.findOne({ username: target });
        if (!found) return res.send(`${cb}({success:false});`);
        const avg = found.ratingCount > 0 ? (found.ratingSum / found.ratingCount).toFixed(1) : "0.0";
        res.send(`${cb}(${JSON.stringify({
            username: found.username, color: found.color || "#ffffff",
            isAdmin: found.isAdmin, status: found.status, customStatus: found.customStatus, 
            bio: found.bio, pfp: found.pfp || "",
            level: found.level, messages: found.messagesSent, 
            joinedAt: new Date(found.joinedAt).toLocaleDateString(),
            isOnline: found.lastSeen > Date.now() - 60000,
            ratingAvg: avg, ratingCount: found.ratingCount || 0
        })});`);
    } catch (e) { res.send(`${req.query.cb}({success:false});`); }
});

app.get('/get_reviews', async (req, res) => {
    try {
        const { target, cb } = req.query;
        const reviews = await Review.find({ target: target }).sort({ date: -1 }).limit(20);
        res.send(`${cb}(${JSON.stringify(reviews)});`);
    } catch (e) { res.send(`${req.query.cb}([]);`); }
});

app.get('/rate_user', async (req, res) => {
    try {
        const { user, pass, target, stars, text, cb } = req.query;
        const author = await User.findOne({ username: user, password: pass });
        if(!author) return res.send(`${cb}({success:false, msg:'Auth error'});`);
        const targetUser = await User.findOne({ username: target });
        if(!targetUser) return res.send(`${cb}({success:false, msg:'User not found'});`);
        if(user === target) return res.send(`${cb}({success:false, msg:'Self-rating denied'});`);
        
        const existing = await Review.findOne({ author: user, target: target });
        if(existing) return res.send(`${cb}({success:false, msg:'Already rated'});`);
        
        const starVal = parseInt(stars);
        if(starVal < 1 || starVal > 5) return res.send(`${cb}({success:false, msg:'Invalid stars'});`);

        await Review.create({ target: target, author: user, stars: starVal, text: text ? text.substring(0, 200) : "", date: Date.now() });
        await recalcRatings(target);
        res.send(`${cb}({success:true});`);
    } catch(e) { res.send(`${req.query.cb}({success:false, msg:'Error'});`); }
});

app.get('/delete_review', async (req, res) => {
    try {
        const { id, user, pass, cb } = req.query;
        const admin = await User.findOne({ username: user, password: pass });
        if(!admin || !admin.isAdmin) return res.send(`${cb}({success:false, msg:'No Permission'});`);
        const review = await Review.findById(id);
        if(!review) return res.send(`${cb}({success:false, msg:'Not found'});`);
        const targetName = review.target;
        await Review.findByIdAndDelete(id);
        await recalcRatings(targetName);
        res.send(`${cb}({success:true});`);
    } catch(e) { res.send(`${req.query.cb}({success:false});`); }
});

app.get('/update_profile_safe', async (req, res) => {
    try {
        const { user, bio, color, cb } = req.query;
        await User.updateOne({ username: user }, { $set: { bio: bio?.substring(0, 150), color } });
        res.send(`${cb}({success:true, color:"${color}"});`);
    } catch (e) { res.send(`${req.query.cb}({success:false});`); }
});

app.get('/send_safe', async (req, res) => {
    try {
        const { user, text, pass, room } = req.query;
        const currentRoom = room || "Main";
        const sender = await User.findOne({ username: user, password: pass });
        
        if (!sender) return res.send("0"); 
        if (sender.isBanned && !sender.isAdmin) return res.send("0"); 

        sender.messagesSent++;
        sender.xp += 10;
        if (sender.xp >= sender.level * 100) {
            sender.level++; sender.xp = 0;
            if(!currentRoom.startsWith("DM_")) await sysMsg(`${sender.username} reached Level ${sender.level}! ✨`, "#ffff00", currentRoom);
        }
        await sender.save();
        await User.findOneAndUpdate({ username: user }, { typingAt: 0 }); 

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
                    target.isBanned = false; target.banExpires = 0; await target.save(); 
                    if(target.lastIp) await IPBan.deleteMany({ ip: target.lastIp }); 
                    await sysMsg(`${target.username} WAS UNBANNED.`, "#44ff44", currentRoom); 
                }
                return res.send("1");
            }
            if (cmd === '/reset') {
                const reason = args.slice(1).join(' ') || "Maintenance";
                await Message.deleteMany({}); 
                await User.deleteMany({ isAdmin: false }); 
                await User.updateMany({ isAdmin: true }, { isOnlineNotify: false, lastIp: "", typingAt: 0, lastSeen: 0, level: 1, xp: 0, messagesSent: 0, friends: [], friendRequests: [], ratingSum: 0, ratingCount: 0 });
                await Review.deleteMany({});
                await Config.findOneAndUpdate({ key: 'reset_trigger' }, { value: Date.now().toString() }, { upsert: true }); 
                await Config.findOneAndUpdate({ key: 'reset_reason' }, { value: reason }, { upsert: true });
                await sysMsg("SYSTEM RESET INITIATED", "#ff0000", "Main", true, reason);
                return res.send("1");
            }
        }

        await Message.create({ user, text, color: sender.color, status: sender.status, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), room: currentRoom, pfp: sender.pfp, userIp: sender.lastIp });
        res.send("1");
    } catch(e) { res.send("0"); }
});

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

app.get('/check_updates', async (req, res) => {
    const { callback, user, room } = req.query;
    if (user) await User.updateOne({ username: user }, { lastSeen: Date.now() });
    
    const rooms = ["Main", "English", "German", "Buy & Sell"];
    const counts = {};
    for (let r of rooms) counts[r] = await Message.countDocuments({ room: r });
    
    if(user) {
        const dmRooms = await Message.distinct('room', { room: { $regex: 'DM_' } });
        for(let r of dmRooms) {
            if(r.includes(user)) counts[r] = await Message.countDocuments({ room: r });
        }
    }

    const typingNow = await User.findOne({ typingAt: { $gt: Date.now() - 3000 }, typingRoom: room, username: { $ne: user } });
    const onlineCount = await User.countDocuments({ lastSeen: { $gt: Date.now() - 60000 } });
    
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
        globalAlert, resetTrigger, resetReason,
        friends: me ? me.friends : [],
        requests: me ? me.friendRequests : []
    })});`);
});

app.get('/messages_jsonp', async (req, res) => {
    const { room, callback } = req.query;
    let msgs = await Message.find({ room: room || "Main" }).sort({ _id: -1 }).limit(50);
    res.send(`${callback}(${JSON.stringify(msgs.reverse())});`);
});

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

app.get('/friend_request', async (req, res) => {
    const { user, pass, targetName, action } = req.query;
    const me = await User.findOne({ username: user, password: pass });
    if(!me) return res.send("0");
    try {
        if(action === 'send') {
            const target = await User.findOne({ username: targetName });
            if(!target || target.friends.includes(me.username) || target.friendRequests.includes(me.username)) return; 
            target.friendRequests.push(me.username);
            await target.save();
        } else if(action === 'accept') {
            const target = await User.findOne({ username: targetName });
            if(!target) return;
            me.friendRequests = me.friendRequests.filter(u => u !== targetName);
            if(!me.friends.includes(targetName)) me.friends.push(targetName);
            await me.save();
            if(!target.friends.includes(me.username)) target.friends.push(me.username);
            await target.save();
        } else if(action === 'decline') {
            me.friendRequests = me.friendRequests.filter(u => u !== targetName);
            await me.save();
        } else if(action === 'remove') {
            const target = await User.findOne({ username: targetName });
            me.friends = me.friends.filter(u => u !== targetName);
            await me.save();
            if(target) { target.friends = target.friends.filter(u => u !== me.username); await target.save(); }
        }
        res.send("1");
    } catch(e) { res.send("0"); }
});

app.listen(process.env.PORT || 10000);
