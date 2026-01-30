const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const app = express();

// --- MONGO DB CONNECTION ---
const mongoURI = "mongodb+srv://Smyle:stranac55@cluster0.qnqljpv.mongodb.net/?appName=Cluster0"; 

mongoose.connect(mongoURI, { serverSelectionTimeoutMS: 5000 })
    .then(() => console.log("Sub-Zero Backend: Online ❄️"))
    .catch(err => console.error("Database Error:", err));

app.use(cors());
app.use(express.json());

// --- MODELS ---
const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true }, // Name#1234
    pureName: { type: String, required: true }, // Name
    password: { type: String, required: true },
    color: { type: String, default: "#00d4ff" },
    isAdmin: { type: Boolean, default: false },
    lastIP: { type: String },
    isBanned: { type: Boolean, default: false },
    tag: { type: String, unique: true } // 1234
});

const MessageSchema = new mongoose.Schema({
    user: String, text: String, color: String, time: String, isAdmin: Boolean
});

const User = mongoose.model('User', UserSchema);
const Message = mongoose.model('Message', MessageSchema);

// Admin Auto-Create
async function initAdmin() {
    const admin = await User.findOne({ pureName: 'admin' });
    if (!admin) {
        await User.create({ 
            username: 'admin#0000', pureName: 'admin', password: '123', 
            color: '#ff3333', isAdmin: true, tag: '0000' 
        });
    }
}
initAdmin();

// --- ROUTES ---
app.get('/', (req, res) => res.send("API ACTIVE"));

app.get('/auth', async (req, res) => {
    const { mode, user, pass, cb } = req.query;
    const callback = cb || 'authCB';
    const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    if (mode === 'register') {
        try {
            const randomTag = Math.floor(1000 + Math.random() * 9000).toString();
            const fullUsername = `${user.trim()}#${randomTag}`;
            await User.create({ 
                username: fullUsername, pureName: user.trim(),
                password: pass, lastIP: clientIP, tag: randomTag
            });
            res.send(`${callback}({success:true, msg:'Registered as ${fullUsername}'});`);
        } catch (e) { res.send(`${callback}({success:false, msg:'Username taken'});`); }
    } else {
        // LOGIN: Search by pureName so ID is not required
        const found = await User.findOne({ pureName: user.trim(), password: pass });
        if (!found) return res.send(`${callback}({success:false, msg:'Invalid login'});`);
        if (found.isBanned) return res.send(`${callback}({isBanned: true});`);
        
        found.lastIP = clientIP;
        await found.save();
        res.send(`${callback}({success:true, user: "${found.username}", color: "${found.color}", isAdmin: ${found.isAdmin}});`);
    }
});

app.get('/messages_jsonp', async (req, res) => {
    const { callback = 'displayMessages', user } = req.query;
    // Check if user is banned while polling messages
    if (user) {
        const check = await User.findOne({ username: user });
        if (check && check.isBanned) return res.send(`showBanScreen();`);
    }
    const msgs = await Message.find().sort({ _id: -1 }).limit(100);
    res.send(`${callback}(${JSON.stringify(msgs.reverse())});`);
});

app.get('/send_safe', async (req, res) => {
    const { user, text, color, pass } = req.query;
    const sender = await User.findOne({ username: user, password: pass });

    if (!sender || sender.isBanned) return res.send("showBanScreen();");

    if (sender.isAdmin && text.startsWith('/')) {
        const parts = text.split(' ');
        const id = parts[1]?.replace('#', '');
        if (parts[0] === '/ban') {
            await User.findOneAndUpdate({ tag: id }, { isBanned: true });
            await Message.create({ user: 'SYSTEM', text: `ID #${id} BANNED`, color: '#ff3333' });
        }
        if (parts[0] === '/unban') {
            await User.findOneAndUpdate({ tag: id }, { isBanned: false });
            await Message.create({ user: 'SYSTEM', text: `ID #${id} UNBANNED`, color: '#00ff00' });
        }
        if (text === '/clear') await Message.deleteMany({});
        return res.send("console.log('Admin command ok');");
    }

    if(text.trim()) {
        await Message.create({
            user: user, text: text, color: sender.isAdmin ? "#ff3333" : (color || "#00d4ff"),
            isAdmin: sender.isAdmin, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
    }
    res.send("console.log('Sent');");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0');
