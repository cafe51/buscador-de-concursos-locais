import { Edital, ScraperOptions } from '../../../types';
import { buscarDospBase } from './dospEngine';

/**
 * Scraper do Diário Oficial de Vitória Brasil (DOSP - Código 5290)
 * Configurado com 5 anos para DEV e 2 anos para PRODUÇÃO (anosDev: 5, anosProd: 2).
 */
export async function buscarVitoriaBrasilDiario(opcoes?: ScraperOptions): Promise<Edital[]> {
  return buscarDospBase(
    {
      cidade: 'Vitória Brasil',
      codigoDosp: 5290,
      urlDisponibilidade: 'https://www.imprensaoficialmunicipal.com.br/vitoriabrasil',
      dominiosOuTermos: [
        'vitoriabrasil.sp.gov.br',
        'imprensaoficialmunicipal.com.br/vitoriabrasil',
        'município de vitória brasil',
        'vitória brasil'
      ],
      anosDev: 5,
      anosProd: 2
    },
    opcoes
  );
}
