const connectDB = require('../src/db');
const Character = require('../src/models/Character');

module.exports = async (req, res) => {
  try {
    await connectDB();
    await Character.deleteMany({});
    
    const girls = [
      {
        name: "Анна", age: 25,
        description: "Романтичная девушка",
        personality: "Заботливая, чувствительная",
        avatarUrl: "https://i.pravatar.cc/400?img=1",
        welcomeMessage: "Привет! Рада знакомству! 🌸",
        bio: "Дизайнер, люблю живопись",
        photos: [
          "https://i.pravatar.cc/400?img=1",
          "https://i.pravatar.cc/400?img=10",
          "https://i.pravatar.cc/400?img=20"
        ],
        baseSympathyReq: 10,
        photoUnlockChance: 0.3
      },
      {
        name: "Мария", age: 27,
        description: "Бизнес-леди",
        personality: "Умная, амбициозная",
        avatarUrl: "https://i.pravatar.cc/400?img=5",
        welcomeMessage: "Здравствуй! 💼",
        bio: "Руковожу IT-компанией",
        photos: ["https://i.pravatar.cc/400?img=5", "https://i.pravatar.cc/400?img=15"],
        baseSympathyReq: 20,
        photoUnlockChance: 0.25
      },
      {
        name: "София", age: 23,
        description: "Веселая студентка",
        personality: "Оптимистичная",
        avatarUrl: "https://i.pravatar.cc/400?img=6",
        welcomeMessage: "Йоу! 🎉",
        bio: "Изучаю журналистику",
        photos: ["https://i.pravatar.cc/400?img=6"],
        baseSympathyReq: 5,
        photoUnlockChance: 0.4
      }
    ];
    
    await Character.insertMany(girls);
    res.json({ success: true, count: girls.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
