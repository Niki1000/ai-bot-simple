const express = require('express');
const router = express.Router();
const { User } = require('../models');
const connectDB = require('../db');

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
    const user = await User.findOne({ telegramId: parseInt(req.params.telegramId) });
    
    if (!user) {
      return res.json({
        success: true,
        subscriptionLevel: 'free',
        credits: 0,
        unlockedPhotos: {}
      });
    }
    
    const unlocked = user.unlockedPhotos || {};
    const unlockedPhotos = {};
    Object.keys(unlocked).forEach(k => { unlockedPhotos[String(k)] = unlocked[k]; });
    res.json({
      success: true,
      subscriptionLevel: user.subscriptionLevel || 'free',
      credits: user.credits || 0,
      unlockedPhotos
    });
  } catch (e) {
    console.error('❌ Entitlements error:', e);
    res.json({ success: false, error: e.message });
  }
});

module.exports = router;
