import mongoose from 'mongoose';

const metadataSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true }, // ex: 'global'
  ultimaAtualizacao: { type: String, required: true },
}, {
  timestamps: true
});

export const MetadataModel = mongoose.models.Metadata || mongoose.model('Metadata', metadataSchema);
