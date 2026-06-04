// src/lib/scrapers/alvaresflorence.ts
import { Edital } from '../../types';
import { buscarInstarBase } from './instar';

export async function buscarAlvaresFlorence(opcoes?: import('../../types').ScraperOptions): Promise<Edital[]> {
  if (opcoes?.verificarDisponibilidade) {
    const { verificaDisponibilidade } = await import('./utils');
    await verificaDisponibilidade('https://www.alvaresflorence.sp.gov.br');
    return [];
  }

  return buscarInstarBase({
    cidade: 'Álvares Florence',
    baseUrl: 'https://www.alvaresflorence.sp.gov.br',
    // 🚀 PERDÃO CONCEDIDO: Álvares Florence chama todos os concursos legítimos de "Simplificado".
    excecoesPalavrasGlobais: ['simplificado']
  });
}