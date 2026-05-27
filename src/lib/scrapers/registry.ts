import { Edital } from '../../types';

import { buscarFernandopolis } from './fernandopolis';
import { buscarCamaraFernandopolis } from './camaras/fernandopolis';
import { buscarVotuporanga } from './votuporanga';
import { buscarCamaraVotuporanga } from './camaras/votuporanga';

import { buscarOuroeste } from './ouroeste';
import { buscarMacedonia } from './macedonia';
import { buscarPedranopolis } from './pedranopolis';
import { buscarEstrela } from './estrela';

import { buscarMeridiano } from './meridiano';
import { buscarCamaraMeridiano } from './camaras/meridiano';

import { buscarSaoJoao } from './saojoao';

import { buscarJales } from './jales';
import { buscarCamaraJales } from './camaras/jales';

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
export const MAPA_SCRAPERS: Record<string, () => Promise<Edital[]>> = {
  'Fernandópolis': buscarFernandopolis,
  'Fernandópolis (Câmara)': buscarCamaraFernandopolis,
  'Votuporanga': buscarVotuporanga,
  'Votuporanga (Câmara)': buscarCamaraVotuporanga,
  'Ouroeste': buscarOuroeste,
  'Jales': buscarJales,
  'Jales (Câmara)': buscarCamaraJales,
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

// ==============================================================
// 🚀 TAREFAS ORDENADAS PARA BUSCA TOTAL
// ==============================================================
export const CIDADES_ATIVAS: string[] = [
  'São João das Duas Pontes',
  'Pedranópolis',
  'Urânia',
  'Pontalinda',
  'Santa Salete'
];
