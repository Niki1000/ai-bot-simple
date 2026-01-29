const express = require('express');
const router = express.Router();
const { User, Character } = require('../models');
const connectDB = require('../db');

function normalizePhoto(photo, index) {
  if (typeof photo === 'string') {
    return { url: photo, requiredLevel: 1 + (index % 4) };
  }
  if (photo && typeof photo === 'object' && photo.url) {
    return { url: photo.url, requiredLevel: typeof photo.requiredLevel === 'number' ? photo.requiredLevel : 1 + (index % 4) };
  }
  return null;
}

function normalizeCharacterPhotos(char) {
  const c = char.toObject ? char.toObject() : { ...char };
  if (c.photos && Array.isArray(c.photos)) {
    c.photos = c.photos.map((p, i) => normalizePhoto(p, i)).filter(Boolean);
  }
  return c;
}

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

// GET matches – returns lastMessage, lastMessageTime, sympathy, level per match; sorted by last message (newest first)
router.get('/matches/:telegramId', async (req, res) => {
  try {
    await connectDB();
    const user = await User.findOne({ telegramId: parseInt(req.params.telegramId) });
    if (!user || !user.likes || user.likes.length === 0) {
      return res.json({ success: true, matches: [] });
    }
    const chars = await Character.find({
      _id: { $in: user.likes },
      isActive: true
    });
    const chatHistory = user.chatHistory || {};
    const sympathy = user.sympathy || {};
    const characterLevel = user.characterLevel || {};
    const enriched = chars.map(c => {
      const charId = c._id.toString();
      const hist = chatHistory[charId] || [];
      const lastMsg = hist.length > 0 ? hist[hist.length - 1] : null;
      const lastMessage = lastMsg ? (lastMsg.message || '').trim() : (c.welcomeMessage || 'Привет! 💕');
      const lastMessageTime = lastMsg && lastMsg.timestamp ? new Date(lastMsg.timestamp).getTime() : 0;
      const match = normalizeCharacterPhotos(c);
      match.lastMessage = lastMessage;
      match.lastMessageTime = lastMessageTime;
      match.sympathy = sympathy[charId] || 0;
      match.level = characterLevel[charId] ?? 0;
      return match;
    });
    enriched.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
    console.log(`✅ Found ${enriched.length} matches (with lastMessage, sorted)`);
    res.json({ success: true, matches: enriched });
  } catch (e) {
    console.error('❌ Matches error:', e);
    res.json({ success: false, error: e.message });
  }
});

module.exports = router;
