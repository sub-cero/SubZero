const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const app = express();

// --- MONGO DB CONNECTION ---
const mongoURI = "mongodb+srv://Smyle:stranac55@cluster0.qnqljpv.mongodb.net/?appName=Cluster0"; 

mongoose.connect(mongoURI, { serverSelectionTimeoutMS: 5000 })
    .then(() => console.log("Ice Cold Connection to MongoDB established!"))
    .catch(err => console.error("Database connection failed:", err));

app.use(cors());
app.use(express.json());

// --- DATABASE MODELS ---
const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    color: { type: String, default: "#00d4ff" },
    isAdmin: { type: Boolean, default: false }
});

const MessageSchema = new mongoose.Schema({
    user: String, text: String, color: String, time: String, isAdmin: Boolean
});

const User = mongoose.model('User', UserSchema);
const Message = mongoose.model('Message', MessageSchema);

// Admin-Auto-Erstellung
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
    const cb = req.query.cb || 'console.log';
    const user = await User.findOne({ username: req.query.user });
    res.send(`${cb}({available: ${!user}});`);
});

app.get('/auth', async (req, res) => {
    const { mode, user, pass, cb } = req.query;
    const callback = cb || 'authCB';

    if (mode === 'register') {
        try {
            const existing = await User.findOne({ username: user });
            if (existing) return res.send(`${callback}({success:false, msg:'Username taken'});`);
            await User.create({ username: user, password: pass });
            res.send(`${callback}({success:true, msg:'Account created! Please login.'});`);
        } catch (e) { res.send(`${callback}({success:false, msg:'Error'});`); }
    } else {
        try {
            const found = await User.findOne({ username: user, password: pass });
            if (found) {
                // WICHTIG: Strings müssen in Anführungszeichen "" stehen!
                res.send(`${callback}({success:true, user: "${found.username}", color: "${found.color}", isAdmin: ${found.isAdmin}});`);
            } else {
                res.send(`${callback}({success:false, msg:'Wrong credentials'});`);
            }
        } catch (e) { res.send(`${callback}({success:false, msg:'DB Error'});`); }
    }
});

app.get('/messages_jsonp', async (req, res) => {
    const callback = req.query.callback || 'displayMessages';
    try {
        const msgs = await Message.find().sort({ _id: -1 }).limit(100);
        res.send(`${callback}(${JSON.stringify(msgs.reverse())});`);
    } catch(e) { res.send(`${callback}([]);`); }
});

app.get('/send_safe', async (req, res) => {
    const { user, text, color, pass } = req.query;
    try {
        const sender = await User.findOne({ username: user, password: pass });
        if (sender?.isAdmin) {
            if (text === '/clear') { await Message.deleteMany({}); return res.send("console.log('Cleared');"); }
            if (text === '/reset') {
                await Message.deleteMany({});
                await User.deleteMany({ isAdmin: false });
                return res.send("console.log('Reset Done');");
            }
        }
        if (text && sender) {
            await Message.create({
                user: user, text: text, color: sender.isAdmin ? "#ff3333" : (color || "#00d4ff"),
                isAdmin: sender.isAdmin, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
        }
        res.send("console.log('Saved');");
    } catch(e) { res.send("console.log('Error');"); }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log('Server V6.2 Running'));
