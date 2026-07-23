import { Edital, ScraperOptions } from '../../../types';
import { buscarDospBase } from './dospEngine';

/**
 * Scraper do Diário Oficial de São João das Duas Pontes (DOSP - Código 5200)
 * Configurado com 5 anos para DEV e 5 anos para PRODUÇÃO (anosDev: 5, anosProd: 5).
 */
export async function buscarSaoJoaoDiario(opcoes?: ScraperOptions): Promise<Edital[]> {
  return buscarDospBase(
    {
      cidade: 'São João das Duas Pontes',
      codigoDosp: 5200,
      urlDisponibilidade: 'https://www.imprensaoficialmunicipal.com.br/saojoao',
      dominiosOuTermos: [
        'sjduaspontes.sp.gov.br',
        'imprensaoficialmunicipal.com.br/saojoao',
        'município de são joão das duas pontes',
        'são joão das duas pontes'
      ],
      anosDev: 5,
      anosProd: 5
    },
    opcoes
  );
}
