// src/lib/scrapers/estrela.ts
import { Edital } from '../../types';
import { buscarWeblineBase } from './webline';

export async function buscarEstrela(): Promise<Edital[]> {
  return buscarWeblineBase({
    cidade: "Estrela d'Oeste",
    baseUrl: 'https://www.pmestrela.sp.gov.br',
    urlBusca: '/?pag=T0RNPU9UZz1PVFk9T0RnPU9EWT1OelU9T1RZPU9XUT1PVEk9T0dVPU9UUT1PR1U9WVRBPQ==&palavraChave=Concurso%20P%C3%BAblico',
    limiteDataTimestamp: new Date('2019-09-13T00:00:00').getTime(),
    corteAno: 2018
  });
}