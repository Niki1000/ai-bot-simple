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
    const telegramId = parseInt(req.params.telegramId, 10);
    if (isNaN(telegramId)) {
      return res.json({ success: true, subscriptionLevel: 'free', credits: 0, unlockedPhotos: {} });
    }
    const user = await User.findOne({ telegramId });
    
    if (!user) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/13440a3b-4e6d-4438-815c-63f2add9ca3b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'user.js:user-entitlements',message:'Backend entitlements: user NOT found',data:{telegramId,userFound:false},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      return res.json({
        success: true,
        subscriptionLevel: 'free',
        credits: 0,
        unlockedPhotos: {}
      });
    }
    
    const unlocked = user.unlockedPhotos || {};
    const unlockedPhotos = {};
    Object.keys(unlocked).forEach(k => {
      const key = String(k);
      const val = unlocked[k];
      unlockedPhotos[key] = Array.isArray(val) ? val.slice() : (val ? [val] : []);
    });
    // #region agent log
    const rawKeys = Object.keys(unlocked);
    const firstKey = rawKeys[0];
    const firstArr = firstKey ? (unlocked[firstKey] || []) : [];
    fetch('http://127.0.0.1:7243/ingest/13440a3b-4e6d-4438-815c-63f2add9ca3b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'user.js:user-entitlements',message:'Backend entitlements response',data:{telegramId,userFound:true,rawKeys,responseKeys:Object.keys(unlockedPhotos),firstKey,firstArrLen:firstArr.length,firstUrlLen:firstArr[0]?.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B,C'})}).catch(()=>{});
    // #endregion
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
