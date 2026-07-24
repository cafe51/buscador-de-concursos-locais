import { Edital, ScraperOptions } from '../../types';
import { buscarPedranopolisDiario } from './diario/pedranopolis';

/**
 * Scraper de Pedranópolis redirecionado para utilizar exclusivamente a extração do Diário Oficial.
 * Os documentos antigos do portal permanecem preservados na coleção `editais`.
 * Novos documentos do Diário Oficial serão gravados na coleção `diario_editais`.
 */
export async function buscarPedranopolis(opcoes?: ScraperOptions): Promise<Edital[]> {
  return await buscarPedranopolisDiario(opcoes);
}