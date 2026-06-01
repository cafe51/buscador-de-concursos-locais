// src/lib/scrapers/camaras/votuporanga.ts
import * as cheerio from 'cheerio';
import { Edital } from '../../../types';
import { ehSujeira, extrairIdConcurso } from '../../filtrosGlobais';
import { fetchHtml } from '../utils';

export async function buscarCamaraVotuporanga(): Promise<Edital[]> {
  const resultados: Edital[] = [];
  let ordemGlobal = 0;

  const urlPagina = 'https://camaravotuporanga.sp.gov.br/concursos';

  try {
    // 🚀 INJEÇÃO DE HEADERS: Disfarça a requisição para não ser bloqueada pelo Cloudflare/Firewall
    const res = await fetchHtml(urlPagina, false, 20000);

    if (!res.ok) {
      throw new Error(`Erro HTTP ${res.status} ao acessar Câmara Votuporanga`);
    }

    const html = res.html;
    const $ = cheerio.load(html);

    const textoPagina = $('body').text();
    if (html.includes('Nenhum registro encontrado') || textoPagina.includes('Nenhum registro encontrado')) {
      // Sucesso: a página ainda não tem concursos publicados.
      // Retornamos um array vazio para não acionar as retentativas e poupar 30 minutos.
      return [];
    }

    // Se o texto não for encontrado, significa que a prefeitura publicou algo.
    // Lançamos erro para alertar nos logs.
    throw new Error('O texto "Nenhum registro encontrado" não foi localizado na página. A prefeitura publicou novos concursos, atualize o scraper!');

  } catch (error: any) {
    const cause = (error as any).cause;
    const causeMsg = cause ? " - Detalhes: " + (cause.message || cause.code || JSON.stringify(cause)) : "";
    throw new Error('Erro geral ao buscar Câmara Votuporanga' + ": " + (error as Error).message + causeMsg);
  }

  return resultados;
}