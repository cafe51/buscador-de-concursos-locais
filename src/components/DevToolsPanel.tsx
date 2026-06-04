'use client'
import { useState, useEffect } from 'react';
import { auditarQuantidadesInstar, Discrepancia } from '../lib/diagnostics';
import { Edital } from '../types';

const CIDADES_ATIVAS = [
  'Álvares Florence',
  'Dolcinópolis',
  "Estrela d'Oeste",
  'Fernandópolis',
  'Fernandópolis (Câmara)',
  "Guarani d'Oeste",
  'Indiaporã',
  'Indiaporã (Câmara)',
  'Jales',
  'Jales (Câmara)',
  'Macedônia',
  'Meridiano',
  'Meridiano (Câmara)',
  'Mira Estrela',
  'Mira Estrela (Câmara)',
  'Ouroeste',
  'Parisi',
  'Parisi (Câmara)',
  'Pedranópolis',
  'Pontalinda',
  'Santa Salete',
  'São João das Duas Pontes',
  'Urânia',
  'Valentim Gentil',
  'Vitória Brasil',
  'Votuporanga',
  'Votuporanga (Câmara)'
].sort();

export default function DevToolsPanel() {
  const [auditando, setAuditando] = useState(false);
  const [resultadoAuditoria, setResultadoAuditoria] = useState<Discrepancia[] | null>(null);
  
  const [isSavingToCloud, setIsSavingToCloud] = useState(false);
  const [isMinimized, setIsMinimized] = useState(true);

  // ⚙️ CONFIGURAÇÕES DE TESTE LOCAL
  const [devEnableAI, setDevEnableAI] = useState(true);
  const [devEnableEmails, setDevEnableEmails] = useState(false);
  const [devSelectedCities, setDevSelectedCities] = useState<string[]>([]);
  const [configLoaded, setConfigLoaded] = useState(false);

  useEffect(() => {
    const aiSaved = localStorage.getItem('devEnableAI');
    if (aiSaved !== null) setDevEnableAI(aiSaved === 'true');

    const emailsSaved = localStorage.getItem('devEnableEmails');
    if (emailsSaved !== null) setDevEnableEmails(emailsSaved === 'true');

    const citiesSaved = localStorage.getItem('devSelectedCities');
    if (citiesSaved) {
      try { 
        setDevSelectedCities(JSON.parse(citiesSaved)); 
      } catch (e) { 
        setDevSelectedCities(CIDADES_ATIVAS);
      }
    } else {
      setDevSelectedCities(CIDADES_ATIVAS);
    }
    setConfigLoaded(true);
  }, []);

  useEffect(() => {
    if (configLoaded) {
      localStorage.setItem('devEnableAI', String(devEnableAI));
      localStorage.setItem('devEnableEmails', String(devEnableEmails));
      localStorage.setItem('devSelectedCities', JSON.stringify(devSelectedCities));
    }
  }, [devEnableAI, devEnableEmails, devSelectedCities, configLoaded]);

  const toggleCity = (cidade: string) => {
    if (devSelectedCities.includes(cidade)) {
      setDevSelectedCities(devSelectedCities.filter(c => c !== cidade));
    } else {
      setDevSelectedCities([...devSelectedCities, cidade]);
    }
  };

  const selectAllCities = () => setDevSelectedCities(CIDADES_ATIVAS);
  const deselectAllCities = () => setDevSelectedCities([]);

  async function rasparESalvarNaNuvem() {
    setIsSavingToCloud(true);
    try {
      const { rodarFluxoCompletoServerAction } = await import('../app/actions');
      
      const response = await rodarFluxoCompletoServerAction({
        isLocalUI: true,
        enableAI: devEnableAI,
        enableEmails: devEnableEmails,
        cidadesSelecionadas: devSelectedCities
      });

      if (response.sucesso) {
        if (response.syncInfo) {
           alert(`✅ Fluxo Completo Executado com Sucesso!\n\n📈 Novos Itens Adicionados: ${response.syncInfo.adicionados}\n🔄 Itens Atualizados: ${response.syncInfo.atualizados}\n\nO processo incluiu Análise com IA, Emails e Salvamento de Logs.`);
        } else {
           alert(`✅ Fluxo Completo Executado com Sucesso! Nenhuma modificação necessária no banco.`);
        }
        window.location.reload();
      } else {
        alert("❌ Erro ao completar fluxo na Nuvem. Verifique o terminal.");
      }
    } catch (e) {
      alert("❌ Falha crítica ao raspar as cidades (Verifique se não houve timeout na interface, veja o terminal).");
    }
    setIsSavingToCloud(false);
  }

  async function rodarAuditoria() {
    setAuditando(true);
    setResultadoAuditoria(null);
    try {
      const { carregarDoBanco } = await import('../lib/storage');
      const editais = await carregarDoBanco();
      
      const mapa = new Map<string, Edital[]>();
      editais.forEach((edital: Edital) => {
        const concursoFinal = edital.dadosEnriquecidos?.concurso || edital.concurso;
        if (concursoFinal) {
          const chaveUnica = `${edital.cidade}_${edital.orgao}_${concursoFinal}`;
          if (!mapa.has(chaveUnica)) mapa.set(chaveUnica, []);
          mapa.get(chaveUnica)!.push(edital);
        }
      });

      const concursosAgrupados = Array.from(mapa.entries()).map(([chaveUnica, listaEditais]) => {
        const primeiroItem = listaEditais[0];
        const concursoFinal = primeiroItem.dadosEnriquecidos?.concurso || primeiroItem.concurso;
        return {
          nome: concursoFinal as string,
          cidade: primeiroItem.cidade,
          totalItens: listaEditais.length,
          itens: listaEditais,
          linksOrigem: Array.from(new Set(listaEditais.map((e: Edital) => e.linkOrigem).filter(Boolean))) as string[]
        };
      });

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
    } catch (e) {
      alert("Erro ao carregar dados do banco para auditoria.");
    }
    setAuditando(false);
  }

  const showDevTools = process.env.NODE_ENV === 'development';
  if (!showDevTools) return null;

  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-6 right-6 z-50 bg-white/90 backdrop-blur-md text-slate-800 p-4 rounded-full shadow-2xl hover:bg-slate-50 transition-all hover:scale-110 flex items-center justify-center border border-slate-200 group"
        title="Abrir DevTools"
      >
        <span className="text-2xl leading-none group-hover:rotate-90 transition-transform duration-300">⚙️</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 sm:inset-auto sm:bottom-6 sm:right-6 z-[9999] flex flex-col items-center sm:items-end gap-4 p-4 sm:p-0 bg-slate-900/40 sm:bg-transparent backdrop-blur-md sm:backdrop-blur-none overflow-y-auto">
      <div className="w-full sm:w-auto flex justify-end mb-2 mt-4 sm:mt-0">
        <button
          onClick={() => setIsMinimized(true)}
          className="bg-white text-slate-800 px-6 py-2 rounded-full text-sm font-bold shadow-xl hover:bg-slate-50 transition-colors border border-slate-200 flex items-center gap-2"
        >
          <span>Fechar DevTools</span> ✖
        </button>
      </div>

      <div className="bg-white/90 backdrop-blur-xl border border-slate-200 p-4 rounded-2xl shadow-xl w-full max-w-md sm:w-96 animate-fade-in flex flex-col gap-3">
        <h3 className="font-bold text-indigo-700 mb-1 flex items-center gap-2">⚙️ Configurações Locais</h3>

        <div className="flex flex-col gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
            <input type="checkbox" checked={devEnableAI} onChange={e => setDevEnableAI(e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500" />
            🧠 Ativar IA (Gemini)
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
            <input type="checkbox" checked={devEnableEmails} onChange={e => setDevEnableEmails(e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500" />
            📧 Ativar Disparos de Email
          </label>
        </div>

        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col gap-2">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-bold text-slate-700">Cidades ({devSelectedCities.length}/{CIDADES_ATIVAS.length})</span>
            <div className="flex gap-2">
              <button onClick={selectAllCities} className="text-xs text-indigo-600 hover:underline">Todas</button>
              <button onClick={deselectAllCities} className="text-xs text-indigo-600 hover:underline">Nenhuma</button>
            </div>
          </div>
          <div className="max-h-32 overflow-y-auto space-y-1 pr-2">
            {CIDADES_ATIVAS.map(cidade => (
              <label key={cidade} className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer hover:bg-slate-100 p-1 rounded">
                <input type="checkbox" checked={devSelectedCities.includes(cidade)} onChange={() => toggleCity(cidade)} className="rounded text-indigo-600 focus:ring-indigo-500" />
                {cidade}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white/90 backdrop-blur-xl border border-slate-200 p-4 rounded-2xl shadow-xl w-full max-w-md sm:w-96 animate-fade-in flex flex-col gap-3">
        <div>
          <h3 className="font-bold text-sky-700 mb-2">☁️ Atualizar Nuvem</h3>
          <p className="text-xs text-slate-500 mb-3">Raspa as cidades selecionadas obedecendo às configurações locais. (Fazendo upsert na nuvem)</p>
          <button
            onClick={rasparESalvarNaNuvem}
            disabled={isSavingToCloud || devSelectedCities.length === 0}
            className="bg-sky-600 text-white w-full py-3 rounded-xl text-sm font-bold disabled:opacity-50 hover:bg-sky-500 transition-colors shadow-lg"
          >
            {isSavingToCloud ? '⏳ Raspando e Salvando...' : '🚀 Raspar TUDO e Atualizar Nuvem'}
          </button>
        </div>
      </div>

      <div className="flex flex-col items-center sm:items-end w-full max-w-md sm:w-auto">
        {resultadoAuditoria && (
          <div className="bg-white/90 backdrop-blur-xl border border-slate-200 p-4 rounded-2xl shadow-xl mb-4 w-full sm:w-96 max-h-[50vh] overflow-y-auto animate-fade-in">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-rose-700">🕵️ Relatório</h3>
              <button onClick={() => setResultadoAuditoria(null)} className="text-slate-400 hover:text-slate-700">✖</button>
            </div>
            {resultadoAuditoria.length === 0 ? (
              <p className="text-sm text-emerald-700 font-bold">Tudo perfeito!</p>
            ) : (
              <div className="space-y-4">
                {resultadoAuditoria.map((disc, idx) => (
                  <div key={idx} className="bg-rose-50 p-3 rounded-xl border border-rose-200 text-sm">
                    <p className="font-bold text-rose-700">{disc.cidade} - {disc.concurso}</p>
                    <div className="flex justify-between mt-2 font-medium">
                      <span className="text-emerald-700">Nós: {disc.qtdNossa}</span>
                      <span className="text-sky-700">Site: {disc.qtdSite}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <button
          onClick={rodarAuditoria} disabled={auditando}
          className={`px-6 py-3 rounded-full font-bold shadow-xl flex items-center gap-2 transition-all w-full sm:w-auto justify-center ${auditando ? 'bg-slate-100 text-slate-400' : 'bg-white text-slate-800 border border-slate-200 hover:bg-slate-50 hover:-translate-y-1'}`}
        >
          {auditando ? '⏳ Auditando...' : '🕵️ Auditar Instar'}
        </button>
      </div>
    </div>
  );
}