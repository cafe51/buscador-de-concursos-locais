// src/lib/filtrosGlobais.ts

export const PALAVRAS_IGNORADAS_GLOBAIS = [
  // 🧹 AVISO: Filtros antigos de Licitações, Compras e Estrutura foram removidos 
  // para evitar falsos positivos com nomes de cargos (Ex: "Analista de Licitações").

  // --- Editais de Cultura, Fomento e Habitação (Não são empregos) ---
  'agricultura familiar', 'aldir blanc', 'cdhu', 'moradias', 'minha casa minha vida',
  'empreendimento habitacional', 'lei paulo gustavo', 'fomento',

  // --- Conselhos Municipais e Eleições Civis (Eleições, não concursos) ---
  'conselho tutelar', 'cmj', 'cmdr', 'eleicao de representacao', 'sociedade civil',
  'membros do conselho', 'processo de escolha', 'conselho municipal', 'direitos da crianca',
  'conselheiro',

  // --- Reuniões, Audiências e Finanças (Lixo institucional) ---
  'copa do mundo', 'conferencia municipal', 'ponto facultativo', 'reuniao ordinaria',
  'reuniao plenaria', 'sessao ordinaria', 'sessao extraordinaria', 'audiencia publica',
  'prestacao de contas', 'relatorio de gestao', 'balanco', 'orcamento', 'plano diretor',
  'lrf', 'audiencia',

  // --- Falsos Positivos de Seleções (Bolsas, Voluntariado e Temporários) ---
  'tempo de aprender', 'mais alfabetizacao', 'voluntario', 'assistente de alfabetizacao',
  'atletas', 'desportivos amadores', 'auxilio financeiro a atletas', 'bom de escola bom de esporte',
  'atribuicao online',
  'concurso de remocao',

  // 🛑 NOVA REGRA: Bloqueia seleções sem prova objetiva (Simplificados e Emergenciais)
  'simplificado', 'curriculo', 'analise de curriculo', 'curriculos', 'emergencial'
];

export function removerAcentos(texto: string) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function ehSujeira(texto: string, palavrasLocais: string[] = [], linkDoPdf: string = ''): boolean {
  const textoNormalizado = removerAcentos(texto);
  const linkNormalizado = removerAcentos(linkDoPdf);
  const todasAsPalavras = [...PALAVRAS_IGNORADAS_GLOBAIS, ...palavrasLocais.map(removerAcentos)];

  return todasAsPalavras.some(palavra =>
    textoNormalizado.includes(palavra) ||
    (linkNormalizado !== '' && linkNormalizado.includes(palavra))
  );
}

/**
 * 🛡️ DETECTOR DE PASTAS ÓRFÃS MELHORADO
 * Avalia título e descrição juntos. Encontra as palavras em qualquer parte da string.
 */
export function ehAndamentoOrfao(titulo: string, descricao: string = ''): boolean {
  const textoNormalizado = removerAcentos(`${titulo} ${descricao}`).toUpperCase().trim();

  // Encontra qualquer menção a uma fase (inclusive no meio de frases como "Edital 11 de Atribuição")
  const regexFase = /\b(CONVOCACAO|CONVOCA|RETIFICACAO|HOMOLOGACAO|RESULTADO|CLASSIFICACAO|GABARITO|PORTARIA|DECRETO|ERRATA|CHAMADA|ATRIBUI[CQ]AO|LOCAIS DE PROVA|ENSALAMENTO)\b/;
  const ehFase = regexFase.test(textoNormalizado);

  // Verifica se o funcionário citou um Concurso ou Processo Seletivo Válido
  const mencionaCertame = /\b(CONCURSO|SELETIV|SELECAO|PS)\b/.test(textoNormalizado);

  // Regra extra: Se começar com "Edital [Numero] de [Fase]", é órfão de erro humano crasso!
  const ehApenasEditalDeFase = /^EDITAL\s+\d+\s+DE\s+/i.test(textoNormalizado);

  // Se é uma fase isolada E não cita nenhum certame -> BLOQUEIA!
  return (ehFase || ehApenasEditalDeFase) && !mencionaCertame;
}

export function ehRelevante(texto: string, palavrasChave: string[]): boolean {
  if (!palavrasChave || palavrasChave.length === 0) return true;
  const textoNormalizado = removerAcentos(texto);
  const palavrasLimpas = palavrasChave.map(removerAcentos);
  return palavrasLimpas.some(palavra => textoNormalizado.includes(palavra));
}

export function extrairIdConcurso(titulo: string, descricao: string, aceitarBuscaInvertida: boolean = false, strict: boolean = false): string | undefined {
  let texto = `${titulo} ${descricao}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  const regexSujeiraNumerica = /(CONVOCACAO|RETIFICACAO|HOMOLOGACAO|ATRIBUI[CQ]AO|CLASSIFICACAO|RESULTADO|PORTARIA|DECRETO|ERRATA|GABARITO|CHAMADA|RECOMENDACAO ADMINISTRATIVA)(?:(?!CONCUR|SELETIV|\bPS\b)[^\d]){0,25}?\d{1,3}[\s\/\-_\.]+\d{2,4}/g;
  texto = texto.replace(regexSujeiraNumerica, '');
  let match = null;

  if (strict) {
    const regexEstrita = /\b(CONCUR[A-Z]*|SELETIVO|SELECAO|\bPS\b)\s*(?:P[UÚ]L?[B]?[IÍ]?[C]?O?S?\s*)?(?:SIMPLIFICADO\s*)?(?:DE\s*)?(?:N[Oº°.]*\s*)?(\d{1,3})[\s\/\-_\.]+(\d{2}|\d{4})\b(?!\s*[\/\-_\.]\s*\d{2,4})/i;
    match = texto.match(regexEstrita);
  } else {
    const regexConcurso = /\b(CONCUR[A-Z]*|SELETIVO|SELECAO|\bPS\b)[^\d]{0,40}?(\d{1,3})[\s\/\-_\.]+(\d{2}|\d{4})\b(?!\s*[\/\-_\.]\s*\d{2,4})/;
    match = texto.match(regexConcurso);
    if (!match && aceitarBuscaInvertida) {
      const regexConcursoInvertido = /(\d{1,3})[\s\/\-_\.]+(\d{2}|\d{4})\b(?!\s*[\/\-_\.]\s*\d{2,4})(?:(?!CONCUR|SELETIV|\bPS\b).){0,40}?\b(CONCUR[A-Z]*|SELETIVO|SELECAO|\bPS\b)\b/;
      const matchInvertido = texto.match(regexConcursoInvertido);
      if (matchInvertido) match = [matchInvertido[0], matchInvertido[3], matchInvertido[1], matchInvertido[2]];
    }
  }

  if (match) {
    const tipo = match[1].startsWith('CONCUR') ? 'Concurso' : 'Processo Seletivo';
    const numero = parseInt(match[2], 10).toString().padStart(2, '0');
    let ano = match[3];
    if (ano.length === 2) ano = `20${ano}`;
    return `${tipo} ${numero}/${ano}`;
  }
  return undefined;
}

export function corrigirErrosDigitacao(texto: string): string {
  let textoCorrigido = texto;
  textoCorrigido = textoCorrigido.replace(/\b(CONCUR[A-Z]*)\s+(P[UÚ]L?[B]+[IÍ]?[C]+O?|P[UÚ]L[IÍ]CO)\b/gi, 'CONCURSO PÚBLICO');
  textoCorrigido = textoCorrigido.replace(/\b(PROCES[A-Z]*|PROC)\s+(SELET[A-Z]*)\b/gi, 'PROCESSO SELETIVO');
  return textoCorrigido;
}