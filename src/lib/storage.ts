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
    // `.lean()` retorna objetos JS puros ao invés de Documentos Mongoose
    const dados = await EditalModel.find()
      .sort({ dataTimestamp: -1, ordemOriginal: 1 })
      .lean();
    
    // O Next.js não permite passar ObjectId ou Objetos complexos para Client Components.
    // Limpamos os campos internos do MongoDB (_id, __v, createdAt, updatedAt)
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

  const operations: any[] = [];

  novosEditais.forEach(novo => {
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
        
        operations.push({
          updateOne: {
            filter: { link: novo.link },
            update: { $set: novo }
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
        tituloIA: novo.tituloIA,
        descricaoIA: novo.descricaoIA
      });
      novasAdicoesReferencias.push(novo);
      
      operations.push({
        insertOne: {
          document: novo
        }
      });
    }
  });

  return {
    adicionados: qtdeAdicionados,
    atualizados: relatorioAtualizacoes,
    relatorioAdicoes,
    novasAdicoesReferencias,
    operations
  };
}

export async function persistirSincronizacao(
  operations: any[], 
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
        // Insere em lotes se substituir tudo
        await EditalModel.insertMany(novosEditais);
      }
    } else if (operations.length > 0) {
      await EditalModel.bulkWrite(operations);
    }

    console.log(`✅ Sincronização MongoDB concluída!`);
    console.log(`📈 Novos Editais Adicionados: ${relatorioAdicoes.length}`);
    console.log(`🔄 Editais Atualizados: ${relatorioAtualizacoes.length}`);

    if (relatorioAdicoes.length > 0 && !substituirTudo) {
      console.log("\n🆕 Relatório de Adições:");
      relatorioAdicoes.forEach(log => {
        console.log(`\n   ✨ [${log.cidade}] 📄 "${log.tituloIA || log.titulo}"\n   🔗 Link: ${log.link}`);
      });
    }

    if (relatorioAtualizacoes.length > 0) {
      console.log("\n📝 Relatório de Alterações:");
      relatorioAtualizacoes.forEach(log => {
        console.log(`\n   🏢 [${log.cidade}] 📄 "${log.titulo}"\n   🔗 Link: ${log.link}\n   🔄 Mudanças: ${log.mudancas.join(' | ')}`);
      });
    }
    console.log("===================================================\n");

    // Salva a data do momento como a última atualização do banco
    await salvarMetadata(new Date().toISOString());

    return { sucesso: true };
  } catch (e) {
    console.error("Erro na persistência com MongoDB:", e);
    return { sucesso: false };
  }
}

export async function sincronizarBanco(novosEditais: Edital[], substituirTudo: boolean = false): Promise<{ sucesso: boolean, adicionados: number, atualizados: SyncLogUpdate[], relatorioAdicoes: SyncLogAddition[] }> {
  try {
    console.log("\n===================================================");
    if (substituirTudo) {
      console.log("🍃 CRIANDO NOVO BANCO NO MONGODB (SUBSTITUIÇÃO TOTAL)...");
    } else {
      console.log("🍃 SINCRONIZANDO COM O MONGODB...");
    }
    console.log("===================================================");

    const resultado = await identificarMudancas(novosEditais, substituirTudo);
    
    // Para manter compatibilidade com quem chamava sincronizarBanco e esperava persistência
    if (resultado.adicionados > 0 || resultado.atualizados.length > 0 || substituirTudo) {
      const persist = await persistirSincronizacao(resultado.operations, substituirTudo, novosEditais, resultado.relatorioAdicoes, resultado.atualizados);
      if (!persist.sucesso) throw new Error("Falha na persistência");
    }

    return { sucesso: true, adicionados: resultado.adicionados, atualizados: resultado.atualizados, relatorioAdicoes: resultado.relatorioAdicoes };
  } catch (e) {
    console.error("Erro na sincronização com MongoDB:", e);
    return { sucesso: false, adicionados: 0, atualizados: [], relatorioAdicoes: [] };
  }
}

export async function carregarMetadata(): Promise<{ ultimaAtualizacao?: string } | null> {
  try {
    await connectToDatabase();
    const doc = await MetadataModel.findOne({ key: 'global' }).lean();
    if (!doc) return null;
    return { ultimaAtualizacao: doc.ultimaAtualizacao };
  } catch (e) {
    console.error("Erro ao carregar metadata do MongoDB:", e);
    return null;
  }
}

export async function salvarMetadata(ultimaAtualizacao: string): Promise<boolean> {
  try {
    await connectToDatabase();
    await MetadataModel.updateOne(
      { key: 'global' },
      { $set: { ultimaAtualizacao } },
      { upsert: true }
    );
    return true;
  } catch (e) {
    console.error("Erro ao salvar metadata no MongoDB:", e);
    return false;
  }
}

// ==============================================================
// 📋 SCRAPING LOGS (ÚLTIMOS 20 BLOCOS)
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
  tituloIA?: string;
  descricaoIA?: string;
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
    // Busca os 20 mais recentes
    const logs = await ScrapingLogModel.find()
      .sort({ inicio: -1 })
      .limit(20)
      .lean();

    if (!logs || logs.length === 0) {
      console.log("Banco de logs vazio no MongoDB. Retornando logs falsos para teste se houver necessidade...");
      return obterMockLogs();
    }

    const logsLimpos = logs.map(({ _id, __v, createdAt, updatedAt, ...resto }) => resto);

    return logsLimpos as unknown as ScrapingLog[];
  } catch (e) {
    console.error("Erro ao carregar scraping logs do MongoDB:", e);
    return [];
  }
}

// Em um BD de verdade não precisamos re-salvar a array inteira toda vez,
// mas para manter a compatibilidade caso alguém use essa função:
export async function salvarScrapingLogs(logs: ScrapingLog[]): Promise<boolean> {
  try {
    await connectToDatabase();
    // Deleta os antigos e insere os novos
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
    // Apenas insere o novo documento no Mongo (muito mais eficiente do que no Blob)
    await ScrapingLogModel.create(novoLog);
    
    // Opcionalmente, apaga logs antigos para manter o limite de 20
    const count = await ScrapingLogModel.countDocuments();
    if (count > 20) {
      const excess = count - 20;
      // Pega os mais antigos e apaga
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
