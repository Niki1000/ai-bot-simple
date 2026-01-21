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
  unlockedPhotos: Object,
  totalMessages: Number,
  subscriptionLevel: { type: String, default: 'free' },
  credits: { type: Number, default: 0 }
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
    
    console.log(`💬 Saving message: ${sender} -> "${message.substring(0, 30)}..." for char ${characterId}`);
    
    let user = await User.findOne({ telegramId: parseInt(telegramId) });
    if (!user) {
      user = new User({
        telegramId: parseInt(telegramId),
        likes: [],
        passes: [],
        sympathy: {},
        chatHistory: {},
        totalMessages: 0
      });
    }
    
    // Initialize nested objects if needed
    if (!user.chatHistory) user.chatHistory = {};
    if (!user.sympathy) user.sympathy = {};
    if (!user.chatHistory[characterId]) user.chatHistory[characterId] = [];

    // Add message to history
    user.chatHistory[characterId].push({
      message,
      sender,
      timestamp: new Date()
    });

    // Update stats for user messages
    if (sender === 'user') {
      user.sympathy[characterId] = (user.sympathy[characterId] || 0) + 1;
      user.totalMessages = (user.totalMessages || 0) + 1;
      user.markModified('sympathy');
    }
    
    // CRITICAL: Mark chatHistory as modified so Mongoose saves nested changes
    user.markModified('chatHistory');
    
    await user.save();
    
    console.log(`✅ Message saved. History length: ${user.chatHistory[characterId].length}`);
    
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
    const { telegramId, characterId } = req.params;
    
    console.log(`📜 Loading history for user ${telegramId}, char ${characterId}`);
    
    const user = await User.findOne({ telegramId: parseInt(telegramId) });
    
    if (!user) {
      console.log('❌ User not found');
      return res.json({ success: true, history: [], sympathy: 0 });
    }
    
    const history = user.chatHistory?.[characterId] || [];
    const sympathy = user.sympathy?.[characterId] || 0;
    
    console.log(`✅ Found ${history.length} messages, sympathy: ${sympathy}`);
    
    res.json({ success: true, history, sympathy });
  } catch (e) {
    console.error('❌ History error:', e);
    res.json({ success: false, error: e.message, history: [], sympathy: 0 });
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

// POST request photo
app.post('/api/webapp/request-photo', async (req, res) => {
  try {
    await connectDB();
    const { telegramId, characterId } = req.body;
    const user = await User.findOne({ telegramId: parseInt(telegramId) });
    const char = await Character.findById(characterId);
    
    if (!user || !char) {
      return res.json({ success: false, message: 'Не найдено' });
    }
    
    const sympathy = user.sympathy?.[characterId] || 0;
    const chance = Math.min(100, sympathy);
    
    // Random chance based on sympathy
    if (Math.random() * 100 < chance && char.photos && char.photos.length > 0) {
      const randomPhoto = char.photos[Math.floor(Math.random() * char.photos.length)];
      return res.json({ success: true, photo: randomPhoto });
    }
    
    res.json({ 
      success: false, 
      message: `Попробуй позже! Шанс: ${Math.floor(chance)}%` 
    });
  } catch (e) {
    console.error('❌ Request photo error:', e);
    res.json({ success: false, error: e.message });
  }
});

// GET user entitlements (subscription, credits, unlocked photos)
app.get('/api/webapp/user-entitlements/:telegramId', async (req, res) => {
  try {
    await connectDB();
    const { telegramId } = req.params;
    
    console.log(`🔑 Loading entitlements for user ${telegramId}`);
    
    const user = await User.findOne({ telegramId: parseInt(telegramId) });
    
    if (!user) {
      return res.json({
        success: true,
        subscriptionLevel: 'free',
        credits: 0,
        unlockedPhotos: {}
      });
    }
    
    res.json({
      success: true,
      subscriptionLevel: user.subscriptionLevel || 'free',
      credits: user.credits || 0,
      unlockedPhotos: user.unlockedPhotos || {}
    });
  } catch (e) {
    console.error('❌ Entitlements error:', e);
    res.json({ success: false, error: e.message });
  }
});

// POST unlock photo
app.post('/api/webapp/unlock-photo', async (req, res) => {
  try {
    await connectDB();
    const { telegramId, characterId, photoUrl } = req.body;
    
    console.log(`📸 Unlock request: user ${telegramId}, char ${characterId}, photo ${photoUrl}`);
    
    let user = await User.findOne({ telegramId: parseInt(telegramId) });
    
    if (!user) {
      return res.json({ success: false, error: 'User not found' });
    }
    
    // Check if user has premium or enough credits
    const isPremium = user.subscriptionLevel === 'premium';
    const hasCredits = (user.credits || 0) >= 10; // 10 credits per photo
    
    if (!isPremium && !hasCredits) {
      return res.json({
        success: false,
        error: 'Недостаточно кредитов или подписки',
        creditsNeeded: 10,
        currentCredits: user.credits || 0
      });
    }
    
    // Initialize unlockedPhotos if needed
    if (!user.unlockedPhotos) user.unlockedPhotos = {};
    if (!user.unlockedPhotos[characterId]) user.unlockedPhotos[characterId] = [];
    
    // Check if already unlocked
    if (user.unlockedPhotos[characterId].includes(photoUrl)) {
      return res.json({ success: true, message: 'Фото уже разблокировано' });
    }
    
    // Add photo to unlocked list
    user.unlockedPhotos[characterId].push(photoUrl);
    
    // Deduct credits if not premium
    if (!isPremium) {
      user.credits = (user.credits || 0) - 10;
    }
    
    user.markModified('unlockedPhotos');
    await user.save();
    
    console.log(`✅ Photo unlocked for user ${telegramId}`);
    
    res.json({
      success: true,
      unlockedPhotos: user.unlockedPhotos[characterId],
      remainingCredits: user.credits
    });
  } catch (e) {
    console.error('❌ Unlock photo error:', e);
    res.json({ success: false, error: e.message });
  }
});

// POST add credits (for testing/demo)
app.post('/api/webapp/add-credits', async (req, res) => {
  try {
    await connectDB();
    const { telegramId, amount } = req.body;
    
    let user = await User.findOne({ telegramId: parseInt(telegramId) });
    
    if (!user) {
      return res.json({ success: false, error: 'User not found' });
    }
    
    user.credits = (user.credits || 0) + (amount || 50);
    await user.save();
    
    console.log(`💰 Added ${amount || 50} credits to user ${telegramId}. Total: ${user.credits}`);
    
    res.json({ success: true, credits: user.credits });
  } catch (e) {
    console.error('❌ Add credits error:', e);
    res.json({ success: false, error: e.message });
  }
});

// Telegram webhook - ADD THIS
app.post('/api/webhook', async (req, res) => {
  try {
    const { handleUpdate } = require('./bot');
    await handleUpdate(req.body);
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

module.exports = app;
