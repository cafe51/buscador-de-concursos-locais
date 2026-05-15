import * as cheerio from 'cheerio';
import { Edital } from '../../types';
import { ehSujeira, ehRelevante } from '../filtrosGlobais'; // <-- IMPORTAMOS A NOVA FUNÇÃO

const SIGLAS_SECRETARIAS: Record<string, string> = {
  'SME': 'Educação',
  'SMRH': 'Recursos Humanos',
  'SMEL': 'Esportes e Lazer',
  'SMCT': 'Cultura e Turismo',
  'SMS': 'Saúde',
  'SMAS': 'Assistência Social',
  'SMO': 'Obras'
};


// Tudo que for de RH e Concurso tem que ter, OBRIGATORIAMENTE, pelo menos um desses termos:
// Garante que fases de concurso como "Gabarito" ou "Prorrogação" não sejam descartadas.
const TERMOS_OBRIGATORIOS_FERNANDOPOLIS = [
  // O Core
  'concurso', 'processo seletivo', 'processo de selecao', 'selecao de', 'estagiario', 'estagio',

  // Ações exclusivas de RH
  'atribuicao', 'contratacao', 'chamada publica', 'admissao', 'posse',

  // Fases e Atualizações (Seguras agora graças à Super Lista Negra)
  'convocacao', 'convoca ', 'gabarito', 'resultado', 'classificacao', 'homologacao',
  'retificacao', 'rerratificacao', 'prorrogacao', 'recurso', 'respostas', 'comunicado',
  'provas', 'entrevista', 'inscricao', 'inscricoes', 'aviso', 'extrato'
];

async function buscarDataFernandopolis(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'force-cache' });
    if (!response.ok) return null;
    const html = await response.text();
    const $ = cheerio.load(html);
    let dataCorreta: string | null = null;
    $('time').each((_, elemento) => {
      const match = $(elemento).text().trim().match(/\b(\d{2}\/\d{2}\/\d{4})\b/);
      if (match && !dataCorreta) dataCorreta = match[1];
    });
    return dataCorreta;
  } catch { return null; }
}

export async function buscarFernandopolis(): Promise<Edital[]> {
  const resultados: Edital[] = [];
  let ordemGlobal = 0;

  for (let pagina = 1; pagina <= 20; pagina++) {
    try {
      const response = await fetch(`https://fernandopolis.sp.gov.br/publicacoes/?categoria=edital&pagina=${pagina}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store'
      });

      if (!response.ok) continue;

      const html = await response.text();
      const $ = cheerio.load(html);
      const itensDestaPagina: { titulo: string, href: string, textoAoRedor: string, ordem: number }[] = [];

      $('h3 a').each((_, elemento) => {
        const titulo = $(elemento).text().trim();
        const href = $(elemento).attr('href') || '';
        const textoAoRedor = $(elemento).parent().parent().text().replace(titulo, '').replace(/\s+/g, ' ').trim();

        const textoParaAnalise = `${titulo} ${textoAoRedor}`;

        // 1. ESCUDO GLOBAL (Lista Negra): Tem alguma das nossas palavras proibidas gerais?
        if (ehSujeira(textoParaAnalise)) {
          return;
        }

        // 2. A PENEIRA FINA (Lista Branca LOCAL): Tem pelo menos uma palavra de Concurso/RH?
        if (!ehRelevante(textoParaAnalise, TERMOS_OBRIGATORIOS_FERNANDOPOLIS)) {
          return; // Se não tiver a palavra mágica, PULA o card! A prefeitura postou lixo.
        }

        ordemGlobal++;
        itensDestaPagina.push({ titulo, href, textoAoRedor, ordem: ordemGlobal });
      });

      await Promise.all(itensDestaPagina.map(async (item) => {
        const linkCompleto = item.href.startsWith('http') ? item.href : `https://fernandopolis.sp.gov.br${item.href}`;
        const dataEncontrada = await buscarDataFernandopolis(linkCompleto);

        let timestamp = 0;
        if (dataEncontrada) {
          const partes = dataEncontrada.split('/');
          timestamp = new Date(`${partes[2]}-${partes[1]}-${partes[0]}T00:00:00`).getTime();
        }

        const tagsMetadados: string[] = [];
        const matchSigla = item.titulo.match(/\b(SME|SMRH|SMEL|SMCT|SMS|SMAS|SMO)\b/i);
        if (matchSigla) {
          const sigla = matchSigla[1].toUpperCase();
          tagsMetadados.push(SIGLAS_SECRETARIAS[sigla]);
        }

        resultados.push({
          cidade: 'Fernandópolis',
          orgao: 'Prefeitura',
          titulo: item.titulo,
          link: linkCompleto,
          descricao: item.textoAoRedor || undefined,
          metadados: tagsMetadados.length > 0 ? tagsMetadados : undefined,
          dataPublicacao: dataEncontrada || 'sem data',
          dataTimestamp: timestamp,
          ordemOriginal: item.ordem
        });
      }));

    } catch (e) {
      console.error(`Erro ao buscar Fernandópolis na página ${pagina}`, e);
    }
  }
  return resultados;
}