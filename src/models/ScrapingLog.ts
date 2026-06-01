import mongoose from 'mongoose';

const logCidadeDetailSchema = new mongoose.Schema({
  cidade: { type: String, required: true },
  sucesso: { type: Boolean, required: true },
  itens: { type: Number, required: true },
  tentativaSucesso: { type: Number, required: true },
  tempoGastoSegundos: { type: Number, required: true },
  erro: { type: String },
  aviso: { type: Boolean },
}, { _id: false });

const syncLogAdditionSchema = new mongoose.Schema({
  cidade: { type: String, required: true },
  titulo: { type: String, required: true },
  link: { type: String, required: true },
  orgao: { type: String },
  dataPublicacao: { type: String },
  concurso: { type: String },
}, { _id: false });

const syncLogUpdateSchema = new mongoose.Schema({
  cidade: { type: String, required: true },
  titulo: { type: String, required: true },
  link: { type: String, required: true },
  mudancas: { type: [String], required: true },
}, { _id: false });

const databaseSyncLogSchema = new mongoose.Schema({
  adicionados: { type: Number, required: true },
  atualizados: { type: Number, required: true },
  relatorioAdicoes: { type: [syncLogAdditionSchema], required: true },
  relatorioAtualizacoes: { type: [syncLogUpdateSchema], required: true },
}, { _id: false });

const scrapingLogSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  inicio: { type: String, required: true },
  fim: { type: String, required: true },
  duracaoSegundos: { type: Number, required: true },
  tentativas: { type: Number, required: true },
  status: { type: String, required: true, enum: ['sucesso', 'falha_parcial', 'falha'] },
  totalEditais: { type: Number, required: true },
  detalhesCidades: { type: [logCidadeDetailSchema], required: true },
  syncInfo: { type: databaseSyncLogSchema },
}, {
  timestamps: true
});

// Índice para listar os logs mais recentes rapidamente
scrapingLogSchema.index({ inicio: -1 });

export const ScrapingLogModel = mongoose.models.ScrapingLog || mongoose.model('ScrapingLog', scrapingLogSchema);
