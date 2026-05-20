// src/app/actions.ts
'use server'

import * as cheerio from 'cheerio';
import { Edital } from '../types';
import { buscarFernandopolis } from '../lib/scrapers/fernandopolis';
import { buscarVotuporanga } from '../lib/scrapers/votuporanga';
import { buscarOuroeste } from '../lib/scrapers/ouroeste';
import { buscarMacedonia } from '../lib/scrapers/macedonia';
import { buscarPedranopolis } from '../lib/scrapers/pedranopolis';
import { buscarEstrela } from '../lib/scrapers/estrela';
import { buscarMeridiano } from '../lib/scrapers/meridiano';
import { buscarSaoJoao } from '../lib/scrapers/saojoao';
import { buscarJales } from '../lib/scrapers/jales';
// 🔥 NOVAS CIDADES IMPORTADAS AQUI
import { buscarMiraEstrela } from '../lib/scrapers/miraestrela';
import { buscarIndiapora } from '../lib/scrapers/indiapora';
import { buscarAlvaresFlorence } from '../lib/scrapers/alvaresflorence';

import { urlsParaBlacklist } from '../lib/docParser';

export type ResultadoBusca = {
  editais: Edital[];
  falhas: string[];
};

// ==============================================================
// ⏱️ LIMITE MÁXIMO DE TEMPO POR CIDADE (55 Segundos)
// ==============================================================
const TIMEOUT_POR_CIDADE_MS = 80000;

async function rodarComProtecao(nomeCidade: string, funcaoScraper: () => Promise<Edital[]>) {
  const tempoInicio = performance.now();

  try {
    const cronometro = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('TIMEOUT')), TIMEOUT_POR_CIDADE_MS);
    });

    const dados = await Promise.race([
      funcaoScraper(),
      cronometro
    ]);

    const tempoFim = performance.now();
    const tempoGasto = ((tempoFim - tempoInicio) / 1000).toFixed(2);

    const tamanhoFixoNome = 30;
    const tamanhoFixoTempo = 5;

    const nomeFormatado = `[${nomeCidade}]`.padEnd(tamanhoFixoNome, ' ');
    const tempoFormatado = tempoGasto.padEnd(tamanhoFixoTempo, ' ');

    console.log(`🟢 ${nomeFormatado} OK \t| Tempo: ${tempoFormatado}s \t| Itens extraídos: ${dados.length}`);

    return { sucesso: true, cidade: nomeCidade, dados };
  } catch (e: any) {
    const tempoFim = performance.now();
    const tempoGasto = ((tempoFim - tempoInicio) / 1000).toFixed(2);

    let motivo = e.message;
    if (motivo === 'TIMEOUT') {
      motivo = `Tempo limite de ${TIMEOUT_POR_CIDADE_MS / 1000}s excedido`;
    }

    console.error(`🔴 [${nomeCidade}] FALHOU \t| Tempo: ${tempoGasto}s \t| Motivo: ${motivo}`);

    return { sucesso: false, cidade: nomeCidade, dados: [] };
  }
}

export async function buscarTodosEditais(): Promise<ResultadoBusca> {
  let todosOsEditais: Edital[] = [];
  const cidadesComFalha: string[] = [];

  urlsParaBlacklist.clear();

  console.log("\n===================================================");
  console.log("⏳ INICIANDO RASPAGEM DE DADOS...");
  console.log("===================================================");

  const tempoInicioTotal = performance.now();

  try {
    const promessas = await Promise.all([
      // As que você já tinha:
      // rodarComProtecao('Fernandópolis', buscarFernandopolis),
      rodarComProtecao('Votuporanga', buscarVotuporanga),
      rodarComProtecao('Ouroeste', buscarOuroeste),
      // rodarComProtecao('Jales', buscarJales),
      // rodarComProtecao('Macedônia', buscarMacedonia),
      // rodarComProtecao("Estrela d'Oeste", buscarEstrela),
      // rodarComProtecao('Meridiano', buscarMeridiano),
      // rodarComProtecao('São João das Duas Pontes', buscarSaoJoao),
      // rodarComProtecao('Pedranópolis', buscarPedranopolis),

      rodarComProtecao('Mira Estrela', buscarMiraEstrela),
      rodarComProtecao('Indiaporã', buscarIndiapora),
      rodarComProtecao('Álvares Florence', buscarAlvaresFlorence),
    ]);

    promessas.forEach((resultado) => {
      if (resultado.sucesso) {
        todosOsEditais = [...todosOsEditais, ...resultado.dados];
      } else {
        cidadesComFalha.push(resultado.cidade);
      }
    });

    // ==============================================================
    // 🛡️ O DESDUPLICADOR GLOBAL: Remove cards com o mesmo link
    // ==============================================================
    const editaisUnicos = new Map<string, Edital>();

    todosOsEditais.forEach((edital) => {
      if (!editaisUnicos.has(edital.link)) {
        editaisUnicos.set(edital.link, edital);
      }
    });

    let listaLimpa = Array.from(editaisUnicos.values());

    // Ordenação Cronológica
    listaLimpa.sort((a, b) => {
      if (b.dataTimestamp !== a.dataTimestamp) {
        return b.dataTimestamp - a.dataTimestamp;
      }
      return (a.ordemOriginal || 0) - (b.ordemOriginal || 0);
    });

    const tempoFimTotal = performance.now();
    const tempoGasto = ((tempoFimTotal - tempoInicioTotal) / 1000).toFixed(2);

    console.log("===================================================");
    console.log(`✅ RASPAGEM TOTAL CONCLUÍDA EM ${tempoGasto} SEGUNDOS!`);
    console.log(`📊 Total de editais extraídos: ${listaLimpa.length}`);
    if (cidadesComFalha.length > 0) {
      console.log(`⚠️ Falhas detectadas em: ${cidadesComFalha.join(', ')}`);
    }

    if (urlsParaBlacklist.size > 0) {
      console.log(`\n🛑 ARQUIVOS SEM DATA OU IMAGENS ENCONTRADOS (${urlsParaBlacklist.size}):`);
      console.log(JSON.stringify(Array.from(urlsParaBlacklist), null, 2));
    }
    console.log("===================================================\n");

    return {
      editais: listaLimpa,
      falhas: cidadesComFalha
    };

  } catch (e: any) {
    throw new Error('Erro grave ao processar as buscas.');
  }
}

// ==============================================================
// 🕵️ AUDITORIA DEV DO INSTAR
// ==============================================================
export type Discrepancia = {
  cidade: string;
  concurso: string;
  linkOrigem: string;
  qtdNossa: number;
  qtdSite: number;
};

// 🚀 Adicionado "temRestricao?" nos parâmetros
export async function auditarQuantidadesInstar(grupos: { nome: string, cidade: string, linkOrigem: string, qtdNossa: number, temRestricao?: boolean }[]): Promise<Discrepancia[]> {
  const discrepancias: Discrepancia[] = [];
  const TAMANHO_LOTE = 10;

  console.log(`\n===================================================`);
  console.log(`🕵️ INICIANDO AUDITORIA EM ${grupos.length} PASTAS INSTAR...`);
  console.log(`===================================================`);

  for (let i = 0; i < grupos.length; i += TAMANHO_LOTE) {
    const lote = grupos.slice(i, i + TAMANHO_LOTE);

    await Promise.all(lote.map(async (grupo) => {
      // Audita apenas cidades que usam Instar
      if (!grupo.linkOrigem || !grupo.linkOrigem.includes('/portal/editais/')) return;

      // 🛡️ Se tivermos detectado que a pasta exige login, o auditor ignora a divergência!
      if (grupo.temRestricao) return;

      try {
        const res = await fetch(grupo.linkOrigem, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });
        if (!res.ok) return;

        const html = await res.text();
        const $ = cheerio.load(html);

        // Busca o número na Badge
        const textoBadge = $('#btn_arquivos_edital .ed_info_qtde_itens').text().trim();
        if (!textoBadge) return;

        const qtdSite = parseInt(textoBadge, 10);

        if (!isNaN(qtdSite) && qtdSite !== grupo.qtdNossa) {
          discrepancias.push({
            cidade: grupo.cidade,
            concurso: grupo.nome,
            linkOrigem: grupo.linkOrigem,
            qtdNossa: grupo.qtdNossa,
            qtdSite: qtdSite
          });
        }
      } catch (e) { }
    }));
  }

  console.log(`✅ AUDITORIA CONCLUÍDA! ${discrepancias.length} discrepâncias encontradas.\n`);
  return discrepancias;
}