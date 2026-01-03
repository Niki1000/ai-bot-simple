import mongoose from './db';
import { Character } from './models/Character';
import dotenv from 'dotenv';

dotenv.config();

const seedCharacters = async () => {
  try {
    // Очищаем старые данные
    await Character.deleteMany({});
    
    // Создаем персонажей
    const characters = [
      {
        name: "Анна 👩‍🎨",
        age: 25,
        bio: "Художница из Санкт-Петербурга. Люблю современное искусство, выставки и кофе по утрам.",
        personality: "Творческая, мечтательная, немного загадочная",
        openingLine: "Привет! Я заметила, что ты тоже интересуешься искусством. Расскажи, что тебя вдохновляет?",
        avatarUrl: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400&h=400&fit=crop",
        photoUrls: [
          "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=600&h=800&fit=crop",
          "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=600&h=800&fit=crop"
        ],
        isActive: true
      },
      {
        name: "Максим 👨‍💻",
        age: 28,
        bio: "Разработчик из Москвы. Увлекаюсь технологиями, горными походами и настольными играми.",
        personality: "Аналитичный, спортивный, с хорошим чувством юмора",
        openingLine: "Привет! Смотрю, ты тоже разбираешься в технологиях. Какие проекты тебя интересуют?",
        avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop",
        photoUrls: [
          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&h=800&fit=crop",
          "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&h=800&fit=crop"
        ],
        isActive: true
      }
    ];
    
    await Character.insertMany(characters);
    console.log(`✅ Добавлено ${characters.length} персонажей`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Ошибка при создании персонажей:', error);
    process.exit(1);
  }
};

// Подключаемся к базе и запускаем сидинг
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-dating-bot')
  .then(() => seedCharacters())
  .catch(err => {
    console.error('❌ Ошибка подключения к MongoDB:', err);
    process.exit(1);
  });