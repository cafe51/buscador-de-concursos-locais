import { Edital, ScraperOptions } from '../../types';
import { buscarOuroesteDiario } from './diario/ouroeste';

export async function buscarOuroeste(opcoes?: ScraperOptions): Promise<Edital[]> {
  return buscarOuroesteDiario(opcoes);
}