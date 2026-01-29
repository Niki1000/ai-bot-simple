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

// GET characters - filter out already liked characters with chat history
router.get('/', async (req, res) => {
  try {
    await connectDB();
    const telegramId = req.query.telegramId ? parseInt(req.query.telegramId) : null;
    
    let chars = await Character.find({ isActive: true });
    console.log(`✅ Found ${chars.length} characters`);
    
    // If telegramId provided, filter and order characters
    if (telegramId) {
      const user = await User.findOne({ telegramId });
      
      if (user && user.likes && user.likes.length > 0 && user.chatHistory) {
        // Filter out characters that are in likes AND have chat history
        const likedWithChat = user.likes.filter(charId => {
          return user.chatHistory[charId] && user.chatHistory[charId].length > 0;
        });
        
        // Remove characters that are liked and have chat
        chars = chars.filter(char => {
          const charIdStr = char._id.toString();
          const isLiked = user.likes.includes(charIdStr);
          const hasChat = user.chatHistory[charIdStr] && user.chatHistory[charIdStr].length > 0;
          
          // Exclude if both liked AND has chat history
          return !(isLiked && hasChat);
        });
        
        console.log(`🔍 Filtered: ${likedWithChat.length} characters removed (liked + chat exists)`);
      }
      
      // Order: never seen first (discovery), then passed, then liked-without-chat; within groups randomize
      if (user) {
        const likes = user.likes || [];
        const passes = user.passes || [];
        chars.sort((a, b) => {
          const aId = a._id.toString();
          const bId = b._id.toString();
          const aNeverSeen = !likes.includes(aId) && !passes.includes(aId);
          const bNeverSeen = !likes.includes(bId) && !passes.includes(bId);
          const aPassed = passes.includes(aId);
          const bPassed = passes.includes(bId);
          // 1) Never seen first (discovery)
          if (aNeverSeen && !bNeverSeen) return -1;
          if (!aNeverSeen && bNeverSeen) return 1;
          if (aNeverSeen && bNeverSeen) return Math.random() - 0.5;
          // 2) Then passed (give another chance)
          if (aPassed && !bPassed) return 1;
          if (!aPassed && bPassed) return -1;
          if (aPassed && bPassed) return Math.random() - 0.5;
          // 3) Liked but no chat yet – randomize
          return Math.random() - 0.5;
        });
      } else {
        chars.sort(() => Math.random() - 0.5);
      }
      
      console.log(`✅ Returning ${chars.length} characters for swipe (ordered by preferences)`);
    }
    
    const characters = chars.map(c => normalizeCharacterPhotos(c));
    res.json({ success: true, characters });
  } catch (e) {
    console.error('❌ Characters error:', e);
    res.json({ success: false, error: e.message });
  }
});

module.exports = router;
