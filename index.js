const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const app = express();

// --- MONGO DB CONNECTION ---
const mongoURI = "mongodb+srv://Smyle:stranac55@cluster0.qnqljpv.mongodb.net/?appName=Cluster0"; 

mongoose.connect(mongoURI, { serverSelectionTimeoutMS: 5000 })
    .then(() => console.log("Sub-Zero Backend: Connection established! ❄️"))
    .catch(err => console.error("Database Error:", err));

app.use(cors());
app.use(express.json());

// --- MODELS ---
const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true }, // Full Name: User#1234
    pureName: String, // Just "User"
    password: { type: String, required: true },
    color: { type: String, default: "#00d4ff" },
    isAdmin: { type: Boolean, default: false },
    lastIP: { type: String },
    isBanned: { type: Boolean, default: false },
    tag: String // The 4 digit ID: 1234
});

const MessageSchema = new mongoose.Schema({
    user: String, text: String, color: String, time: String, isAdmin: Boolean
});

const User = mongoose.model('User', UserSchema);
const Message = mongoose.model('Message', MessageSchema);

// Initialize Admin
async function initAdmin() {
    const admin = await User.findOne({ pureName: 'admin' });
    if (!admin) {
        await User.create({ 
            username: 'admin#0000', 
            pureName: 'admin', 
            password: '123', 
            color: '#ff3333', 
            isAdmin: true, 
            tag: '0000' 
        });
    }
}
initAdmin();

// --- ROUTES ---

app.get('/', (req, res) => res.send("Sub-Zero API: Running ❄️"));

app.get('/auth', async (req, res) => {
    const { mode, user, pass, cb } = req.query;
    const callback = cb || 'authCB';
    const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    if (mode === 'register') {
        try {
            const randomTag = Math.floor(1000 + Math.random() * 9000).toString();
            const fullUsername = `${user.trim()}#${randomTag}`;
            
            await User.create({ 
                username: fullUsername, 
                pureName: user.trim(),
                password: pass, 
                lastIP: clientIP,
                tag: randomTag
            });
            res.send(`${callback}({success:true, msg:'Account created: ${fullUsername}'});`);
        } catch (e) { res.send(`${callback}({success:false, msg:'Username taken or error'});`); }
    } else {
        // LOGIN
        const found = await User.findOne({ username: user, password: pass });
        if (!found) return res.send(`${callback}({success:false, msg:'Invalid credentials'});`);
        if (found.isBanned) return res.send(`${callback}({success:false, msg:'YOU ARE BANNED!'});`);
        
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

    if (!sender || sender.isBanned) return res.send("console.log('Access denied');");

    // Admin Commands
    if (sender.isAdmin && text.startsWith('/')) {
        const parts = text.split(' ');
        if (parts[0] === '/ban' && parts[1]) {
            const targetTag = parts[1].replace('#', ''); // removes # if admin typed it
            const victim = await User.findOneAndUpdate({ tag: targetTag }, { isBanned: true });
            if(victim) {
                await Message.create({ user: 'SYSTEM', text: `User with ID #${targetTag} has been banned!`, color: '#ff3333' });
            }
        }
        if (text === '/clear') await Message.deleteMany({});
        return res.send("console.log('Admin command executed');");
    }

    if(text.trim()) {
        await Message.create({
            user: user,
            text: text,
            color: sender.isAdmin ? "#ff3333" : (color || "#00d4ff"),
            isAdmin: sender.isAdmin,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
    }
    res.send("console.log('Message stored');");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0');
