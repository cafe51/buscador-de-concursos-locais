// src/lib/scrapers/miraestrela.ts
import { Edital } from '../../types';
import { buscarInstarBase } from './instar';

export async function buscarMiraEstrela(opcoes?: import('../../types').ScraperOptions): Promise<Edital[]> {
  if (opcoes?.verificarDisponibilidade) {
    const { verificaDisponibilidade } = await import('./utils');
    await verificaDisponibilidade('https://www.miraestrela.sp.gov.br');
    return [];
  }

  return buscarInstarBase({
    cidade: 'Mira Estrela',
    baseUrl: 'https://www.miraestrela.sp.gov.br'
  });
}