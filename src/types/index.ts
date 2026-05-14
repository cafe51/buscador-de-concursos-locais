export type Edital = {
  cidade: string;
  orgao: string;
  titulo: string;
  link: string;
  dataTimestamp: number;

  // Propriedades Opcionais (Se não tiver, o scraper não envia e o front não renderiza)
  descricao?: string;      // Textos longos (Votuporanga, Fernandópolis)
  metadados?: string;      // Textos curtos para a etiqueta (Nº do Processo de Votuporanga)
  statusGeral?: string;    // Status (Aberto, Homologado - Votuporanga)
  dataPublicacao?: string; // Ex: 13/03/2020 ou "sem data"
  ordemOriginal?: number;  // Critério de desempate
};