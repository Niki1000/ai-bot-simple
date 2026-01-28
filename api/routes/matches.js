const express = require('express');
const router = express.Router();
const { User, Character } = require('../models');
const connectDB = require('../db');

// POST match (like/pass)
router.post('/match', async (req, res) => {
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
router.get('/matches/:telegramId', async (req, res) => {
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

module.exports = router;
