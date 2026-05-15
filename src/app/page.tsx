'use client'

import { useState, useEffect } from 'react';
import { buscarTodosEditais } from './actions';
import { Edital } from '../types';
import EditalCard from '../components/EditalCard';
import FilterPanel from '../components/FilterPanel';
import { exportarParaJSON } from '../utils/exportJson'; // <-- MÓDULO IMPORTADO AQUI

export const maxDuration = 60;

function removerAcentos(texto: string) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export default function Home() {
  const [editais, setEditais] = useState<Edital[]>([]);
  const [loading, setLoading] = useState(true);
  const [erroFatal, setErroFatal] = useState('');
  const [alertas, setAlertas] = useState<string[]>([]);

  const [palavrasDesejadas, setPalavrasDesejadas] = useState<string[]>([]);
  const [palavrasIgnoradas, setPalavrasIgnoradas] = useState<string[]>([]);

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
  useEffect(() => { setPaginaAtual(1) }, [palavrasDesejadas, palavrasIgnoradas]);

  // Aplicação dos Filtros
  const editaisFiltrados = editais.filter((edital) => {
    const valoresTextuais = [
      edital.cidade,
      edital.orgao,
      edital.titulo,
      edital.descricao,
      edital.metadados,
      edital.statusGeral,
      edital.dataPublicacao
    ].filter(Boolean).join(" ");

    const textoNormalizado = removerAcentos(valoresTextuais);

    const passaDesejadas = palavrasDesejadas.length === 0 || palavrasDesejadas.some(p => textoNormalizado.includes(p));
    const passaIgnoradas = palavrasIgnoradas.length === 0 || !palavrasIgnoradas.some(p => textoNormalizado.includes(p));

    return passaDesejadas && passaIgnoradas;
  });

  const totalPaginas = Math.ceil(editaisFiltrados.length / ITENS_POR_PAGINA);
  const indexInicio = (paginaAtual - 1) * ITENS_POR_PAGINA;
  const editaisDaPagina = editaisFiltrados.slice(indexInicio, indexInicio + ITENS_POR_PAGINA);

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
              // AQUI CHAMAMOS O MÓDULO PASSANDO O ARRAY FILTRADO
              onClick={() => exportarParaJSON(editaisFiltrados, 'meus-editais')}
              disabled={loading || editaisFiltrados.length === 0}
              className={`px-4 py-3 rounded font-bold transition-colors border ${loading || editaisFiltrados.length === 0 ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50'}`}
              title="Baixar a lista que você está vendo na tela em JSON"
            >
              📥 Exportar JSON
            </button>

            <button
              onClick={carregarDados}
              disabled={loading}
              className={`px-6 py-3 rounded font-bold text-white transition-colors ${loading ? 'bg-blue-300 cursor-wait' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              {loading ? 'Extraindo dados...' : '🔄 Buscar Novidades'}
            </button>
          </div>
        </header>

        {alertas.length > 0 && !loading && (
          <div className="bg-orange-100 border-l-4 border-orange-500 text-orange-800 p-4 rounded mb-6 shadow-sm">
            <p className="font-bold flex items-center gap-2">⚠️ Atenção: Problemas de conexão com alguns órgãos</p>
            <p className="text-sm mt-1">Mostrando os dados dos outros municípios, mas não foi possível atualizar: <strong>{alertas.join(', ')}</strong>.</p>
          </div>
        )}

        <FilterPanel
          palavrasDesejadas={palavrasDesejadas} setPalavrasDesejadas={setPalavrasDesejadas}
          palavrasIgnoradas={palavrasIgnoradas} setPalavrasIgnoradas={setPalavrasIgnoradas}
        />

        {erroFatal && <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-6 text-center">{erroFatal}</div>}

        <div className="space-y-4">
          <p className="text-sm text-gray-500 text-right">Mostrando {editaisFiltrados.length} resultados</p>

          {loading ? (
            <div className="text-center p-8 text-gray-500 animate-pulse">Lendo páginas e extraindo datas de PDFs...</div>
          ) : editaisDaPagina.length === 0 ? (
            <div className="bg-white p-6 rounded-lg shadow text-center text-gray-500">Nenhum edital encontrado.</div>
          ) : (
            editaisDaPagina.map((edital, index) => <EditalCard key={index} edital={edital} />)
          )}
        </div>

        {!loading && editaisFiltrados.length > 0 && (
          <div className="mt-8 flex justify-center items-center gap-4">
            <button onClick={() => setPaginaAtual(p => Math.max(1, p - 1))} disabled={paginaAtual === 1} className="px-4 py-2 rounded bg-gray-800 text-white disabled:bg-gray-200 disabled:text-gray-400">← Anterior</button>
            <span className="text-gray-600 font-medium">Página {paginaAtual} de {totalPaginas}</span>
            <button onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))} disabled={paginaAtual === totalPaginas} className="px-4 py-2 rounded bg-gray-800 text-white disabled:bg-gray-200 disabled:text-gray-400">Próxima →</button>
          </div>
        )}

      </div>
    </main>
  );
}