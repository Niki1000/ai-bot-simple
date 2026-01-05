const express = require('express');
const mongoose = require('mongoose');
const Character = require('../src/models/Character');
const User = require('../src/models/User');

const router = express.Router();

// Middleware для парсинга JSON
router.use(express.json());

// Получить всех персонажей
router.get('/characters', async (req, res) => {
  try {
    const characters = await Character.find({ isActive: true })
      .select('name age description personality avatarUrl welcomeMessage trustRequired photoLimit')
      .lean();
    
    res.json({ success: true, characters });
  } catch (error) {
    console.error('Error getting characters:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Получить пользователя по telegramId
router.get('/user/:telegramId', async (req, res) => {
  try {
    const user = await User.findOne({ telegramId: parseInt(req.params.telegramId) });
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    let character = null;
    if (user.characterId) {
      character = await Character.findById(user.characterId)
        .select('name age avatarUrl')
        .lean();
    }
    
    res.json({
      success: true,
      user: {
        ...user.toObject(),
        character
      }
    });
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Выбрать персонажа
router.post('/select-character', async (req, res) => {
  try {
    const { telegramId, characterId } = req.body;
    
    if (!telegramId || !characterId) {
      return res.status(400).json({ 
        success: false, 
        error: 'telegramId and characterId are required' 
      });
    }
    
    const character = await Character.findById(characterId);
    if (!character) {
      return res.status(404).json({ success: false, error: 'Character not found' });
    }
    
    const user = await User.findOneAndUpdate(
      { telegramId: parseInt(telegramId) },
      { characterId: characterId },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    
    res.json({
      success: true,
      message: `Вы выбрали ${character.name}!`,
      user: user.toObject(),
      character: character.toObject()
    });
  } catch (error) {
    console.error('Error selecting character:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Отправить сообщение
router.post('/chat', async (req, res) => {
  try {
    const { telegramId, message } = req.body;
    
    if (!telegramId || !message) {
      return res.status(400).json({ 
        success: false, 
        error: 'telegramId and message are required' 
      });
    }
    
    // Увеличиваем счетчик сообщений
    await User.findOneAndUpdate(
      { telegramId: parseInt(telegramId) },
      { 
        $inc: { totalMessages: 1, trustLevel: 1 },
        lastActive: new Date()
      }
    );
    
    // Простой AI ответ (можно заменить на реальный AI API)
    const responses = [
      "О, это интересно! Расскажи подробнее? 🤔",
      "Я понимаю тебя. Давай поговорим об этом! 💬",
      "Спасибо, что поделился! Это важно для меня. ❤️",
      "Хм, я думаю о твоих словах... Что ты сам об этом думаешь? 💭",
      "Как здорово! Я рад нашему общению. 😊",
      "Интересная мысль! У меня есть что добавить... 📝",
      "Я ценю твою открытость. Давай продолжим беседу! 👍"
    ];
    
    const response = responses[Math.floor(Math.random() * responses.length)];
    
    res.json({
      success: true,
      response: response,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in chat:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;