const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

// Simple Character schema (inline)
const CharacterSchema = new mongoose.Schema({
  name: String,
  age: Number,
  description: String,
  personality: String,
  avatarUrl: String,
  welcomeMessage: String,
  bio: String,
  photos: [String],
  baseSympathyReq: Number,
  photoUnlockChance: Number,
  isActive: Boolean
}, { strict: false });

const Character = mongoose.models.Character || mongoose.model('Character', CharacterSchema);

// User schema (inline)
const UserSchema = new mongoose.Schema({
  telegramId: Number,
  selectedGirl: String,
  sympathy: mongoose.Schema.Types.Mixed,
  unlockedPhotos: mongoose.Schema.Types.Mixed,
  totalMessages: { type: Number, default: 0 },
  photosUnlocked: { type: Number, default: 0 }
}, { strict: false });

const User = mongoose.models.User || mongoose.model('User', UserSchema);

// SEED ROUTE
router.get('/seed', async (req, res) => {
  try {
    if (!process.env.MONGODB_URI) {
      return res.json({ error: 'No MongoDB URI' });
    }
    
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI);
    }
    
    await Character.deleteMany({});
    
    const girls = [
      {
        name: "Анна", age: 25, description: "Романтичная", personality: "Заботливая",
        avatarUrl: "https://i.pravatar.cc/400?img=1",
        welcomeMessage: "Привет! 🌸", bio: "Дизайнер",
        photos: ["https://i.pravatar.cc/400?img=1", "https://i.pravatar.cc/400?img=10"],
        baseSympathyReq: 10, photoUnlockChance: 0.3, isActive: true
      },
      {
        name: "Мария", age: 27, description: "Бизнес-леди", personality: "Умная",
        avatarUrl: "https://i.pravatar.cc/400?img=5",
        welcomeMessage: "Здравствуй 💼", bio: "IT-компания",
        photos: ["https://i.pravatar.cc/400?img=5", "https://i.pravatar.cc/400?img=15"],
        baseSympathyReq: 20, photoUnlockChance: 0.25, isActive: true
      },
      {
        name: "София", age: 23, description: "Студентка", personality: "Весёлая",
        avatarUrl: "https://i.pravatar.cc/400?img=6",
        welcomeMessage: "Йоу! 🎉", bio: "Журналистика",
        photos: ["https://i.pravatar.cc/400?img=6"],
        baseSympathyReq: 5, photoUnlockChance: 0.4, isActive: true
      }
    ];
    
    await Character.insertMany(girls);
    res.json({ success: true, count: 3 });
  } catch (e) {
    res.json({ error: e.message });
  }
});

// GET CHARACTERS
router.get('/characters', async (req, res) => {
  try {
    const chars = await Character.find({ isActive: true });
    res.json({ success: true, characters: chars });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET USER
router.get('/user/:telegramId', async (req, res) => {
  try {
    const user = await User.findOne({ telegramId: parseInt(req.params.telegramId) });
    res.json({ success: true, user: user || {} });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// SELECT CHARACTER
router.post('/select-character', async (req, res) => {
  try {
    const { telegramId, characterId } = req.body;
    const char = await Character.findById(characterId);
    
    await User.findOneAndUpdate(
      { telegramId: parseInt(telegramId) },
      { selectedGirl: char.name },
      { upsert: true }
    );
    
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// CHAT
router.post('/chat', async (req, res) => {
  try {
    const { telegramId } = req.body;
    
    await User.findOneAndUpdate(
      { telegramId: parseInt(telegramId) },
      { $inc: { totalMessages: 1 } },
      { upsert: true }
    );
    
    const replies = ["Интересно! 😊", "Расскажи ещё ❤️", "Мне нравится 💕"];
    res.json({ success: true, response: replies[Math.floor(Math.random() * 3)] });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// REQUEST PHOTO
router.post('/request-photo', async (req, res) => {
  try {
    const { telegramId, characterId } = req.body;
    const char = await Character.findById(characterId);
    const user = await User.findOne({ telegramId: parseInt(telegramId) }) || {};
    
    const sympathy = user.totalMessages || 0;
    
    if (sympathy < 10) {
      return res.json({ success: false, message: `Нужно больше общения! (${sympathy}/10)` });
    }
    
    const chance = 0.5; // 50% chance
    
    if (Math.random() < chance && char.photos && char.photos.length > 0) {
      const photo = char.photos[0];
      res.json({ success: true, photo, message: "Вот моё фото! 📸" });
    } else {
      res.json({ success: false, message: "Пока не готова 🙈" });
    }
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

module.exports = router;
