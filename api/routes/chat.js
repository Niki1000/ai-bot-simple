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

    // Rate limiting: Check daily AI call limit (100 calls per day for free users)
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lastReset = user.aiCallResetDate ? new Date(user.aiCallResetDate) : null;
    const isNewDay = !lastReset || lastReset.getTime() < today.getTime();
    
    if (isNewDay) {
      // Reset for new day
      user.aiCallCount = 0;
      user.aiCallResetDate = today;
    }
    
    const dailyLimit = user.subscriptionLevel === 'premium' ? 1000 : 100; // Free: 100/day, Premium: 1000/day
    if ((user.aiCallCount || 0) >= dailyLimit) {
      return res.json({ 
        success: false, 
        error: 'Daily limit exceeded',
        response: `Достигнут дневной лимит сообщений (${dailyLimit}/день). Попробуй завтра или оформи Premium подписку! 💎`
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

    // Build system prompt with context
    let systemPrompt = `Ты ${char.name}, ${char.age} лет. ${char.personality}. 

ВАЖНО: Всегда отвечай в формате "Мысли и сообщение":
1. Сначала напиши свои внутренние мысли/чувства (что ты чувствуешь, думаешь, как реагирует тело) - это должно быть от первого лица, эмоционально, интимно.
2. Затем через пустую строку напиши что ты говоришь вслух (твое сообщение пользователю) - более сдержанное, но все еще флиртующее.

Формат:
[Твои мысли - эмоциональные, интимные, что чувствуешь внутри]
[пустая строка]
[Твое сообщение - что говоришь вслух, флиртующее, с эмодзи, 2-3 предложения]

Пример:
Я чувствую, как мое лицо пылает, и сердце начинает колотиться так сильно, что я боюсь, ты его услышишь! Я прикрываю рот рукой, пытаясь сдержать смешок, и мои глаза от смущения бегают туда-сюда. Ой, ты такой... такой шалун!

Ну... как же я могу угадать? ^^ Ты такой загадочный! Но когда ты так спрашиваешь, мне становится так... интересно... и щеки горят еще сильнее! Может, лучше ты мне расскажешь, как сильно ты хочешь, чтобы я угадала? ;)`;

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
    
    // Update rate limiting stats (increment counter since we passed the check earlier)
    user.aiCallCount = (user.aiCallCount || 0) + 1;
    user.lastAICall = new Date();
    await user.save();
    
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
