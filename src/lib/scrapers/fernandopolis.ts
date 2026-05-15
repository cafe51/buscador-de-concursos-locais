import * as cheerio from 'cheerio';
import { Edital } from '../../types';
import { ehSujeira } from '../filtrosGlobais'; // <-- 1. IMPORTA O GUARDA COSTAS

// Dicionário de Secretarias para Fernandópolis
const SIGLAS_SECRETARIAS: Record<string, string> = {
  'SME': 'Educação',
  'SMRH': 'Recursos Humanos',
  'SMEL': 'Esportes e Lazer',
  'SMCT': 'Cultura e Turismo',
  'SMS': 'Saúde',
  'SMAS': 'Assistência Social',
  'SMO': 'Obras'
};

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

  // Palavras que só Fernandópolis ignora (Exemplo da regra local que você pediu)
  const sujeirasLocais = ['filhos da terra'];

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

        // 2. O ESCUDO GLOBAL E LOCAL EM AÇÃO
        if (ehSujeira(`${titulo} ${textoAoRedor}`, sujeirasLocais)) {
          return; // Pula essa licitação/sujeira na hora!
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

        // 3. PESCANDO AS SIGLAS NO TÍTULO
        const tagsMetadados: string[] = [];
        const matchSigla = item.titulo.match(/\b(SME|SMRH|SMEL|SMCT|SMS|SMAS|SMO)\b/i);
        if (matchSigla) {
          const sigla = matchSigla[1].toUpperCase();
          tagsMetadados.push(SIGLAS_SECRETARIAS[sigla]); // Injeta "Educação", etc.
        }

        resultados.push({
          cidade: 'Fernandópolis',
          orgao: 'Prefeitura',
          titulo: item.titulo,
          link: linkCompleto,
          descricao: item.textoAoRedor || undefined,
          metadados: tagsMetadados.length > 0 ? tagsMetadados : undefined, // ARRAY INJETADO!
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