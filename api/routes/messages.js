const express = require('express');
const router = express.Router();
const { User } = require('../models');
const { calculateSympathyPoints, getDailyLimits, ensureDailyUsage } = require('../utils');
const connectDB = require('../db');

const MESSAGES_PER_LEVEL = 10;
const MAX_LEVEL = 10;
const PHOTO_REQUEST_PERCENT_PER_MESSAGE = 10; // +10% per user message, cap 100

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

    // When girl sends a photo in chat, add it to unlocked so it stays unlocked after reload
    if (photoUrl && sender === 'bot') {
      const prev = user.unlockedPhotos || {};
      const list = Array.isArray(prev[characterId]) ? prev[characterId].slice() : [];
      if (!list.includes(photoUrl)) list.push(photoUrl);
      user.unlockedPhotos = { ...prev, [characterId]: list };
      user.markModified('unlockedPhotos');
    }

    // Update stats for user messages (skip for photo-request message)
    const isPhotoRequestMessage = (sender === 'user' && message && String(message).trim() === '📸 Запрос фото');
    if (sender === 'user' && !isPhotoRequestMessage) {
      // Daily message limit by subscription
      ensureDailyUsage(user);
      const subLevel = user.subscriptionLevel || 'free';
      const limits = getDailyLimits(subLevel);
      const used = user.messagesSentToday != null ? user.messagesSentToday : 0;
      if (used >= limits.messages) {
        return res.status(429).json({
          success: false,
          error: 'daily_limit',
          message: `Дневной лимит сообщений (${limits.messages}) исчерпан. Завтра снова будет доступно или оформи подписку.`
        });
      }
      user.messagesSentToday = used + 1;
      user.markModified('messagesSentToday');

      // Sympathy (kept for future rude-message decrease)
      const sympathyPoints = calculateSympathyPoints(message);
      const finalPoints = Math.round(sympathyPoints * 10) / 10;
      user.sympathy[characterId] = (user.sympathy[characterId] || 0) + finalPoints;
      user.totalMessages = (user.totalMessages || 0) + 1;
      user.markModified('sympathy');

      // Level: each N messages = +1 level (0–10), progress bar toward next level
      if (!user.characterLevel) user.characterLevel = {};
      if (!user.characterLevelProgress) user.characterLevelProgress = {};
      let level = user.characterLevel[characterId] != null ? user.characterLevel[characterId] : 0;
      let progress = user.characterLevelProgress[characterId] != null ? user.characterLevelProgress[characterId] : 0;
      progress += 1;
      if (progress >= MESSAGES_PER_LEVEL && level < MAX_LEVEL) {
        level += 1;
        progress = 0;
        console.log(`📈 Level up: char ${characterId} -> level ${level}`);
      } else if (level >= MAX_LEVEL) {
        progress = Math.min(progress, MESSAGES_PER_LEVEL - 1);
      }
      user.characterLevel[characterId] = level;
      user.characterLevelProgress[characterId] = progress;
      user.markModified('characterLevel');
      user.markModified('characterLevelProgress');

      // Photo request % (0–100): increases when user chats; resets when girl sends photo
      if (!user.photoRequestPercent) user.photoRequestPercent = {};
      let photoPercent = user.photoRequestPercent[characterId] != null ? user.photoRequestPercent[characterId] : 0;
      photoPercent = Math.min(100, photoPercent + PHOTO_REQUEST_PERCENT_PER_MESSAGE);
      user.photoRequestPercent[characterId] = photoPercent;
      user.markModified('photoRequestPercent');
    }
    
    // CRITICAL: Mark chatHistory as modified so Mongoose saves nested changes
    user.markModified('chatHistory');
    
    await user.save();
    console.log(`✅ Message saved. History length: ${user.chatHistory[characterId].length}`);
    
    const photoRequestPercent = user.photoRequestPercent?.[characterId] ?? 0;
    const subLevel = user.subscriptionLevel || 'free';
    const limits = getDailyLimits(subLevel);
    const remainingMessages = Math.max(0, limits.messages - (user.messagesSentToday || 0));
    const remainingPhotos = Math.max(0, limits.photos - (user.photosRequestedToday || 0));
    res.json({
      success: true,
      sympathy: user.sympathy[characterId] || 0,
      level: user.characterLevel?.[characterId] ?? 0,
      levelProgress: user.characterLevelProgress?.[characterId] ?? 0,
      photoRequestPercent,
      dailyLimits: { remainingMessages, remainingPhotos, messagesLimit: limits.messages, photosLimit: limits.photos }
    });
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
      return res.json({ success: true, history: [], sympathy: 0, level: 0, levelProgress: 0, photoRequestPercent: 0 });
    }
    
    const history = user.chatHistory?.[characterId] || [];
    const sympathy = user.sympathy?.[characterId] || 0;
    const level = user.characterLevel?.[characterId] ?? 0;
    const levelProgress = user.characterLevelProgress?.[characterId] ?? 0;
    const photoRequestPercent = user.photoRequestPercent?.[characterId] ?? 0;
    
    console.log(`✅ Found ${history.length} messages, sympathy: ${sympathy}, level: ${level}, progress: ${levelProgress}, photo%: ${photoRequestPercent}`);
    
    res.json({ success: true, history, sympathy, level, levelProgress, photoRequestPercent });
  } catch (e) {
    console.error('❌ History error:', e);
    res.json({ success: false, error: e.message, history: [], sympathy: 0, level: 0, levelProgress: 0, photoRequestPercent: 0 });
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
