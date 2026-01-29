const express = require('express');
const router = express.Router();
const { User, Character } = require('../models');
const connectDB = require('../db');

// Normalize photo to { url, requiredLevel }; first photo (index 0) is level 0 (always unlocked)
function normalizePhoto(photo, index) {
  const defaultLevel = index === 0 ? 0 : 1 + (index % 4);
  if (typeof photo === 'string') {
    return { url: photo, requiredLevel: defaultLevel };
  }
  if (photo && typeof photo === 'object' && photo.url) {
    return { url: photo.url, requiredLevel: typeof photo.requiredLevel === 'number' ? photo.requiredLevel : defaultLevel };
  }
  return null;
}

function getPhotosWithLevels(char) {
  if (!char.photos || !Array.isArray(char.photos)) return [];
  return char.photos.map((p, i) => normalizePhoto(p, i)).filter(Boolean);
}

// POST request photo – level-gated: only photos with requiredLevel <= user level can be unlocked
router.post('/request-photo', async (req, res) => {
  try {
    await connectDB();
    const { telegramId, characterId: rawCharId } = req.body;
    const characterId = rawCharId != null ? String(rawCharId) : rawCharId;
    const user = await User.findOne({ telegramId: parseInt(telegramId) });
    const char = await Character.findById(characterId);
    
    if (!user || !char) {
      return res.json({ success: false, message: 'Не найдено' });
    }
    
    const level = user.characterLevel?.[characterId] ?? 0;
    const photosWithLevels = getPhotosWithLevels(char);
    const unlocked = user.unlockedPhotos || {};
    const unlockedList = Array.isArray(unlocked[characterId]) ? unlocked[characterId] : [];
    
    const lockableAtLevel = photosWithLevels.filter(
      p => p.requiredLevel <= level && !unlockedList.includes(p.url)
    );
    
    if (lockableAtLevel.length === 0) {
      return res.json({
        success: false,
        message: 'Новые фото откроются на следующем уровне'
      });
    }
    
    const chosen = lockableAtLevel[Math.floor(Math.random() * lockableAtLevel.length)];
    const list = unlockedList.slice();
    if (!list.includes(chosen.url)) list.push(chosen.url);
    user.unlockedPhotos = { ...unlocked, [characterId]: list };
    user.markModified('unlockedPhotos');
    await user.save();
    return res.json({ success: true, photo: chosen.url });
  } catch (e) {
    console.error('❌ Request photo error:', e);
    res.json({ success: false, error: e.message });
  }
});

// POST unlock photo
router.post('/unlock-photo', async (req, res) => {
  try {
    await connectDB();
    const { telegramId, characterId: rawCharId, photoUrl } = req.body;
    const characterId = rawCharId != null ? String(rawCharId) : rawCharId;
    
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
    
    // Initialize unlockedPhotos if needed (use string key for consistency)
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
