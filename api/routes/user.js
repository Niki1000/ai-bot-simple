const express = require('express');
const router = express.Router();
const { User } = require('../models');
const connectDB = require('../db');
const { getDailyLimits, getTodayString } = require('../utils');

// GET user
router.get('/:telegramId', async (req, res) => {
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
router.post('/select-character', async (req, res) => {
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

// GET user entitlements
router.get('/user-entitlements/:telegramId', async (req, res) => {
  try {
    await connectDB();
    const telegramId = parseInt(req.params.telegramId, 10);
    if (isNaN(telegramId)) {
      return res.json({ success: true, subscriptionLevel: 'free', credits: 0, unlockedPhotos: {}, characterLevel: {}, characterLevelProgress: {} });
    }
    const user = await User.findOne({ telegramId });
    
    if (!user) {
      return res.json({
        success: true,
        subscriptionLevel: 'free',
        credits: 0,
        unlockedPhotos: {},
        characterLevel: {},
        characterLevelProgress: {}
      });
    }
    
    const unlocked = user.unlockedPhotos || {};
    const unlockedPhotos = {};
    Object.keys(unlocked).forEach(k => {
      const key = String(k);
      const val = unlocked[k];
      unlockedPhotos[key] = Array.isArray(val) ? val.slice() : (val ? [val] : []);
    });

    const subLevel = user.subscriptionLevel || 'free';
    const limits = getDailyLimits(subLevel);
    const today = getTodayString();
    const isSameDay = user.dailyUsageDate === today;
    const messagesUsed = isSameDay ? (user.messagesSentToday || 0) : 0;
    const photosUsed = isSameDay ? (user.photosRequestedToday || 0) : 0;
    const remainingMessages = Math.max(0, limits.messages - messagesUsed);
    const remainingPhotos = Math.max(0, limits.photos - photosUsed);

    res.json({
      success: true,
      subscriptionLevel: subLevel,
      credits: user.credits || 0,
      unlockedPhotos,
      characterLevel: user.characterLevel || {},
      characterLevelProgress: user.characterLevelProgress || {},
      dailyLimits: {
        remainingMessages,
        remainingPhotos,
        messagesLimit: limits.messages,
        photosLimit: limits.photos
      }
    });
  } catch (e) {
    console.error('❌ Entitlements error:', e);
    res.json({ success: false, error: e.message });
  }
});

module.exports = router;
