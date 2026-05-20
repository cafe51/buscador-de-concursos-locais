// src/lib/scrapers/vitoriabrasil.ts
import { Edital } from '../../types';
import { buscarInstarBase } from './instar';

export async function buscarVitoriaBrasil(): Promise<Edital[]> {
  return buscarInstarBase({
    cidade: 'Vitória Brasil',
    baseUrl: 'https://www.vitoriabrasil.sp.gov.br'
  });
}