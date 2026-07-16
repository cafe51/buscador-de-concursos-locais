import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    lowercase: true, 
    trim: true 
  },
  passwordHash: { 
    type: String, 
    required: true 
  },
  username: { 
    type: String, 
    required: true, 
    trim: true 
  },
  role: { 
    type: String, 
    required: true, 
    default: 'user', 
    enum: ['user', 'admin'] 
  },
  notifications: {
    enabled: { 
      type: Boolean, 
      required: true, 
      default: false 
    },
    organs: { 
      type: String, 
      required: true, 
      default: 'todos', 
      enum: ['todos', 'prefeitura', 'camara'] 
    },
    cities: { 
      type: [String], 
      required: true, 
      default: ['todas'] 
    }
  },
  passwordResetToken: {
    type: String,
    default: null
  },
  passwordResetExpires: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

export const UserModel = mongoose.models.User || mongoose.model('User', userSchema);
export type UserDocument = mongoose.InferSchemaType<typeof userSchema> & { _id: mongoose.Types.ObjectId };
