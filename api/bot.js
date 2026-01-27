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

// Remove persistent keyboard buttons (keep only Web App button)
async function removeKeyboardButtons() {
  try {
    // Remove all bot commands
    await bot.deleteMyCommands();
    console.log('✅ Removed bot commands/keyboard buttons');
  } catch (error) {
    console.error('❌ Error removing keyboard buttons:', error);
  }
}

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
        // Remove any persistent keyboard buttons
        await removeKeyboardButtons();
        
        // Use WEBAPP_URL if set, otherwise VERCEL_URL (auto-provided by Vercel), or fallback
        // VERCEL_URL is the current deployment URL, but for production use a stable URL
        const baseUrl = process.env.WEBAPP_URL || 
                       process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                       'https://ai-bot-simple.vercel.app';
        // Add cache-busting parameter to force fresh load
        const timestamp = Date.now();
        const webAppUrl = `${baseUrl}?v=${timestamp}`;
        
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
      
      // Handle /help command
      if (text === '/help') {
        const baseUrl = process.env.WEBAPP_URL || 
                       process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                       'https://ai-bot-simple.vercel.app';
        const timestamp = Date.now();
        const webAppUrl = `${baseUrl}?v=${timestamp}`;
        
        const helpMessage = 
          '📖 Помощь по AI Dating Bot\n\n' +
          '🔹 /start - Начать работу с ботом\n' +
          '🔹 /help - Показать это сообщение\n' +
          '🔹 /girls - Список доступных девушек\n\n' +
          '💡 Чтобы начать общение:\n' +
          '1. Нажми кнопку ниже "Открыть AI Dating"\n' +
          '2. Свайпни девушек вправо, чтобы лайкнуть\n' +
          '3. Открой чат с понравившейся девушкой\n' +
          '4. Начни общение! 💕\n\n' +
          'Все общение происходит в приложении - открой его, чтобы начать чат!';
        
        await bot.sendMessage(chatId, helpMessage, {
          reply_markup: {
            inline_keyboard: [[
              {
                text: '💕 Открыть AI Dating',
                web_app: { url: webAppUrl }
              }
            ]],
            remove_keyboard: true
          }
        });
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
        
        await bot.sendMessage(chatId, message, {
          reply_markup: {
            remove_keyboard: true
          }
        });
        return;
      }
      
      // Handle unrecognized commands (starts with / but not a known command)
      if (text.startsWith('/')) {
        const baseUrl = process.env.WEBAPP_URL || 
                       process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                       'https://ai-bot-simple.vercel.app';
        const timestamp = Date.now();
        const webAppUrl = `${baseUrl}?v=${timestamp}`;
        
        await bot.sendMessage(chatId, 
          '❌ Команда не найдена!\n\n' +
          'Доступные команды:\n' +
          '🔹 /start - Начать работу\n' +
          '🔹 /help - Помощь\n' +
          '🔹 /girls - Список девушек\n\n' +
          'Или открой приложение, чтобы начать знакомства! 👇',
          {
            reply_markup: {
              inline_keyboard: [[
                {
                  text: '💕 Открыть AI Dating',
                  web_app: { url: webAppUrl }
                }
              ]],
              remove_keyboard: true
            }
          }
        );
        return;
      }
      
      // Handle regular messages - redirect to WebApp (chat only in miniapp)
      const baseUrl = process.env.WEBAPP_URL || 
                     process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                     'https://ai-bot-simple.vercel.app';
      const timestamp = Date.now();
      const webAppUrl = `${baseUrl}?v=${timestamp}`;
      
      await bot.sendMessage(chatId, 
        '💬 Общение с девушками доступно только в приложении!\n\n' +
        'Нажми кнопку ниже, чтобы открыть AI Dating и начать чат 💕',
        {
          reply_markup: {
            inline_keyboard: [[
              {
                text: '💕 Открыть AI Dating',
                web_app: { url: webAppUrl }
              }
            ]],
            remove_keyboard: true
          }
        }
      );
      
      console.log(`📱 Redirected user ${userId} to WebApp for chat`);
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
    // For webhook, use VERCEL_URL (current deployment) or WEBAPP_URL
    // VERCEL_URL is automatically provided by Vercel and points to current deployment
    const baseUrl = process.env.WEBAPP_URL || 
                   (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                    'https://ai-bot-simple.vercel.app');
    
    const webhookUrl = `${baseUrl}/api/webhook`;
    await bot.setWebhook(webhookUrl);
    console.log('✅ Webhook set:', webhookUrl);
  } catch (error) {
    console.error('❌ Webhook error:', error);
  }
}

// Initialize: Remove keyboard buttons on startup
removeKeyboardButtons();

module.exports = { bot, handleUpdate, setWebhook, removeKeyboardButtons };
