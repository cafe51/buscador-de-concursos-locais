// src/lib/scrapers/camaras/votuporanga.ts
import * as cheerio from 'cheerio';
import { Edital } from '../../../types';
import { ehSujeira, extrairIdConcurso } from '../../filtrosGlobais';
import { fetchHtml } from '../utils';

export async function buscarCamaraVotuporanga(opcoes?: import('../../../types').ScraperOptions): Promise<Edital[]> {
  if (opcoes?.verificarDisponibilidade) {
    const url = 'https://camaravotuporanga.sp.gov.br/concursos';
    let html = '';
    try {
      const response = await fetchHtml(url);
      html = response.html;
    } catch (e) {
      throw new Error('SITE_INDISPONIVEL');
    }

    const $ = cheerio.load(html);
    
    // Verifica se a mensagem de "vazio" ainda existe na página
    const temMensagemVazia = html.includes('Nenhum registro encontrado') || $('.listing-no-results__message span').text().trim() === 'Nenhum registro encontrado';
    
    if (temMensagemVazia) {
      // Lança erro para ser tratado como OFFLINE pelo runner.
      // Assim, o email de "sucesso" não será enviado até que a mensagem de fato suma da página.
      throw new Error('SITE_INDISPONIVEL: Nenhum registro encontrado ainda');
    }

    // Se a mensagem sumiu, significa que publicaram algo novo!
    // Retorna vazio. O runner tratará como ONLINE e enviará o e-mail de alerta para o administrador.
    return [];
  }

  const resultados: Edital[] = [];

  return resultados;
}