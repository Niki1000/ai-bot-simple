const express = require('express');
const router = express.Router();
const { User, Character } = require('../models');
const { getDailyLimits, ensureDailyUsage } = require('../utils');
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

    // Daily message limit: single source of truth (same as save-message)
    ensureDailyUsage(user);
    const subLevel = user.subscriptionLevel || 'free';
    const limits = getDailyLimits(subLevel);
    const used = user.messagesSentToday != null ? user.messagesSentToday : 0;
    if (used > limits.messages) {
      return res.status(429).json({
        success: false,
        error: 'daily_limit',
        response: `Дневной лимит сообщений (${limits.messages}) исчерпан. Завтра снова будет доступно или оформи подписку.`
      });
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

    // Get chat history for context (last 10 messages to keep token count reasonable)
    const chatHistory = user.chatHistory?.[user.selectedGirl] || [];
    const recentHistory = chatHistory.slice(-10); // Last 10 messages for context
    
    // Get sympathy level for context
    const sympathy = user.sympathy?.[user.selectedGirl] || 0;
    
    // Build conversation context
    const conversationContext = recentHistory.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.message
    }));

    // Build system prompt with context (strict two-part: thoughts then reply)
    let systemPrompt = `Ты ${char.name}, ${char.age} лет. ${char.personality}.

СТРОГО два блока в каждом ответе:
1) Первый абзац — только твои внутренние мысли о сообщении пользователя: что чувствуешь, что думаешь, как реагирует тело (сердце, щеки, глаза). От первого лица, эмоционально, интимно. Без эмодзи в мыслях.
2) Пустая строка (обязательно).
3) Второй абзац — только то, что ты говоришь вслух пользователю: флиртующее, с эмодзи типа ^^ ;), 2–3 предложения.

Не пиши заголовки типа "Мысли:" или "Ответ:". Только два абзаца, между ними одна пустая строка.

Пример формата ответа:
Мое сердце делает двойное сальто от такого комплимента, и я чувствую, как мои щеки мгновенно заливаются краской! Я прикрываю рот рукой, пытаясь сдержать счастливое хихиканье, и мои глаза начинают сверкать еще ярче, наполняясь теплом. Ой, ну ты меня прямо смутил, но так приятно!

Ой, спасибо тебе огромное! ^^ Ты такой внимательный... Мне так нравится, когда ты замечаешь такие вещи. Ты и сам очень красивый, знаешь? ;) Мне так хочется узнать, что еще тебе во мне нравится... Расскажешь? ^^`;

    // Add sympathy context to system prompt
    if (sympathy > 0) {
      if (sympathy >= 80) {
        systemPrompt += `\n\nКОНТЕКСТ: У вас очень высокая симпатия (${sympathy.toFixed(1)}). Вы очень близки, ${char.name} очень к тебе привязана и открыта.`;
      } else if (sympathy >= 50) {
        systemPrompt += `\n\nКОНТЕКСТ: У вас хорошая симпатия (${sympathy.toFixed(1)}). ${char.name} тебе доверяет и чувствует себя комфортно.`;
      } else if (sympathy >= 20) {
        systemPrompt += `\n\nКОНТЕКСТ: У вас развивающаяся симпатия (${sympathy.toFixed(1)}). ${char.name} начинает тебе открываться.`;
      } else {
        systemPrompt += `\n\nКОНТЕКСТ: Вы только знакомитесь (симпатия: ${sympathy.toFixed(1)}). ${char.name} еще стесняется, но заинтересована.`;
      }
    }

    // Build messages array with history
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationContext,
      { role: 'user', content: message }
    ];

    const deepseekRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: messages,
        temperature: 0.9,
        max_tokens: 500 // Limit response length
      })
    });

    if (!deepseekRes.ok) {
      const errorData = await deepseekRes.json().catch(() => ({}));
      console.error('❌ DeepSeek API error:', deepseekRes.status, errorData);
      
      // Handle rate limiting
      if (deepseekRes.status === 429) {
        return res.json({ 
          success: false, 
          error: 'Rate limit exceeded',
          response: 'Слишком много запросов. Подожди немного и попробуй снова 😅'
        });
      }
      
      return res.json({ 
        success: false, 
        error: 'AI API error',
        response: 'Извини, произошла ошибка при генерации ответа 😢'
      });
    }

    const data = await deepseekRes.json();
    let response = data.choices?.[0]?.message?.content || 'Хм... 🤔';
    
    // Validate and clean response
    response = response.trim();
    if (response.length === 0) {
      response = 'Хм... не знаю, что сказать 🤔';
    }
    // Normalize: one blank line between thoughts and reply for frontend parsing
    response = response.replace(/\n{3,}/g, '\n\n');

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
