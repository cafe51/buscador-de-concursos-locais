// src/components/DevToolsPanel.tsx
'use client'
import { useState } from 'react';
import { buscarEditaisPorCidade } from '../app/actions';
import { auditarQuantidadesInstar, extrairDadosRawInstar, Discrepancia } from '../lib/diagnostics';
import { sincronizarBanco } from '../lib/storage';
import { Edital } from '../types';

type DevToolsProps = {
  todasCidades: string[];
  concursosAgrupados: any[];
  onUpdateCityData: (cidade: string, novosEditais: Edital[]) => void;
  onScrapeAndSave: () => void; // 🚀 Adicionado
  isSavingToCloud: boolean;    // 🚀 Adicionado
  onCreateNewDb: () => void;   // 🚀 Adicionado
  isCreatingNewDb: boolean;    // 🚀 Adicionado
};

export default function DevToolsPanel({ todasCidades, concursosAgrupados, onUpdateCityData, onScrapeAndSave, isSavingToCloud, onCreateNewDb, isCreatingNewDb }: DevToolsProps) {
  const [auditando, setAuditando] = useState(false);
  const [resultadoAuditoria, setResultadoAuditoria] = useState<Discrepancia[] | null>(null);

  const [urlRaw, setUrlRaw] = useState('');
  const [isRawScraping, setIsRawScraping] = useState(false);

  const [cidadeAlvoDev, setCidadeAlvoDev] = useState<string>(todasCidades[0]);
  const [isRefreshingCity, setIsRefreshingCity] = useState(false);
  const [isMinimized, setIsMinimized] = useState(true);

  async function rodarAuditoria() {
    setAuditando(true);
    setResultadoAuditoria(null);
    const payload = concursosAgrupados
      .filter(g => g.linksOrigem && g.linksOrigem.length > 0)
      .map(g => ({
        nome: g.nome,
        cidade: g.cidade,
        linksOrigem: g.linksOrigem,
        qtdNossa: g.totalItens,
        temRestricao: g.itens.some((item: Edital) => item.titulo.includes('Acesso Restrito'))
      }));
    const discrepancias = await auditarQuantidadesInstar(payload);
    setResultadoAuditoria(discrepancias);
    setAuditando(false);
  }

  async function rodarRawScraper() {
    if (!urlRaw) return;
    setIsRawScraping(true);
    try {
      const dados = await extrairDadosRawInstar(urlRaw);
      const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
      const urlBlob = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = urlBlob;
      link.download = `raio-x-instar-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(urlBlob);
    } catch (e) {
      alert("Falha ao rodar o Raw Scraper. Verifique a URL.");
    }
    setIsRawScraping(false);
  }

  async function rodarAtualizacaoIndividual() {
    if (!cidadeAlvoDev) return;
    setIsRefreshingCity(true);
    try {
      const resultado = await buscarEditaisPorCidade(cidadeAlvoDev);
      if (resultado.falhas.length > 0) {
        alert(`Falha ao buscar editais de ${cidadeAlvoDev}. Verifique os logs no terminal.`);
      } else {
        // Envia os dados frescos para fundir com os antigos na nuvem
        const syncResult = await sincronizarBanco(resultado.editais);
        if (syncResult.sucesso) {
          alert(`✅ Cidade [${cidadeAlvoDev}] Atualizada e Salva na Nuvem!\n\n📈 Novos Editais: ${syncResult.adicionados}\n🔄 Editais Atualizados: ${syncResult.atualizados.length}`);
        } else {
          alert(`⚠️ Cidade [${cidadeAlvoDev}] atualizada localmente, mas falhou ao salvar na Nuvem.`);
        }
      }
      onUpdateCityData(cidadeAlvoDev, resultado.editais);
    } catch (e) {
      console.error(e);
      alert("Erro ao executar o scraper da cidade selecionada.");
    }
    setIsRefreshingCity(false);
  }

  const showDevTools = process.env.NODE_ENV === 'development';
  if (!showDevTools) return null;

  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-6 right-6 z-50 bg-neutral-900/80 backdrop-blur-md text-white p-4 rounded-full shadow-2xl hover:bg-neutral-800 transition-all hover:scale-110 flex items-center justify-center border border-neutral-700 group"
        title="Abrir DevTools"
      >
        <span className="text-2xl leading-none group-hover:rotate-90 transition-transform duration-300">⚙️</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 sm:inset-auto sm:bottom-6 sm:right-6 z-50 flex flex-col items-center sm:items-end gap-4 p-4 sm:p-0 bg-neutral-950/60 sm:bg-transparent backdrop-blur-md sm:backdrop-blur-none overflow-y-auto">
      <div className="w-full sm:w-auto flex justify-end mb-2 mt-4 sm:mt-0">
        <button
          onClick={() => setIsMinimized(true)}
          className="bg-neutral-900 text-white px-6 py-2 rounded-full text-sm font-bold shadow-xl hover:bg-neutral-800 transition-colors border border-neutral-700 flex items-center gap-2"
        >
          <span>Fechar DevTools</span> ✖
        </button>
      </div>

      {/* ☁️ NUVEM VERCEL BLOB */}
      <div className="bg-neutral-900/80 backdrop-blur-xl border border-sky-500/50 p-4 rounded-2xl shadow-xl w-full max-w-md sm:w-96 animate-fade-in flex flex-col gap-3">
        <div>
          <h3 className="font-bold text-sky-400 mb-2">☁️ Atualizar Nuvem</h3>
          <p className="text-xs text-neutral-400 mb-3">Raspa TODAS as cidades e faz o upload (Upsert) para o banco de dados da Vercel (Pode levar 2 minutos).</p>
          <button
            onClick={onScrapeAndSave} disabled={isSavingToCloud || isCreatingNewDb}
            className="bg-sky-600 text-white w-full py-3 rounded-xl text-sm font-bold disabled:opacity-50 hover:bg-sky-500 transition-colors shadow-lg"
          >
            {isSavingToCloud ? '⏳ Raspando e Salvando...' : '🚀 Raspar TUDO e Atualizar Nuvem'}
          </button>
        </div>
        <div className="border-t border-neutral-800 pt-3">
          <h3 className="font-bold text-red-600 mb-2">🛑 Criar Novo Banco</h3>
          <p className="text-xs text-neutral-400 mb-3">Zera a nuvem atual e recria o banco APENAS com os dados encontrados agora (Destrutivo).</p>
          <button
            onClick={onCreateNewDb} disabled={isSavingToCloud || isCreatingNewDb}
            className="bg-red-600/20 border border-red-500/50 text-red-400 w-full py-2 rounded-xl text-sm font-bold disabled:opacity-50 hover:bg-red-500/30 transition-colors shadow-lg"
          >
            {isCreatingNewDb ? '⏳ Recriando Banco...' : '💥 Zerar e Criar Novo Banco'}
          </button>
        </div>
      </div>

      {/* RASPAGEM INDIVIDUAL */}
      <div className="bg-neutral-900/80 backdrop-blur-xl border border-emerald-500/50 p-4 rounded-2xl shadow-xl w-full max-w-md sm:w-96 animate-fade-in">
        <h3 className="font-bold text-emerald-400 mb-2">⚡ Testar Cidade Única</h3>
        <p className="text-xs text-neutral-400 mb-3">Atualiza a cidade selecionada e salva as modificações diretamente no servidor.</p>
        <select
          value={cidadeAlvoDev}
          onChange={(e) => setCidadeAlvoDev(e.target.value)}
          className="bg-neutral-950 border border-neutral-800 text-emerald-400 p-2 w-full text-xs font-bold rounded-xl mb-2 outline-none focus:border-emerald-500"
        >
          {todasCidades.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button
          onClick={rodarAtualizacaoIndividual} disabled={isRefreshingCity}
          className="bg-emerald-600 text-white w-full py-2 rounded-xl text-sm font-bold disabled:opacity-50 hover:bg-emerald-500 transition-colors shadow-lg"
        >
          {isRefreshingCity ? '⏳ Raspando e Sincronizando...' : `Atualizar ${cidadeAlvoDev} na Nuvem`}
        </button>
      </div>

      {/* RAW SCRAPER */}
      <div className="bg-neutral-900/80 backdrop-blur-xl border border-purple-500/50 p-4 rounded-2xl shadow-xl w-full max-w-md sm:w-96 animate-fade-in">
        <h3 className="font-bold text-purple-400 mb-2">🛠️ Raio-X Instar (Raw)</h3>
        <input
          type="text"
          placeholder="Ex: https://.../numero-ano-processo-decrescente/0"
          value={urlRaw} onChange={(e) => setUrlRaw(e.target.value)}
          className="bg-neutral-950 text-white border border-neutral-800 p-2 w-full text-xs rounded-xl mb-2 outline-none focus:border-purple-500"
        />
        <button
          onClick={rodarRawScraper} disabled={isRawScraping || !urlRaw}
          className="bg-purple-600 text-white w-full py-2 rounded-xl text-sm font-bold disabled:opacity-50 hover:bg-purple-500 transition-colors"
        >
          {isRawScraping ? '⏳ Extraindo...' : 'Extrair JSON'}
        </button>
      </div>

      {/* AUDITOR */}
      <div className="flex flex-col items-center sm:items-end w-full max-w-md sm:w-auto">
        {resultadoAuditoria && (
          <div className="bg-neutral-900/80 backdrop-blur-xl border border-rose-500/50 p-4 rounded-2xl shadow-xl mb-4 w-full sm:w-96 max-h-[50vh] overflow-y-auto animate-fade-in">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-rose-400">🕵️ Relatório</h3>
              <button onClick={() => setResultadoAuditoria(null)} className="text-neutral-500 hover:text-white">✖</button>
            </div>
            {resultadoAuditoria.length === 0 ? (
              <p className="text-sm text-emerald-400 font-bold">Tudo perfeito!</p>
            ) : (
              <div className="space-y-4">
                {resultadoAuditoria.map((disc, idx) => (
                  <div key={idx} className="bg-rose-500/10 p-3 rounded-xl border border-rose-500/30 text-sm">
                    <p className="font-bold text-rose-300">{disc.cidade} - {disc.concurso}</p>
                    <div className="flex justify-between mt-2 font-medium">
                      <span className="text-emerald-400">Nós: {disc.qtdNossa}</span>
                      <span className="text-sky-400">Site: {disc.qtdSite}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <button
          onClick={rodarAuditoria} disabled={auditando || concursosAgrupados.length === 0}
          className={`px-6 py-3 rounded-full font-bold shadow-xl flex items-center gap-2 transition-all w-full sm:w-auto justify-center ${auditando ? 'bg-neutral-800 text-neutral-500' : 'bg-neutral-900 text-white border border-neutral-700 hover:bg-neutral-800 hover:-translate-y-1'}`}
        >
          {auditando ? '⏳ Auditando...' : '🕵️ Auditar Instar'}
        </button>
      </div>
    </div>
  );
}