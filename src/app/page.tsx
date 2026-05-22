// src/app/page.tsx
'use client'

import { useState, useEffect, useMemo, useRef } from 'react';
import { buscarTodosEditais } from './actions';
import { Edital } from '../types';
import { exportarParaJSON } from '../utils/exportJson';

// Componentes Modularizados
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

const anoAtual = new Date().getFullYear();
const anosDisponiveis = Array.from({ length: anoAtual - 2017 + 1 }, (_, i) => anoAtual - i);

const TODAS_CIDADES = [
  'Fernandópolis', 'Votuporanga', 'Ouroeste', 'Jales', 'Macedônia',
  "Estrela d'Oeste", 'Meridiano', 'São João das Duas Pontes', 'Pedranópolis',
  'Mira Estrela', 'Indiaporã', 'Álvares Florence', 'Parisi', 'Valentim Gentil',
  'Vitória Brasil', "Guarani d'Oeste", 'Urânia', 'Dolcinópolis', 'Pontalinda', 'Santa Salete'
].sort();

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

  const [filtroAno, setFiltroAno] = useState<number | 'todos'>('todos');
  const [filtroCidade, setFiltroCidade] = useState<string | 'todas'>('todas');

  const [paginaAtual, setPaginaAtual] = useState(1);
  const ITENS_POR_PAGINA = 10;

  const fetchIniciado = useRef(false);

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

  useEffect(() => {
    if (!fetchIniciado.current) {
      fetchIniciado.current = true;
      carregarDados();
    }
  }, []);

  useEffect(() => {
    setPaginaAtual(1);
    if (modoVisualizacao === 'agrupado') setConcursoSelecionado(null);
  }, [palavrasDesejadas, palavrasIgnoradas, filtroAno, filtroCidade, modoVisualizacao]);

  const cidadesDisponiveis = useMemo(() => {
    return Array.from(new Set(editais.map(e => e.cidade))).sort();
  }, [editais]);

  const editaisFiltrados = useMemo(() => {
    return editais.filter((edital) => {
      if (filtroAno !== 'todos' && edital.ano !== filtroAno) return false;
      if (filtroCidade !== 'todas' && edital.cidade !== filtroCidade) return false;

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

  const concursosAgrupados = useMemo(() => {
    const mapa = new Map<string, Edital[]>();

    editaisFiltrados.forEach((edital) => {
      if (edital.concurso) {
        const chaveUnica = `${edital.cidade}_${edital.orgao}_${edital.concurso}`;
        if (!mapa.has(chaveUnica)) mapa.set(chaveUnica, []);
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

  function handleUpdateCityData(cidadeAlvo: string, novosEditais: Edital[]) {
    setEditais((prev) => {
      const dadosOutrasCidades = prev.filter(e => e.cidade !== cidadeAlvo);
      const novaLista = [...dadosOutrasCidades, ...novosEditais];
      novaLista.sort((a, b) => {
        if (b.dataTimestamp !== a.dataTimestamp) return b.dataTimestamp - a.dataTimestamp;
        return (a.ordemOriginal || 0) - (b.ordemOriginal || 0);
      });
      return novaLista;
    });
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8 text-gray-800 relative">
      <div className="max-w-4xl mx-auto">
        <Header
          loading={loading}
          hasData={editaisFiltrados.length > 0}
          onExport={() => exportarParaJSON(editaisFiltrados, 'meus-editais')}
          onUpdate={carregarDados}
        />

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

        <ControlsBar
          modoVisualizacao={modoVisualizacao} setModoVisualizacao={setModoVisualizacao}
          onClearSelection={() => setConcursoSelecionado(null)}
          filtroCidade={filtroCidade} setFiltroCidade={setFiltroCidade} cidadesDisponiveis={cidadesDisponiveis}
          filtroAno={filtroAno} setFiltroAno={setFiltroAno} anosDisponiveis={anosDisponiveis}
        />

        {loading ? (
          <div className="text-center p-8 text-gray-500 animate-pulse">Lendo páginas e extraindo dados...</div>
        ) : editaisFiltrados.length === 0 ? (
          <div className="bg-white p-6 rounded-lg shadow text-center text-gray-500 border border-gray-100">Nenhum edital encontrado com esses filtros.</div>
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
      />
    </main>
  );
}