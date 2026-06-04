// src/lib/scrapers/votuporanga.ts
import { Edital } from '../../types';
import { buscarInstarBase } from './instar';

export async function buscarVotuporanga(opcoes?: import('../../types').ScraperOptions): Promise<Edital[]> {
  if (opcoes?.verificarDisponibilidade) {
    const { verificaDisponibilidade } = await import('./utils');
    await verificaDisponibilidade('https://www.votuporanga.sp.gov.br');
    return [];
  }

  return buscarInstarBase({
    cidade: 'Votuporanga',
    baseUrl: 'https://www.votuporanga.sp.gov.br'
    // Não precisa passar 'basePath' nem 'orgao' porque os valores padrões do motor já servem!
  });
}