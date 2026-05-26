// src/app/page.tsx
'use client'

import { useState, useEffect, useMemo, useRef } from 'react';
// 🚀 Importações do banco de dados adicionadas
import { carregarDoBanco } from './actions';
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

  const fetchIniciado = useRef(false);

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
      setPaginaAtual(1);
    } catch (e) {
      setErroFatal('Ocorreu um erro ao conectar ao banco de dados.');
    }
    setLoading(false);
  }

  // 🚀 A FUNÇÃO DO MODO DESENVOLVEDOR (Raspa a internet inteira e salva no Banco)
  async function rasparESalvarNaNuvem() {
    setIsSavingToCloud(true);
    try {
      // Importamos a nova função
      const { buscarTodosEditais, sincronizarBanco } = await import('./actions');

      const resultado = await buscarTodosEditais();
      setAlertas(resultado.falhas);

      // Envia os dados frescos para fundir com os antigos na nuvem
      const syncResult = await sincronizarBanco(resultado.editais);

      if (syncResult.sucesso) {
        alert(`✅ Sincronização Concluída!\n\n📈 Novos Itens Adicionados: ${syncResult.adicionados}\n🔄 Itens Atualizados: ${syncResult.atualizados.length}\n\nAbra o terminal do seu servidor para ver o relatório completo de alterações.`);

        // Recarrega os dados do banco recém-atualizado para a tela do usuário
        carregarDados();
      } else {
        alert("❌ Erro ao salvar na Nuvem. Verifique o console.");
      }
    } catch (e) {
      alert("❌ Falha crítica ao raspar as cidades.");
    }
    setIsSavingToCloud(false);
  }

  // 🚀 NOVA FUNÇÃO: ZERAR E CRIAR NOVO BANCO
  async function criarNovoBancoNaNuvem() {
    if (!confirm("⚠️ ATENÇÃO: Isso vai apagar todo o banco atual e recriar apenas com os dados que forem encontrados agora. Deseja continuar?")) return;
    
    setIsCreatingNewDb(true);
    try {
      const { buscarTodosEditais, sincronizarBanco } = await import('./actions');
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

  useEffect(() => {
    if (!fetchIniciado.current) {
      fetchIniciado.current = true;
      carregarDados();
    }
  }, []);

  useEffect(() => {
    setPaginaAtual(1);
    if (modoVisualizacao === 'agrupado') setConcursoSelecionado(null);
  }, [palavrasDesejadas, palavrasIgnoradas, filtroAno, filtroCidade, filtroOrgao, modoVisualizacao]);

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
        edital.cidade, edital.orgao, edital.titulo, edital.descricao,
        edital.metadados, edital.statusGeral, edital.dataPublicacao
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
    <main className="min-h-screen bg-gray-50 p-8 text-gray-800 relative">
      <div className="max-w-4xl mx-auto">
        <Header
          loading={loading}
          hasData={editaisFiltrados.length > 0}
          onExport={() => exportarParaJSON(editaisFiltrados, 'meus-editais')}
          onUpdate={carregarDados} // Se ele clicar aqui, só puxa os dados recentes da Nuvem!
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
          filtroOrgao={filtroOrgao} setFiltroOrgao={setFiltroOrgao} orgaosDisponiveis={orgaosDisponiveis}
          filtroAno={filtroAno} setFiltroAno={setFiltroAno} anosDisponiveis={anosDisponiveis}
        />

        {loading ? (
          <div className="text-center p-8 text-gray-500 animate-pulse">Carregando dados da nuvem...</div>
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
        onScrapeAndSave={rasparESalvarNaNuvem} // 🚀 Função Injetada!
        isSavingToCloud={isSavingToCloud}
        onCreateNewDb={criarNovoBancoNaNuvem}
        isCreatingNewDb={isCreatingNewDb}
      />

    </main>
  );
}