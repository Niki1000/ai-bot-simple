import mongoose, { Schema, model, Document } from 'mongoose';

export interface IUser extends Document {
  telegramId: number;
  username?: string;
  firstName: string;
  lastName?: string;
  currentCharacterId?: string;
  trustLevel: number;
  photoRequests: number;
  lastPhotoRequest?: Date;
  totalMessages?: number;
  createdAt: Date;
  updatedAt: Date;
  characterId?: mongoose.Types.ObjectId | string; // <-- added
}

const UserSchema = new Schema<IUser>({
  telegramId: {
    type: Number,
    required: true,
    unique: true,
    index: true
  },
  characterId: { type: Schema.Types.ObjectId, ref: 'Character', default: null }, // <-- added
  username: {
    type: String,
    required: false
  },
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String,
    required: false
  },
  currentCharacterId: {
    type: String,
    required: false
  },
  trustLevel: {
    type: Number,
    default: 10,
    min: 0,
    max: 100
  },
  photoRequests: {
    type: Number,
    default: 0
  },
  lastPhotoRequest: {
    type: Date,
    required: false
  },
  totalMessages: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true // Добавляет createdAt и updatedAt автоматически
});

// Индексы для быстрого поиска
UserSchema.index({ trustLevel: -1 });
UserSchema.index({ createdAt: -1 });

export const User = model<IUser>('User', UserSchema);