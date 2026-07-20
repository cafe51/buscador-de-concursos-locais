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
  fonte: { type: String },
  dadosEnriquecidos: {
    titulo: { type: String },
    descricao: { type: String },
    concurso: { type: String },
    dataPublicacao: { type: String },
    orgao: { type: String }
  }
}, {
  timestamps: true
});

export const EditalModel = mongoose.models.Edital || mongoose.model('Edital', editalSchema, 'editals');
