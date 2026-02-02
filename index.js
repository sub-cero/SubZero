const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); 
const https = require('https');
const app = express();

const mongoURI = "mongodb+srv://Smyle:stranac55@cluster0.qnqljpv.mongodb.net/?appName=Cluster0"; 
mongoose.connect(mongoURI).then(() => console.log("Sub-Zero V60: Speed & Ban Fix 🚀")).catch(err => console.error("DB Error:", err));

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.set('trust proxy', 1);

const sendJS = (res, callback, data) => {
    res.type('application/javascript'); 
    res.status(200).send(`${callback}(${JSON.stringify(data)});`);
};

app.get('/ping', (req, res) => { res.status(200).send('pong'); });

setInterval(() => {
    https.get("https://subzero-hc18.onrender.com/ping", (res) => {}).on('error', (e) => console.error("Ping Error:", e.message));
}, 30000);

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
    ratingCount: { type: Number, default: 0 },
    isVerified: { type: Boolean, default: false }
}, { strict: false });

const ReviewSchema = new mongoose.Schema({
    target: String, author: String, stars: Number, text: String, isVerified: { type: Boolean, default: false }, date: { type: Number, default: Date.now() }
});

const BanSchema = new mongoose.Schema({ ip: String });

const MessageSchema = new mongoose.Schema({ 
    user: String, text: String, color: String, time: String, 
    status: String, room: { type: String, default: "Main" },
    isSystem: { type: Boolean, default: false },
    isReset: { type: Boolean, default: false },
    resetReason: { type: String, default: "" },
    pfp: String, userIp: String, isVerified: { type: Boolean, default: false }
});

const ConfigSchema = new mongoose.Schema({ key: String, value: String });

const User = mongoose.model('User', UserSchema);
const Review = mongoose.model('Review', ReviewSchema);
const IPBan = mongoose.model('IPBan', BanSchema);
const Message = mongoose.model('Message', MessageSchema);
const Config = mongoose.model('Config', ConfigSchema);

async function validateUser(inputName, plainPassword) {
    if(!inputName) return null;
    const cleanName = inputName.trim();
    let user = await User.findOne({ pureName: cleanName.toLowerCase() });
    if (!user) user = await User.findOne({ username: cleanName });
    if (!user) return null;
    let isMatch = false;
    try {
        if (user.password && user.password.startsWith('$')) { isMatch = await bcrypt.compare(plainPassword, user.password); }
    } catch (e) { isMatch = false; }
    if (!isMatch && user.password === plainPassword) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(plainPassword, salt);
        await user.save();
        isMatch = true;
    }
    return isMatch ? user : null;
}

async function recalcRatings(username) {
    const reviews = await Review.find({ target: username });
    let sum = 0; reviews.forEach(r => sum += r.stars);
    await User.updateOne({ username: username }, { ratingSum: sum, ratingCount: reviews.length });
}

async function sysMsg(text, color = "#44ff44", room = "Main", isReset = false, reason = "") {
    try { await Message.create({ user: "SYSTEM", text, color, status: "SYS", time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), isSystem: true, room: room || "Main", isReset, resetReason: reason }); } catch (e) {}
}

setInterval(async () => {
    try {
        const minuteAgo = Date.now() - 60000;
        const lostUsers = await User.find({ lastSeen: { $lt: minuteAgo }, isOnlineNotify: true });
        for (let u of lostUsers) {
            await sysMsg(`${u.username} left the room.`, "#ff4444", "Main");
            u.isOnlineNotify = false; await u.save();
        }
    } catch (e) {}
}, 15000);

app.get('/auth', async (req, res) => {
    const cb = req.query.cb || 'callback';
    try {
        const { mode, user, pass } = req.query;
        const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || "";
        const ipList = rawIp.split(',');
        const realIp = ipList.length > 1 ? ipList[1].trim() : ipList[0].trim();

        const ipBanned = await IPBan.findOne({ ip: realIp });
        if (ipBanned) return sendJS(res, cb, {success:false, msg:'IP_BANNED', isBanned: true});

        if (mode === 'check') {
            const pureName = user?.trim().toLowerCase();
            const existing = await User.findOne({ pureName });
            return sendJS(res, cb, { taken: !!existing, valid: user && user.length >= 5 });
        }
        
        if (mode === 'register') {
            const existing = await User.findOne({ pureName: user.trim().toLowerCase() });
            if (existing) return sendJS(res, cb, {success:false, msg:'Taken'});
            
            const hashedPassword = await bcrypt.hash(pass, 10);
            const userCount = await User.countDocuments({});
            const makeAdmin = (userCount === 0 || user.toLowerCase() === 'superadmin');

            await User.create({ 
                username: `${user.trim()}#${Math.floor(1000+Math.random()*9000)}`, 
                pureName: user.trim().toLowerCase(), password: hashedPassword, 
                color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0'), 
                lastIp: realIp, lastSeen: Date.now(), isAdmin: makeAdmin 
            });
            return sendJS(res, cb, {success:true, msg:'Created'});
        } else {
            const found = await validateUser(user, pass);
            if (!found) return sendJS(res, cb, {success:false, msg:'Login failed'});
            
            if (found.isBanned && !found.isAdmin) {
                if (found.banExpires > 0 && Date.now() > found.banExpires) { found.isBanned = false; await found.save(); } 
                else return sendJS(res, cb, {success:false, msg: 'BANNED', isBanned: true, banExpires: found.banExpires}); 
            }
            
            found.lastIp = realIp; found.lastSeen = Date.now();
            if (!found.isOnlineNotify) {
                if (found.isAdmin) await sysMsg("⚠️ THE ADMIN IS HERE! ⚠️", "#ff0000", "Main");
                else await sysMsg(`${found.username} joined`, "#44ff44", "Main");
                found.isOnlineNotify = true;
            }
            if(!found.friends) found.friends = [];
            if(!found.friendRequests) found.friendRequests = [];
            await found.save();
            
            return sendJS(res, cb, {
                success:true, 
                user: found.username, 
                color: found.color, 
                isAdmin: found.isAdmin, 
                status: found.status, 
                pfp: found.pfp || "", 
                isVerified: found.isVerified || false, 
                friends: found.friends, 
                requests: found.friendRequests
            });
        }
    } catch(e) { 
        console.error(e);
        sendJS(res, cb, {success:false, msg:'Server Error'}); 
    }
});

app.get('/get_profile', async (req, res) => {
    const found = await User.findOne({ username: req.query.target });
    if (!found) return sendJS(res, req.query.cb, {success:false});
    const avg = found.ratingCount > 0 ? (found.ratingSum / found.ratingCount).toFixed(1) : "0.0";
    sendJS(res, req.query.cb, { username: found.username, color: found.color, isAdmin: found.isAdmin, status: found.status, customStatus: found.customStatus, bio: found.bio, level: found.level, messages: found.messagesSent, joinedAt: new Date(found.joinedAt).toLocaleDateString(), isOnline: found.lastSeen > Date.now() - 60000, isVerified: found.isVerified, ratingAvg: avg, ratingCount: found.ratingCount });
});

app.get('/get_reviews', async (req, res) => {
    const reviews = await Review.find({ target: req.query.target }).sort({ isVerified: -1, date: -1 }).limit(20);
    sendJS(res, req.query.cb, reviews);
});

app.get('/rate_user', async (req, res) => {
    const { user, pass, target, stars, text, verified, cb } = req.query;
    const author = await validateUser(user, pass);
    if(!author) return sendJS(res, cb, {success:false});
    const targetUser = await User.findOne({ username: target });
    if(user === target || !targetUser) return sendJS(res, cb, {success:false});
    
    let isVer = false;
    if(author.isAdmin) {
        isVer = (verified === 'true');
        targetUser.isVerified = isVer; await targetUser.save();
        await Message.updateMany({ user: target }, { isVerified: isVer });
    }
    await Review.create({ target, author: user, stars: parseInt(stars), text: text || "", isVerified: isVer, date: Date.now() });
    await recalcRatings(target);
    sendJS(res, cb, {success:true});
});

app.get('/delete_review', async (req, res) => {
    const admin = await validateUser(req.query.user, req.query.pass);
    if(!admin || !admin.isAdmin) return sendJS(res, req.query.cb, {success:false});
    await Review.findByIdAndDelete(req.query.id);
    await recalcRatings(req.query.target); 
    sendJS(res, req.query.cb, {success:true});
});

app.get('/update_profile_safe', async (req, res) => {
    await User.updateOne({ username: req.query.user }, { $set: { bio: req.query.bio, color: req.query.color } });
    sendJS(res, req.query.cb, {success:true, color:req.query.color});
});

app.get('/send_safe', async (req, res) => {
    res.type('application/javascript');
    
    const { user, text, pass, room } = req.query;
    const sender = await validateUser(user, pass);
    if (!sender) return res.send("/* Auth Failed */"); 
    if (sender.isBanned && !sender.isAdmin) return res.send("/* Banned */"); 
    if (room === 'News & Updates' && !sender.isAdmin) return res.send("/* No Perms */");

    if (sender.isAdmin && text.startsWith('/')) {
        const args = text.split(' '); 
        const cmd = args[0].toLowerCase();
        const targetName = args[1]; 

        if (cmd === '/alert') {
            await Config.findOneAndUpdate({ key: 'global_alert' }, { value: args.slice(1).join(' ') }, { upsert: true });
            setTimeout(async () => { await Config.deleteOne({ key: 'global_alert' }); }, 15000);
            return res.send("/* Alert Sent */");
        }
        if (cmd === '/clear') { 
            await Message.deleteMany({ room }); 
            await sysMsg("CHAT CLEARED", "#ffff00", room); 
            return res.send("/* Cleared */"); 
        }
        if (cmd === '/ban' || cmd === '/ipban') {
            const target = await User.findOne({ 
                $or: [{ username: targetName }, { username: new RegExp(targetName + "$", "i") }] 
            });
            
            if(target && !target.isAdmin) {
                target.isBanned = true; 
                let duration = 0;
                if(args[2]) duration = parseInt(args[2]) > 999 ? 3e12 : (parseInt(args[2]) * 60 * 60000); 
                target.banExpires = Date.now() + duration;
                
                if(cmd === '/ipban') await IPBan.create({ ip: target.lastIp });
                await target.save();
                await sysMsg(`${target.username} has been BANNED.`, "#ff0000", room);
            }
            return res.send("/* Banned */");
        }
        if (cmd === '/unban') {
            const target = await User.findOne({ 
                $or: [{ username: targetName }, { username: new RegExp(targetName + "$", "i") }] 
            });
            if(target) { 
                target.isBanned = false; 
                await target.save(); 
                await IPBan.deleteMany({ ip: target.lastIp }); 
                await sysMsg(`${target.username} has been UNBANNED.`, "#44ff44", room); 
            }
            return res.send("/* Unbanned */");
        }
        if (cmd === '/reset') {
            await Message.deleteMany({}); 
            await User.deleteMany({ isAdmin: false }); 
            await Review.deleteMany({});
            await Config.findOneAndUpdate({ key: 'reset_trigger' }, { value: Date.now().toString() }, { upsert: true });
            await Config.findOneAndUpdate({ key: 'reset_reason' }, { value: args.slice(1).join(' ') || "Maintenance" }, { upsert: true });
            await sysMsg("SYSTEM RESET", "#ff0000", "Main", true);
            return res.send("/* Reset */");
        }
    }

    const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || "";
    sender.messagesSent++;
    if ((sender.xp += 10) >= sender.level * 100) { 
        sender.level++; sender.xp = 0; 
        await sysMsg(`${sender.username} reached Level ${sender.level}! ✨`, "#ffff00", room); 
    }
    await sender.save(); 
    await User.findOneAndUpdate({ username: user }, { typingAt: 0 });
    
    await Message.create({ 
        user, text, color: sender.color, status: sender.status, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
        room: room || "Main", pfp: sender.pfp, userIp: rawIp, isVerified: sender.isVerified 
    });
    res.send("/* Message Sent */");
});

app.get('/delete', async (req, res) => {
    const reqUser = await validateUser(req.query.user, req.query.pass);
    if (!reqUser) return res.type('application/javascript').send("/* Auth fail */");
    if (reqUser.isAdmin) await Message.findByIdAndUpdate(req.query.id, { text: "$$ADMIN_DEL$$", isSystem: false });
    else await Message.findOneAndUpdate({ _id: req.query.id, user: reqUser.username }, { text: "$$USER_DEL$$", isSystem: false });
    res.type('application/javascript').send("/* Deleted */");
});

// --- OPTIMIZED UPDATE CHECK (PARALLEL) ---
app.get('/check_updates', async (req, res) => {
    const { user, room } = req.query;
    
    // 1. Update Last Seen (Async, don't wait)
    if (user) User.updateOne({ username: user }, { lastSeen: Date.now() }).exec();

    // 2. Parallel Database Queries (SPEED BOOST)
    const [counts, typing, ga, rt, rr, me, onlineCount] = await Promise.all([
        (async () => {
            const c = {};
            const rooms = ["Main", "English", "German", "Buy & Sell", "News & Updates"];
            // Get DMs if user exists
            if(user) {
                const dms = await Message.distinct('room', { room: { $regex: 'DM_' } });
                dms.forEach(r => { if(r.includes(user)) rooms.push(r); });
            }
            // Count all concurrently
            const results = await Promise.all(rooms.map(r => Message.countDocuments({ room: r })));
            rooms.forEach((r, i) => c[r] = results[i]);
            return c;
        })(),
        User.findOne({ typingAt: { $gt: Date.now() - 3000 }, typingRoom: room, username: { $ne: user } }).select('username'),
        Config.findOne({ key: 'global_alert' }),
        Config.findOne({ key: 'reset_trigger' }),
        Config.findOne({ key: 'reset_reason' }),
        user ? User.findOne({ username: user }).select('color isBanned banExpires friends friendRequests') : null,
        User.countDocuments({ lastSeen: { $gt: Date.now() - 60000 } })
    ]);

    sendJS(res, req.query.callback, { 
        counts, 
        onlineCount, 
        typingUser: typing ? typing.username : null,
        myColor: me ? me.color : "#ffffff", 
        isBanned: me ? me.isBanned : false, 
        banExpires: me ? me.banExpires : 0,
        globalAlert: ga ? ga.value : null, 
        resetTrigger: rt ? rt.value : null, 
        resetReason: rr ? rr.value : "",
        friends: me ? me.friends : [], 
        requests: me ? me.friendRequests : []
    });
});

app.get('/messages_jsonp', async (req, res) => {
    const { requester, reqPass } = req.query;
    let projection = { userIp: 0 };
    if (requester && reqPass) {
        const admin = await validateUser(requester, reqPass);
        if (admin && admin.isAdmin) projection = {}; 
    }
    const msgs = await Message.find({ room: req.query.room || "Main" }, projection).sort({ _id: -1 }).limit(50);
    sendJS(res, req.query.callback, msgs.reverse());
});

app.get('/typing', async (req, res) => { await User.findOneAndUpdate({ username: req.query.user }, { typingAt: Date.now(), typingRoom: req.query.room }); res.type('application/javascript').send("/* typing */"); });
app.get('/logout_notify', async (req, res) => { await sysMsg(`${req.query.user} left.`, "#ff4444", req.query.room); res.type('application/javascript').send("/* bye */"); });
app.get('/friend_request', async (req, res) => {
    const { user, pass, targetName, action } = req.query;
    const me = await validateUser(user, pass); if(!me) return res.type('application/javascript').send("0");
    const target = await User.findOne({ username: targetName });
    if (action === 'send' && target && !target.friends.includes(me.username)) { target.friendRequests.push(me.username); await target.save(); }
    if (action === 'accept' && target) { 
        me.friendRequests = me.friendRequests.filter(u => u !== targetName); me.friends.push(targetName); await me.save();
        target.friends.push(me.username); await target.save();
    }
    if (action === 'decline') { me.friendRequests = me.friendRequests.filter(u => u !== targetName); await me.save(); }
    if (action === 'remove' && target) {
        me.friends = me.friends.filter(u => u !== targetName); await me.save();
        target.friends = target.friends.filter(u => u !== me.username); await target.save();
    }
    res.type('application/javascript').send("/* Freq done */");
});

app.listen(process.env.PORT || 10000);
