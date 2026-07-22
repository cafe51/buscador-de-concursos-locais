import { Edital, ScraperOptions } from '../../types';
import { buscarSantaSaleteDiario } from './diario/santasalete';

export async function buscarSantaSalete(opcoes?: ScraperOptions): Promise<Edital[]> {
  return buscarSantaSaleteDiario(opcoes);
}