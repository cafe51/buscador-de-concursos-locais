import { Edital } from '../../types';

import { buscarFernandopolis } from './fernandopolis';
import { buscarCamaraFernandopolis } from './camaras/fernandopolis';
import { buscarVotuporanga } from './votuporanga';
import { buscarVotuporangaDiario } from './diario/votuporanga';

import { buscarOuroeste } from './ouroeste';
import { buscarOuroesteDiario } from './diario/ouroeste';
import { buscarMacedonia } from './macedonia';
import { buscarPedranopolis } from './pedranopolis';
import { buscarEstrela } from './estrela';
import { buscarEstrelaDOesteDiario } from './diario/estreladoeste';

import { buscarMeridiano } from './meridiano';
import { buscarMeridianoDiario } from './diario/meridiano';

import { buscarSaoJoao } from './saojoao';
import { buscarSaoJoaoDiario } from './diario/saojoao';

import { buscarJales } from './jales';
import { buscarJalesDiario } from './diario/jales';

import { buscarUrania } from './urania';
import { buscarUraniaDiario } from './diario/urania';
import { buscarDolcinopolis } from './dolcinopolis';
import { buscarDolcinopolisDiario } from './diario/dolcinopolis';

import { buscarMiraEstrela } from './miraestrela';
import { buscarCamaraMiraEstrela } from './camaras/miraestrela';

import { buscarIndiapora } from './indiapora';
import { buscarIndiaporaDiario } from './diario/indiapora';

import { buscarAlvaresFlorence } from './alvaresflorence';

import { buscarParisi } from './parisi';
import { buscarCamaraParisi } from './camaras/parisi';

import { buscarValentimGentil } from './valentimgentil';
import { buscarVitoriaBrasil } from './vitoriabrasil';
import { buscarVitoriaBrasilDiario } from './diario/vitoriabrasil';

import { buscarGuaraniDOeste } from './guaranidoeste';
import { buscarPontalinda } from './pontalinda';

import { buscarSantaSalete } from './santasalete';
import { buscarSantaSaleteDiario } from './diario/santasalete';

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
  'São João das Duas Pontes': buscarSaoJoao,
  'Pedranópolis': buscarPedranopolis,
  'Mira Estrela': buscarMiraEstrela,
  'Mira Estrela (Câmara)': buscarCamaraMiraEstrela,
  'Indiaporã': buscarIndiapora,
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
  'Dolcinópolis': buscarDolcinopolisDiario,
  "Estrela d'Oeste": buscarEstrelaDOesteDiario,
  'Meridiano': buscarMeridianoDiario,
  'Ouroeste': buscarOuroesteDiario,
  'Santa Salete': buscarSantaSaleteDiario,
  'São João das Duas Pontes': buscarSaoJoaoDiario,
  'Vitória Brasil': buscarVitoriaBrasilDiario,
  'Indiaporã': buscarIndiaporaDiario,
  'Urânia': buscarUraniaDiario,
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
  'São João das Duas Pontes',
  'Pedranópolis',
  'Votuporanga',
  'Ouroeste',

  'Mira Estrela',
  'Mira Estrela (Câmara)',
  'Indiaporã',

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
