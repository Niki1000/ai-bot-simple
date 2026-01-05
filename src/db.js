const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI не установлен в .env');
    }

    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ MongoDB подключена успешно');
    return mongoose.connection;
  } catch (error) {
    console.error('❌ Ошибка подключения к MongoDB:', error.message);
    
    // Для production не выходим, чтобы сервер не падал
    if (process.env.NODE_ENV === 'production') {
      console.log('⚠️  Продолжаем работу без MongoDB');
      return null;
    }
    
    process.exit(1);
  }
};

module.exports = connectDB;