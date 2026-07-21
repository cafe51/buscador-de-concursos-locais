import { Edital } from '../../types';

import { buscarFernandopolis } from './fernandopolis';
import { buscarCamaraFernandopolis } from './camaras/fernandopolis';
import { buscarVotuporanga } from './votuporanga';
import { buscarVotuporangaDiario } from './diario/votuporanga';

import { buscarOuroeste } from './ouroeste';
import { buscarMacedonia } from './macedonia';
import { buscarPedranopolis } from './pedranopolis';
import { buscarEstrela } from './estrela';

import { buscarMeridiano } from './meridiano';
import { buscarCamaraMeridiano } from './camaras/meridiano';

import { buscarSaoJoao } from './saojoao';

import { buscarJales } from './jales';
import { buscarJalesDiario } from './diario/jales';

import { buscarUrania } from './urania';
import { buscarDolcinopolis } from './dolcinopolis';

import { buscarMiraEstrela } from './miraestrela';
import { buscarCamaraMiraEstrela } from './camaras/miraestrela';

import { buscarIndiapora } from './indiapora';
import { buscarCamaraIndiapora } from './camaras/indiapora';

import { buscarAlvaresFlorence } from './alvaresflorence';

import { buscarParisi } from './parisi';
import { buscarCamaraParisi } from './camaras/parisi';

import { buscarValentimGentil } from './valentimgentil';
import { buscarVitoriaBrasil } from './vitoriabrasil';

import { buscarGuaraniDOeste } from './guaranidoeste';
import { buscarPontalinda } from './pontalinda';

import { buscarSantaSalete } from './santasalete';

// ==============================================================
// 🗺️ MAPEAMENTO GLOBAL DE SCRAPERS
// ==============================================================
export const MAPA_SCRAPERS: Record<string, (opcoes?: import('../../types').ScraperOptions) => Promise<Edital[]>> = {
  'Fernandópolis': buscarFernandopolis,
  'Fernandópolis (Câmara)': buscarCamaraFernandopolis,
  'Votuporanga': buscarVotuporanga,
  'Ouroeste': buscarOuroeste,
  'Jales': buscarJales,
  'Macedônia': buscarMacedonia,
  "Estrela d'Oeste": buscarEstrela,
  'Meridiano': buscarMeridiano,
  'Meridiano (Câmara)': buscarCamaraMeridiano,
  'São João das Duas Pontes': buscarSaoJoao,
  'Pedranópolis': buscarPedranopolis,
  'Mira Estrela': buscarMiraEstrela,
  'Mira Estrela (Câmara)': buscarCamaraMiraEstrela,
  'Indiaporã': buscarIndiapora,
  'Indiaporã (Câmara)': buscarCamaraIndiapora,
  'Álvares Florence': buscarAlvaresFlorence,
  'Parisi': buscarParisi,
  'Parisi (Câmara)': buscarCamaraParisi,
  'Valentim Gentil': buscarValentimGentil,
  'Vitória Brasil': buscarVitoriaBrasil,
  "Guarani d'Oeste": buscarGuaraniDOeste,
  'Urânia': buscarUrania,
  'Dolcinópolis': buscarDolcinopolis,
  'Pontalinda': buscarPontalinda,
  'Santa Salete': buscarSantaSalete,
};

export const MAPA_SCRAPERS_DIARIO: Record<string, (opcoes?: import('../../types').ScraperOptions) => Promise<Edital[]>> = {
  'Jales': buscarJalesDiario,
  'Votuporanga': buscarVotuporangaDiario,
};

export function obterScraperParaCidade(nomeCidade: string, tipoFonte?: string) {
  if (tipoFonte === 'diario' && MAPA_SCRAPERS_DIARIO[nomeCidade]) {
    return MAPA_SCRAPERS_DIARIO[nomeCidade];
  }
  return MAPA_SCRAPERS[nomeCidade];
}

// ==============================================================
// 🚀 TAREFAS ORDENADAS PARA BUSCA TOTAL
// ==============================================================
export const CIDADES_ATIVAS: string[] = [
  'Fernandópolis',
  'Fernandópolis (Câmara)',
  'Jales',
  'Macedônia',
  "Estrela d'Oeste",
  "Guarani d'Oeste",
  'Meridiano',
  'Meridiano (Câmara)',
  'São João das Duas Pontes',
  'Pedranópolis',
  'Votuporanga',
  'Ouroeste',

  'Mira Estrela',
  'Mira Estrela (Câmara)',
  'Indiaporã',
  'Indiaporã (Câmara)',
  'Álvares Florence',
  'Parisi',
  'Parisi (Câmara)',
  'Valentim Gentil',
  'Vitória Brasil',
  'Urânia',
  'Dolcinópolis',
  'Pontalinda',
  'Santa Salete'
];
