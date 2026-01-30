const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const app = express();

// --- MONGO DB CONNECTION ---
const mongoURI = "mongodb+srv://Smyle:stranac55@cluster0.qnqljpv.mongodb.net/?appName=Cluster0"; 

mongoose.connect(mongoURI)
    .then(() => console.log("Ice Cold Connection to MongoDB established!"))
    .catch(err => console.error("Database connection failed:", err));

app.use(cors());
app.use(express.json());

// --- DATABASE MODELS ---
const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true },
    password: { type: String },
    color: { type: String, default: "#00d4ff" },
    isAdmin: { type: Boolean, default: false }
});

const MessageSchema = new mongoose.Schema({
    user: String,
    text: String,
    color: String,
    time: String,
    isAdmin: Boolean
});

const User = mongoose.model('User', UserSchema);
const Message = mongoose.model('Message', MessageSchema);

// Admin-Auto-Erstellung (Login: admin / PW: 123)
async function initAdmin() {
    try {
        const adminExists = await User.findOne({ username: 'admin' });
        if (!adminExists) {
            await User.create({ username: 'admin', password: '123', color: '#ff3333', isAdmin: true });
            console.log("Admin account initialized.");
        }
    } catch(e) { console.log("Admin check skip..."); }
}
initAdmin();

// --- ROUTES ---
app.get('/check_user', async (req, res) => {
    const user = await User.findOne({ username: req.query.user });
    res.send(`${req.query.cb}({available: ${!user}});`);
});

app.get('/auth', async (req, res) => {
    const { mode, user, pass, cb } = req.query;
    if (mode === 'register') {
        try {
            await User.create({ username: user, password: pass });
            res.send(`${cb}({success:true, msg:'Account created! Please login.'});`);
        } catch (e) { res.send(`${cb}({success:false, msg:'Username already taken'});`); }
    } else {
        const found = await User.findOne({ username: user, password: pass });
        if (found) res.send(`${cb}({success:true, user: found.username, color: found.color, isAdmin: found.isAdmin});`);
        else res.send(`${cb}({success:false, msg:'Wrong credentials'});`);
    }
});

app.get('/messages_jsonp', async (req, res) => {
    try {
        const msgs = await Message.find().sort({ _id: -1 }).limit(100);
        res.send(`${req.query.callback}(${JSON.stringify(msgs.reverse())});`);
    } catch(e) { res.send(`${req.query.callback}([]);`); }
});

app.get('/send_safe', async (req, res) => {
    const { user, text, color, pass } = req.query;
    const sender = await User.findOne({ username: user, password: pass });

    if (sender?.isAdmin) {
        if (text === '/clear') {
            await Message.deleteMany({});
            return res.send("console.log('Chat Cleared');");
        }
        if (text === '/reset') {
            await Message.deleteMany({});
            await User.deleteMany({ isAdmin: false });
            return res.send("console.log('Hard Reset Done');");
        }
    }

    if (text && sender) {
        await Message.create({
            user: user,
            text: text,
            color: sender.isAdmin ? "#ff3333" : (color || "#00d4ff"),
            isAdmin: sender.isAdmin,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
    }
    res.send("console.log('Saved to DB');");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log('Server V6 Live'));
