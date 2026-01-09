const express = require('express');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const mongoUrl = process.env.MONGODB_URI;

async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(mongoUrl);
  console.log('✅ DB connected');
}

// Inline all routes to avoid module loading issues
const userSchema = new mongoose.Schema({
  telegramId: Number,
  selectedGirl: String,
  likes: [String],
  passes: [String],
  sympathy: Object,
  chatHistory: Object,
  totalMessages: Number
}, { strict: false });

const charSchema = new mongoose.Schema({
  name: String,
  age: Number,
  avatarUrl: String,
  photos: [String],
  bio: String,
  personality: String,
  welcomeMessage: String,
  isActive: Boolean
});

const User = mongoose.models.User || mongoose.model('User', userSchema);
const Character = mongoose.models.Character || mongoose.model('Character', charSchema);

// GET characters
app.get('/api/webapp/characters', async (req, res) => {
  try {
    await connectDB();
    const chars = await Character.find({ isActive: true });
    console.log(`✅ Found ${chars.length} characters`);
    res.json({ success: true, characters: chars });
  } catch (e) {
    console.error('❌ Characters error:', e);
    res.json({ success: false, error: e.message });
  }
});

// GET user
app.get('/api/webapp/user/:telegramId', async (req, res) => {
  try {
    await connectDB();
    let user = await User.findOne({ telegramId: parseInt(req.params.telegramId) });
    if (!user) {
      user = new User({ 
        telegramId: parseInt(req.params.telegramId),
        likes: [],
        passes: [],
        sympathy: {},
        chatHistory: {},
        totalMessages: 0
      });
      await user.save();
    }
    res.json({ success: true, user });
  } catch (e) {
    console.error('❌ User error:', e);
    res.json({ success: false, error: e.message });
  }
});

// POST select character
app.post('/api/webapp/select-character', async (req, res) => {
  try {
    await connectDB();
    const { telegramId, characterId } = req.body;
    await User.updateOne(
      { telegramId: parseInt(telegramId) },
      { $set: { selectedGirl: characterId } },
      { upsert: true }
    );
    res.json({ success: true });
  } catch (e) {
    console.error('❌ Select error:', e);
    res.json({ success: false, error: e.message });
  }
});

// POST match
app.post('/api/webapp/match', async (req, res) => {
  try {
    await connectDB();
    const { telegramId, characterId, action } = req.body;
    const field = action === 'like' ? 'likes' : 'passes';
    await User.updateOne(
      { telegramId: parseInt(telegramId) },
      { $addToSet: { [field]: characterId } },
      { upsert: true }
    );
    console.log(`✅ User ${telegramId} ${action}d ${characterId}`);
    res.json({ success: true });
  } catch (e) {
    console.error('❌ Match error:', e);
    res.json({ success: false, error: e.message });
  }
});

// GET matches
app.get('/api/webapp/matches/:telegramId', async (req, res) => {
  try {
    await connectDB();
    const user = await User.findOne({ telegramId: parseInt(req.params.telegramId) });
    if (!user || !user.likes || user.likes.length === 0) {
      return res.json({ success: true, matches: [] });
    }
    const matches = await Character.find({ 
      _id: { $in: user.likes },
      isActive: true 
    });
    console.log(`✅ Found ${matches.length} matches`);
    res.json({ success: true, matches });
  } catch (e) {
    console.error('❌ Matches error:', e);
    res.json({ success: false, error: e.message });
  }
});

// POST save message
app.post('/api/webapp/save-message', async (req, res) => {
  try {
    await connectDB();
    const { telegramId, characterId, message, sender } = req.body;
    let user = await User.findOne({ telegramId: parseInt(telegramId) });
    if (!user) {
      user = new User({ 
        telegramId: parseInt(telegramId),
        sympathy: {},
        chatHistory: {},
        totalMessages: 0
      });
    }
    if (!user.chatHistory) user.chatHistory = {};
    if (!user.sympathy) user.sympathy = {};
    if (!user.chatHistory[characterId]) user.chatHistory[characterId] = [];
    
    user.chatHistory[characterId].push({
      message,
      sender,
      timestamp: new Date()
    });
    
    if (sender === 'user') {
      user.sympathy[characterId] = (user.sympathy[characterId] || 0) + 1;
      user.totalMessages = (user.totalMessages || 0) + 1;
    }
    await user.save();
    res.json({ success: true, sympathy: user.sympathy[characterId] || 0 });
  } catch (e) {
    console.error('❌ Save message error:', e);
    res.json({ success: false, error: e.message });
  }
});

// GET chat history
app.get('/api/webapp/chat-history/:telegramId/:characterId', async (req, res) => {
  try {
    await connectDB();
    const user = await User.findOne({ telegramId: parseInt(req.params.telegramId) });
    const history = user?.chatHistory?.[req.params.characterId] || [];
    const sympathy = user?.sympathy?.[req.params.characterId] || 0;
    res.json({ success: true, history, sympathy });
  } catch (e) {
    console.error('❌ History error:', e);
    res.json({ success: false, error: e.message });
  }
});

// POST chat
app.post('/api/webapp/chat', async (req, res) => {
  try {
    await connectDB();
    const { telegramId, message } = req.body;
    const user = await User.findOne({ telegramId: parseInt(telegramId) });
    if (!user?.selectedGirl) {
      return res.json({ success: false, error: 'No character' });
    }
    const char = await Character.findById(user.selectedGirl);
    if (!char) {
      return res.json({ success: false, error: 'Character not found' });
    }
    
    const deepseekRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: `Ты ${char.name}, ${char.age} лет. ${char.personality}. Отвечай кратко, флиртуй, используй эмодзи. 2-3 предложения.` },
          { role: 'user', content: message }
        ],
        temperature: 0.8
      })
    });
    
    const data = await deepseekRes.json();
    const response = data.choices?.[0]?.message?.content || 'Хм... 🤔';
    res.json({ success: true, response });
  } catch (e) {
    console.error('❌ Chat error:', e);
    res.json({ success: true, response: 'Ой... 😅' });
  }
});

// Catch all
app.get('*', (req, res) => {
  res.sendFile('index.html', { root: 'public' });
});

module.exports = app;
