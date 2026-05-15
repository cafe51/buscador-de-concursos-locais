export type Edital = {
  cidade: string;
  orgao: string;
  titulo: string;
  link: string;
  dataTimestamp: number;

  concurso?: string;       // <--- NOVA CHAVE OFICIAL DE AGRUPAMENTO!
  descricao?: string;
  metadados?: string[];
  statusGeral?: string;
  dataPublicacao?: string;
  ordemOriginal?: number;
};