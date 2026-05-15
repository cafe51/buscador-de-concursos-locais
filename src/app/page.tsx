'use client'

import { useState, useEffect, useMemo } from 'react';
import { buscarTodosEditais } from './actions';
import { Edital } from '../types';
import EditalCard from '../components/EditalCard';
import FilterPanel from '../components/FilterPanel';
import { exportarParaJSON } from '../utils/exportJson';

export const maxDuration = 60;

function removerAcentos(texto: string) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// Formata o nome para arquivo (evita que a barra "/" quebre o download)
function formatarNomeArquivo(nome: string) {
  return nome.replace(/[\/\s]/g, '-').toLowerCase();
}

export default function Home() {
  const [editais, setEditais] = useState<Edital[]>([]);
  const [loading, setLoading] = useState(true);
  const [erroFatal, setErroFatal] = useState('');
  const [alertas, setAlertas] = useState<string[]>([]);

  const [palavrasDesejadas, setPalavrasDesejadas] = useState<string[]>([]);
  const [palavrasIgnoradas, setPalavrasIgnoradas] = useState<string[]>([]);

  // ESTADOS DE NAVEGAÇÃO E VISUALIZAÇÃO
  const [modoVisualizacao, setModoVisualizacao] = useState<'lista' | 'agrupado'>('lista');
  const [concursoSelecionado, setConcursoSelecionado] = useState<string | null>(null);

  // 2. O NOVO ESTADO: Filtro Triplo para as Pastas
  const [filtroTipoGrupo, setFiltroTipoGrupo] = useState<'todos' | 'concurso' | 'seletivo'>('todos');

  const [paginaAtual, setPaginaAtual] = useState(1);
  const ITENS_POR_PAGINA = 10;

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
  }, [palavrasDesejadas, palavrasIgnoradas]);

  // APLICAÇÃO DOS FILTROS GERAIS (Palavras chave)
  const editaisFiltrados = useMemo(() => {
    return editais.filter((edital) => {
      const valoresTextuais = [
        edital.cidade, edital.orgao, edital.titulo, edital.descricao,
        edital.metadados, edital.statusGeral, edital.dataPublicacao
      ].filter(Boolean).join(" ");

      const textoNormalizado = removerAcentos(valoresTextuais);

      const passaDesejadas = palavrasDesejadas.length === 0 || palavrasDesejadas.some(p => textoNormalizado.includes(p));
      const passaIgnoradas = palavrasIgnoradas.length === 0 || !palavrasIgnoradas.some(p => textoNormalizado.includes(p));

      return passaDesejadas && passaIgnoradas;
    });
  }, [editais, palavrasDesejadas, palavrasIgnoradas]);

  // AGRUPAMENTO DE CONCURSOS
  const concursosAgrupados = useMemo(() => {
    const mapa = new Map<string, Edital[]>();

    editaisFiltrados.forEach((edital) => {
      if (edital.concurso) {
        if (!mapa.has(edital.concurso)) {
          mapa.set(edital.concurso, []);
        }
        mapa.get(edital.concurso)!.push(edital);
      }
    });

    let gruposArray = Array.from(mapa.entries()).map(([nomeConcurso, listaEditais]) => ({
      nome: nomeConcurso,
      cidade: listaEditais[0].cidade,
      orgao: listaEditais[0].orgao,
      ultimaAtualizacao: listaEditais[0].dataPublicacao,
      totalItens: listaEditais.length,
      itens: listaEditais
    }));

    // 3. A NOVA ORDENAÇÃO: Lendo o número e o ano no nome da pasta
    gruposArray.sort((a, b) => {
      // Usa regex para extrair o ano e o número do formato "01/2023"
      const extrairAnoNumero = (nome: string) => {
        const match = nome.match(/(\d{2})\/(\d{4})/);
        if (!match) return { ano: 0, numero: 0 };
        return { ano: parseInt(match[2], 10), numero: parseInt(match[1], 10) };
      };

      const valA = extrairAnoNumero(a.nome);
      const valB = extrairAnoNumero(b.nome);

      // Desempate: Se o ano for diferente, o maior ano (mais novo) fica em cima
      if (valB.ano !== valA.ano) {
        return valB.ano - valA.ano;
      }
      // Se for o mesmo ano, o maior número do edital fica em cima
      return valB.numero - valA.numero;
    });

    // 2. APLICA O FILTRO TRIPLO
    if (filtroTipoGrupo === 'concurso') {
      gruposArray = gruposArray.filter(g => g.nome.toUpperCase().includes('CONCURSO'));
    } else if (filtroTipoGrupo === 'seletivo') {
      gruposArray = gruposArray.filter(g => g.nome.toUpperCase().includes('PROCESSO SELETIVO'));
    }

    return gruposArray;
  }, [editaisFiltrados, filtroTipoGrupo]);

  const grupoAtual = concursosAgrupados.find(c => c.nome === concursoSelecionado);

  const totalPaginas = Math.ceil(editaisFiltrados.length / ITENS_POR_PAGINA);
  const indexInicio = (paginaAtual - 1) * ITENS_POR_PAGINA;
  const editaisDaPaginaLista = editaisFiltrados.slice(indexInicio, indexInicio + ITENS_POR_PAGINA);

  return (
    <main className="min-h-screen bg-gray-50 p-8 text-gray-800">
      <div className="max-w-4xl mx-auto">

        <header className="mb-6 flex justify-between items-center bg-white p-6 rounded-lg shadow-sm border border-gray-100">
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
            <p className="font-bold">⚠️ Atenção: Problemas de conexão em: {alertas.join(', ')}.</p>
          </div>
        )}

        <FilterPanel
          palavrasDesejadas={palavrasDesejadas} setPalavrasDesejadas={setPalavrasDesejadas}
          palavrasIgnoradas={palavrasIgnoradas} setPalavrasIgnoradas={setPalavrasIgnoradas}
        />

        {erroFatal && <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-6 text-center">{erroFatal}</div>}

        <div className="flex justify-center mb-8">
          <div className="bg-gray-200 p-1 rounded-lg inline-flex">
            <button
              onClick={() => { setModoVisualizacao('lista'); setConcursoSelecionado(null); }}
              className={`px-6 py-2 rounded-md font-semibold text-sm transition-all ${modoVisualizacao === 'lista' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              📋 Ver Tudo (Lista)
            </button>
            <button
              onClick={() => setModoVisualizacao('agrupado')}
              className={`px-6 py-2 rounded-md font-semibold text-sm transition-all ${modoVisualizacao === 'agrupado' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              🗂️ Agrupado por Concurso
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center p-8 text-gray-500 animate-pulse">Lendo páginas e extraindo dados...</div>
        ) : editaisFiltrados.length === 0 ? (
          <div className="bg-white p-6 rounded-lg shadow text-center text-gray-500">Nenhum edital encontrado com esses filtros.</div>
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
            {/* CABEÇALHO DO GRUPO (Com Botão de Voltar e Exportar) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <button
                onClick={() => setConcursoSelecionado(null)}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-semibold transition-colors"
              >
                <span>←</span> Voltar para as Pastas
              </button>

              {/* 1. O NOVO BOTÃO DE EXPORTAR O GRUPO ESPECÍFICO */}
              <button
                onClick={() => exportarParaJSON(grupoAtual.itens, formatarNomeArquivo(grupoAtual.nome))}
                className="bg-white text-purple-700 border border-purple-300 hover:bg-purple-50 px-4 py-2 rounded text-sm font-bold shadow-sm transition-colors"
                title={`Baixar o JSON apenas com os itens do ${grupoAtual.nome}`}
              >
                📥 Baixar Arquivos Deste Concurso
              </button>
            </div>

            <div className="bg-purple-50 border-l-4 border-purple-600 p-6 rounded-lg mb-6 shadow-sm">
              <h2 className="text-2xl font-bold text-purple-900">{grupoAtual.nome}</h2>
              <p className="text-purple-700 mt-1">Todos os {grupoAtual.totalItens} andamentos encontrados para este certame.</p>
            </div>

            <div className="space-y-4">
              {grupoAtual.itens.map((edital, index) => (
                <EditalCard key={index} edital={edital} />
              ))}
            </div>
          </div>

        ) : (

          <div className="animate-fade-in">
            {/* 2. O NOVO FILTRO TRIPLO DE PASTAS */}
            <div className="flex justify-between items-end mb-4">
              <p className="text-sm text-gray-500">
                {concursosAgrupados.length} pastas encontradas
              </p>
              <div className="bg-white border border-gray-200 p-1 rounded inline-flex shadow-sm">
                <button
                  onClick={() => setFiltroTipoGrupo('todos')}
                  className={`px-3 py-1 text-xs font-semibold rounded ${filtroTipoGrupo === 'todos' ? 'bg-gray-100 text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setFiltroTipoGrupo('concurso')}
                  className={`px-3 py-1 text-xs font-semibold rounded ${filtroTipoGrupo === 'concurso' ? 'bg-gray-100 text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Concursos
                </button>
                <button
                  onClick={() => setFiltroTipoGrupo('seletivo')}
                  className={`px-3 py-1 text-xs font-semibold rounded ${filtroTipoGrupo === 'seletivo' ? 'bg-gray-100 text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Procs. Seletivos
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {concursosAgrupados.length === 0 ? (
                <div className="col-span-full bg-white p-6 rounded-lg shadow text-center text-gray-500">
                  Nenhum concurso atende ao filtro atual.
                </div>
              ) : (
                concursosAgrupados.map((grupo, idx) => (
                  <div
                    key={idx}
                    onClick={() => setConcursoSelecionado(grupo.nome)}
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
    </main>
  );
}