const express = require('express');
const router = express.Router();
const { User, Character } = require('../models');
const connectDB = require('../db');

// POST chat
router.post('/chat', async (req, res) => {
  try {
    await connectDB();
    const { telegramId, message } = req.body;
    const user = await User.findOne({ telegramId: parseInt(telegramId) });
    if (!user?.selectedGirl) {
      return res.json({ success: false, error: 'No character' });
    }
    const char = await Character.findById(user.selectedGirl);
    if (!char) {
      return res.json({ success: false, error: 'Character not found' });
    }

    // Check if API key is configured
    if (!process.env.DEEPSEEK_API_KEY) {
      console.error('❌ DEEPSEEK_API_KEY not configured');
      return res.json({ 
        success: false, 
        error: 'AI API not configured. Please set DEEPSEEK_API_KEY environment variable.',
        response: 'Извини, AI временно недоступен 😢'
      });
    }

    const deepseekRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { 
            role: 'system', 
            content: `Ты ${char.name}, ${char.age} лет. ${char.personality}. 

ВАЖНО: Всегда отвечай в формате "Мысли и сообщение":
1. Сначала напиши свои внутренние мысли/чувства (что ты чувствуешь, думаешь, как реагирует тело) - это должно быть от первого лица, эмоционально, интимно.
2. Затем через пустую строку напиши что ты говоришь вслух (твое сообщение пользователю) - более сдержанное, но все еще флиртующее.

Формат:
[Твои мысли - эмоциональные, интимные, что чувствуешь внутри]
[пустая строка]
[Твое сообщение - что говоришь вслух, флиртующее, с эмодзи, 2-3 предложения]

Пример:
Я чувствую, как мое лицо пылает, и сердце начинает колотиться так сильно, что я боюсь, ты его услышишь! Я прикрываю рот рукой, пытаясь сдержать смешок, и мои глаза от смущения бегают туда-сюда. Ой, ты такой... такой шалун!

Ну... как же я могу угадать? ^^ Ты такой загадочный! Но когда ты так спрашиваешь, мне становится так... интересно... и щеки горят еще сильнее! Может, лучше ты мне расскажешь, как сильно ты хочешь, чтобы я угадала? ;)`
          },
          { role: 'user', content: message }
        ],
        temperature: 0.9
      })
    });

    if (!deepseekRes.ok) {
      const errorData = await deepseekRes.json().catch(() => ({}));
      console.error('❌ DeepSeek API error:', deepseekRes.status, errorData);
      return res.json({ 
        success: false, 
        error: 'AI API error',
        response: 'Извини, произошла ошибка при генерации ответа 😢'
      });
    }

    const data = await deepseekRes.json();
    const response = data.choices?.[0]?.message?.content || 'Хм... 🤔';
    res.json({ success: true, response });
  } catch (e) {
    console.error('❌ Chat error:', e);
    res.json({ 
      success: false, 
      error: e.message,
      response: 'Ой... произошла ошибка 😅' 
    });
  }
});

module.exports = router;
