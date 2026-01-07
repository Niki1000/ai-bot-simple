require('dotenv').config();
const mongoose = require('mongoose');
const Character = require('./models/Character');
const connectDB = require('./db');

async function seedDatabase() {
  try {
    console.log('🌱 Заполнение базы данных...');

    await connectDB();

    // Удаляем старые данные
    await Character.deleteMany({});
    console.log('🧹 Удалены старые персонажи');

    // Создаём тестовых персонажей
    const characters = [
      {
        name: "Анна",
        age: 25,
        description: "Романтичная девушка с мягким характером, любит искусство",
        personality: "Заботливая, чувствительная, творческая",
        avatarUrl: "https://i.pravatar.cc/150?img=1",
        welcomeMessage: "Привет! Я так рада познакомиться с тобой! 🌸",
        bio: "Я Анна, работаю дизайнером. Люблю живопись, классическую музыку и долгие прогулки по парку.",
        trustRequired: 10,
        photoLimit: 3,
        isActive: true,
        // In characters array, add:
        photos: [
          'https://i.pravatar.cc/400?img=1',  // Photo 1
          'https://i.pravatar.cc/400?img=12',
          'https://i.pravatar.cc/400?img=23',
          // Add 7 more per girl (total 10)
        ]
      },
      {
        name: "Мария",
        age: 27,
        description: "Уверенная в себе бизнес-леди, ценит интеллект",
        personality: "Умная, амбициозная, прямолинейная",
        avatarUrl: "https://i.pravatar.cc/150?img=5",
        welcomeMessage: "Здравствуй. Что привело тебя сюда? 💼",
        bio: "Я Мария, руковожу IT-компанией. Увлекаюсь технологиями, инвестициями и спортом.",
        trustRequired: 20,
        photoLimit: 2,
        isActive: true,
        // In characters array, add:
        photos: [
          'https://i.pravatar.cc/400?img=1',  // Photo 1
          'https://i.pravatar.cc/400?img=12',
          'https://i.pravatar.cc/400?img=23',
          // Add 7 more per girl (total 10)
        ]
      },
      {
        name: "София",
        age: 23,
        description: "Веселая и энергичная студентка, обожает приключения",
        personality: "Оптимистичная, спонтанная, дружелюбная",
        avatarUrl: "https://i.pravatar.cc/150?img=6",
        welcomeMessage: "Йоу! Готов к приключениям? 🎉",
        bio: "Я София, изучаю журналистику. Люблю путешествовать, фотографировать и знакомиться с новыми людьми.",
        trustRequired: 5,
        photoLimit: 5,
        isActive: true,
        // In characters array, add:
        photos: [
          'https://i.pravatar.cc/400?img=1',  // Photo 1
          'https://i.pravatar.cc/400?img=12',
          'https://i.pravatar.cc/400?img=23',
          // Add 7 more per girl (total 10)
        ]
      },
      {
        name: "Екатерина",
        age: 30,
        description: "Загадочная и мудрая женщина с богатым опытом",
        personality: "Мудрая, терпеливая, загадочная",
        avatarUrl: "https://i.pravatar.cc/150?img=11",
        welcomeMessage: "Приветствую... Я чувствую, у нас будет интересная беседа. 🔮",
        bio: "Я Екатерина, психолог. Помогаю людям разбираться в себе. Увлекаюсь философией и эзотерикой.",
        trustRequired: 30,
        photoLimit: 1,
        isActive: true
      },
      {
        name: "Виктория",
        age: 22,
        description: "Спортивная и активная, всегда в движении",
        personality: "Энергичная, целеустремленная, competitive",
        avatarUrl: "https://i.pravatar.cc/150?img=8",
        welcomeMessage: "Привет! Готов бросить вызов? 💪",
        bio: "Я Виктория, профессиональная спортсменка. Занимаюсь горными лыжами и альпинизмом.",
        trustRequired: 15,
        photoLimit: 4,
        isActive: true
      }
    ];

    // Сохраняем персонажей
    await Character.insertMany(characters);
    console.log(`✅ Добавлено ${characters.length} персонажей`);

    // Выводим список
    const savedCharacters = await Character.find();
    console.log('\n📋 Список персонажей:');
    savedCharacters.forEach((char, index) => {
      console.log(`${index + 1}. ${char.name}, ${char.age} лет - ${char.description}`);
    });

    console.log('\n🎉 База данных успешно заполнена!');

    // Закрываем соединение
    await mongoose.disconnect();
    console.log('🔌 Соединение с MongoDB закрыто');

  } catch (error) {
    console.error('❌ Ошибка при заполнении базы данных:', error);
    process.exit(1);
  }
}

// Запускаем заполнение
if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;