import { bot } from './bot';
import { connectDB } from './db';

async function testBotCommands() {
  console.log('🤖 Тестирование команд бота...\n');
  
  try {
    // Подключаемся к базе данных
    await connectDB();
    console.log('✅ MongoDB подключена\n');
    
    // Имитируем команды (для реального теста нужно запустить бота)
    console.log('📋 Доступные команды:');
    console.log('1. /start - приветствие');
    console.log('2. /girls - список персонажей');
    console.log('3. /profile - профиль пользователя');
    console.log('4. /help - справка');
    console.log('5. Текстовые сообщения\n');
    
    console.log('🔍 Проверка моделей данных:');
    
    // Проверяем модели
    const User = require('./models/User').User;
    const Character = require('./models/Character').Character;
    
    if (User && Character) {
      console.log('✅ Модели User и Character загружены');
    }
    
    // Проверяем наличие персонажей
    const characterCount = await Character.countDocuments();
    console.log(`📊 Персонажей в базе: ${characterCount}`);
    
    if (characterCount === 0) {
      console.log('⚠️  В базе нет персонажей. Запустите seed.ts');
      console.log('   Команда: npx ts-node seed.ts');
    }
    
    // Проверяем наличие пользователей
    const userCount = await User.countDocuments();
    console.log(`👥 Пользователей в базе: ${userCount}\n`);
    
    console.log('🚀 Для реального теста:');
    console.log('1. Запустите сервер: npm run dev');
    console.log('2. Откройте Telegram и найдите бота');
    console.log('3. Отправьте команды и проверьте ответы');
    
  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error);
  }
}

// Запускаем тест
testBotCommands();