// src/lib/scrapers/ouroeste.ts
import { Edital } from '../../types';
import { buscarInstarBase } from './instar';

export async function buscarOuroeste(opcoes?: import('../../types').ScraperOptions): Promise<Edital[]> {
  if (opcoes?.verificarDisponibilidade) {
    const { verificaDisponibilidade } = await import('./utils');
    await verificaDisponibilidade('https://www.ouroeste.sp.gov.br');
    return [];
  }

  return buscarInstarBase({
    cidade: 'Ouroeste',
    baseUrl: 'https://www.ouroeste.sp.gov.br'
  });
}