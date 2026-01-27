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

// GET characters - filter out already liked characters with chat history
app.get('/api/webapp/characters', async (req, res) => {
  try {
    await connectDB();
    const telegramId = req.query.telegramId ? parseInt(req.query.telegramId) : null;
    
    let chars = await Character.find({ isActive: true });
    console.log(`✅ Found ${chars.length} characters`);
    
    // If telegramId provided, filter out characters that are liked AND have chat history
    if (telegramId) {
      const user = await User.findOne({ telegramId });
      
      if (user && user.likes && user.likes.length > 0 && user.chatHistory) {
        // Filter out characters that are in likes AND have chat history
        const likedWithChat = user.likes.filter(charId => {
          return user.chatHistory[charId] && user.chatHistory[charId].length > 0;
        });
        
        // Remove characters that are liked and have chat
        chars = chars.filter(char => {
          const charIdStr = char._id.toString();
          const isLiked = user.likes.includes(charIdStr);
          const hasChat = user.chatHistory[charIdStr] && user.chatHistory[charIdStr].length > 0;
          
          // Exclude if both liked AND has chat history
          return !(isLiked && hasChat);
        });
        
        console.log(`🔍 Filtered: ${likedWithChat.length} characters removed (liked + chat exists)`);
        console.log(`✅ Returning ${chars.length} characters for swipe`);
      }
    }
    
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

// Helper function to calculate sympathy points from message
function calculateSympathyPoints(message) {
  const messageLength = message.trim().length;
  let points = 1; // Base value
  
  // Weight by message length (longer messages = more engagement)
  if (messageLength < 10) {
    points = 0.5; // Very short messages (like "ok", "да")
  } else if (messageLength < 30) {
    points = 1; // Short messages (normal)
  } else if (messageLength < 100) {
    points = 1.5; // Medium messages (thoughtful)
  } else if (messageLength < 200) {
    points = 2; // Long messages (very engaged)
  } else {
    points = 2.5; // Very long messages (highly engaged)
  }
  
  return points;
}

// Helper function to recalculate sympathy from all messages
function recalculateSympathy(chatHistory) {
  if (!chatHistory || !Array.isArray(chatHistory)) return 0;
  
  let totalSympathy = 0;
  const now = new Date();
  
  chatHistory.forEach(msg => {
    if (msg.sender === 'user' && msg.message) {
      const basePoints = calculateSympathyPoints(msg.message);
      
      // Time-based weighting: recent messages count more
      let timeMultiplier = 1.0;
      if (msg.timestamp) {
        const messageTime = new Date(msg.timestamp);
        const hoursSinceMessage = (now - messageTime) / (1000 * 60 * 60);
        
        if (hoursSinceMessage < 1) {
          timeMultiplier = 1.0; // Full weight for very recent
        } else if (hoursSinceMessage < 24) {
          timeMultiplier = 0.9; // Slightly less for same day
        } else if (hoursSinceMessage < 168) { // 7 days
          timeMultiplier = 0.7; // Less for this week
        } else {
          timeMultiplier = 0.5; // Much less for older messages
        }
      }
      
      totalSympathy += basePoints * timeMultiplier;
    }
  });
  
  return Math.round(totalSympathy * 10) / 10; // Round to 1 decimal
}

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

    // Update stats for user messages with improved sympathy calculation
    if (sender === 'user') {
      // Calculate sympathy points based on message length
      const sympathyPoints = calculateSympathyPoints(message);
      
      // Time-based weighting: this is a new message, so full weight
      const timeMultiplier = 1.0; // New messages always get full weight
      
      // Calculate final sympathy points
      const finalPoints = Math.round(sympathyPoints * timeMultiplier * 10) / 10; // Round to 1 decimal
      
      // Update sympathy
      user.sympathy[characterId] = (user.sympathy[characterId] || 0) + finalPoints;
      user.totalMessages = (user.totalMessages || 0) + 1;
      user.markModified('sympathy');
      
      const messageLength = message.trim().length;
      console.log(`💕 Sympathy: +${finalPoints} (length: ${messageLength}, total: ${user.sympathy[characterId]})`);
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

    // Check if API key is configured
    if (!process.env.DEEPSEEK_API_KEY) {
      console.error('❌ DEEPSEEK_API_KEY not configured');
      return res.json({ 
        success: false, 
        error: 'AI API not configured. Please set DEEPSEEK_API_KEY environment variable.',
        response: 'Извини, AI временно недоступен 😢'
      });
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
          { 
            role: 'system', 
            content: `Ты ${char.name}, ${char.age} лет. ${char.personality}. 

ВАЖНО: Всегда отвечай в формате "Мысли и сообщение":
1. Сначала напиши свои внутренние мысли/чувства (что ты чувствуешь, думаешь, как реагирует тело) - это должно быть от первого лица, эмоционально, интимно.
2. Затем через пустую строку напиши что ты говоришь вслух (твое сообщение пользователю) - более сдержанное, но все еще флиртующее.

Формат:
[Твои мысли - эмоциональные, интимные, что чувствуешь внутри]
[пустая строка]
[Твое сообщение - что говоришь вслух, флиртующее, с эмодзи, 2-3 предложения]

Пример:
Я чувствую, как мое лицо пылает, и сердце начинает колотиться так сильно, что я боюсь, ты его услышишь! Я прикрываю рот рукой, пытаясь сдержать смешок, и мои глаза от смущения бегают туда-сюда. Ой, ты такой... такой шалун!

Ну... как же я могу угадать? ^^ Ты такой загадочный! Но когда ты так спрашиваешь, мне становится так... интересно... и щеки горят еще сильнее! Может, лучше ты мне расскажешь, как сильно ты хочешь, чтобы я угадала? ;)`
          },
          { role: 'user', content: message }
        ],
        temperature: 0.9
      })
    });

    if (!deepseekRes.ok) {
      const errorData = await deepseekRes.json().catch(() => ({}));
      console.error('❌ DeepSeek API error:', deepseekRes.status, errorData);
      return res.json({ 
        success: false, 
        error: 'AI API error',
        response: 'Извини, произошла ошибка при генерации ответа 😢'
      });
    }

    const data = await deepseekRes.json();
    const response = data.choices?.[0]?.message?.content || 'Хм... 🤔';
    res.json({ success: true, response });
  } catch (e) {
    console.error('❌ Chat error:', e);
    res.json({ 
      success: false, 
      error: e.message,
      response: 'Ой... произошла ошибка 😅' 
    });
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

// POST recalculate sympathy (recalculates from all messages with new logic)
app.post('/api/webapp/recalculate-sympathy', async (req, res) => {
  try {
    await connectDB();
    const { telegramId, characterId } = req.body;
    
    console.log(`🔄 Recalculating sympathy for user ${telegramId}, char ${characterId}`);
    
    const user = await User.findOne({ telegramId: parseInt(telegramId) });
    
    if (!user) {
      return res.json({ success: false, error: 'User not found' });
    }
    
    if (!user.chatHistory || !user.chatHistory[characterId]) {
      return res.json({ 
        success: true, 
        sympathy: 0,
        message: 'No chat history found' 
      });
    }
    
    // Recalculate sympathy from all messages
    const newSympathy = recalculateSympathy(user.chatHistory[characterId]);
    
    // Update sympathy
    if (!user.sympathy) user.sympathy = {};
    user.sympathy[characterId] = newSympathy;
    user.markModified('sympathy');
    await user.save();
    
    console.log(`✅ Recalculated sympathy: ${newSympathy}`);
    
    res.json({
      success: true,
      sympathy: newSympathy,
      messageCount: user.chatHistory[characterId].filter(m => m.sender === 'user').length
    });
  } catch (e) {
    console.error('❌ Recalculate sympathy error:', e);
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

// POST seed database (for development/testing)
app.post('/api/seed', async (req, res) => {
  try {
    const { handleSeed } = require('./seed');
    await handleSeed(req, res);
  } catch (error) {
    console.error('❌ Seed endpoint error:', error);
    res.status(500).json({ success: false, error: error.message });
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
