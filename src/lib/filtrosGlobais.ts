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

// ==============================================================
// 🎯 FUNÇÃO EXTRATORA DE CHAVE DE CONCURSO (Refinada)
// ==============================================================
export function extrairIdConcurso(titulo: string, descricao: string): string | undefined {
  let texto = `${titulo} ${descricao}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

  // 1. FAXINA INTELIGENTE: Remove numerações SOMENTE se estiverem COLADAS à palavra de sujeira.
  // Mudamos [^\d]{0,40}? para {0,10}?. Isso apaga "CONVOCACAO 18/2024", 
  // mas preserva o "006/2022" da frase "CLASSIFICACAO FINAL DO PROCESSO SELETIVO 006/2022"!
  const regexSujeiraNumerica = /(CONVOCACAO|RETIFICACAO|HOMOLOGACAO|ATRIBUICAO|CLASSIFICACAO|RESULTADO|PORTARIA|DECRETO|ERRATA|GABARITO|CHAMADA|RECOMENDACAO ADMINISTRATIVA)[^\d]{0,10}?\d{1,3}[\s\/\-_]+\d{2,4}/g;

  // 2. BUSCA SEGURA: Pega Concurso (perdoa erros como CONCURO, CONCUROS) ou Seletivo
  const regexConcurso = /(CONCUR[A-Z]*|SELETIVO|SELECAO)[^\d]{0,40}?(\d{1,3})[\s\/\-_]+(\d{2}|\d{4})\b/;
  const match = texto.match(regexConcurso);

  if (match) {
    const tipo = match[1].startsWith('CONCUR') ? 'Concurso' : 'Processo Seletivo';

    // 3. RESOLVE A INCONSISTÊNCIA DOS ZEROS (001 vira 01 / 006 vira 06)
    // Converte para número matemático para limpar os zeros excedentes e formata para 2 casas
    const numeroRaw = parseInt(match[2], 10);
    const numero = numeroRaw.toString().padStart(2, '0');

    // 4. RESOLVE A INCONSISTÊNCIA DO ANO (23 vira 2023)
    let ano = match[3];
    if (ano.length === 2) ano = `20${ano}`;

    return `${tipo} ${numero}/${ano}`;
  }

  // EFEITO ÍMÃ (Fallback para os preguiçosos que não escrevem "Concurso")
  const regexSecundaria = /(?:EDITAL|P[UÚ]BLICO|PROCESSO)[^\d]{0,40}?(\d{1,3})[\s\/\-]*(\d{2}|\d{4})\b/i;
  const matchSecundario = texto.match(regexSecundaria);
  if (matchSecundario) {
    const numero = parseInt(matchSecundario[1], 10).toString().padStart(2, '0');
    let ano = matchSecundario[2];
    if (ano.length === 2) ano = `20${ano}`;
    return `Agrupamento: ${numero}/${ano}`;
  }

  return undefined;
}

// ==============================================================
// 🛠️ CORRETOR ORTOGRÁFICO DE NOMENCLATURAS (Fuzzy Regex)
// ==============================================================
export function corrigirErrosDigitacao(texto: string): string {
  let textoCorrigido = texto;

  // 1. Corrige a família do "Concurso Público"
  // Pega erros como: PÚLBICO, PULICO, CONCURO, CONCUROS, etc.
  // Troca tudo pela string perfeita.
  const regexConcurso = /\b(CONCUR[A-Z]*)\s+(P[UÚ]L?[B]+[IÍ]?[C]+O?|P[UÚ]L[IÍ]CO)\b/gi;
  textoCorrigido = textoCorrigido.replace(regexConcurso, 'CONCURSO PÚBLICO');

  // 2. Corrige a família do "Processo Seletivo"
  // Pega erros como: PROCESO SELETIVO, PROC SELETIVO
  const regexSeletivo = /\b(PROCES[A-Z]*|PROC)\s+(SELET[A-Z]*)\b/gi;
  textoCorrigido = textoCorrigido.replace(regexSeletivo, 'PROCESSO SELETIVO');

  return textoCorrigido;
}