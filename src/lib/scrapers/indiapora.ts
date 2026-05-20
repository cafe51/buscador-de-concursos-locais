// src/lib/scrapers/indiapora.ts
import { Edital } from '../../types';
import { buscarInstarBase } from './instar';

export async function buscarIndiapora(): Promise<Edital[]> {
  return buscarInstarBase({
    cidade: 'Indiaporã',
    baseUrl: 'https://www.indiapora.sp.gov.br'
  });
}