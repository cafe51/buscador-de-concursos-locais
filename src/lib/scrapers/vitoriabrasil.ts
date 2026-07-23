import { Edital, ScraperOptions } from '../../types';
import { buscarVitoriaBrasilDiario } from './diario/vitoriabrasil';

export async function buscarVitoriaBrasil(opcoes?: ScraperOptions): Promise<Edital[]> {
  return buscarVitoriaBrasilDiario(opcoes);
}