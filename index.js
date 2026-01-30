const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const app = express();

// --- MONGO DB CONNECTION ---
const mongoURI = "mongodb+srv://Smyle:stranac55@cluster0.qnqljpv.mongodb.net/?appName=Cluster0"; 

mongoose.connect(mongoURI, { serverSelectionTimeoutMS: 5000 })
    .then(() => console.log("Sub-Zero Database: Connected ❄️"))
    .catch(err => console.error("Database Error:", err));

app.use(cors());
app.use(express.json());

// --- MODELL-UPGRADE ---
const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    color: { type: String, default: "#00d4ff" },
    isAdmin: { type: Boolean, default: false },
    lastIP: { type: String },
    isBanned: { type: Boolean, default: false }
});

const MessageSchema = new mongoose.Schema({
    user: String, text: String, color: String, time: String, isAdmin: Boolean
});

const User = mongoose.model('User', UserSchema);
const Message = mongoose.model('Message', MessageSchema);

// Admin Initialisierung
async function initAdmin() {
    const admin = await User.findOne({ username: 'admin' });
    if (!admin) {
        await User.create({ username: 'admin', password: '123', color: '#ff3333', isAdmin: true });
    }
}
initAdmin();

// --- ROUTES ---

// Ping für Cron-Job
app.get('/', (req, res) => res.send("Server Alive ❄️"));

app.get('/auth', async (req, res) => {
    const { mode, user, pass, cb } = req.query;
    const callback = cb || 'authCB';
    const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    if (mode === 'register') {
        try {
            const id = Math.floor(1000 + Math.random() * 9000);
            const userWithID = `${user}#${id}`;
            await User.create({ username: userWithID, password: pass, lastIP: clientIP });
            res.send(`${callback}({success:true, msg:'Konto erstellt: ${userWithID}'});`);
        } catch (e) { res.send(`${callback}({success:false, msg:'Name vergeben'});`); }
    } else {
        const found = await User.findOne({ username: user, password: pass });
        if (!found) return res.send(`${callback}({success:false, msg:'Falsche Daten'});`);
        if (found.isBanned) return res.send(`${callback}({success:false, msg:'DU BIST GEBANNT!'});`);
        
        // IP bei jedem Login aktualisieren
        found.lastIP = clientIP;
        await found.save();
        
        res.send(`${callback}({success:true, user: "${found.username}", color: "${found.color}", isAdmin: ${found.isAdmin}});`);
    }
});

app.get('/messages_jsonp', async (req, res) => {
    const callback = req.query.callback || 'displayMessages';
    const msgs = await Message.find().sort({ _id: -1 }).limit(100);
    res.send(`${callback}(${JSON.stringify(msgs.reverse())});`);
});

app.get('/send_safe', async (req, res) => {
    const { user, text, color, pass } = req.query;
    const sender = await User.findOne({ username: user, password: pass });

    if (!sender || sender.isBanned) return res.send("console.log('Banned/Unauthorized');");

    // Admin Befehle: /ban User#1234 oder /clear
    if (sender.isAdmin && text.startsWith('/')) {
        const parts = text.split(' ');
        if (parts[0] === '/ban') {
            await User.findOneAndUpdate({ username: parts[1] }, { isBanned: true });
            await Message.create({ user: 'SYSTEM', text: `${parts[1]} wurde verbannt!`, color: '#ff3333' });
        }
        if (text === '/clear') await Message.deleteMany({});
        return res.send("console.log('Admin Action Done');");
    }

    await Message.create({
        user: user,
        text: text,
        color: sender.isAdmin ? "#ff3333" : (color || "#00d4ff"),
        isAdmin: sender.isAdmin,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    res.send("console.log('Sent');");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0');
