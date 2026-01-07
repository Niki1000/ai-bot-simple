const express = require('express');
const User = require('../src/models/User');
const Character = require('../src/models/Character');

const router = express.Router();

// GET /api/webapp/characters (Used by app.js)
router.get('/characters', async (req, res) => {
  try {
    const characters = await Character.find({ isActive: true })
      .select('name age description personality avatarUrl welcomeMessage bio photos baseSympathyReq photoUnlockChance')
      .lean();
    
    res.json({ success: true, characters });
  } catch (error) {
    console.error('Error getting characters:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/webapp/user/:telegramId
router.get('/user/:telegramId', async (req, res) => {
  try {
    const user = await User.findOne({ telegramId: parseInt(req.params.telegramId) });
    res.json({ success: true, user: user || {} });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/webapp/select-character
router.post('/select-character', async (req, res) => {
  try {
    const { telegramId, characterId } = req.body;
    
    const character = await Character.findById(characterId);
    if (!character) {
      return res.status(404).json({ success: false, error: 'Character not found' });
    }
    
    const user = await User.findOneAndUpdate(
      { telegramId: parseInt(telegramId) },
      { selectedGirl: character.name },
      { new: true, upsert: true }
    );
    
    res.json({ success: true, message: `Выбрана ${character.name}!`, user, character });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/webapp/chat (sympathy +1)
router.post('/chat', async (req, res) => {
  const { telegramId, message } = req.body;
  try {
    const user = await User.findOne({ telegramId: parseInt(telegramId) });
    const characterId = user?.selectedGirl || 'default';
    
    await User.findOneAndUpdate(
      { telegramId: parseInt(telegramId) },
      {
        $inc: { 
          [`sympathy.${characterId}`]: 1,
          totalMessages: 1 
        },
        lastActive: new Date()
      },
      { upsert: true }
    );

    const responses = [
      "Интересно! Расскажи больше 😊", 
      "Мне нравится как ты думаешь ❤️", 
      "Ты особенный 💕",
      "Я рада что ты со мной 🥰",
      "Хочу узнать тебя лучше 💭"
    ];
    
    res.json({ 
      success: true, 
      response: responses[Math.floor(Math.random() * responses.length)]
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/webapp/request-photo (chance unlock)
router.post('/request-photo', async (req, res) => {
  const { telegramId, characterId } = req.body;
  try {
    const user = await User.findOne({ telegramId: parseInt(telegramId) });
    const girl = await Character.findById(characterId);
    
    if (!girl || !user) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }
    
    const sympathy = user.sympathy?.get(characterId.toString()) || 0;
    const unlocked = user.unlockedPhotos?.get(characterId.toString()) || [];
    
    // Calculate chance (higher sympathy = higher chance)
    const baseChance = girl.photoUnlockChance || 0.3;
    const chance = Math.min(0.9, baseChance + (sympathy / 100));
    
    if (Math.random() < chance) {
      // Unlock next photo
      const nextPhoto = girl.photos?.[unlocked.length];
      
      if (nextPhoto) {
        unlocked.push(nextPhoto);
        
        await User.findOneAndUpdate(
          { telegramId: parseInt(telegramId) },
          { 
            [`unlockedPhotos.${characterId}`]: unlocked,
            $inc: { photosUnlocked: 1 }
          }
        );
        
        res.json({ 
          success: true, 
          photo: nextPhoto,
          message: `Вот моё фото! 📸 (${unlocked.length}/${girl.photos.length})`
        });
      } else {
        res.json({ success: false, message: "Все фото разблокированы! 🎉" });
      }
    } else {
      const needed = (girl.baseSympathyReq || 10) + unlocked.length * 5;
      res.json({ 
        success: false, 
        message: `Пока не готова 🙈 Симпатия: ${sympathy}/${needed} (Шанс: ${(chance*100).toFixed(0)}%)`
      });
    }
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
