const express = require('express');
const mongoose = require('mongoose');
const app = express.Router();

const mongoUrl = process.env.MONGODB_URI;
let isConnected = false;

async function connectDB() {
  if (isConnected) return;
  try {
    await mongoose.connect(mongoUrl);
    isConnected = true;
    console.log('✅ MongoDB connected (WebApp API)');
  } catch (e) {
    console.error('❌ MongoDB error:', e);
    throw e;
  }
}

// FIXED User Schema - Use plain objects instead of Map
const UserSchema = new mongoose.Schema({
  telegramId: Number,
  selectedGirl: String,
  likes: { type: [String], default: [] },
  passes: { type: [String], default: [] },
  sympathy: { type: Object, default: {} },
  chatHistory: { type: Object, default: {} },
  unlockedPhotos: { type: Object, default: {} },
  totalMessages: { type: Number, default: 0 }
}, { strict: false, collection: 'users' });

const CharacterSchema = new mongoose.Schema({
  name: String,
  age: Number,
  avatarUrl: String,
  photos: [String],
  bio: String,
  personality: String,
  welcomeMessage: String,
  isActive: { type: Boolean, default: true }
}, { collection: 'characters' });

const User = mongoose.models.User || mongoose.model('User', UserSchema);
const Character = mongoose.models.Character || mongoose.model('Character', CharacterSchema);

// GET /api/webapp/user/:telegramId
app.get('/user/:telegramId', async (req, res) => {
  try {
    await connectDB();
    let user = await User.findOne({ telegramId: parseInt(req.params.telegramId) });

    if (!user) {
      user = await User.create({
        telegramId: parseInt(req.params.telegramId),
        likes: [],
        passes: [],
        sympathy: {},
        chatHistory: {},
        unlockedPhotos: {}
      });
    }

    res.json({ success: true, user });
  } catch (e) {
    console.error('User API error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/webapp/characters
app.get('/characters', async (req, res) => {
  try {
    await connectDB();
    const characters = await Character.find({ isActive: true }).lean();
    console.log(`✅ Loaded ${characters.length} characters`);
    res.json({ success: true, characters });
  } catch (e) {
    console.error('Characters API error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/webapp/select-character
app.post('/select-character', async (req, res) => {
  try {
    await connectDB();
    const { telegramId, characterId } = req.body;

    await User.findOneAndUpdate(
      { telegramId: parseInt(telegramId) },
      { selectedGirl: characterId },
      { upsert: true }
    );

    res.json({ success: true });
  } catch (e) {
    console.error('Select character error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/webapp/match
app.post('/match', async (req, res) => {
  try {
    await connectDB();
    const { telegramId, characterId, action } = req.body;

    if (!telegramId || !characterId || !action) {
      return res.status(400).json({ success: false, error: 'Missing params' });
    }

    const fieldName = action === 'like' ? 'likes' : 'passes';

    const user = await User.findOneAndUpdate(
      { telegramId: parseInt(telegramId) },
      {
        $addToSet: { [fieldName]: characterId }
      },
      { upsert: true, new: true }
    );

    console.log(`✅ User ${telegramId} ${action}d character ${characterId}`);
    res.json({ success: true, action, likes: user.likes.length });

  } catch (e) {
    console.error('Match error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/webapp/matches/:telegramId
app.get('/matches/:telegramId', async (req, res) => {
  try {
    await connectDB();
    const user = await User.findOne({ telegramId: parseInt(req.params.telegramId) });

    console.log(`🔍 Fetching matches for user ${req.params.telegramId}`);

    if (!user || !user.likes || user.likes.length === 0) {
      console.log('❌ No likes found');
      return res.json({ success: true, matches: [] });
    }

    console.log('User likes array:', user.likes);

    const matches = await Character.find({
      _id: { $in: user.likes },
      isActive: true
    }).lean();

    console.log(`✅ Found ${matches.length} matches`);

    res.json({ success: true, matches });

  } catch (e) {
    console.error('Matches error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/webapp/save-message
app.post('/save-message', async (req, res) => {
  try {
    await connectDB();
    const { telegramId, characterId, message, sender } = req.body;

    console.log(`💬 Saving message from ${sender} for user ${telegramId}`);

    const user = await User.findOne({ telegramId: parseInt(telegramId) });

    if (!user) {
      const newUser = await User.create({
        telegramId: parseInt(telegramId),
        sympathy: { [characterId]: sender === 'user' ? 1 : 0 },
        chatHistory: {
          [characterId]: [{ message, sender, timestamp: new Date() }]
        },
        totalMessages: sender === 'user' ? 1 : 0
      });

      return res.json({
        success: true,
        sympathy: newUser.sympathy[characterId] || 0
      });
    }

    // Update existing user
    if (!user.chatHistory) user.chatHistory = {};
    if (!user.chatHistory[characterId]) user.chatHistory[characterId] = [];
    if (!user.sympathy) user.sympathy = {};

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

    console.log(`✅ Message saved. New sympathy: ${user.sympathy[characterId]}`);

    res.json({ success: true, sympathy: user.sympathy[characterId] || 0 });

  } catch (e) {
    console.error('Save message error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/webapp/chat-history/:telegramId/:characterId
app.get('/chat-history/:telegramId/:characterId', async (req, res) => {
  try {
    await connectDB();
    const user = await User.findOne({ telegramId: parseInt(req.params.telegramId) });

    const history = user?.chatHistory?.[req.params.characterId] || [];
    const sympathy = user?.sympathy?.[req.params.characterId] || 0;

    console.log(`📜 Loaded ${history.length} messages, sympathy: ${sympathy}`);

    res.json({ success: true, history, sympathy });

  } catch (e) {
    console.error('Chat history error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/webapp/chat
app.post('/chat', async (req, res) => {
  try {
    await connectDB();
    const { telegramId, message } = req.body;

    const user = await User.findOne({ telegramId: parseInt(telegramId) });
    if (!user?.selectedGirl) {
      return res.json({ success: false, error: 'No character selected' });
    }

    const character = await Character.findById(user.selectedGirl);
    if (!character) {
      return res.json({ success: false, error: 'Character not found' });
    }

    // Call DeepSeek API
    const deepseekRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: `Ты - ${character.name}, ${character.age}-летняя девушка. ${character.personality}. Отвечай кратко, флиртуй, используй эмодзи. Максимум 2-3 предложения.`
          },
          {
            role: 'user',
            content: message
          }
        ],
        temperature: 0.8
      })
    });

    const data = await deepseekRes.json();
    const response = data.choices?.[0]?.message?.content || 'Хм... 🤔';

    res.json({ success: true, response });

  } catch (e) {
    console.error('Chat error:', e);
    res.json({ success: true, response: 'Ой, что-то пошло не так... 😅' });
  }
});

module.exports = app;
