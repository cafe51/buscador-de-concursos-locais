// src/types/index.ts
export type Edital = {
  cidade: string;
  orgao: string;
  titulo: string;
  link: string;
  dataTimestamp: number;

  ano?: number;
  concurso?: string;
  descricao?: string;
  metadados?: string[];
  statusGeral?: string;
  dataPublicacao?: string;
  ordemOriginal?: number;

  linkOrigem?: string; // 🚀 NOVA CHAVE: Guarda a URL da página interna!
  tituloIA?: string;
  descricaoIA?: string;
};