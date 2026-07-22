import { Edital, ScraperOptions } from '../../types';
import { buscarMeridianoDiario } from './diario/meridiano';

export async function buscarMeridiano(opcoes?: ScraperOptions): Promise<Edital[]> {
  return buscarMeridianoDiario(opcoes);
}