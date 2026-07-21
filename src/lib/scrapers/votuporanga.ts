import { Edital } from '../../types';
import { buscarVotuporangaDiario } from './diario/votuporanga';

/**
 * Scraper de Votuporanga redirecionado para utilizar exclusivamente a extração do Diário Oficial.
 * Os documentos antigos do portal permanecem preservados na coleção `editais`.
 */
export async function buscarVotuporanga(opcoes?: import('../../types').ScraperOptions): Promise<Edital[]> {
  return await buscarVotuporangaDiario(opcoes);
}