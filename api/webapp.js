const express = require('express');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());

const connectDB = async () => {
  if (mongoose.connection.readyState !== 1 && process.env.MONGODB_URI) {
    await mongoose.connect(process.env.MONGODB_URI);
  }
};

const CharacterSchema = new mongoose.Schema({
  name: String, age: Number, description: String, personality: String,
  avatarUrl: String, welcomeMessage: String, bio: String, photos: [String],
  baseSympathyReq: Number, photoUnlockChance: Number, isActive: Boolean
}, { strict: false });

const UserSchema = new mongoose.Schema({
  telegramId: Number, selectedGirl: String, totalMessages: Number,
  sympathy: mongoose.Schema.Types.Mixed, unlockedPhotos: mongoose.Schema.Types.Mixed
}, { strict: false });

const Character = mongoose.models.Character || mongoose.model('Character', CharacterSchema);
const User = mongoose.models.User || mongoose.model('User', UserSchema);

// Handle all paths
app.all('*', async (req, res) => {
  const path = req.query.path || req.path.replace('/api/webapp/', '');
  
  try {
    await connectDB();
    
    // SEED
    if (path === 'seed' || path === '/seed') {
      await Character.deleteMany({});
      const girls = [
        { name: "Анна", age: 25, description: "Романтичная", personality: "Заботливая",
          avatarUrl: "https://i.pravatar.cc/400?img=1", welcomeMessage: "Привет! 🌸",
          bio: "Дизайнер", photos: ["https://i.pravatar.cc/400?img=1", "https://i.pravatar.cc/400?img=10"],
          baseSympathyReq: 10, photoUnlockChance: 0.3, isActive: true },
        { name: "Мария", age: 27, description: "Бизнес-леди", personality: "Умная",
          avatarUrl: "https://i.pravatar.cc/400?img=5", welcomeMessage: "Здравствуй 💼",
          bio: "IT", photos: ["https://i.pravatar.cc/400?img=5"], baseSympathyReq: 20, photoUnlockChance: 0.25, isActive: true },
        { name: "София", age: 23, description: "Студентка", personality: "Весёлая",
          avatarUrl: "https://i.pravatar.cc/400?img=6", welcomeMessage: "Йоу! 🎉",
          bio: "Журналистика", photos: ["https://i.pravatar.cc/400?img=6"], baseSympathyReq: 5, photoUnlockChance: 0.4, isActive: true }
      ];
      await Character.insertMany(girls);
      return res.json({ success: true, count: 3 });
    }
    
    // CHARACTERS
    if (path === 'characters' || path === '/characters') {
      const chars = await Character.find({ isActive: true }).lean();
      return res.json({ success: true, characters: chars });
    }
    
    // USER
    if (path.startsWith('user/') || path.startsWith('/user/')) {
      const telegramId = path.split('/').pop();
      const user = await User.findOne({ telegramId: parseInt(telegramId) });
      return res.json({ success: true, user: user || {} });
    }
    
    // SELECT CHARACTER
    if ((path === 'select-character' || path === '/select-character') && req.method === 'POST') {
      const { telegramId, characterId } = req.body;
      const char = await Character.findById(characterId);
      await User.findOneAndUpdate({ telegramId: parseInt(telegramId) }, { selectedGirl: char?.name }, { upsert: true });
      return res.json({ success: true });
    }
    
    // CHAT
    if ((path === 'chat' || path === '/chat') && req.method === 'POST') {
      const { telegramId } = req.body;
      await User.findOneAndUpdate({ telegramId: parseInt(telegramId) }, { $inc: { totalMessages: 1 } }, { upsert: true });
      const replies = ["Интересно! 😊", "Расскажи ещё ❤️", "Мне нравится 💕"];
      return res.json({ success: true, response: replies[Math.floor(Math.random() * 3)] });
    }
    
    // REQUEST PHOTO
    if ((path === 'request-photo' || path === '/request-photo') && req.method === 'POST') {
      const { telegramId, characterId } = req.body;
      const user = await User.findOne({ telegramId: parseInt(telegramId) });
      const char = await Character.findById(characterId);
      const sympathy = user?.totalMessages || 0;
      
      if (sympathy < 10) return res.json({ success: false, message: `Общайся больше! (${sympathy}/10)` });
      if (Math.random() < 0.5 && char?.photos?.length) {
        return res.json({ success: true, photo: char.photos[0], message: "Вот фото! 📸" });
      } else {
        return res.json({ success: false, message: "Пока не готова 🙈" });
      }
    }
    
    res.status(404).json({ error: 'Not found', path });
    
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = app;
