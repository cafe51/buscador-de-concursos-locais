// src/lib/scrapers/alvaresflorence.ts
import { Edital } from '../../types';
import { buscarInstarBase } from './instar';

export async function buscarAlvaresFlorence(): Promise<Edital[]> {
  return buscarInstarBase({
    cidade: 'Álvares Florence',
    baseUrl: 'https://www.alvaresflorence.sp.gov.br',
    // 🚀 PERDÃO CONCEDIDO: Álvares Florence chama todos os concursos legítimos de "Simplificado".
    excecoesPalavrasGlobais: ['simplificado']
  });
}