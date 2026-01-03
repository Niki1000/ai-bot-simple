import { Schema, model, Document } from 'mongoose';

export interface IUser extends Document {
  telegramId: number;
  username?: string;
  firstName: string;
  lastName?: string;
  currentCharacterId?: string;
  trustLevel: number;
  photoRequests: number;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>({
  telegramId: { type: Number, required: true, unique: true },
  username: { type: String, required: false },
  firstName: { type: String, required: true },
  lastName: { type: String, required: false },
  currentCharacterId: { type: String, required: false },
  trustLevel: { type: Number, default: 0, min: 0, max: 100 },
  photoRequests: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

export const User = model<IUser>('User', UserSchema);