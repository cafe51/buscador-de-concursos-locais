import { Edital, ScraperOptions } from '../../types';
import { buscarUraniaDiario } from './diario/urania';

export async function buscarUrania(opcoes?: ScraperOptions): Promise<Edital[]> {
  return buscarUraniaDiario(opcoes);
}