// A SUPER LISTA NEGRA GLOBAL DE PALAVRAS (Sem acentos, tudo minúsculo)
export const PALAVRAS_IGNORADAS_GLOBAIS = [
  // --- Licitações, Contratos, Compras e Obras ---
  'licitacao', 'pregao', 'tomada de precos', 'aquisicao', 'adjudicacao', 'contratacao de empresa',
  'ata de registro', 'registro de precos', 'concorrencia publica', 'inexigibilidade', 'dispensa de licitacao',
  'leilao', 'alienacao', 'contrato n', 'termo aditivo', 'obras e servicos',

  // --- Avisos e Chamamentos Administrativos ---
  'chamamento', 'credenciamento', 'notificacao', 'inventario', 'permissao', 'bens patrimoniais',
  'multas', 'combustivel', 'cemiterio', 'igreja', 'veiculos', 'frota', 'desfazimento',

  // --- Habitação, Cultura e Social ---
  'agricultura familiar', 'aldir blanc', 'cdhu', 'moradias', 'minha casa minha vida',
  'empreendimento habitacional', 'lei paulo gustavo', 'fomento',

  // --- Conselhos Municipais e Eleições Civis ---
  'conselho tutelar', 'cmdca', 'cmj', 'cmdr', 'eleicao de representacao', 'sociedade civil',
  'membros do conselho', 'processo de escolha', 'conselho municipal', 'direitos da crianca',
  'conselheiro',

  // --- Decretos, Reuniões, Leis e Finanças ---
  'decreto', 'copa do mundo', 'conferencia municipal', 'ponto facultativo', 'reuniao ordinaria',
  'reuniao plenaria', 'sessao ordinaria', 'sessao extraordinaria', 'audiencia publica',
  'prestacao de contas', 'relatorio de gestao', 'balanco', 'orcamento', 'plano diretor',
  'lrf', 'audiencia',

  // --- Falsos Positivos de Seleções (Bolsas e Voluntariado) ---
  'tempo de aprender', 'mais alfabetizacao', 'voluntario', 'assistente de alfabetizacao',
  'atletas', 'desportivos amadores', 'auxilio financeiro a atletas', 'bom de escola bom de esporte',
  'atribuicao de classes', 'atribuicao de aulas', 'atribuicao online'

];

export function removerAcentos(texto: string) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/**
 * Função Guarda-Costas: Retorna TRUE se encontrar alguma sujeira.
 */
export function ehSujeira(texto: string, palavrasLocais: string[] = []): boolean {
  const textoNormalizado = removerAcentos(texto);
  const todasAsPalavras = [...PALAVRAS_IGNORADAS_GLOBAIS, ...palavrasLocais.map(removerAcentos)];
  return todasAsPalavras.some(palavra => textoNormalizado.includes(palavra));
}

/**
 * Função Peneira Fina: Retorna TRUE APENAS se o texto contiver o que queremos.
 */
export function ehRelevante(texto: string, palavrasChave: string[]): boolean {
  // Se a cidade não forneceu uma lista branca, libera tudo (segurança para outras cidades)
  if (!palavrasChave || palavrasChave.length === 0) return true;

  const textoNormalizado = removerAcentos(texto);
  const palavrasLimpas = palavrasChave.map(removerAcentos);

  return palavrasLimpas.some(palavra => textoNormalizado.includes(palavra));
}