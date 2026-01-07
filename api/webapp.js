const express = require('express');
const User = require('../src/models/User');
const Character = require('../src/models/Character');

const router = express.Router();
router.use(express.json());

// GET /api/webapp/girls (Tinder swipe cards)
router.get('/girls', async (req, res) => {
  try {
    const girls = await Character.find({ isActive: true })
      .select('name age description avatarUrl bio sympathyReq')
      .lean();
    res.json({ success: true, girls });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/webapp/chat (sympathy +1)
router.post('/chat', async (req, res) => {
  const { telegramId, characterId, message } = req.body;
  try {
    const user = await User.findOneAndUpdate(
      { telegramId: parseInt(telegramId) },
      {
        $inc: { 
          [`sympathy.${characterId}`]: 1,  // +1 sympathy
          totalMessages: 1 
        },
        lastActive: new Date()
      },
      { upsert: true, new: true }
    );

    // Dummy responses
    const responses = ["Интересно! Расскажи больше 😊", "Мне нравится как ты думаешь ❤️", "Ты особенный 💕"];
    res.json({ success: true, response: responses[Math.floor(Math.random()*3)], sympathy: user.sympathy.get(characterId) || 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/webapp/photo (chance-based unlock)
router.post('/photo', async (req, res) => {
  const { telegramId, characterId } = req.body;
  try {
    const user = await User.findOne({ telegramId: parseInt(telegramId) });
    const girl = await Character.findById(characterId);
    
    const sympathy = user.sympathy.get(characterId) || 0;
    const chance = Math.min(0.9, girl.photoUnlockChance + (sympathy / 200));  // Max 90%
    
    if (Math.random() < chance) {
      // Unlock next photo
      const unlocked = user.unlockedPhotos.get(characterId) || [];
      const nextPhoto = girl.photos[unlocked.length];
      if (nextPhoto) {
        unlocked.push(nextPhoto);
        await User.findOneAndUpdate(
          { telegramId: parseInt(telegramId) },
          { [`unlockedPhotos.${characterId}`]: unlocked, $inc: { photosUnlocked: 1 } }
        );
        res.json({ success: true, photo: nextPhoto, sympathyReq: girl.baseSympathyReq });
      } else {
        res.json({ success: false, message: "Все фото разблокированы!" });
      }
    } else {
      res.json({ success: false, message: `Попробуй ещё! Нужно ${girl.baseSympathyReq + unlocked.length * 10} симпатии (шанс: ${(chance*100).toFixed(0)}%)` });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/webapp/user/:id (stats)
router.get('/user/:telegramId', async (req, res) => {
  const user = await User.findOne({ telegramId: parseInt(req.params.telegramId) });
  res.json({ success: true, user: user || {} });
});

module.exports = router;
