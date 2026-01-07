const connectDB = require('../src/db');
const Character = require('../src/models/Character');

module.exports = async (req, res) => {
  try {
    await connectDB();
    await Character.deleteMany({});
    
    const girls = [
      {
        name: "Анна", age: 25,
        description: "Романтичная девушка с мягким характером",
        personality: "Заботливая, чувствительная",
        avatarUrl: "https://i.pravatar.cc/400?img=1",
        welcomeMessage: "Привет! Рада знакомству! 🌸",
        bio: "Дизайнер, люблю живопись и музыку",
        photos: [
          "https://i.pravatar.cc/400?img=1",
          "https://i.pravatar.cc/400?img=10",
          "https://i.pravatar.cc/400?img=20"
        ],
        baseSympathyReq: 10,
        photoUnlockChance: 0.3,
        isActive: true
      },
      {
        name: "Мария", age: 27,
        description: "Бизнес-леди, ценит интеллект",
        personality: "Умная, амбициозная",
        avatarUrl: "https://i.pravatar.cc/400?img=5",
        welcomeMessage: "Здравствуй. Что привело? 💼",
        bio: "Руковожу IT-компанией",
        photos: ["https://i.pravatar.cc/400?img=5", "https://i.pravatar.cc/400?img=15"],
        baseSympathyReq: 20,
        photoUnlockChance: 0.25,
        isActive: true
      },
      {
        name: "София", age: 23,
        description: "Веселая студентка, обожает приключения",
        personality: "Оптимистичная, спонтанная",
        avatarUrl: "https://i.pravatar.cc/400?img=6",
        welcomeMessage: "Йоу! Готов к приключениям? 🎉",
        bio: "Изучаю журналистику",
        photos: ["https://i.pravatar.cc/400?img=6", "https://i.pravatar.cc/400?img=16"],
        baseSympathyReq: 5,
        photoUnlockChance: 0.4,
        isActive: true
      }
    ];
    
    await Character.insertMany(girls);
    res.json({ success: true, message: `Added ${girls.length} girls` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
