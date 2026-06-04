// src/lib/scrapers/guaranidoeste.ts
import { Edital } from '../../types';
import { buscarWeblineBase } from './webline';

export async function buscarGuaraniDOeste(opcoes?: import('../../types').ScraperOptions): Promise<Edital[]> {
  if (opcoes?.verificarDisponibilidade) {
    const { verificaDisponibilidade } = await import('./utils');
    await verificaDisponibilidade('https://www.guaranidoeste.sp.gov.br');
    return [];
  }

  return buscarWeblineBase({
    cidade: "Guarani d'Oeste",
    baseUrl: 'https://www.guaranidoeste.sp.gov.br',
    urlBusca: '/index2.php?pag=T0RNPU9UZz1PVFk9T0RnPU9EWT1OelU9T1RZPU9XUT1PVEk9T0dVPU9UUT1PR1U9WVRBPQ==&palavraChave=concurso%20publico',
    // Como a cidade é nova, vamos puxar o histórico completo dela primeiro (sem corte de ano e data)
  });
}