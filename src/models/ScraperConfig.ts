import mongoose from 'mongoose';

const scraperConfigSchema = new mongoose.Schema({
  nome: { type: String, required: true, unique: true },
  verificarDisponibilidade: { type: Boolean, required: true, default: false }
}, {
  timestamps: true
});

export const ScraperConfigModel = mongoose.models.ScraperConfig || mongoose.model('ScraperConfig', scraperConfigSchema);
