import * as cheerio from 'cheerio';
import { Edital } from '../../types';

// --- ATUALIZADO: Busca a data focando APENAS na tag <time> ---
async function buscarDataFernandopolis(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'force-cache' });
    if (!response.ok) return null;

    const html = await response.text();
    const $ = cheerio.load(html);

    let dataCorreta: string | null = null;

    // Procura especificamente pela tag <time> que a prefeitura usa para a publicação
    $('time').each((_, elemento) => {
      const textoTempo = $(elemento).text().trim(); // Ex: "27/04/2026 às 15h22"

      // Extrai apenas a parte "DD/MM/AAAA"
      const match = textoTempo.match(/\b(\d{2}\/\d{2}\/\d{4})\b/);

      if (match && !dataCorreta) {
        dataCorreta = match[1];
      }
    });

    return dataCorreta;
  } catch {
    return null;
  }
}

export async function buscarFernandopolis(): Promise<Edital[]> {
  const resultados: Edital[] = [];
  let ordemGlobal = 0;

  for (let pagina = 1; pagina <= 10; pagina++) {
    try {
      const response = await fetch(`https://fernandopolis.sp.gov.br/publicacoes/?categoria=edital&pagina=${pagina}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        cache: 'no-store'
      });

      if (!response.ok) continue;

      const html = await response.text();
      const $ = cheerio.load(html);

      const itensDestaPagina: { titulo: string, href: string, textoAoRedor: string, ordem: number }[] = [];

      $('h3 a').each((_, elemento) => {
        ordemGlobal++;
        const titulo = $(elemento).text().trim();
        const href = $(elemento).attr('href') || '';
        const textoAoRedor = $(elemento).parent().parent().text().replace(titulo, '').replace(/\s+/g, ' ').trim();

        itensDestaPagina.push({ titulo, href, textoAoRedor, ordem: ordemGlobal });
      });

      await Promise.all(itensDestaPagina.map(async (item) => {
        const linkCompleto = item.href.startsWith('http') ? item.href : `https://fernandopolis.sp.gov.br${item.href}`;

        // Chama a nossa nova função super precisa!
        const dataEncontrada = await buscarDataFernandopolis(linkCompleto);

        let timestamp = 0;
        if (dataEncontrada) {
          const partes = dataEncontrada.split('/');
          timestamp = new Date(`${partes[2]}-${partes[1]}-${partes[0]}T00:00:00`).getTime();
        }

        resultados.push({
          cidade: 'Fernandópolis',
          orgao: 'Prefeitura',
          titulo: item.titulo,
          link: linkCompleto,
          descricao: item.textoAoRedor || undefined,
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