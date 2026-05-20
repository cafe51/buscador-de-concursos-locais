// src/lib/scrapers/miraestrela.ts
import { Edital } from '../../types';
import { buscarInstarBase } from './instar';

export async function buscarMiraEstrela(): Promise<Edital[]> {
  return buscarInstarBase({
    cidade: 'Mira Estrela',
    baseUrl: 'https://www.miraestrela.sp.gov.br'
  });
}