import { Edital, ScraperOptions } from '../../types';
import { buscarEstrelaDOesteDiario } from './diario/estreladoeste';

export async function buscarEstrela(opcoes?: ScraperOptions): Promise<Edital[]> {
  return buscarEstrelaDOesteDiario(opcoes);
}