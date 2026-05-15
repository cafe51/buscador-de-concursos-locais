export type Edital = {
  cidade: string;
  orgao: string;
  titulo: string;
  link: string;
  dataTimestamp: number;

  descricao?: string;
  metadados?: string[];    // <--- MUDOU PARA ARRAY DE STRINGS!
  statusGeral?: string;
  dataPublicacao?: string;
  ordemOriginal?: number;
};