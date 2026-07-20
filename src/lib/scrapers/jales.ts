import { Edital } from '../../types';
import { buscarJalesDiario } from './diario/jales';

/**
 * Scraper de Jales redirecionado para utilizar exclusivamente a extração do Diário Oficial.
 * Os documentos antigos do portal permanecem preservados na coleção `editais`.
 * Novos documentos do Diário Oficial serão gravados na coleção `diario_editais`.
 */
export async function buscarJales(opcoes?: import('../../types').ScraperOptions): Promise<Edital[]> {
  return await buscarJalesDiario(opcoes);
}