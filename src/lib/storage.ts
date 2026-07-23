'use server'

import { Edital } from '../types';
import { obterMockLogs } from './mockScrapingLogs';
import connectToDatabase from './mongodb';
import { EditalModel } from '../models/Edital';
import { ScrapingLogModel } from '../models/ScrapingLog';
import { MetadataModel } from '../models/Metadata';

export async function carregarDoBanco(): Promise<Edital[]> {
  try {
    await connectToDatabase();
    const dados = await EditalModel.find()
      .sort({ dataTimestamp: -1, ordemOriginal: 1 })
      .lean();

    const dadosLimpos = dados.map(({ _id, __v, createdAt, updatedAt, ...resto }) => resto);
    return dadosLimpos as unknown as Edital[];
  } catch (e) {
    console.error("Erro ao ler do MongoDB:", e);
    return [];
  }
}

export async function identificarMudancas(novosEditais: Edital[], substituirTudo: boolean = false) {
  await connectToDatabase();

  const editaisAntigos = substituirTudo ? [] : await EditalModel.find().lean();
  const mapaAntigos = new Map<string, any>();
  editaisAntigos.forEach(e => mapaAntigos.set(e.link, e));

  const relatorioAtualizacoes: SyncLogUpdate[] = [];
  const relatorioAdicoes: SyncLogAddition[] = [];
  const novasAdicoesReferencias: Edital[] = [];
  let qtdeAdicionados = 0;

  const opsEditais: any[] = [];

  // Deduplica novosEditais mantendo a versão mais recente/enriquecida por link
  const mapaUnicos = new Map<string, Edital>();
  novosEditais.forEach(e => {
    if (e.link) {
      mapaUnicos.set(e.link, e);
    }
  });
  const editaisDeduplicados = Array.from(mapaUnicos.values());

  editaisDeduplicados.forEach(novo => {
    const antigo = mapaAntigos.get(novo.link);

    if (antigo) {
      const alteracoes: string[] = [];
      const chavesParaIgnorar = ['ordemOriginal', 'dataTimestamp', '_id', '__v', 'createdAt', 'updatedAt'];

      (Object.keys(novo) as Array<keyof Edital>).forEach(key => {
        if (!chavesParaIgnorar.includes(key)) {
          const normalizarVazio = (val: any) => {
            if (val === null || val === undefined || val === '') return null;
            if (Array.isArray(val) && val.length === 0) return null;
            return JSON.stringify(val);
          };

          const valNovo = normalizarVazio(novo[key]);
          const valAntigo = normalizarVazio(antigo[key]);

          if (valNovo !== valAntigo) {
            const formatarParaLog = (val: any) => {
              if (val === null || val === undefined || val === '') return 'vazio';
              if (Array.isArray(val) && val.length === 0) return 'vazio';
              if (Array.isArray(val)) return `[${val.join(', ')}]`;
              return String(val);
            };

            alteracoes.push(`${key}: '${formatarParaLog(antigo[key])}' ➔ '${formatarParaLog(novo[key])}'`);
          }
        }
      });

      if (alteracoes.length > 0) {
        relatorioAtualizacoes.push({
          cidade: novo.cidade,
          titulo: novo.titulo,
          link: novo.link,
          mudancas: alteracoes
        });

        opsEditais.push({
          updateOne: {
            filter: { link: novo.link },
            update: { $set: novo },
            upsert: true
          }
        });
      }
    } else {
      qtdeAdicionados++;
      relatorioAdicoes.push({
        cidade: novo.cidade,
        titulo: novo.titulo,
        link: novo.link,
        orgao: novo.orgao,
        dataPublicacao: novo.dataPublicacao,
        concurso: novo.concurso,
        dadosEnriquecidos: novo.dadosEnriquecidos
      });
      novasAdicoesReferencias.push(novo);

      mapaAntigos.set(novo.link, novo);
      opsEditais.push({
        updateOne: {
          filter: { link: novo.link },
          update: { $set: novo },
          upsert: true
        }
      });
    }
  });

  return {
    adicionados: qtdeAdicionados,
    atualizados: relatorioAtualizacoes,
    relatorioAdicoes,
    novasAdicoesReferencias,
    operations: opsEditais
  };
}

export async function persistirSincronizacao(
  operationsObj: any, 
  substituirTudo: boolean = false, 
  novosEditais: Edital[] = [],
  relatorioAdicoes: SyncLogAddition[] = [],
  relatorioAtualizacoes: SyncLogUpdate[] = []
) {
  try {
    await connectToDatabase();

    if (substituirTudo) {
      await EditalModel.deleteMany({});
      if (novosEditais.length > 0) {
        // Deduplica novosEditais por link antes do insertMany
        const mapaInsert = new Map<string, Edital>();
        novosEditais.forEach(e => mapaInsert.set(e.link, e));
        await EditalModel.insertMany(Array.from(mapaInsert.values()), { ordered: false });
      }
    } else {
      const ops = Array.isArray(operationsObj) ? operationsObj : (operationsObj?.opsEditais || []);
      if (ops.length > 0) {
        try {
          await EditalModel.bulkWrite(ops, { ordered: false });
        } catch (bulkErr: any) {
          if (bulkErr.name === 'MongoBulkWriteError' || bulkErr.code === 11000) {
            console.warn(`⚠️ Aviso: Alguns registros duplicados foram ignorados durante o bulkWrite (${bulkErr.message || bulkErr}). A sincronização prosseguiu com sucesso.`);
          } else {
            throw bulkErr;
          }
        }
      }
    }

    console.log(`✅ Sincronização MongoDB concluída!`);
    console.log(`📈 Novos Editais Adicionados: ${relatorioAdicoes.length}`);
    console.log(`🔄 Editais Atualizados: ${relatorioAtualizacoes.length}`);

    if (relatorioAdicoes.length > 0 && !substituirTudo) {
      console.log("\n🆕 Relatório de Adições:");
      relatorioAdicoes.forEach(item => {
        console.log(` ➕ [${item.cidade}] ${item.titulo}`);
        console.log(`    Link: ${item.link}`);
        if (item.concurso) console.log(`    Concurso: ${item.concurso}`);
        console.log("    ----------------------------------------");
      });
    }

    if (relatorioAtualizacoes.length > 0 && !substituirTudo) {
      console.log("\n🔄 Relatório de Alterações em Editais Existentes:");
      relatorioAtualizacoes.forEach(item => {
        console.log(` ✏️ [${item.cidade}] ${item.titulo}`);
        console.log(`    Link: ${item.link}`);
        console.log(`    Modificações:`);
        item.mudancas.forEach(m => console.log(`       - ${m}`));
        console.log("    ----------------------------------------");
      });
    }

    // Salva a data da última atualização no MetadataModel
    const dataIso = new Date().toISOString();
    await MetadataModel.findOneAndUpdate(
      { key: 'global' },
      { $set: { ultimaAtualizacao: dataIso } },
      { upsert: true, returnDocument: 'after' }
    );

    return { sucesso: true };
  } catch (e) {
    console.error("Erro ao persistir sincronização no MongoDB:", e);
    return { sucesso: false };
  }
}

export async function sincronizarBanco(novosEditais: Edital[], substituirTudo: boolean = false) {
  try {
    const analysis = await identificarMudancas(novosEditais, substituirTudo);
    const syncRes = await persistirSincronizacao(
      analysis.operations, 
      substituirTudo, 
      novosEditais, 
      analysis.relatorioAdicoes, 
      analysis.atualizados
    );

    if (syncRes.sucesso) {
      return {
        sucesso: true,
        adicionados: analysis.adicionados,
        atualizados: analysis.atualizados,
        relatorioAdicoes: analysis.relatorioAdicoes
      };
    } else {
      return { sucesso: false, adicionados: 0, atualizados: [], relatorioAdicoes: [] };
    }
  } catch (e) {
    console.error("Erro ao sincronizar banco MongoDB:", e);
    return { sucesso: false, adicionados: 0, atualizados: [], relatorioAdicoes: [] };
  }
}

export async function carregarMetadata(): Promise<{ ultimaAtualizacao?: string } | null> {
  try {
    await connectToDatabase();
    const meta = await MetadataModel.findOne({ key: 'global' }).lean();
    if (!meta) return null;
    return { ultimaAtualizacao: meta.ultimaAtualizacao };
  } catch (e) {
    console.error("Erro ao ler metadata do MongoDB:", e);
    return null;
  }
}

export async function salvarEnriquecimentoEmLote(editais: Edital[]): Promise<{ sucesso: boolean; count: number }> {
  try {
    await connectToDatabase();
    const opsEditais: any[] = [];

    editais
      .filter(e => e.dadosEnriquecidos)
      .forEach(e => {
        const updateObj: any = { dadosEnriquecidos: e.dadosEnriquecidos };
        if (e.fonte === 'diario' && e.orgao) {
          updateObj.orgao = e.orgao;
        }

        opsEditais.push({
          updateOne: {
            filter: { link: e.link },
            update: { $set: updateObj }
          }
        });
      });

    if (opsEditais.length > 0) {
      await EditalModel.bulkWrite(opsEditais);
    }
    
    return { sucesso: true, count: opsEditais.length };
  } catch (e) {
    console.error("Erro ao salvar enriquecimento em lote no MongoDB:", e);
    return { sucesso: false, count: 0 };
  }
}

export async function reverterEnriquecimento(link: string): Promise<{ sucesso: boolean }> {
  try {
    await connectToDatabase();
    const res = await EditalModel.updateOne(
      { link },
      { $unset: { dadosEnriquecidos: "" } }
    );
    return { sucesso: res.modifiedCount > 0 };
  } catch (e) {
    console.error("Erro ao reverter enriquecimento no MongoDB:", e);
    return { sucesso: false };
  }
}

// ==============================================================
// 📋 SCRAPING LOGS
// ==============================================================

export type LogCidadeDetail = {
  cidade: string;
  sucesso: boolean;
  itens: number;
  tentativaSucesso: number;
  tempoGastoSegundos: number;
  erro?: string;
  aviso?: boolean;
};

export type SyncLogAddition = {
  cidade: string;
  titulo: string;
  link: string;
  orgao?: string;
  dataPublicacao?: string;
  concurso?: string;
  dadosEnriquecidos?: {
    titulo?: string;
    descricao?: string;
    concurso?: string;
    dataPublicacao?: string;
  };
};

export type SyncLogUpdate = {
  cidade: string;
  titulo: string;
  link: string;
  mudancas: string[];
};

export type DatabaseSyncLog = {
  adicionados: number;
  atualizados: number;
  relatorioAdicoes: SyncLogAddition[];
  relatorioAtualizacoes: SyncLogUpdate[];
};

export type ScrapingLog = {
  id: string;
  inicio: string;
  fim: string;
  duracaoSegundos: number;
  tentativas: number;
  status: 'sucesso' | 'falha_parcial' | 'falha';
  totalEditais: number;
  detalhesCidades: LogCidadeDetail[];
  syncInfo?: DatabaseSyncLog;
};

export async function carregarScrapingLogs(): Promise<ScrapingLog[]> {
  try {
    await connectToDatabase();
    const logs = await ScrapingLogModel.find()
      .sort({ inicio: -1 })
      .limit(20)
      .lean();

    if (!logs || logs.length === 0) {
      return obterMockLogs();
    }

    const logsLimpos = logs.map(({ _id, __v, createdAt, updatedAt, ...resto }) => resto);
    return logsLimpos as unknown as ScrapingLog[];
  } catch (e) {
    console.error("Erro ao carregar scraping logs do MongoDB:", e);
    return [];
  }
}

export async function salvarScrapingLogs(logs: ScrapingLog[]): Promise<boolean> {
  try {
    await connectToDatabase();
    await ScrapingLogModel.deleteMany({});
    if (logs.length > 0) {
      await ScrapingLogModel.insertMany(logs);
    }
    return true;
  } catch (e) {
    console.error("Erro ao salvar scraping logs no MongoDB:", e);
    return false;
  }
}

export async function adicionarScrapingLog(novoLog: ScrapingLog): Promise<boolean> {
  try {
    await connectToDatabase();
    await ScrapingLogModel.create(novoLog);
    
    const count = await ScrapingLogModel.countDocuments();
    if (count > 20) {
      const excess = count - 20;
      const oldestLogs = await ScrapingLogModel.find().sort({ inicio: 1 }).limit(excess);
      const idsToDelete = oldestLogs.map(l => l._id);
      await ScrapingLogModel.deleteMany({ _id: { $in: idsToDelete } });
    }
    
    return true;
  } catch (e) {
    console.error("Erro ao adicionar scraping log no MongoDB:", e);
    return false;
  }
}

// ==============================================================
// 📋 PAGINAÇÃO E FILTROS SERVER-SIDE (SINGLE COLLECTION)
// ==============================================================

export type FiltrosEditais = {
  filtroAno: number | 'todos';
  filtroCidade: string | 'todas';
  filtroOrgao: string | 'todos';
  palavrasDesejadas: string[];
  palavrasIgnoradas: string[];
};

function construirQueryFiltros(filtros: FiltrosEditais) {
  const query: any = {};

  if (filtros.filtroCidade && filtros.filtroCidade !== 'todas') {
    query.cidade = filtros.filtroCidade;
  }

  if (filtros.filtroOrgao && filtros.filtroOrgao !== 'todos') {
    query.orgao = filtros.filtroOrgao;
  }

  if (filtros.filtroAno && filtros.filtroAno !== 'todos') {
    query.ano = filtros.filtroAno;
  }

  const buildAccentInsensitiveRegex = (pattern: string): string => {
    const map: Record<string, string> = {
      'a': '[aáàâãäå]',
      'e': '[eéèêë]',
      'i': '[iíìîï]',
      'o': '[oóòôõöø]',
      'u': '[uúùûü]',
      'c': '[cç]',
      'n': '[nñ]'
    };
    
    const normalized = pattern.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    
    let regexStr = '';
    for (const char of normalized) {
      if (map[char]) {
        regexStr += map[char];
      } else {
        if (['\\', '^', '$', '*', '+', '?', '.', '(', ')', '[', ']', '{', '}', '|'].includes(char)) {
          regexStr += '\\' + char;
        } else {
          regexStr += char;
        }
      }
    }
    return regexStr;
  };

  const buildFieldMatches = (regexPattern: string) => {
    const regex = new RegExp(regexPattern, 'i');
    return [
      { cidade: regex },
      { orgao: regex },
      { titulo: regex },
      { "dadosEnriquecidos.titulo": regex },
      { descricao: regex },
      { "dadosEnriquecidos.descricao": regex },
      { concurso: regex },
      { "dadosEnriquecidos.concurso": regex },
      { dataPublicacao: regex },
      { "dadosEnriquecidos.dataPublicacao": regex },
      { metadados: regex },
      { statusGeral: regex }
    ];
  };

  if (filtros.palavrasDesejadas && filtros.palavrasDesejadas.length > 0) {
    const orConditions = filtros.palavrasDesejadas.flatMap(word => {
      const pattern = buildAccentInsensitiveRegex(word);
      return buildFieldMatches(pattern);
    });
    query.$or = orConditions;
  }

  if (filtros.palavrasIgnoradas && filtros.palavrasIgnoradas.length > 0) {
    const norConditions = filtros.palavrasIgnoradas.flatMap(word => {
      const pattern = buildAccentInsensitiveRegex(word);
      return buildFieldMatches(pattern);
    });
    query.$nor = norConditions;
  }

  return query;
}

export async function carregarEditaisPaginados(
  filtros: FiltrosEditais,
  pagina: number,
  itensPorPagina: number
): Promise<{ editais: Edital[]; totalFiltrados: number; cidadesDisponiveis: string[]; orgaosDisponiveis: string[] }> {
  try {
    await connectToDatabase();
    const query = construirQueryFiltros(filtros);

    const totalFiltrados = await EditalModel.countDocuments(query);
    const skip = (pagina - 1) * itensPorPagina;

    const dados = await EditalModel.find(query)
      .sort({ dataTimestamp: -1, ordemOriginal: 1 })
      .skip(skip)
      .limit(itensPorPagina)
      .lean();

    const dadosLimpos = dados.map(({ _id, __v, createdAt, updatedAt, ...resto }) => resto) as unknown as Edital[];

    const cidadesDisponiveis = await EditalModel.distinct("cidade");
    const orgaosDisponiveis = await EditalModel.distinct("orgao");

    return {
      editais: dadosLimpos,
      totalFiltrados,
      cidadesDisponiveis: (cidadesDisponiveis as string[]).sort((a, b) => a.localeCompare(b, 'pt-BR')),
      orgaosDisponiveis: (orgaosDisponiveis as string[]).sort((a, b) => a.localeCompare(b, 'pt-BR'))
    };
  } catch (e) {
    console.error("Erro ao carregar editais paginados do MongoDB:", e);
    return { editais: [], totalFiltrados: 0, cidadesDisponiveis: [], orgaosDisponiveis: [] };
  }
}

export async function carregarPastasPaginadas(
  filtros: FiltrosEditais,
  pagina: number,
  pastasPorPagina: number,
  filtroTipoGrupo: 'todos' | 'concurso' | 'seletivo'
): Promise<{ pastas: any[]; totalPastas: number; cidadesDisponiveis: string[]; orgaosDisponiveis: string[] }> {
  try {
    await connectToDatabase();
    const query = construirQueryFiltros(filtros);

    const pipeline: any[] = [
      { $match: query },
      {
        $addFields: {
          concursoFinal: {
            $trim: {
              input: {
                $cond: {
                  if: {
                    $gt: [{ $strLenCP: { $ifNull: ["$dadosEnriquecidos.concurso", ""] } }, 0]
                  },
                  then: "$dadosEnriquecidos.concurso",
                  else: "$concurso"
                }
              }
            }
          }
        }
      },
      {
        $match: {
          concursoFinal: { $type: "string", $ne: "" }
        }
      },
      {
        $group: {
          _id: {
            cidade: "$cidade",
            orgao: "$orgao",
            concurso: "$concursoFinal"
          },
          maxTimestamp: { $max: "$dataTimestamp" },
          totalItens: { $sum: 1 },
          hasUnenriched: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $eq: ["$dadosEnriquecidos", null] },
                    { $eq: ["$dadosEnriquecidos.titulo", null] },
                    { $eq: ["$dadosEnriquecidos.titulo", ""] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      }
    ];

    const rawGroups = await EditalModel.aggregate(pipeline);

    let grupos = rawGroups.map(g => {
      const chave = `${g._id.cidade}_${g._id.orgao}_${g._id.concurso}`;
      return {
        chaveUnica: chave,
        nome: g._id.concurso,
        cidade: g._id.cidade,
        orgao: g._id.orgao,
        totalItens: g.totalItens,
        maxTimestamp: g.maxTimestamp,
        todosEnriquecidos: g.hasUnenriched === 0
      };
    });

    if (filtroTipoGrupo === 'concurso') {
      grupos = grupos.filter(g => g.nome && g.nome.toUpperCase().includes('CONCURSO'));
    } else if (filtroTipoGrupo === 'seletivo') {
      grupos = grupos.filter(g => g.nome && g.nome.toUpperCase().includes('PROCESSO SELETIVO'));
    }

    grupos.sort((a, b) => {
      const extrairAnoNumero = (nome: string) => {
        if (!nome || typeof nome !== 'string') return { ano: 0, numero: 0 };
        const match = nome.match(/(\d{2})\/(\d{4})/);
        if (!match) return { ano: 0, numero: 0 };
        return { ano: parseInt(match[2], 10), numero: parseInt(match[1], 10) };
      };

      const valA = extrairAnoNumero(a.nome);
      const valB = extrairAnoNumero(b.nome);

      if (valB.ano !== valA.ano) return valB.ano - valA.ano;
      return valB.numero - valA.numero;
    });

    const totalPastas = grupos.length;
    const skip = (pagina - 1) * pastasPorPagina;
    const gruposPagina = grupos.slice(skip, skip + pastasPorPagina);

    let pastasHidratadas: any[] = [];

    if (gruposPagina.length > 0) {
      const matchQueries = gruposPagina.map(g => ({
        cidade: g.cidade,
        orgao: g.orgao,
        $or: [
          { "dadosEnriquecidos.concurso": g.nome },
          { concurso: g.nome }
        ]
      }));

      const editaisRaw = await EditalModel.find({ $or: matchQueries })
        .sort({ dataTimestamp: -1, ordemOriginal: 1 })
        .lean();

      const editais = editaisRaw.map(({ _id, __v, createdAt, updatedAt, ...resto }) => resto) as unknown as Edital[];

      const mapaEditais = new Map<string, Edital[]>();
      editais.forEach(e => {
        const concEnriquecido = e.dadosEnriquecidos?.concurso?.trim();
        const concursoFinal = (concEnriquecido && concEnriquecido !== '') ? concEnriquecido : e.concurso;
        const chave = `${e.cidade}_${e.orgao}_${concursoFinal}`;
        if (!mapaEditais.has(chave)) {
          mapaEditais.set(chave, []);
        }
        mapaEditais.get(chave)!.push(e);
      });

      pastasHidratadas = gruposPagina.map(g => {
        const itensGrupo = mapaEditais.get(g.chaveUnica) || [];
        const primeiroItem = itensGrupo[0];
        const ultimaAtualizacao = primeiroItem 
          ? (primeiroItem.dadosEnriquecidos?.dataPublicacao || primeiroItem.dataPublicacao || "")
          : "";

        return {
          chaveUnica: g.chaveUnica,
          nome: g.nome,
          cidade: g.cidade,
          orgao: g.orgao,
          ultimaAtualizacao,
          totalItens: itensGrupo.length,
          todosEnriquecidos: !itensGrupo.some(e => !e.dadosEnriquecidos || !e.dadosEnriquecidos.titulo),
          itens: itensGrupo,
          linksOrigem: Array.from(new Set(itensGrupo.map(e => e.linkOrigem).filter(Boolean))) as string[]
        };
      });
    }

    const cidadesDisponiveis = await EditalModel.distinct("cidade");
    const orgaosDisponiveis = await EditalModel.distinct("orgao");

    return {
      pastas: pastasHidratadas,
      totalPastas,
      cidadesDisponiveis: (cidadesDisponiveis as string[]).sort((a, b) => a.localeCompare(b, 'pt-BR')),
      orgaosDisponiveis: (orgaosDisponiveis as string[]).sort((a, b) => a.localeCompare(b, 'pt-BR'))
    };
  } catch (e) {
    console.error("Erro ao carregar pastas paginadas do MongoDB:", e);
    return { pastas: [], totalPastas: 0, cidadesDisponiveis: [], orgaosDisponiveis: [] };
  }
}

export async function carregarTodosEditaisFiltrados(filtros: FiltrosEditais): Promise<Edital[]> {
  try {
    await connectToDatabase();
    const query = construirQueryFiltros(filtros);
    const dados = await EditalModel.find(query)
      .sort({ dataTimestamp: -1, ordemOriginal: 1 })
      .lean();

    return dados.map(({ _id, __v, createdAt, updatedAt, ...resto }) => resto) as unknown as Edital[];
  } catch (e) {
    console.error("Erro ao carregar todos os editais filtrados:", e);
    return [];
  }
}

export async function carregarGrupoPorChave(chaveUnica: string): Promise<any | null> {
  try {
    await connectToDatabase();
    const parts = chaveUnica.split('_');
    if (parts.length < 3) return null;
    const cidade = parts[0];
    const orgao = parts[1];
    const nome = parts.slice(2).join('_');

    const matchQuery = {
      cidade,
      orgao,
      $or: [
        { "dadosEnriquecidos.concurso": nome },
        { concurso: nome }
      ]
    };

    const editaisRaw = await EditalModel.find(matchQuery)
      .sort({ dataTimestamp: -1, ordemOriginal: 1 })
      .lean();

    if (editaisRaw.length === 0) return null;

    const editais = editaisRaw.map(({ _id, __v, createdAt, updatedAt, ...resto }) => resto) as unknown as Edital[];
    const primeiroItem = editais[0];
    const ultimaAtualizacao = primeiroItem 
      ? (primeiroItem.dadosEnriquecidos?.dataPublicacao || primeiroItem.dataPublicacao || "")
      : "";
    const hasUnenriched = editais.some(e => !e.dadosEnriquecidos || !e.dadosEnriquecidos.titulo);

    return {
      chaveUnica,
      nome,
      cidade,
      orgao,
      ultimaAtualizacao,
      totalItens: editais.length,
      todosEnriquecidos: !hasUnenriched,
      itens: editais,
      linksOrigem: Array.from(new Set(editais.map(e => e.linkOrigem).filter(Boolean))) as string[]
    };
  } catch (e) {
    console.error("Erro ao carregar grupo por chave:", e);
    return null;
  }
}
