import { Edital } from '../../types';
import { buscarFernandopolisDiario } from './diario/fernandopolis';

/**
 * Scraper de Fernandópolis redirecionado para utilizar exclusivamente a extração do Diário Oficial.
 * Os documentos antigos do portal permanecem preservados na coleção `editais`.
 * Novos documentos do Diário Oficial serão gravados na coleção `diario_editais`.
 */
export async function buscarFernandopolis(opcoes?: import('../../types').ScraperOptions): Promise<Edital[]> {
  return await buscarFernandopolisDiario(opcoes);
}