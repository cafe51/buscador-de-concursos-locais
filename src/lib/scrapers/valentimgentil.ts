// src/lib/scrapers/valentimgentil.ts
import { Edital } from '../../types';
import { buscarInstarBase } from './instar';

export async function buscarValentimGentil(): Promise<Edital[]> {
  return buscarInstarBase({
    cidade: 'Valentim Gentil',
    baseUrl: 'https://www.valentimgentil.sp.gov.br'
  });
}