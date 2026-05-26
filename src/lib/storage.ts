'use server'

import { Edital } from '../types';
import { put, list } from '@vercel/blob';

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

export async function sincronizarBanco(novosEditais: Edital[], substituirTudo: boolean = false): Promise<{ sucesso: boolean, adicionados: number, atualizados: string[] }> {
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
    const relatorioAtualizacoes: string[] = [];
    const relatorioAdicoes: string[] = [];
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
          relatorioAtualizacoes.push(
            `\n   🏢 [${novo.cidade}] 📄 "${novo.titulo}"` +
            `\n   🔗 Link: ${novo.link}` +
            `\n   🔄 Mudanças: ${alteracoes.join(' | ')}`
          );
        }
      } else {
        qtdeAdicionados++;
        relatorioAdicoes.push(
          `\n   ✨ [${novo.cidade}] 📄 "${novo.titulo}"` +
          `\n   🔗 Link: ${novo.link}`
        );
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
      relatorioAdicoes.forEach(log => console.log(log));
    }

    if (relatorioAtualizacoes.length > 0) {
      console.log("\n📝 Relatório de Alterações:");
      relatorioAtualizacoes.forEach(log => console.log(log));
    }
    console.log("===================================================\n");

    return { sucesso: true, adicionados: qtdeAdicionados, atualizados: relatorioAtualizacoes };
  } catch (e) {
    console.error("Erro na sincronização com Vercel Blob:", e);
    return { sucesso: false, adicionados: 0, atualizados: [] };
  }
}
