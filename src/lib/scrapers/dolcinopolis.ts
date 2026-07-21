import { Edital, ScraperOptions } from '../../types';
import { buscarDolcinopolisDiario } from './diario/dolcinopolis';

export async function buscarDolcinopolis(opcoes?: ScraperOptions): Promise<Edital[]> {
  return buscarDolcinopolisDiario(opcoes);
}