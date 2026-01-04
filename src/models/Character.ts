import { Schema, model, Document } from 'mongoose';

export interface ICharacter extends Document {
  name: string;
  age: number;
  description: string;
  personality: string;
  avatarUrl?: string; // Изменяем на необязательное
  openingLine?: string; // Изменяем на необязательное
  bio?: string; // Изменяем на необязательное
  trustRequired: number;
  photoLimit: number;
  isActive: boolean;
  createdAt: Date;
}

const CharacterSchema = new Schema<ICharacter>({
  name: { type: String, required: true },
  age: { type: Number, required: true },
  description: { type: String, required: true },
  personality: { type: String, required: true },
  avatarUrl: { 
    type: String, 
    optional: 'https://via.placeholder.com/150/667eea/ffffff?text=AI' 
  },
  openingLine: { 
    type: String, 
    optional: 'Привет! Рада познакомиться!' 
  },
  bio: { 
    type: String, 
    optional: 'Интересный персонаж для общения' 
  },
  trustRequired: { type: Number, default: 0 },
  photoLimit: { type: Number, default: 3 },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

export const Character = model<ICharacter>('Character', CharacterSchema);