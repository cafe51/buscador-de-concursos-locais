// src/lib/scrapers/ouroeste.ts
import { Edital } from '../../types';
import { buscarInstarBase } from './instar';

export async function buscarOuroeste(): Promise<Edital[]> {
  return buscarInstarBase({
    cidade: 'Ouroeste',
    baseUrl: 'https://www.ouroeste.sp.gov.br'
  });
}