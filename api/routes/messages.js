const express = require('express');
const router = express.Router();
const { User } = require('../models');
const { calculateSympathyPoints } = require('../utils');
const connectDB = require('../db');

// POST save message
router.post('/save-message', async (req, res) => {
  try {
    await connectDB();
    const { telegramId, characterId: rawCharId, message, sender, photoUrl } = req.body;
    const characterId = rawCharId != null ? String(rawCharId) : rawCharId;
    
    console.log(`💬 Saving message: ${sender} -> "${(message || '').substring(0, 30)}..." for char ${characterId}${photoUrl ? ' [with photo]' : ''}`);
    
    let user = await User.findOne({ telegramId: parseInt(telegramId) });
    if (!user) {
      user = new User({
        telegramId: parseInt(telegramId),
        likes: [],
        passes: [],
        sympathy: {},
        chatHistory: {},
        totalMessages: 0
      });
    }
    
    // Initialize nested objects if needed
    if (!user.chatHistory) {user.chatHistory = {};}
    if (!user.sympathy) {user.sympathy = {};}
    if (!user.chatHistory[characterId]) {user.chatHistory[characterId] = [];}

    const msgEntry = { message: message || '', sender, timestamp: new Date() };
    if (photoUrl) msgEntry.photoUrl = photoUrl;
    user.chatHistory[characterId].push(msgEntry);

    // When girl sends a photo in chat, add it to unlocked so it stays unlocked in profile
    if (photoUrl && sender === 'bot') {
      if (!user.unlockedPhotos) user.unlockedPhotos = {};
      if (!user.unlockedPhotos[characterId]) user.unlockedPhotos[characterId] = [];
      if (!user.unlockedPhotos[characterId].includes(photoUrl)) {
        user.unlockedPhotos[characterId].push(photoUrl);
        user.markModified('unlockedPhotos');
      }
    }

    // Update stats for user messages with improved sympathy calculation
    if (sender === 'user') {
      // Calculate sympathy points based on message length
      const sympathyPoints = calculateSympathyPoints(message);
      
      // Time-based weighting: this is a new message, so full weight
      const timeMultiplier = 1.0; // New messages always get full weight
      
      // Calculate final sympathy points
      const finalPoints = Math.round(sympathyPoints * timeMultiplier * 10) / 10; // Round to 1 decimal
      
      // Update sympathy
      user.sympathy[characterId] = (user.sympathy[characterId] || 0) + finalPoints;
      user.totalMessages = (user.totalMessages || 0) + 1;
      user.markModified('sympathy');
      
      const messageLength = message.trim().length;
      console.log(`💕 Sympathy: +${finalPoints} (length: ${messageLength}, total: ${user.sympathy[characterId]})`);
    }
    
    // CRITICAL: Mark chatHistory as modified so Mongoose saves nested changes
    user.markModified('chatHistory');
    
    await user.save();
    
    console.log(`✅ Message saved. History length: ${user.chatHistory[characterId].length}`);
    
    res.json({ success: true, sympathy: user.sympathy[characterId] || 0 });
  } catch (e) {
    console.error('❌ Save message error:', e);
    res.json({ success: false, error: e.message });
  }
});

// GET chat history
router.get('/chat-history/:telegramId/:characterId', async (req, res) => {
  try {
    await connectDB();
    const { telegramId, characterId } = req.params;
    
    console.log(`📜 Loading history for user ${telegramId}, char ${characterId}`);
    
    const user = await User.findOne({ telegramId: parseInt(telegramId) });
    
    if (!user) {
      console.log('❌ User not found');
      return res.json({ success: true, history: [], sympathy: 0 });
    }
    
    const history = user.chatHistory?.[characterId] || [];
    const sympathy = user.sympathy?.[characterId] || 0;
    
    console.log(`✅ Found ${history.length} messages, sympathy: ${sympathy}`);
    
    res.json({ success: true, history, sympathy });
  } catch (e) {
    console.error('❌ History error:', e);
    res.json({ success: false, error: e.message, history: [], sympathy: 0 });
  }
});

// POST clear chat with a character
router.post('/clear-chat', async (req, res) => {
  try {
    await connectDB();
    const { telegramId, characterId } = req.body;
    if (!telegramId || !characterId) {
      return res.status(400).json({ success: false, error: 'telegramId and characterId required' });
    }
    const user = await User.findOne({ telegramId: parseInt(telegramId) });
    if (!user) {
      return res.json({ success: true });
    }
    if (!user.chatHistory) user.chatHistory = {};
    user.chatHistory[characterId] = [];
    user.markModified('chatHistory');
    await user.save();
    console.log(`🗑 Cleared chat for user ${telegramId} with character ${characterId}`);
    res.json({ success: true });
  } catch (e) {
    console.error('❌ Clear chat error:', e);
    res.json({ success: false, error: e.message });
  }
});

module.exports = router;
