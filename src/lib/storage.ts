'use server'

import { Edital } from '../types';
import { put, list } from '@vercel/blob';
import { obterMockLogs } from './mockScrapingLogs';

export async function carregarDoBanco(): Promise<Edital[]> {
  try {
    const { blobs } = await list();
    const file = blobs.find(b => b.pathname === 'editais.json');

    if (!file) return [];

    const res = await fetch(file.downloadUrl, {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` }
    });

    if (!res.ok) {
      console.error("Erro HTTP ao baixar o banco:", res.status, res.statusText);
      return [];
    }

    const dados = await res.json();
    return dados;
  } catch (e) {
    console.error("Erro ao ler do Vercel Blob:", e);
    return [];
  }
}

export async function sincronizarBanco(novosEditais: Edital[], substituirTudo: boolean = false): Promise<{ sucesso: boolean, adicionados: number, atualizados: SyncLogUpdate[], relatorioAdicoes: SyncLogAddition[] }> {
  try {
    console.log("\n===================================================");
    if (substituirTudo) {
      console.log("☁️ CRIANDO NOVO BANCO NA NUVEM (SUBSTITUIÇÃO TOTAL)...");
    } else {
      console.log("☁️ SINCRONIZANDO COM A NUVEM...");
    }
    console.log("===================================================");

    const editaisAntigos = substituirTudo ? [] : await carregarDoBanco();

    const mapaFinal = new Map<string, Edital>();
    const relatorioAtualizacoes: SyncLogUpdate[] = [];
    const relatorioAdicoes: SyncLogAddition[] = [];
    let qtdeAdicionados = 0;

    editaisAntigos.forEach(e => mapaFinal.set(e.link, e));

    novosEditais.forEach(novo => {
      const antigo = mapaFinal.get(novo.link);

      if (antigo) {
        const alteracoes: string[] = [];
        const chavesParaIgnorar = ['ordemOriginal', 'dataTimestamp'];

        (Object.keys(novo) as Array<keyof Edital>).forEach(key => {
          if (!chavesParaIgnorar.includes(key)) {
            const valNovo = JSON.stringify(novo[key] || '');
            const valAntigo = JSON.stringify(antigo[key] || '');

            if (valNovo !== valAntigo) {
              alteracoes.push(`${key}: '${antigo[key] || 'vazio'}' ➔ '${novo[key] || 'vazio'}'`);
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
        }
      } else {
        qtdeAdicionados++;
        relatorioAdicoes.push({
          cidade: novo.cidade,
          titulo: novo.titulo,
          link: novo.link,
          orgao: novo.orgao,
          dataPublicacao: novo.dataPublicacao,
          concurso: novo.concurso
        });
      }

      mapaFinal.set(novo.link, novo);
    });

    const listaFinal = Array.from(mapaFinal.values());
    listaFinal.sort((a, b) => {
      if (b.dataTimestamp !== a.dataTimestamp) return b.dataTimestamp - a.dataTimestamp;
      return (a.ordemOriginal || 0) - (b.ordemOriginal || 0);
    });

    console.log(`☁️ Enviando pacote consolidado (${listaFinal.length} itens) para o Vercel Blob...`);
    await put('editais.json', JSON.stringify(listaFinal), {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json'
    });

    console.log(`✅ Upload concluído!`);
    console.log(`📈 Novos Editais Adicionados: ${qtdeAdicionados}`);
    console.log(`🔄 Editais Atualizados: ${relatorioAtualizacoes.length}`);

    if (relatorioAdicoes.length > 0 && !substituirTudo) {
      console.log("\n🆕 Relatório de Adições:");
      relatorioAdicoes.forEach(log => {
        console.log(`\n   ✨ [${log.cidade}] 📄 "${log.titulo}"\n   🔗 Link: ${log.link}`);
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

    return { sucesso: true, adicionados: qtdeAdicionados, atualizados: relatorioAtualizacoes, relatorioAdicoes };
  } catch (e) {
    console.error("Erro na sincronização com Vercel Blob:", e);
    return { sucesso: false, adicionados: 0, atualizados: [], relatorioAdicoes: [] };
  }
}

export async function carregarMetadata(): Promise<{ ultimaAtualizacao?: string } | null> {
  try {
    const { blobs } = await list();
    const file = blobs.find(b => b.pathname === 'metadata.json');

    if (!file) return null;

    const res = await fetch(file.downloadUrl, {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` }
    });

    if (!res.ok) return null;

    return await res.json();
  } catch (e) {
    console.error("Erro ao carregar metadata:", e);
    return null;
  }
}

export async function salvarMetadata(ultimaAtualizacao: string): Promise<boolean> {
  try {
    await put('metadata.json', JSON.stringify({ ultimaAtualizacao }), {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json'
    });
    return true;
  } catch (e) {
    console.error("Erro ao salvar metadata:", e);
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
    const { blobs } = await list();
    const file = blobs.find(b => b.pathname === 'scraping-logs.json');

    if (!file) {
      console.log("Banco de logs não encontrado. Criando logs falsos para teste...");
      const mockLogs = obterMockLogs();
      await salvarScrapingLogs(mockLogs);
      return mockLogs;
    }

    const res = await fetch(file.downloadUrl, {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` }
    });

    if (!res.ok) return [];

    return await res.json();
  } catch (e) {
    console.error("Erro ao carregar scraping logs:", e);
    return [];
  }
}

export async function salvarScrapingLogs(logs: ScrapingLog[]): Promise<boolean> {
  try {
    await put('scraping-logs.json', JSON.stringify(logs), {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json'
    });
    return true;
  } catch (e) {
    console.error("Erro ao salvar scraping logs:", e);
    return false;
  }
}

export async function adicionarScrapingLog(novoLog: ScrapingLog): Promise<boolean> {
  try {
    const logs = await carregarScrapingLogs();
    
    // Insere no início (mais recente no topo)
    const novosLogs = [novoLog, ...logs];
    
    // Limita aos 20 mais recentes
    const logsLimitados = novosLogs.slice(0, 20);
    
    return await salvarScrapingLogs(logsLimitados);
  } catch (e) {
    console.error("Erro ao adicionar scraping log:", e);
    return false;
  }
}
