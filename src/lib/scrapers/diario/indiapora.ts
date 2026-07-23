import { Edital, ScraperOptions } from '../../../types';
import { buscarDospBase } from './dospEngine';

/**
 * Scraper do Diário Oficial de Indiaporã (DOSP - Código 4888)
 * Configurado com 5 anos para DEV e 90 dias para PRODUÇÃO (anosDev: 5).
 */
export async function buscarIndiaporaDiario(opcoes?: ScraperOptions): Promise<Edital[]> {
  return buscarDospBase(
    {
      cidade: 'Indiaporã',
      codigoDosp: 4888,
      urlDisponibilidade: 'https://www.imprensaoficialmunicipal.com.br/indiapora',
      dominiosOuTermos: [
        'indiapora.sp.gov.br',
        'imprensaoficialmunicipal.com.br/indiapora',
        'município de indiaporã',
        'indiaporã'
      ],
      anosDev: 5
    },
    opcoes
  );
}
