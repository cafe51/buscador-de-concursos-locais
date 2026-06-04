// src/app/page.tsx
'use client'

import { useState, useEffect, useMemo, useRef } from 'react';
// 🚀 Importações do banco de dados adicionadas
import { carregarDoBanco, carregarMetadata } from '../lib/storage';
import { Edital } from '../types';
import { exportarParaJSON } from '../utils/exportJson';

import FilterPanel from '../components/FilterPanel';
import DevToolsPanel from '../components/DevToolsPanel';
import Header from '../components/Header';
import ControlsBar from '../components/ControlsBar';
import ListView from '../components/ListView';
import FolderView from '../components/FolderView';
import FolderDetailView from '../components/FolderDetailView';

export const maxDuration = 60;

function removerAcentos(texto: string) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function formatarNomeArquivo(nome: string) {
  return nome.replace(/[\/\s]/g, '-').toLowerCase();
}

function formatarDataHora(isoString: string) {
  try {
    const data = new Date(isoString);
    return data.toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return isoString;
  }
}

const anoAtual = new Date().getFullYear();
const anosDisponiveis = Array.from({ length: anoAtual - 2017 + 1 }, (_, i) => anoAtual - i);

const TODAS_CIDADES = [
  'Fernandópolis', 'Votuporanga', 'Ouroeste', 'Jales', 'Macedônia',
  "Estrela d'Oeste", 'Meridiano', 'São João das Duas Pontes', 'Pedranópolis',
  'Mira Estrela', 'Indiaporã', 'Álvares Florence', 'Parisi', 'Valentim Gentil',
  'Vitória Brasil', "Guarani d'Oeste", 'Urânia', 'Dolcinópolis', 'Pontalinda', 'Santa Salete',
  'Meridiano (Câmara)', 'Parisi (Câmara)', 'Mira Estrela (Câmara)', 'Indiaporã (Câmara)', 'Jales (Câmara)',
  'Votuporanga (Câmara)', 'Fernandópolis (Câmara)'
].sort();

export default function Home() {
  const [editais, setEditais] = useState<Edital[]>([]);
  const [loading, setLoading] = useState(true);
  const [erroFatal, setErroFatal] = useState('');
  const [alertas, setAlertas] = useState<string[]>([]);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<string>('');

  const [palavrasDesejadas, setPalavrasDesejadas] = useState<string[]>([]);
  const [palavrasIgnoradas, setPalavrasIgnoradas] = useState<string[]>([]);

  const [modoVisualizacao, setModoVisualizacao] = useState<'lista' | 'agrupado'>('lista');
  const [concursoSelecionado, setConcursoSelecionado] = useState<string | null>(null);
  const [filtroTipoGrupo, setFiltroTipoGrupo] = useState<'todos' | 'concurso' | 'seletivo'>('todos');

  const [filtroAno, setFiltroAno] = useState<number | 'todos'>('todos');
  const [filtroCidade, setFiltroCidade] = useState<string | 'todas'>('todas');
  const [filtroOrgao, setFiltroOrgao] = useState<string | 'todos'>('todos');

  const [paginaAtual, setPaginaAtual] = useState(1);
  const ITENS_POR_PAGINA = 10;

  // 🚀 NOVO: Estado para bloqueio do botão da nuvem
  const [isSavingToCloud, setIsSavingToCloud] = useState(false);
  const [isCreatingNewDb, setIsCreatingNewDb] = useState(false);
  const [isRefleshingFailed, setIsRefleshingFailed] = useState(false);

  const fetchIniciado = useRef(false);
  const [carregouURL, setCarregouURL] = useState(false);
  const isFirstFilterChange = useRef(true);

  // 1. CARREGAMENTO RÁPIDO DO USUÁRIO COMUM (Puxa APENAS da Nuvem)
  async function carregarDados() {
    setLoading(true);
    setErroFatal('');
    setAlertas([]);
    try {
      const dadosSalvos = await carregarDoBanco();

      if (dadosSalvos && dadosSalvos.length > 0) {
        setEditais(dadosSalvos);
      } else {
        // Se o banco estiver vazio, a tela apenas avisa, sem travar o servidor!
        setEditais([]);
        console.warn("Banco de dados vazio ou não encontrado na Nuvem.");
      }

      // 🚀 NOVA PARTE: Carregar a metadata da última atualização
      const meta = await carregarMetadata();
      if (meta && meta.ultimaAtualizacao) {
        setUltimaAtualizacao(formatarDataHora(meta.ultimaAtualizacao));
      } else {
        setUltimaAtualizacao('');
      }

      setPaginaAtual(1);
    } catch (e) {
      setErroFatal('Ocorreu um erro ao conectar ao banco de dados.');
    }
    setLoading(false);
  }

  // 🚀 A FUNÇÃO DO MODO DESENVOLVEDOR (Raspa a internet inteira e salva no Banco)
  async function rasparESalvarNaNuvem(options: { enableAI: boolean; enableEmails: boolean; cidadesSelecionadas: string[] }) {
    setIsSavingToCloud(true);
    try {
      const { rodarFluxoCompletoServerAction } = await import('./actions');
      
      const response = await rodarFluxoCompletoServerAction({
        isLocalUI: true,
        enableAI: options.enableAI,
        enableEmails: options.enableEmails,
        cidadesSelecionadas: options.cidadesSelecionadas
      });

      if (response.sucesso) {
        if (response.syncInfo) {
           alert(`✅ Fluxo Completo Executado com Sucesso!\n\n📈 Novos Itens Adicionados: ${response.syncInfo.adicionados}\n🔄 Itens Atualizados: ${response.syncInfo.atualizados}\n\nO processo incluiu Análise com IA, Emails e Salvamento de Logs.`);
        } else {
           alert(`✅ Fluxo Completo Executado com Sucesso! Nenhuma modificação necessária no banco.`);
        }
        carregarDados();
      } else {
        alert("❌ Erro ao completar fluxo na Nuvem. Verifique o terminal.");
      }
    } catch (e) {
      alert("❌ Falha crítica ao raspar as cidades (Verifique se não houve timeout na interface, veja o terminal).");
    }
    setIsSavingToCloud(false);
  }

  // 🚀 NOVA FUNÇÃO: ZERAR E CRIAR NOVO BANCO
  async function criarNovoBancoNaNuvem() {
    if (!confirm("⚠️ ATENÇÃO: Isso vai apagar todo o banco atual e recriar apenas com os dados que forem encontrados agora. Deseja continuar?")) return;
    
    setIsCreatingNewDb(true);
    try {
      const { buscarTodosEditais } = await import('./actions');
      const { sincronizarBanco } = await import('../lib/storage');
      const resultado = await buscarTodosEditais();
      setAlertas(resultado.falhas);

      // Envia os dados frescos para substituir os antigos
      const syncResult = await sincronizarBanco(resultado.editais, true);

      if (syncResult.sucesso) {
        alert(`✅ Novo Banco Criado com Sucesso!\n\n📈 Itens Adicionados: ${syncResult.adicionados}\n\nAbra o terminal do seu servidor para ver o relatório completo de alterações.`);
        carregarDados();
      } else {
        alert("❌ Erro ao criar novo banco na Nuvem. Verifique o console.");
      }
    } catch (e) {
      alert("❌ Falha crítica ao raspar as cidades.");
    }
    setIsCreatingNewDb(false);
  }

  // 🚀 NOVA FUNÇÃO: REFAZER CIDADES COM FALHA E ATUALIZAR NUVEM
  async function refazerCidadesComFalha() {
    if (alertas.length === 0) return;
    setIsRefleshingFailed(true);

    try {
      const { buscarEditaisPorCidade } = await import('./actions');
      const { sincronizarBanco } = await import('../lib/storage');

      const cidadesParaReprocessar = alertas.map(alerta => {
        const match = alerta.match(/(.+)\s+\([^)]+\)$/);
        return match ? match[1].trim() : alerta.trim();
      });

      const novasFalhas: string[] = [];
      let totalNovosAdicionados = 0;
      let totalAtualizados = 0;

      for (const cidade of cidadesParaReprocessar) {
        console.log(`♻️ Reprocessando cidade com falha: ${cidade}`);
        try {
          const resultado = await buscarEditaisPorCidade(cidade);
          if (resultado.falhas.length > 0) {
            novasFalhas.push(resultado.falhas[0]);
          } else {
            // Sincroniza com a nuvem os dados obtidos com sucesso
            const syncResult = await sincronizarBanco(resultado.editais);
            if (syncResult.sucesso) {
              totalNovosAdicionados += syncResult.adicionados;
              totalAtualizados += syncResult.atualizados.length;
              // Atualiza o estado local para essa cidade
              handleUpdateCityData(cidade, resultado.editais);
            } else {
              novasFalhas.push(`${cidade} (Erro ao salvar na nuvem)`);
            }
          }
        } catch (e: any) {
          novasFalhas.push(`${cidade} (${e.message || 'Erro no reprocessamento'})`);
        }
      }

      setAlertas(novasFalhas);

      if (novasFalhas.length === 0) {
        alert(`✅ Todas as cidades com falha foram reprocessadas e salvas na Nuvem com sucesso!\n\n📈 Novos Editais: ${totalNovosAdicionados}\n🔄 Editais Atualizados: ${totalAtualizados}`);
      } else {
        alert(`⚠️ Reprocessamento concluído com alguns avisos/falhas restantes.\n\n📈 Novos Editais: ${totalNovosAdicionados}\n🔄 Editais Atualizados: ${totalAtualizados}\n❌ Cidades ainda com falha: ${novasFalhas.length}`);
      }
    } catch (err) {
      console.error(err);
      alert("❌ Falha crítica ao reprocessar as cidades com falha.");
    } finally {
      setIsRefleshingFailed(false);
    }
  }

  // 1. CARREGAMENTO INICIAL DOS FILTROS DA URL
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);

    const desejadas = params.get('desejadas');
    if (desejadas) {
      setPalavrasDesejadas(desejadas.split(',').filter(Boolean));
    }

    const ignoradas = params.get('ignoradas');
    if (ignoradas) {
      setPalavrasIgnoradas(ignoradas.split(',').filter(Boolean));
    }

    const modo = params.get('modo');
    if (modo === 'lista' || modo === 'agrupado') {
      setModoVisualizacao(modo as 'lista' | 'agrupado');
    }

    const concurso = params.get('concurso');
    if (concurso) {
      setConcursoSelecionado(concurso);
    }

    const tipoGrupo = params.get('tipoGrupo');
    if (tipoGrupo === 'todos' || tipoGrupo === 'concurso' || tipoGrupo === 'seletivo') {
      setFiltroTipoGrupo(tipoGrupo as 'todos' | 'concurso' | 'seletivo');
    }

    const ano = params.get('ano');
    if (ano) {
      setFiltroAno(ano === 'todos' ? 'todos' : parseInt(ano, 10));
    }

    const cidade = params.get('cidade');
    if (cidade) {
      setFiltroCidade(cidade);
    }

    const orgao = params.get('orgao');
    if (orgao) {
      setFiltroOrgao(orgao);
    }

    const pagina = params.get('pagina');
    if (pagina) {
      setPaginaAtual(parseInt(pagina, 10));
    }

    setCarregouURL(true);
  }, []);

  // 2. CARREGAMENTO DOS DADOS (APENAS APÓS TENTAR LER A URL)
  useEffect(() => {
    if (carregouURL && !fetchIniciado.current) {
      fetchIniciado.current = true;
      carregarDados();
    }
  }, [carregouURL]);

  // 3. SINCRONIZAÇÃO DOS FILTROS DO REACT DE VOLTA PARA A URL
  useEffect(() => {
    if (!carregouURL) return;

    const params = new URLSearchParams();

    if (palavrasDesejadas.length > 0) {
      params.set('desejadas', palavrasDesejadas.join(','));
    }
    if (palavrasIgnoradas.length > 0) {
      params.set('ignoradas', palavrasIgnoradas.join(','));
    }
    if (modoVisualizacao !== 'lista') {
      params.set('modo', modoVisualizacao);
    }
    if (concursoSelecionado) {
      params.set('concurso', concursoSelecionado);
    }
    if (filtroTipoGrupo !== 'todos') {
      params.set('tipoGrupo', filtroTipoGrupo);
    }
    if (filtroAno !== 'todos') {
      params.set('ano', filtroAno.toString());
    }
    if (filtroCidade !== 'todas') {
      params.set('cidade', filtroCidade);
    }
    if (filtroOrgao !== 'todos') {
      params.set('orgao', filtroOrgao);
    }
    if (paginaAtual !== 1) {
      params.set('pagina', paginaAtual.toString());
    }

    const queryString = params.toString();
    const novaURL = queryString ? `?${queryString}` : window.location.pathname;

    window.history.replaceState(null, '', novaURL);
  }, [
    palavrasDesejadas,
    palavrasIgnoradas,
    modoVisualizacao,
    concursoSelecionado,
    filtroTipoGrupo,
    filtroAno,
    filtroCidade,
    filtroOrgao,
    paginaAtual,
    carregouURL
  ]);

  // 4. RESET DE PÁGINA EM MUDANÇAS DE FILTRO DO USUÁRIO
  useEffect(() => {
    if (!carregouURL) return;

    if (isFirstFilterChange.current) {
      isFirstFilterChange.current = false;
      return;
    }

    setPaginaAtual(1);
    if (modoVisualizacao === 'agrupado') {
      setConcursoSelecionado(null);
    }
  }, [
    palavrasDesejadas,
    palavrasIgnoradas,
    filtroAno,
    filtroCidade,
    filtroOrgao,
    modoVisualizacao,
    carregouURL
  ]);

  const cidadesDisponiveis = useMemo(() => {
    return Array.from(new Set(editais.map(e => e.cidade))).sort();
  }, [editais]);

  const orgaosDisponiveis = useMemo(() => {
    return Array.from(new Set(editais.map(e => e.orgao))).filter(Boolean).sort();
  }, [editais]);

  const editaisFiltrados = useMemo(() => {
    return editais.filter((edital) => {
      if (filtroAno !== 'todos' && edital.ano !== filtroAno) return false;
      if (filtroCidade !== 'todas' && edital.cidade !== filtroCidade) return false;
      if (filtroOrgao !== 'todos' && edital.orgao !== filtroOrgao) return false;

      const valoresTextuais = [
        edital.cidade, edital.orgao, 
        edital.dadosEnriquecidos?.titulo || edital.titulo, 
        edital.dadosEnriquecidos?.descricao || edital.descricao,
        edital.dadosEnriquecidos?.concurso || edital.concurso,
        edital.dadosEnriquecidos?.dataPublicacao || edital.dataPublicacao,
        edital.metadados, edital.statusGeral
      ].filter(Boolean).join(" ");

      const textoNormalizado = removerAcentos(valoresTextuais);

      const passaDesejadas = palavrasDesejadas.length === 0 || palavrasDesejadas.some(p => textoNormalizado.includes(p));
      const passaIgnoradas = palavrasIgnoradas.length === 0 || !palavrasIgnoradas.some(p => textoNormalizado.includes(p));

      return passaDesejadas && passaIgnoradas;
    });
  }, [editais, palavrasDesejadas, palavrasIgnoradas, filtroAno, filtroCidade, filtroOrgao]);

  const concursosAgrupados = useMemo(() => {
    const mapa = new Map<string, Edital[]>();

    editaisFiltrados.forEach((edital) => {
      const concursoFinal = edital.dadosEnriquecidos?.concurso || edital.concurso;
      if (concursoFinal) {
        const chaveUnica = `${edital.cidade}_${edital.orgao}_${concursoFinal}`;
        if (!mapa.has(chaveUnica)) mapa.set(chaveUnica, []);
        mapa.get(chaveUnica)!.push(edital);
      }
    });

    let gruposArray = Array.from(mapa.entries()).map(([chaveUnica, listaEditais]) => {
      const primeiroItem = listaEditais[0];
      const concursoFinal = primeiroItem.dadosEnriquecidos?.concurso || primeiroItem.concurso;
      const dataPublicacaoFinal = primeiroItem.dadosEnriquecidos?.dataPublicacao || primeiroItem.dataPublicacao;
      
      return {
        chaveUnica: chaveUnica,
        nome: concursoFinal as string,
        cidade: primeiroItem.cidade,
        orgao: primeiroItem.orgao,
        ultimaAtualizacao: dataPublicacaoFinal,
        totalItens: listaEditais.length,
        itens: listaEditais,
        linksOrigem: Array.from(new Set(listaEditais.map(e => e.linkOrigem).filter(Boolean))) as string[]
      };
    });

    gruposArray.sort((a, b) => {
      const extrairAnoNumero = (nome: string) => {
        const match = nome.match(/(\d{2})\/(\d{4})/);
        if (!match) return { ano: 0, numero: 0 };
        return { ano: parseInt(match[2], 10), numero: parseInt(match[1], 10) };
      };

      const valA = extrairAnoNumero(a.nome);
      const valB = extrairAnoNumero(b.nome);

      if (valB.ano !== valA.ano) return valB.ano - valA.ano;
      return valB.numero - valA.numero;
    });

    if (filtroTipoGrupo === 'concurso') {
      gruposArray = gruposArray.filter(g => g.nome.toUpperCase().includes('CONCURSO'));
    } else if (filtroTipoGrupo === 'seletivo') {
      gruposArray = gruposArray.filter(g => g.nome.toUpperCase().includes('PROCESSO SELETIVO'));
    }

    return gruposArray;
  }, [editaisFiltrados, filtroTipoGrupo]);

  const grupoAtual = concursosAgrupados.find(c => c.chaveUnica === concursoSelecionado);
  const totalPaginas = Math.ceil(editaisFiltrados.length / ITENS_POR_PAGINA);
  const indexInicio = (paginaAtual - 1) * ITENS_POR_PAGINA;
  const editaisDaPaginaLista = editaisFiltrados.slice(indexInicio, indexInicio + ITENS_POR_PAGINA);

  function handleUpdateCityData(cidadeAlvo: string, novosEditais: Edital[]) {
    setEditais((prev) => {
      const isCamara = cidadeAlvo.includes('(Câmara)');
      const cidadeReal = cidadeAlvo.replace(' (Câmara)', '').trim();
      const orgaoReal = isCamara ? 'Câmara Municipal' : 'Prefeitura';

      const dadosOutrasCidades = prev.filter(e => !(e.cidade === cidadeReal && e.orgao === orgaoReal));

      const novaLista = [...dadosOutrasCidades, ...novosEditais];
      novaLista.sort((a, b) => {
        if (b.dataTimestamp !== a.dataTimestamp) return b.dataTimestamp - a.dataTimestamp;
        return (a.ordemOriginal || 0) - (b.ordemOriginal || 0);
      });
      return novaLista;
    });

    setConcursoSelecionado(null);
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6 md:p-8 text-slate-800 relative">
      <div className="max-w-4xl mx-auto">
        <Header
          loading={loading}
          hasData={editaisFiltrados.length > 0}
          onExport={() => exportarParaJSON(editaisFiltrados, 'meus-editais')}
          onUpdate={carregarDados} // Se ele clicar aqui, só puxa os dados recentes da Nuvem!
          ultimaAtualizacao={ultimaAtualizacao}
        />

        {alertas.length > 0 && !loading && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-sm">
            <div>
              <p className="font-bold flex items-center gap-2 text-sm sm:text-base">
                ⚠️ Atenção: Problemas na raspagem das seguintes fontes:
              </p>
              <ul className="list-disc list-inside text-xs mt-1.5 text-amber-700 pl-2 space-y-0.5">
                {alertas.map((alerta, idx) => (
                  <li key={idx} className="font-medium">{alerta}</li>
                ))}
              </ul>
            </div>
            <button
              onClick={refazerCidadesComFalha}
              disabled={isRefleshingFailed}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50 self-start sm:self-center shrink-0 animate-pulse"
            >
              {isRefleshingFailed ? (
                <>
                  <span className="animate-spin inline-block">🔄</span>
                  Reprocessando...
                </>
              ) : (
                <>
                  <span>🔄</span>
                  Reprocessar Falhas na Nuvem
                </>
              )}
            </button>
          </div>
        )}

        <FilterPanel
          palavrasDesejadas={palavrasDesejadas} setPalavrasDesejadas={setPalavrasDesejadas}
          palavrasIgnoradas={palavrasIgnoradas} setPalavrasIgnoradas={setPalavrasIgnoradas}
        />

        {erroFatal && <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-6 text-center shadow-sm">{erroFatal}</div>}

        <ControlsBar
          modoVisualizacao={modoVisualizacao} setModoVisualizacao={setModoVisualizacao}
          onClearSelection={() => setConcursoSelecionado(null)}
          filtroCidade={filtroCidade} setFiltroCidade={setFiltroCidade} cidadesDisponiveis={cidadesDisponiveis}
          filtroOrgao={filtroOrgao} setFiltroOrgao={setFiltroOrgao} orgaosDisponiveis={orgaosDisponiveis}
          filtroAno={filtroAno} setFiltroAno={setFiltroAno} anosDisponiveis={anosDisponiveis}
        />

        {loading ? (
          <div className="text-center p-8 text-slate-500 font-medium animate-pulse">Carregando dados da nuvem...</div>
        ) : editaisFiltrados.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-xl border border-slate-200 p-6 rounded-xl text-center text-slate-500 shadow-sm">Nenhum edital encontrado com esses filtros.</div>
        ) : modoVisualizacao === 'lista' ? (
          <ListView
            editais={editaisDaPaginaLista}
            totalFiltrados={editaisFiltrados.length}
            paginaAtual={paginaAtual} setPaginaAtual={setPaginaAtual} totalPaginas={totalPaginas}
          />
        ) : concursoSelecionado && grupoAtual ? (
          <FolderDetailView
            grupo={grupoAtual}
            onBack={() => setConcursoSelecionado(null)}
            onUpdateGlobal={(link, novosDados) => {
              setEditais(prev => prev.map(e => {
                if (e.link === link) {
                  const newE = { ...e };
                  if (novosDados === null) {
                    delete newE.dadosEnriquecidos;
                  } else {
                    newE.dadosEnriquecidos = novosDados;
                  }
                  return newE;
                }
                return e;
              }));
            }}
          />
        ) : (
          <FolderView
            concursosAgrupados={concursosAgrupados}
            filtroTipoGrupo={filtroTipoGrupo} setFiltroTipoGrupo={setFiltroTipoGrupo}
            onSelectFolder={setConcursoSelecionado}
          />
        )}
      </div>

      <DevToolsPanel
        todasCidades={TODAS_CIDADES}
        concursosAgrupados={concursosAgrupados}
        onUpdateCityData={handleUpdateCityData}
        onScrapeAndSave={rasparESalvarNaNuvem}
        isSavingToCloud={isSavingToCloud}
        onCreateNewDb={criarNovoBancoNaNuvem}
        isCreatingNewDb={isCreatingNewDb}
      />

    </main>
  );
}