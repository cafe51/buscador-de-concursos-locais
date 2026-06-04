import mongoose, { Schema, Document } from 'mongoose';

export interface IServidorIBGE extends Document {
  idServidor: number;
  nome: string;
  cpfFormatado: string;
  situacao: string;
  uorgExercicio: string;
  uorgLotacao: string;
  ufExercicio: string;
  rawData: any;
  ultimaAtualizacao: Date;
}

const ServidorIBGESchema: Schema = new Schema({
  idServidor: { type: Number, required: true, unique: true },
  nome: { type: String, required: true },
  cpfFormatado: { type: String },
  situacao: { type: String },
  uorgExercicio: { type: String },
  uorgLotacao: { type: String },
  ufExercicio: { type: String },
  rawData: { type: Schema.Types.Mixed },
  ultimaAtualizacao: { type: Date, default: Date.now }
});

export default mongoose.models.ServidorIBGE || mongoose.model<IServidorIBGE>('ServidorIBGE', ServidorIBGESchema);
