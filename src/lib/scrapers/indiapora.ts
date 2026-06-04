// src/lib/scrapers/indiapora.ts
import { Edital } from '../../types';
import { buscarInstarBase } from './instar';

export async function buscarIndiapora(opcoes?: import('../../types').ScraperOptions): Promise<Edital[]> {
  if (opcoes?.verificarDisponibilidade) {
    const { verificaDisponibilidade } = await import('./utils');
    await verificaDisponibilidade('https://www.indiapora.sp.gov.br');
    return [];
  }

  return buscarInstarBase({
    cidade: 'Indiaporã',
    baseUrl: 'https://www.indiapora.sp.gov.br'
  });
}