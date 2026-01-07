const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

// Connect MongoDB
const connectDB = async () => {
  if (!process.env.MONGODB_URI) {
    console.log('⚠️ No MongoDB URI');
    return;
  }
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected in webapp');
  }
};

// Character Schema (inline)
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
}, { strict: false, collection: 'characters' });

const Character = mongoose.models.Character || mongoose.model('Character', CharacterSchema);

// User Schema (inline)
const UserSchema = new mongoose.Schema({
  telegramId: Number,
  selectedGirl: String,
  sympathy: mongoose.Schema.Types.Mixed,
  unlockedPhotos: mongoose.Schema.Types.Mixed,
  totalMessages: { type: Number, default: 0 },
  photosUnlocked: { type: Number, default: 0 }
}, { strict: false, collection: 'users' });

const User = mongoose.models.User || mongoose.model('User', UserSchema);

// ==================== ROUTES ====================

// GET /api/webapp/seed - Seed database with girls
router.get('/seed', async (req, res) => {
  try {
    await connectDB();
    
    // Clear old data
    await Character.deleteMany({});
    console.log('🧹 Cleared old characters');
    
    // Create girls
    const girls = [
      {
        name: "Анна",
        age: 25,
        description: "Романтичная девушка с мягким характером",
        personality: "Заботливая, чувствительная, творческая",
        avatarUrl: "https://i.pravatar.cc/400?img=1",
        welcomeMessage: "Привет! Я так рада познакомиться с тобой! 🌸",
        bio: "Я работаю дизайнером. Люблю живопись, классическую музыку и долгие прогулки.",
        photos: [
          "https://i.pravatar.cc/400?img=1",
          "https://i.pravatar.cc/400?img=10",
          "https://i.pravatar.cc/400?img=20",
          "https://i.pravatar.cc/400?img=30"
        ],
        baseSympathyReq: 10,
        photoUnlockChance: 0.3,
        isActive: true
      },
      {
        name: "Мария",
        age: 27,
        description: "Уверенная в себе бизнес-леди, ценит интеллект",
        personality: "Умная, амбициозная, прямолинейная",
        avatarUrl: "https://i.pravatar.cc/400?img=5",
        welcomeMessage: "Здравствуй. Что привело тебя сюда? 💼",
        bio: "Я руковожу IT-компанией. Увлекаюсь технологиями и инвестициями.",
        photos: [
          "https://i.pravatar.cc/400?img=5",
          "https://i.pravatar.cc/400?img=15",
          "https://i.pravatar.cc/400?img=25"
        ],
        baseSympathyReq: 20,
        photoUnlockChance: 0.25,
        isActive: true
      },
      {
        name: "София",
        age: 23,
        description: "Веселая и энергичная студентка, обожает приключения",
        personality: "Оптимистичная, спонтанная, дружелюбная",
        avatarUrl: "https://i.pravatar.cc/400?img=6",
        welcomeMessage: "Йоу! Готов к приключениям? 🎉",
        bio: "Я изучаю журналистику. Люблю путешествовать и фотографировать.",
        photos: [
          "https://i.pravatar.cc/400?img=6",
          "https://i.pravatar.cc/400?img=16",
          "https://i.pravatar.cc/400?img=26",
          "https://i.pravatar.cc/400?img=36",
          "https://i.pravatar.cc/400?img=46"
        ],
        baseSympathyReq: 5,
        photoUnlockChance: 0.4,
        isActive: true
      },
      {
        name: "Екатерина",
        age: 30,
        description: "Загадочная и мудрая женщина с богатым опытом",
        personality: "Мудрая, терпеливая, загадочная",
        avatarUrl: "https://i.pravatar.cc/400?img=11",
        welcomeMessage: "Приветствую... Я чувствую, у нас будет интересная беседа. 🔮",
        bio: "Я психолог. Помогаю людям разбираться в себе. Увлекаюсь философией.",
        photos: [
          "https://i.pravatar.cc/400?img=11",
          "https://i.pravatar.cc/400?img=21"
        ],
        baseSympathyReq: 30,
        photoUnlockChance: 0.2,
        isActive: true
      },
      {
        name: "Виктория",
        age: 22,
        description: "Спортивная и активная, всегда в движении",
        personality: "Энергичная, целеустремленная, конкурентная",
        avatarUrl: "https://i.pravatar.cc/400?img=8",
        welcomeMessage: "Привет! Готов бросить вызов? 💪",
        bio: "Я профессиональная спортсменка. Занимаюсь горными лыжами.",
        photos: [
          "https://i.pravatar.cc/400?img=8",
          "https://i.pravatar.cc/400?img=18",
          "https://i.pravatar.cc/400?img=28"
        ],
        baseSympathyReq: 15,
        photoUnlockChance: 0.35,
        isActive: true
      }
    ];
    
    const inserted = await Character.insertMany(girls);
    console.log(`✅ Added ${inserted.length} girls`);
    
    res.json({ 
      success: true, 
      count: inserted.length,
      message: `Добавлено ${inserted.length} девушек`,
      girls: inserted.map(g => ({ name: g.name, age: g.age }))
    });
    
  } catch (error) {
    console.error('❌ Seed error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: error.stack 
    });
  }
});

// GET /api/webapp/characters - Get all active girls
router.get('/characters', async (req, res) => {
  try {
    await connectDB();
    
    const characters = await Character.find({ isActive: true }).lean();
    console.log(`📋 Found ${characters.length} characters`);
    
    res.json({ 
      success: true, 
      characters: characters 
    });
    
  } catch (error) {
    console.error('❌ Characters error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// GET /api/webapp/user/:telegramId - Get user data
router.get('/user/:telegramId', async (req, res) => {
  try {
    await connectDB();
    
    const user = await User.findOne({ 
      telegramId: parseInt(req.params.telegramId) 
    });
    
    res.json({ 
      success: true, 
      user: user || { telegramId: parseInt(req.params.telegramId) } 
    });
    
  } catch (error) {
    console.error('❌ User error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// POST /api/webapp/select-character - Select a girl
router.post('/select-character', async (req, res) => {
  try {
    await connectDB();
    
    const { telegramId, characterId } = req.body;
    
    if (!telegramId || !characterId) {
      return res.status(400).json({ 
        success: false, 
        error: 'telegramId and characterId required' 
      });
    }
    
    const character = await Character.findById(characterId);
    if (!character) {
      return res.status(404).json({ 
        success: false, 
        error: 'Character not found' 
      });
    }
    
    const user = await User.findOneAndUpdate(
      { telegramId: parseInt(telegramId) },
      { selectedGirl: character.name },
      { new: true, upsert: true }
    );
    
    console.log(`👥 User ${telegramId} selected ${character.name}`);
    
    res.json({ 
      success: true, 
      message: `Выбрана ${character.name}!`,
      user: user,
      character: character 
    });
    
  } catch (error) {
    console.error('❌ Select error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// POST /api/webapp/chat - Send message (increase sympathy)
router.post('/chat', async (req, res) => {
  try {
    await connectDB();
    
    const { telegramId, message } = req.body;
    
    if (!telegramId || !message) {
      return res.status(400).json({ 
        success: false, 
        error: 'telegramId and message required' 
      });
    }
    
    // Update user stats
    await User.findOneAndUpdate(
      { telegramId: parseInt(telegramId) },
      { 
        $inc: { totalMessages: 1 },
        lastActive: new Date()
      },
      { upsert: true }
    );
    
    // Random AI responses
    const responses = [
      "Интересно! Расскажи больше 😊",
      "Мне нравится как ты думаешь ❤️",
      "Ты особенный 💕",
      "Я рада что ты со мной 🥰",
      "Хочу узнать тебя лучше 💭",
      "Это так мило! 😍",
      "Продолжай, мне интересно 🌟",
      "Ты меня удивляешь! 🎉"
    ];
    
    const response = responses[Math.floor(Math.random() * responses.length)];
    
    console.log(`💬 Chat: User ${telegramId} sent message`);
    
    res.json({ 
      success: true, 
      response: response 
    });
    
  } catch (error) {
    console.error('❌ Chat error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// POST /api/webapp/request-photo - Request photo unlock
router.post('/request-photo', async (req, res) => {
  try {
    await connectDB();
    
    const { telegramId, characterId } = req.body;
    
    if (!telegramId || !characterId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing parameters' 
      });
    }
    
    const user = await User.findOne({ telegramId: parseInt(telegramId) });
    const girl = await Character.findById(characterId);
    
    if (!girl) {
      return res.status(404).json({ 
        success: false, 
        message: 'Girl not found' 
      });
    }
    
    // Calculate sympathy based on messages
    const sympathy = user?.totalMessages || 0;
    const unlockedPhotos = user?.unlockedPhotos || {};
    const unlockedForGirl = unlockedPhotos[characterId] || [];
    
    // Check minimum sympathy
    const minRequired = (girl.baseSympathyReq || 10) + (unlockedForGirl.length * 5);
    
    if (sympathy < minRequired) {
      return res.json({ 
        success: false, 
        message: `Нужно больше общения! (${sympathy}/${minRequired} сообщений)` 
      });
    }
    
    // Calculate unlock chance (increases with sympathy)
    const baseChance = girl.photoUnlockChance || 0.3;
    const bonusChance = Math.min(0.4, sympathy / 100);
    const totalChance = Math.min(0.9, baseChance + bonusChance);
    
    // Try to unlock
    if (Math.random() < totalChance) {
      // Get next photo
      const nextPhotoIndex = unlockedForGirl.length;
      const nextPhoto = girl.photos?.[nextPhotoIndex];
      
      if (nextPhoto) {
        // Save unlocked photo
        unlockedForGirl.push(nextPhoto);
        
        await User.findOneAndUpdate(
          { telegramId: parseInt(telegramId) },
          { 
            [`unlockedPhotos.${characterId}`]: unlockedForGirl,
            $inc: { photosUnlocked: 1 }
          },
          { upsert: true }
        );
        
        console.log(`📸 User ${telegramId} unlocked photo ${nextPhotoIndex + 1} from ${girl.name}`);
        
        res.json({ 
          success: true, 
          photo: nextPhoto,
          message: `Вот моё фото! 📸 (${unlockedForGirl.length}/${girl.photos.length})`
        });
      } else {
        res.json({ 
          success: false, 
          message: "Все фото уже разблокированы! 🎉" 
        });
      }
    } else {
      // Failed to unlock
      const chancePercent = Math.floor(totalChance * 100);
      res.json({ 
        success: false, 
        message: `Пока не готова делиться 🙈 (Шанс: ${chancePercent}%, общайся больше!)` 
      });
    }
    
  } catch (error) {
    console.error('❌ Photo request error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

module.exports = router;
