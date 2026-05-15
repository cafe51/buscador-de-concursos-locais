// A LISTA NEGRA GLOBAL DE PALAVRAS (Sem acentos, tudo minúsculo)
export const PALAVRAS_IGNORADAS_GLOBAIS = [
  'chamamento', 'credenciamento', 'notificacao', 'inventario',
  'permissao', 'agricultura familiar', 'aldir blanc', 'bens patrimoniais',
  'pregao', 'tomada de precos', 'aquisicao', 'cdhu', 'moradias',
  'adjudicacao', 'ponto facultativo', 'multas', 'combustivel', 'cemiterio', 'igreja'
];

export function removerAcentos(texto: string) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/**
 * Função Guarda-Costas: Retorna TRUE se encontrar alguma sujeira.
 * @param texto O título + descrição do edital
 * @param palavrasLocais Array opcional com palavras que SÓ aquela cidade quer ignorar
 */
export function ehSujeira(texto: string, palavrasLocais: string[] = []): boolean {
  const textoNormalizado = removerAcentos(texto);

  // Junta a regra global com a regra local da cidade
  const todasAsPalavras = [...PALAVRAS_IGNORADAS_GLOBAIS, ...palavrasLocais.map(removerAcentos)];

  return todasAsPalavras.some(palavra => textoNormalizado.includes(palavra));
}