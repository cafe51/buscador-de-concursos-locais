import { Edital, ScraperOptions } from '../../types';
import { buscarSaoJoaoDiario } from './diario/saojoao';

export async function buscarSaoJoao(opcoes?: ScraperOptions): Promise<Edital[]> {
  return buscarSaoJoaoDiario(opcoes);
}