// src/lib/scrapers/valentimgentil.ts
import { Edital } from '../../types';
import { buscarInstarBase } from './instar';

export async function buscarValentimGentil(opcoes?: import('../../types').ScraperOptions): Promise<Edital[]> {
  if (opcoes?.verificarDisponibilidade) {
    const { verificaDisponibilidade } = await import('./utils');
    await verificaDisponibilidade('https://www.valentimgentil.sp.gov.br');
    return [];
  }

  return buscarInstarBase({
    cidade: 'Valentim Gentil',
    baseUrl: 'https://www.valentimgentil.sp.gov.br'
  });
}