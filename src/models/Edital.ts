import mongoose from 'mongoose';

const editalSchema = new mongoose.Schema({
  cidade: { type: String, required: true },
  orgao: { type: String, required: true },
  titulo: { type: String, required: true },
  link: { type: String, required: true, unique: true },
  dataTimestamp: { type: Number, required: true },
  
  ano: { type: Number },
  concurso: { type: String },
  descricao: { type: String },
  metadados: { type: [String] },
  statusGeral: { type: String },
  dataPublicacao: { type: String },
  ordemOriginal: { type: Number },
  linkOrigem: { type: String },
}, {
  timestamps: true
});

// Índice composto para ordenação rápida
editalSchema.index({ dataTimestamp: -1, ordemOriginal: 1 });

export const EditalModel = mongoose.models.Edital || mongoose.model('Edital', editalSchema);
