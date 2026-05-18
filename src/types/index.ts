export type Edital = {
  cidade: string;
  orgao: string;
  titulo: string;
  link: string;
  dataTimestamp: number;

  ano?: number;            // <--- NOVA CHAVE! (Número isolado)
  concurso?: string;
  descricao?: string;
  metadados?: string[];
  statusGeral?: string;
  dataPublicacao?: string;
  ordemOriginal?: number;
};