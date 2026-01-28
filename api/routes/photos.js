const express = require('express');
const router = express.Router();
const { User, Character } = require('../models');
const connectDB = require('../db');

// POST request photo
router.post('/request-photo', async (req, res) => {
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
      // Add to user's unlocked photos so it stays unlocked in profile and in chat
      if (!user.unlockedPhotos) user.unlockedPhotos = {};
      if (!user.unlockedPhotos[characterId]) user.unlockedPhotos[characterId] = [];
      if (!user.unlockedPhotos[characterId].includes(randomPhoto)) {
        user.unlockedPhotos[characterId].push(randomPhoto);
        user.markModified('unlockedPhotos');
        await user.save();
      }
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

// POST unlock photo
router.post('/unlock-photo', async (req, res) => {
  try {
    await connectDB();
    const { telegramId, characterId, photoUrl } = req.body;
    
    console.log(`📸 Unlock request: user ${telegramId}, char ${characterId}, photo ${photoUrl}`);
    
    const user = await User.findOne({ telegramId: parseInt(telegramId) });
    
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
    if (!user.unlockedPhotos) {user.unlockedPhotos = {};}
    if (!user.unlockedPhotos[characterId]) {user.unlockedPhotos[characterId] = [];}
    
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

module.exports = router;
