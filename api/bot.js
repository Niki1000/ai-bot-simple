const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token);

const mongoUrl = process.env.MONGODB_URI;

async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(mongoUrl);
  console.log('✅ Bot DB connected');
}

// Schemas - MUST MATCH api/index.js
const userSchema = new mongoose.Schema({
  telegramId: Number,
  selectedGirl: String,
  likes: [String],
  passes: [String],
  sympathy: Object,
  chatHistory: Object,
  unlockedPhotos: Object,
  totalMessages: Number,
  subscriptionLevel: { type: String, default: 'free' },
  credits: { type: Number, default: 0 }
}, { strict: false });

const charSchema = new mongoose.Schema({
  name: String,
  age: Number,
  avatarUrl: String,
  photos: [String],
  bio: String,
  personality: String,
  welcomeMessage: String,
  isActive: Boolean
});

const User = mongoose.models.User || mongoose.model('User', userSchema);
const Character = mongoose.models.Character || mongoose.model('Character', charSchema);

// Handle updates from webhook
async function handleUpdate(update) {
  try {
    await connectDB();
    
    if (update.message) {
      const chatId = update.message.chat.id;
      const text = update.message.text;
      const userId = update.message.from.id;
      
      console.log(`📨 Message from ${userId}: ${text}`);
      
      // Handle /start command
      if (text === '/start') {
        const webAppUrl = process.env.WEBAPP_URL || 'https://ai-bot-simple.vercel.app';
        
        await bot.sendMessage(chatId, 
          '💕 Привет! Добро пожаловать в AI Dating!\n\n' +
          'Здесь тебя ждут красивые девушки с ИИ 😍\n\n' +
          'Нажми кнопку ниже, чтобы начать знакомства! 👇',
          {
            reply_markup: {
              inline_keyboard: [[
                {
                  text: '💕 Открыть AI Dating',
                  web_app: { url: webAppUrl }
                }
              ]]
            }
          }
        );
        return;
      }
      
      // Handle /girls command
      if (text === '/girls') {
        const chars = await Character.find({ isActive: true }).limit(5);
        
        let message = '👥 Доступные девушки:\n\n';
        chars.forEach((char, i) => {
          message += `${i + 1}. ${char.name}, ${char.age} лет\n`;
        });
        message += '\nОткрой Web App чтобы начать общение! 👆';
        
        await bot.sendMessage(chatId, message);
        return;
      }
      
      // Handle regular messages - AI chat
      let user = await User.findOne({ telegramId: userId });
      
      // Create user if doesn't exist (shouldn't happen, but safety check)
      if (!user) {
        user = new User({
          telegramId: userId,
          likes: [],
          passes: [],
          sympathy: {},
          chatHistory: {},
          unlockedPhotos: {},
          totalMessages: 0,
          subscriptionLevel: 'free',
          credits: 0
        });
        await user.save();
        console.log(`👤 Created new user ${userId} from bot`);
      }
      
      if (!user.selectedGirl) {
        await bot.sendMessage(chatId, 
          '❌ Сначала выбери девушку в приложении!\n\n' +
          'Используй /start чтобы открыть AI Dating 💕'
        );
        return;
      }
      
      // Get character
      const char = await Character.findById(user.selectedGirl);
      if (!char) {
        await bot.sendMessage(chatId, '❌ Девушка не найдена. Выбери другую!');
        return;
      }
      
      // Call DeepSeek API
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
              content: `Ты ${char.name}, ${char.age} лет. ${char.personality}. Отвечай кратко, флиртуй, используй эмодзи. 2-3 предложения.` 
            },
            { role: 'user', content: text }
          ],
          temperature: 0.8
        })
      });
      
      const data = await deepseekRes.json();
      const response = data.choices?.[0]?.message?.content || 'Хм... 🤔';
      
      // Save messages - CRITICAL: Use markModified() for nested objects
      // Initialize nested objects if missing
      if (!user.chatHistory) user.chatHistory = {};
      if (!user.sympathy) user.sympathy = {};
      if (!user.unlockedPhotos) user.unlockedPhotos = {};
      
      const charId = char._id.toString();
      if (!user.chatHistory[charId]) {
        user.chatHistory[charId] = [];
      }
      
      // Save user message
      user.chatHistory[charId].push({
        message: text,
        sender: 'user',
        timestamp: new Date()
      });
      
      // Save bot response
      user.chatHistory[charId].push({
        message: response,
        sender: 'bot',
        timestamp: new Date()
      });
      
      // Update sympathy and total messages
      user.sympathy[charId] = (user.sympathy[charId] || 0) + 1;
      user.totalMessages = (user.totalMessages || 0) + 1;
      
      // CRITICAL: Mark nested objects as modified so Mongoose saves them
      user.markModified('chatHistory');
      user.markModified('sympathy');
      
      await user.save();
      
      console.log(`💾 Saved messages to DB. History length: ${user.chatHistory[charId].length}`);
      
      // Send response
      await bot.sendMessage(chatId, `💕 ${char.name}:\n\n${response}`);
      
      console.log(`✅ Replied to ${userId}`);
    }
  } catch (error) {
    console.error('❌ Bot error:', error);
    if (update.message) {
      try {
        await bot.sendMessage(update.message.chat.id, 'Извини, произошла ошибка 😢');
      } catch (e) {}
    }
  }
}

// Set webhook
async function setWebhook() {
  try {
    const webhookUrl = `${process.env.WEBAPP_URL}/api/webhook`;
    await bot.setWebhook(webhookUrl);
    console.log('✅ Webhook set:', webhookUrl);
  } catch (error) {
    console.error('❌ Webhook error:', error);
  }
}

module.exports = { bot, handleUpdate, setWebhook };
