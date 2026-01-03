import { Schema, model, Document } from 'mongoose';

export interface ICharacter extends Document {
  name: string;
  age: number;
  bio: string;
  personality: string;
  openingLine: string;
  avatarUrl: string;
  photoUrls: string[];
  isActive: boolean;
}

const CharacterSchema = new Schema<ICharacter>({
  name: { type: String, required: true },
  age: { type: Number, required: true },
  bio: { type: String, required: true },
  personality: { type: String, required: true },
  openingLine: { type: String, required: true },
  avatarUrl: { type: String, required: true },
  photoUrls: { type: [String], default: [] },
  isActive: { type: Boolean, default: true }
});

export const Character = model<ICharacter>('Character', CharacterSchema);