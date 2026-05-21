// src/app/page.tsx
'use client'

import { useState, useEffect, useMemo } from 'react';
import { buscarTodosEditais, auditarQuantidadesInstar, extrairDadosRawInstar, Discrepancia } from './actions';
import { Edital } from '../types';
import EditalCard from '../components/EditalCard';
import FilterPanel from '../components/FilterPanel';
import { exportarParaJSON } from '../utils/exportJson';

export const maxDuration = 60;

function removerAcentos(texto: string) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function formatarNomeArquivo(nome: string) {
  return nome.replace(/[\/\s]/g, '-').toLowerCase();
}

// LIMITE DO ANO AJUSTADO PARA 2017
const anoAtual = new Date().getFullYear();
const anosDisponiveis = Array.from({ length: anoAtual - 2017 + 1 }, (_, i) => anoAtual - i);

export default function Home() {
  const [editais, setEditais] = useState<Edital[]>([]);
  const [loading, setLoading] = useState(true);
  const [erroFatal, setErroFatal] = useState('');
  const [alertas, setAlertas] = useState<string[]>([]);

  const [palavrasDesejadas, setPalavrasDesejadas] = useState<string[]>([]);
  const [palavrasIgnoradas, setPalavrasIgnoradas] = useState<string[]>([]);

  const [modoVisualizacao, setModoVisualizacao] = useState<'lista' | 'agrupado'>('lista');
  const [concursoSelecionado, setConcursoSelecionado] = useState<string | null>(null);
  const [filtroTipoGrupo, setFiltroTipoGrupo] = useState<'todos' | 'concurso' | 'seletivo'>('todos');

  // ESTADOS FIXOS: Ano e Cidade
  const [filtroAno, setFiltroAno] = useState<number | 'todos'>('todos');
  const [filtroCidade, setFiltroCidade] = useState<string | 'todas'>('todas');

  const [paginaAtual, setPaginaAtual] = useState(1);
  const ITENS_POR_PAGINA = 10;

  // ESTADOS DO AUDITOR E RAW SCRAPER (MODO DEV)
  const [auditando, setAuditando] = useState(false);
  const [resultadoAuditoria, setResultadoAuditoria] = useState<Discrepancia[] | null>(null);
  const [urlRaw, setUrlRaw] = useState('');
  const [isRawScraping, setIsRawScraping] = useState(false);

  async function carregarDados() {
    setLoading(true);
    setErroFatal('');
    setAlertas([]);
    try {
      const resultado = await buscarTodosEditais();
      setEditais(resultado.editais);
      setAlertas(resultado.falhas);
      setPaginaAtual(1);
    } catch (e) {
      setErroFatal('Ocorreu um erro fatal de conexão. Tente novamente mais tarde.');
    }
    setLoading(false);
  }

  useEffect(() => { carregarDados() }, []);

  useEffect(() => {
    setPaginaAtual(1);
    if (modoVisualizacao === 'agrupado') setConcursoSelecionado(null);
  }, [palavrasDesejadas, palavrasIgnoradas, filtroAno, filtroCidade]);

  // GERA A LISTA DE CIDADES DINAMICAMENTE
  const cidadesDisponiveis = useMemo(() => {
    const cidades = new Set(editais.map(e => e.cidade));
    return Array.from(cidades).sort();
  }, [editais]);

  // ==============================================================
  // LÓGICA DE FILTROS COM PRIORIDADE (Short-circuit Evaluation)
  // ==============================================================
  const editaisFiltrados = useMemo(() => {
    return editais.filter((edital) => {
      const passaFiltroAno = filtroAno === 'todos' || edital.ano === filtroAno;
      const passaFiltroCidade = filtroCidade === 'todas' || edital.cidade === filtroCidade;

      if (!passaFiltroAno || !passaFiltroCidade) return false;

      const valoresTextuais = [
        edital.cidade, edital.orgao, edital.titulo, edital.descricao,
        edital.metadados, edital.statusGeral, edital.dataPublicacao
      ].filter(Boolean).join(" ");

      const textoNormalizado = removerAcentos(valoresTextuais);

      const passaDesejadas = palavrasDesejadas.length === 0 || palavrasDesejadas.some(p => textoNormalizado.includes(p));
      const passaIgnoradas = palavrasIgnoradas.length === 0 || !palavrasIgnoradas.some(p => textoNormalizado.includes(p));

      return passaDesejadas && passaIgnoradas;
    });
  }, [editais, palavrasDesejadas, palavrasIgnoradas, filtroAno, filtroCidade]);

  // ==============================================================
  // AGRUPAMENTO DE CONCURSOS
  // ==============================================================
  const concursosAgrupados = useMemo(() => {
    const mapa = new Map<string, Edital[]>();

    editaisFiltrados.forEach((edital) => {
      if (edital.concurso) {
        const chaveUnica = `${edital.cidade}_${edital.concurso}`;
        if (!mapa.has(chaveUnica)) {
          mapa.set(chaveUnica, []);
        }
        mapa.get(chaveUnica)!.push(edital);
      }
    });

    let gruposArray = Array.from(mapa.entries()).map(([chaveUnica, listaEditais]) => ({
      chaveUnica: chaveUnica,
      nome: listaEditais[0].concurso as string,
      cidade: listaEditais[0].cidade,
      orgao: listaEditais[0].orgao,
      ultimaAtualizacao: listaEditais[0].dataPublicacao,
      totalItens: listaEditais.length,
      itens: listaEditais,
      linksOrigem: Array.from(new Set(listaEditais.map(e => e.linkOrigem).filter(Boolean))) as string[]
    }));

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

  // ==============================================================
  // FUNÇÕES DO MODO DESENVOLVEDOR (QA)
  // ==============================================================
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
        temRestricao: g.itens.some(item => item.titulo.includes('Acesso Restrito'))
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

  return (
    <main className="min-h-screen bg-gray-50 p-8 text-gray-800 relative">
      <div className="max-w-4xl mx-auto">

        <header className="mb-6 flex flex-col md:flex-row md:justify-between md:items-center bg-white p-6 rounded-lg shadow-sm border border-gray-100 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-blue-900">Radar de Concursos 🎯</h1>
            <p className="text-gray-500 mt-1">Monitorando Órgãos Locais e Região</p>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => exportarParaJSON(editaisFiltrados, 'meus-editais')}
              disabled={loading || editaisFiltrados.length === 0}
              className={`px-4 py-3 rounded font-bold transition-colors border ${loading || editaisFiltrados.length === 0 ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50'}`}
              title="Baixar a lista de TODOS os editais filtrados"
            >
              📥 Exportar Tudo
            </button>
            <button
              onClick={carregarDados}
              disabled={loading}
              className={`px-6 py-3 rounded font-bold text-white transition-colors ${loading ? 'bg-blue-300 cursor-wait' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              {loading ? 'Extraindo dados...' : '🔄 Atualizar'}
            </button>
          </div>
        </header>

        {alertas.length > 0 && !loading && (
          <div className="bg-orange-100 border-l-4 border-orange-500 text-orange-800 p-4 rounded mb-6 shadow-sm">
            <p className="font-bold flex items-center gap-2">⚠️ Atenção: Problemas de conexão em: {alertas.join(', ')}.</p>
          </div>
        )}

        <FilterPanel
          palavrasDesejadas={palavrasDesejadas} setPalavrasDesejadas={setPalavrasDesejadas}
          palavrasIgnoradas={palavrasIgnoradas} setPalavrasIgnoradas={setPalavrasIgnoradas}
        />

        {erroFatal && <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-6 text-center">{erroFatal}</div>}

        {/* CONTROLES DE VISÃO E FILTROS FIXOS */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div className="bg-gray-200 p-1 rounded-lg inline-flex w-full md:w-auto overflow-hidden">
            <button
              onClick={() => { setModoVisualizacao('lista'); setConcursoSelecionado(null); }}
              className={`flex-1 md:flex-none px-4 py-2 rounded-md font-semibold text-sm transition-all ${modoVisualizacao === 'lista' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              📋 Ver Tudo
            </button>
            <button
              onClick={() => setModoVisualizacao('agrupado')}
              className={`flex-1 md:flex-none px-4 py-2 rounded-md font-semibold text-sm transition-all ${modoVisualizacao === 'agrupado' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              🗂️ Agrupados
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
            <div className="flex flex-1 md:flex-none items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm">
              <label htmlFor="cidadeFiltro" className="text-sm font-bold text-gray-700">Cidade:</label>
              <select
                id="cidadeFiltro"
                value={filtroCidade}
                onChange={(e) => setFiltroCidade(e.target.value)}
                className="bg-transparent text-sm font-semibold text-blue-700 outline-none cursor-pointer flex-1"
              >
                <option value="todas">Todas as Cidades</option>
                {cidadesDisponiveis.map(cidade => (
                  <option key={cidade} value={cidade}>{cidade}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm">
              <label htmlFor="anoFiltro" className="text-sm font-bold text-gray-700">Ano:</label>
              <select
                id="anoFiltro"
                value={filtroAno}
                onChange={(e) => setFiltroAno(e.target.value === 'todos' ? 'todos' : parseInt(e.target.value, 10))}
                className="bg-transparent text-sm font-semibold text-blue-700 outline-none cursor-pointer"
              >
                <option value="todos">Todos</option>
                {anosDisponiveis.map(ano => (
                  <option key={ano} value={ano}>{ano}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center p-8 text-gray-500 animate-pulse">Lendo páginas e extraindo dados...</div>
        ) : editaisFiltrados.length === 0 ? (
          <div className="bg-white p-6 rounded-lg shadow text-center text-gray-500 border border-gray-100">Nenhum edital encontrado com esses filtros.</div>
        ) : modoVisualizacao === 'lista' ? (

          <div className="space-y-4">
            <p className="text-sm text-gray-500 text-right">Mostrando {editaisFiltrados.length} resultados</p>
            {editaisDaPaginaLista.map((edital, index) => <EditalCard key={index} edital={edital} />)}

            <div className="mt-8 flex justify-center items-center gap-4">
              <button onClick={() => setPaginaAtual(p => Math.max(1, p - 1))} disabled={paginaAtual === 1} className="px-4 py-2 rounded bg-gray-800 text-white disabled:bg-gray-200 disabled:text-gray-400">← Anterior</button>
              <span className="text-gray-600 font-medium">Página {paginaAtual} de {totalPaginas}</span>
              <button onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))} disabled={paginaAtual === totalPaginas} className="px-4 py-2 rounded bg-gray-800 text-white disabled:bg-gray-200 disabled:text-gray-400">Próxima →</button>
            </div>
          </div>

        ) : concursoSelecionado && grupoAtual ? (

          <div className="animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <button
                onClick={() => setConcursoSelecionado(null)}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-semibold transition-colors"
              >
                <span>←</span> Voltar para as Pastas
              </button>

              <button
                onClick={() => exportarParaJSON(grupoAtual.itens, formatarNomeArquivo(`${grupoAtual.cidade}-${grupoAtual.nome}`))}
                className="bg-white text-purple-700 border border-purple-300 hover:bg-purple-50 px-4 py-2 rounded text-sm font-bold shadow-sm transition-colors"
              >
                📥 Baixar Arquivos Deste Concurso
              </button>
            </div>

            <div className="bg-purple-50 border-l-4 border-purple-600 p-6 rounded-lg mb-6 shadow-sm">
              <h2 className="text-2xl font-bold text-purple-900">{grupoAtual.nome}</h2>
              <p className="text-purple-700 mt-1">Todos os {grupoAtual.totalItens} andamentos encontrados para {grupoAtual.cidade}.</p>
            </div>

            <div className="space-y-4">
              {grupoAtual.itens.map((edital, index) => (
                <EditalCard key={index} edital={edital} />
              ))}
            </div>
          </div>

        ) : (

          <div className="animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between sm:items-end mb-4 gap-4">
              <p className="text-sm text-gray-500">
                {concursosAgrupados.length} pastas encontradas
              </p>
              <div className="bg-white border border-gray-200 p-1 rounded inline-flex shadow-sm w-full sm:w-auto overflow-x-auto">
                <button
                  onClick={() => setFiltroTipoGrupo('todos')}
                  className={`flex-1 sm:flex-none px-3 py-1 text-xs font-semibold rounded whitespace-nowrap ${filtroTipoGrupo === 'todos' ? 'bg-gray-100 text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setFiltroTipoGrupo('concurso')}
                  className={`flex-1 sm:flex-none px-3 py-1 text-xs font-semibold rounded whitespace-nowrap ${filtroTipoGrupo === 'concurso' ? 'bg-gray-100 text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Concursos
                </button>
                <button
                  onClick={() => setFiltroTipoGrupo('seletivo')}
                  className={`flex-1 sm:flex-none px-3 py-1 text-xs font-semibold rounded whitespace-nowrap ${filtroTipoGrupo === 'seletivo' ? 'bg-gray-100 text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Procs. Seletivos
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {concursosAgrupados.length === 0 ? (
                <div className="col-span-full bg-white p-6 rounded-lg shadow text-center text-gray-500 border border-gray-100">
                  Nenhum concurso atende ao filtro atual.
                </div>
              ) : (
                concursosAgrupados.map((grupo, idx) => (
                  <div
                    key={idx}
                    onClick={() => setConcursoSelecionado(grupo.chaveUnica)}
                    className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:border-purple-400 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <span className="bg-purple-100 text-purple-800 text-xs font-bold px-3 py-1 rounded-full">
                          🗂️ {grupo.nome}
                        </span>
                        <span className="bg-gray-100 text-gray-600 text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap">
                          {grupo.totalItens} {grupo.totalItens === 1 ? 'item' : 'itens'}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-gray-800 group-hover:text-purple-700 transition-colors">
                        {grupo.nome}
                      </h3>
                    </div>

                    <div className="mt-6 flex flex-col gap-2 text-sm text-gray-500 border-t border-gray-100 pt-4">
                      <div className="flex items-center gap-2">
                        <span>📍</span> {grupo.cidade} - {grupo.orgao}
                      </div>
                      <div className="flex items-center gap-2">
                        <span>🕒</span> <span className="font-semibold text-gray-700">Atualizado em: {grupo.ultimaAtualizacao}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </div>

      {/* ========================================== */}
      {/* 🕵️ PAINEL DO DESENVOLVEDOR (Só no DEV)     */}
      {/* ========================================== */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-6 right-6 flex flex-col items-end z-50 gap-4">

          {/* 🛠️ FERRAMENTA 2: RAW SCRAPER */}
          <div className="bg-white border-2 border-purple-500 p-4 rounded-lg shadow-xl w-96 animate-fade-in">
            <h3 className="font-bold text-purple-700 mb-2">🛠️ Raio-X Instar (Raw)</h3>
            <p className="text-xs text-gray-500 mb-3">Puxa todos os metadados de uma página de listagem sem aplicar nenhum filtro.</p>
            <input
              type="text"
              placeholder="Ex: https://.../numero-ano-processo-decrescente/0"
              value={urlRaw}
              onChange={(e) => setUrlRaw(e.target.value)}
              className="border border-purple-200 p-2 w-full text-xs rounded mb-2 outline-none focus:border-purple-600"
            />
            <button
              onClick={rodarRawScraper}
              disabled={isRawScraping || !urlRaw}
              className="bg-purple-600 text-white w-full py-2 rounded text-sm font-bold disabled:bg-gray-400 hover:bg-purple-700 transition-colors"
            >
              {isRawScraping ? '⏳ Extraindo Dados...' : 'Extrair e Baixar JSON'}
            </button>
          </div>

          {/* 🕵️ FERRAMENTA 1: AUDITOR */}
          <div className="flex flex-col items-end">
            {resultadoAuditoria && (
              <div className="bg-white border-2 border-red-500 p-4 rounded-lg shadow-xl mb-4 w-96 max-h-[50vh] overflow-y-auto animate-fade-in">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-red-700">🕵️ Relatório de Auditoria</h3>
                  <button onClick={() => setResultadoAuditoria(null)} className="text-gray-400 hover:text-black">✖</button>
                </div>

                {resultadoAuditoria.length === 0 ? (
                  <p className="text-sm text-green-600 font-bold">Tudo perfeito! O sistema extraiu 100% dos arquivos.</p>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600">Atenção, estas pastas estão faltando arquivos (foram barrados pelo filtro ou houve falha):</p>
                    {resultadoAuditoria.map((disc, idx) => (
                      <div key={idx} className="bg-red-50 p-3 rounded border border-red-100 text-sm">
                        <p className="font-bold text-red-900">{disc.cidade} - {disc.concurso}</p>
                        <div className="flex justify-between mt-2 font-medium">
                          <span className="text-green-700">Temos: {disc.qtdNossa}</span>
                          <span className="text-blue-700">Site diz: {disc.qtdSite}</span>
                        </div>
                        <div className="mt-2 space-y-1">
                          {disc.linksOrigem.map((link, lIdx) => (
                            <a key={lIdx} href={link} target="_blank" rel="noopener noreferrer" className="text-xs text-red-600 underline block">
                              Abrir pasta {lIdx + 1} no site
                            </a>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={rodarAuditoria}
              disabled={auditando || concursosAgrupados.length === 0}
              className={`px-4 py-3 rounded-full font-bold shadow-lg flex items-center gap-2 transition-all ${auditando ? 'bg-gray-300 text-gray-600' : 'bg-black text-white hover:bg-gray-800 hover:-translate-y-1'}`}
            >
              {auditando ? '⏳ Auditando...' : '🕵️ Auditar Instar'}
            </button>
          </div>

        </div>
      )}
    </main>
  );
}