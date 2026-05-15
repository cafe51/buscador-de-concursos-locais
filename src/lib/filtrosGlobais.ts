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

  // --- Falsos Positivos de Seleções (Bolsas, Voluntariado e Temporários por Currículo) ---
  'tempo de aprender', 'mais alfabetizacao', 'voluntario', 'assistente de alfabetizacao',
  'atletas', 'desportivos amadores', 'auxilio financeiro a atletas', 'bom de escola bom de esporte',
  'atribuicao de classes', 'atribuicao de aulas', 'atribuicao online',

  // 🛑 NOVA REGRA: Bloqueia seleções sem prova objetiva
  'simplificado', 'curriculo', 'analise de curriculo', 'curriculos'
];

export function removerAcentos(texto: string) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/**
 * Função Guarda-Costas: Retorna TRUE se encontrar alguma sujeira.
 * @param texto O texto visível do card (Título + Descrição)
 * @param palavrasLocais Lista opcional de palavras proibidas específicas da cidade
 * @param linkDoPdf O link do edital para pegarmos sujeiras escondidas na URL
 */
export function ehSujeira(texto: string, palavrasLocais: string[] = [], linkDoPdf: string = ''): boolean {
  const textoNormalizado = removerAcentos(texto);
  const linkNormalizado = removerAcentos(linkDoPdf);

  const todasAsPalavras = [...PALAVRAS_IGNORADAS_GLOBAIS, ...palavrasLocais.map(removerAcentos)];

  // Verifica se a palavra está no texto OU se ela está escondida no link do arquivo
  return todasAsPalavras.some(palavra =>
    textoNormalizado.includes(palavra) ||
    (linkNormalizado !== '' && linkNormalizado.includes(palavra))
  );
}

/**
 * Função Peneira Fina: Retorna TRUE APENAS se o texto contiver o que queremos.
 */
export function ehRelevante(texto: string, palavrasChave: string[]): boolean {
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

  const regexSujeiraNumerica = /(CONVOCACAO|RETIFICACAO|HOMOLOGACAO|ATRIBUICAO|CLASSIFICACAO|RESULTADO|PORTARIA|DECRETO|ERRATA|GABARITO|CHAMADA|RECOMENDACAO)[^\d]{0,25}?\d{1,3}[\s\/\-_]+\d{2,4}/g;

  texto = texto.replace(regexSujeiraNumerica, '');

  const regexConcurso = /(CONCUR[A-Z]*|SELETIVO|SELECAO)[^\d]{0,40}?(\d{1,3})[\s\/\-_]+(\d{2}|\d{4})\b/;
  const match = texto.match(regexConcurso);

  if (match) {
    const tipo = match[1].startsWith('CONCUR') ? 'Concurso' : 'Processo Seletivo';

    const numeroRaw = parseInt(match[2], 10);
    const numero = numeroRaw.toString().padStart(2, '0');

    let ano = match[3];
    if (ano.length === 2) ano = `20${ano}`;

    return `${tipo} ${numero}/${ano}`;
  }

  return undefined;
}

// ==============================================================
// 🛠️ CORRETOR ORTOGRÁFICO DE NOMENCLATURAS (Fuzzy Regex)
// ==============================================================
export function corrigirErrosDigitacao(texto: string): string {
  let textoCorrigido = texto;

  const regexConcurso = /\b(CONCUR[A-Z]*)\s+(P[UÚ]L?[B]+[IÍ]?[C]+O?|P[UÚ]L[IÍ]CO)\b/gi;
  textoCorrigido = textoCorrigido.replace(regexConcurso, 'CONCURSO PÚBLICO');

  const regexSeletivo = /\b(PROCES[A-Z]*|PROC)\s+(SELET[A-Z]*)\b/gi;
  textoCorrigido = textoCorrigido.replace(regexSeletivo, 'PROCESSO SELETIVO');

  return textoCorrigido;
}