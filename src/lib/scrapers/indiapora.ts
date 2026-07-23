import { Edital, ScraperOptions } from '../../types';
import { buscarIndiaporaDiario } from './diario/indiapora';

export async function buscarIndiapora(opcoes?: ScraperOptions): Promise<Edital[]> {
  return buscarIndiaporaDiario(opcoes);
}