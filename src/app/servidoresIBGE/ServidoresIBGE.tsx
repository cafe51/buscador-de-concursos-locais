'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown, ChevronUp, ExternalLink, ArrowUpRight, Search } from 'lucide-react'

const ESTADOS_MAP: Record<string, string> = {
  'AC': 'Acre', 'AL': 'Alagoas', 'AP': 'Amapá', 'AM': 'Amazonas',
  'BA': 'Bahia', 'CE': 'Ceará', 'DF': 'Distrito Federal', 'ES': 'Espírito Santo',
  'GO': 'Goiás', 'MA': 'Maranhão', 'MT': 'Mato Grosso', 'MS': 'Mato Grosso do Sul',
  'MG': 'Minas Gerais', 'PA': 'Pará', 'PB': 'Paraíba', 'PR': 'Paraná',
  'PE': 'Pernambuco', 'PI': 'Piauí', 'RJ': 'Rio de Janeiro', 'RN': 'Rio Grande do Norte',
  'RS': 'Rio Grande do Sul', 'RO': 'Rondônia', 'RR': 'Roraima', 'SC': 'Santa Catarina',
  'SP': 'São Paulo', 'SE': 'Sergipe', 'TO': 'Tocantins', 'OUTROS': 'Outros (S/ Info)'
};

interface Servidor {
  idServidor: number;
  nome: string;
  situacao: string;
  uorgExercicio: string;
  uorgLotacao: string;
  ufExercicio: string;
  cpfFormatado?: string;
  rawData?: any;
}

const normalizeText = (text: string) => {
  if (!text) return '';
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

const SearchableDropdown = ({ options, value, onChange, placeholder, disabled }: { options: {label: string, value: string, searchText?: string}[], value: string, onChange: (v: string) => void, placeholder: string, disabled?: boolean }) => {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = options.filter(opt => {
    const target = opt.searchText || opt.label;
    return normalizeText(target).includes(normalizeText(search));
  });

  return (
    <div className="relative w-full sm:w-64" ref={wrapperRef}>
      <div 
        className={`w-full px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md shadow-sm cursor-pointer flex justify-between items-center ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-slate-300'}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className="truncate">{value ? options.find(o=>o.value===value)?.label : placeholder}</span>
        <ChevronDown size={16} className="text-slate-400 shrink-0 ml-2" />
      </div>
      
      {isOpen && !disabled && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-72 flex flex-col">
          <div className="p-2 border-b border-slate-100 shrink-0 relative">
            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              autoFocus
              className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
              placeholder="Pesquisar..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <ul className="overflow-y-auto py-1">
            {filtered.length > 0 ? filtered.map(opt => (
              <li
                key={opt.value}
                className={`px-4 py-2 text-sm cursor-pointer hover:bg-indigo-50 hover:text-indigo-700 ${value === opt.value ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-700'}`}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                  setSearch('');
                }}
              >
                {opt.label}
              </li>
            )) : (
              <li className="px-4 py-2 text-sm text-slate-500 text-center">Nenhum resultado</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

export default function ServidoresIBGE() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const urlUf = searchParams.get('uf')
  const urlCidade = searchParams.get('cidade')

  const [agenciasData, setAgenciasData] = useState<{
    estados: string[], 
    cidadesPorEstado: Record<string, {nome: string, query: string}[]>,
    ultimaAtualizacao?: string
  }>({ estados: [], cidadesPorEstado: {} })
  
  const [estadoSelecionado, setEstadoSelecionado] = useState<string>(urlUf || 'SP')
  const [cidadeQuery, setCidadeQuery] = useState<string>(urlCidade || 'AGENCIA DO IBGE EM FERNANDOPOLIS/SP')
  
  const [servidores, setServidores] = useState<Servidor[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [remuneracoes, setRemuneracoes] = useState<Record<number, any>>({})

  useEffect(() => {
    async function fetchAgencias() {
      try {
        const res = await fetch('/api/servidores-ibge/agencias')
        if (res.ok) {
          const data = await res.json()
          if (data.estados && data.estados.length > 0) {
            setAgenciasData(data)
            
            // Só sobrescreve se a URL não tiver os parâmetros
            if (!urlUf && !urlCidade) {
              if (data.estados.includes('SP')) {
                setEstadoSelecionado('SP')
                const cidadesSp = data.cidadesPorEstado['SP']
                if (cidadesSp && cidadesSp.length > 0) {
                  const fernandopolis = cidadesSp.find((c: any) => c.nome.includes('FERNANDOPOLIS'))
                  setCidadeQuery(fernandopolis ? fernandopolis.query : cidadesSp[0].query)
                }
              } else {
                setEstadoSelecionado(data.estados[0])
                setCidadeQuery(data.cidadesPorEstado[data.estados[0]][0].query)
              }
            }
          }
        }
      } catch (err) {
        console.error('Falha ao carregar agências', err)
      }
    }
    fetchAgencias()
  }, []) // Remove dependências para rodar só uma vez no mount

  const cidadesDisponiveis = agenciasData.cidadesPorEstado[estadoSelecionado] || []

  const updateUrl = (uf: string, cid: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (uf) params.set('uf', uf)
    if (cid) params.set('cidade', cid)
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  const handleEstadoChange = (uf: string) => {
    setEstadoSelecionado(uf)
    const cidades = agenciasData.cidadesPorEstado[uf]
    let newCityQuery = ''
    if (cidades && cidades.length > 0) {
      newCityQuery = cidades[0].query
    }
    setCidadeQuery(newCityQuery)
    updateUrl(uf, newCityQuery)
  }

  const handleCidadeChange = (query: string) => {
    setCidadeQuery(query)
    updateUrl(estadoSelecionado, query)
  }

  const fetchRemuneracao = (idServidor: number, idAposentado: number) => {
    setRemuneracoes(prev => {
      if (prev[idServidor] || !idAposentado) return prev;
      
      fetch(`/api/servidores-ibge/remuneracao?id=${idAposentado}`)
        .then(res => res.json().then(data => ({ res, data })))
        .then(({ res, data }) => {
          if (res.ok) {
            setRemuneracoes(p => ({ ...p, [idServidor]: { loading: false, data } }));
          } else {
            setRemuneracoes(p => ({ ...p, [idServidor]: { loading: false, error: data.error } }));
          }
        })
        .catch(() => {
          setRemuneracoes(p => ({ ...p, [idServidor]: { loading: false, error: 'Erro de conexão' } }));
        });
        
      return { ...prev, [idServidor]: { loading: true } };
    });
  }

  // Busca a remuneração de todos automaticamente quando a lista carrega
  useEffect(() => {
    if (servidores.length > 0) {
      servidores.forEach(srv => {
        const idAposentado = srv.rawData?.servidor?.idServidorAposentadoPensionista;
        if (idAposentado) {
          fetchRemuneracao(srv.idServidor, idAposentado);
        }
      });
    }
  }, [servidores]);

  const toggleExpand = (srv: Servidor) => {
    const id = srv.idServidor;
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      fetchRemuneracao(id, srv.rawData?.servidor?.idServidorAposentadoPensionista);
    }
  }

  useEffect(() => {
    async function fetchServidores() {
      setIsLoading(true)
      setError('')
      try {
        if (!cidadeQuery) return;
        // Precisamos codificar a string pois contém espaços e barras (ex: AGENCIA DO IBGE EM FERNANDOPOLIS/SP)
        const res = await fetch(`/api/servidores-ibge?cidade=${encodeURIComponent(cidadeQuery)}`)
        if (!res.ok) {
          throw new Error('Falha ao buscar servidores')
        }
        const data = await res.json()
        setServidores(data.servidores || [])
      } catch (err: any) {
        setError(err.message)
      } finally {
        setIsLoading(false)
      }
    }

    fetchServidores()
  }, [cidadeQuery])

  return (
    <div className="bg-slate-100/80 sm:bg-white/80 backdrop-blur-xl border border-slate-200 p-4 sm:p-6 rounded-2xl shadow-sm animate-fade-in w-full overflow-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h3 className="text-lg font-medium text-indigo-900 mb-1">
            Servidores IBGE (Tempo Real)
          </h3>
          <p className="text-sm text-slate-500 mb-1">
            Acompanhe os funcionários ativos/inativos da agência.
          </p>
          {agenciasData.ultimaAtualizacao && (
            <p className="text-xs font-medium text-emerald-600 bg-emerald-50 inline-block px-2 py-0.5 rounded-full mt-1">
              Última sincronização: {new Date(agenciasData.ultimaAtualizacao).toLocaleString('pt-BR')}
            </p>
          )}
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {agenciasData.estados.length > 0 ? (
            <>
              <SearchableDropdown 
                options={agenciasData.estados.map(uf => ({ 
                  label: ESTADOS_MAP[uf] ? `${uf} - ${ESTADOS_MAP[uf]}` : uf, 
                  value: uf,
                  searchText: ESTADOS_MAP[uf] ? `${uf} ${ESTADOS_MAP[uf]}` : uf
                }))}
                value={estadoSelecionado}
                onChange={handleEstadoChange}
                placeholder="Estado"
              />
              <SearchableDropdown 
                options={cidadesDisponiveis.map(c => ({ label: c.nome, value: c.query }))}
                value={cidadeQuery}
                onChange={handleCidadeChange}
                placeholder="Selecione a Agência"
                disabled={cidadesDisponiveis.length === 0}
              />
            </>
          ) : (
            <div className="px-4 py-2 text-sm text-slate-500 bg-slate-100 rounded-md">
              Carregando locais...
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>
      ) : servidores.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          Nenhum servidor encontrado na agência selecionada.
          <br />
          <span className="text-xs mt-2 block">(Pode ser que a sincronização em background ainda esteja rodando)</span>
        </div>
      ) : (
        <div className="w-full">
          <table className="w-full text-left block sm:table border-separate sm:border-collapse" style={{ borderSpacing: '0 12px' }}>
            <thead className="hidden sm:table-header-group bg-slate-50 text-slate-600 text-sm font-medium border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 w-8"></th>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Situação</th>
                <th className="px-4 py-3">Cargo / Função</th>
                <th className="px-4 py-3">Remuneração Bruta</th>
              </tr>
            </thead>
            <tbody className="block sm:table-row-group space-y-3 sm:space-y-0">
                {servidores.map(srv => {
                  const isExpanded = expandedId === srv.idServidor;
                  const fichaEfetivo = srv.rawData?.fichasCargoEfetivo?.[0] || srv.rawData?.fichasDemaisSituacoes?.[0];
                  const fichaFuncao = srv.rawData?.fichasFuncao?.[0];
                  
                  const cargoEfetivo = fichaEfetivo?.cargo || fichaEfetivo?.situacaoServidor || 'Não informado';
                  
                  let isChefe = false;
                  let funcaoOficial = '';

                  if (fichaFuncao) {
                    const atividade = (fichaFuncao.atividade || '').toLowerCase();
                    const funcao = (fichaFuncao.funcao || '').toLowerCase();
                    if (atividade.includes('chefe') || atividade.includes('gerente') || atividade.includes('coordenador') || 
                        funcao.includes('chefe') || funcao.includes('gerente') || funcao.includes('coordenador')) {
                      isChefe = true;
                      funcaoOficial = fichaFuncao.atividade || fichaFuncao.funcao;
                    }
                  }

                  if (!isChefe) {
                    const c = cargoEfetivo.toLowerCase();
                    if (c.includes('chefe') || c.includes('gerencia') || c.includes('coordenador')) {
                      isChefe = true;
                      funcaoOficial = cargoEfetivo;
                    }
                  }
                  
                  return (
                    <React.Fragment key={srv.idServidor}>
                      <tr 
                      className={`block sm:table-row bg-white sm:bg-transparent border border-slate-200 sm:border-none rounded-xl sm:rounded-none shadow-sm sm:shadow-none hover:bg-slate-50 transition-all duration-200 cursor-pointer relative active:scale-[0.98] sm:active:scale-100 ${isExpanded ? 'ring-2 ring-indigo-500/80 sm:ring-0 sm:bg-slate-50/80' : ''}`}
                      onClick={() => toggleExpand(srv)}
                    >
                      <td className="hidden sm:table-cell px-4 py-4 text-slate-400 border-b border-slate-100">
                        <ChevronDown size={16} className={`transition-transform duration-300 ease-in-out ${isExpanded ? 'rotate-180 text-indigo-500' : ''}`} />
                      </td>
                      <td className="block sm:table-cell px-4 pt-4 pb-2 sm:py-4 font-medium text-slate-900 border-b border-slate-100/0 sm:border-slate-100">
                        <div className="flex items-center gap-2 pr-8 sm:pr-0">
                          <span className="text-[15px] sm:text-sm leading-tight">{srv.nome}</span>
                          {srv.rawData?.servidor?.idServidorAposentadoPensionista && (
                            <a
                              href={`https://portaldatransparencia.gov.br/servidores/${srv.rawData.servidor.idServidorAposentadoPensionista}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="shrink-0 inline-flex items-center justify-center p-1.5 sm:px-3 sm:py-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white rounded-lg transition-all duration-200 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider"
                              title="Abrir página oficial"
                            >
                              <ArrowUpRight size={14} strokeWidth={2.5} />
                              <span className="hidden sm:inline ml-1.5">Portal</span>
                            </a>
                          )}
                        </div>
                        <div className="absolute top-4 right-4 sm:hidden text-slate-400">
                          <ChevronDown size={20} className={`transition-transform duration-300 ease-in-out ${isExpanded ? 'rotate-180 text-indigo-500' : ''}`} />
                        </div>
                      </td>
                      <td className="block sm:table-cell px-4 py-1.5 sm:py-4 border-b border-slate-100/0 sm:border-slate-100">
                        <div className="flex justify-between items-center sm:block">
                          <span className="sm:hidden text-[11px] font-bold text-slate-400 uppercase tracking-wide">Situação</span>
                          <span className={`inline-flex px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-semibold uppercase tracking-wide ${
                            srv.situacao === 'Ativo' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {srv.situacao}
                          </span>
                        </div>
                      </td>
                      <td className="block sm:table-cell px-4 py-1.5 sm:py-4 border-b border-slate-100/0 sm:border-slate-100">
                        <div className="flex justify-between items-center sm:block">
                          <span className="sm:hidden text-[11px] font-bold text-slate-400 uppercase tracking-wide">Cargo / Função</span>
                          <div className="text-right sm:text-left">
                            {isChefe ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200 uppercase tracking-wider">
                                Chefe / Gerente
                              </span>
                            ) : (
                              <span className="text-slate-500 text-[13px] sm:text-xs" title={cargoEfetivo}>{cargoEfetivo}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="block sm:table-cell px-4 pb-4 pt-1.5 sm:py-4 font-medium text-slate-700 border-b border-slate-100/0 sm:border-slate-100 rounded-b-xl sm:rounded-none">
                        <div className="flex justify-between items-center sm:block pt-3 mt-1 border-t border-dashed border-slate-200 sm:pt-0 sm:mt-0 sm:border-none">
                          <span className="sm:hidden text-[11px] font-bold text-slate-400 uppercase tracking-wide">Salário Bruto</span>
                          {remuneracoes[srv.idServidor]?.loading ? (
                            <span className="animate-pulse bg-slate-200 h-4 w-16 block rounded"></span>
                          ) : remuneracoes[srv.idServidor]?.data ? (
                            <span className="text-[15px] sm:text-sm">R$ {remuneracoes[srv.idServidor].data.bruta}</span>
                          ) : (
                            <span className="text-xs text-slate-400">N/D</span>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="animate-[fadeIn_0.3s_ease-out]">
                        <style dangerouslySetInnerHTML={{__html: `
                          @keyframes fadeIn {
                            from { opacity: 0; transform: translateY(-10px); }
                            to { opacity: 1; transform: translateY(0); }
                          }
                        `}} />
                        <td colSpan={5} className="block sm:table-cell px-4 sm:px-8 py-4 sm:py-6 bg-slate-50/80 sm:bg-slate-50/50 rounded-b-xl sm:rounded-none border-t border-slate-200 sm:border-slate-100 -mt-2 sm:mt-0">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[13px] sm:text-sm">
                            {isChefe && (
                              <div className="col-span-full mb-2 bg-amber-50/80 p-3 sm:p-4 rounded-xl border border-amber-200/60 shadow-sm">
                                <p className="text-[11px] text-amber-700 font-extrabold uppercase tracking-wider mb-1">Função de Liderança</p>
                                <p className="text-amber-900 font-bold text-sm sm:text-base">{funcaoOficial}</p>
                                <p className="text-[11px] sm:text-xs text-amber-700 mt-1.5 opacity-90"><span className="font-semibold">Cargo Efetivo:</span> {cargoEfetivo}</p>
                              </div>
                            )}
                            <div className="bg-white p-3 rounded-lg border border-slate-200/60 shadow-sm">
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">CPF</p>
                              <p className="text-slate-700 font-medium">{srv.cpfFormatado || 'Não informado'}</p>
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-slate-200/60 shadow-sm">
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Regime Jurídico</p>
                              <p className="text-slate-700 font-medium">{fichaEfetivo?.regimeJuridico || 'Não informado'}</p>
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-slate-200/60 shadow-sm">
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Jornada</p>
                              <p className="text-slate-700 font-medium">{fichaEfetivo?.jornadaTrabalho || 'Não informada'}</p>
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-slate-200/60 shadow-sm">
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Ingresso no Órgão</p>
                              <p className="text-slate-700 font-medium">{fichaEfetivo?.dataIngressoOrgao || 'Não informada'}</p>
                            </div>
                          </div>

                          <div className="col-span-full border-t border-slate-200/80 mt-5 pt-5">
                            <p className="text-xs text-indigo-900 font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
                              Detalhamento da Remuneração
                            </p>
                            {remuneracoes[srv.idServidor]?.loading ? (
                              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-pulse">
                                {[1, 2, 3, 4, 5, 6].map(i => (
                                  <div key={i} className="bg-slate-200/60 h-[72px] rounded-xl border border-slate-200"></div>
                                ))}
                                <div className="bg-red-100/50 h-[72px] rounded-xl border border-red-100"></div>
                                <div className="bg-red-100/50 h-[72px] rounded-xl border border-red-100"></div>
                                <div className="col-span-2 lg:col-span-4 h-[84px] bg-emerald-100/50 rounded-xl mt-2 border border-emerald-100"></div>
                              </div>
                            ) : remuneracoes[srv.idServidor]?.error ? (
                              <p className="text-[13px] text-red-500 bg-red-50 p-3 rounded-lg border border-red-100">{remuneracoes[srv.idServidor].error}</p>
                            ) : remuneracoes[srv.idServidor]?.data ? (
                              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-[fadeIn_0.4s_ease-out]">
                                <div className="bg-white p-3 rounded-xl border border-slate-200/60 shadow-sm transition-shadow hover:shadow-md">
                                  <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Mês Ref.</p>
                                  <p className="font-semibold text-slate-700 text-[13px]">{remuneracoes[srv.idServidor].data.mesReferencia}</p>
                                </div>
                                <div className="bg-white p-3 rounded-xl border border-slate-200/60 shadow-sm transition-shadow hover:shadow-md">
                                  <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Bruta</p>
                                  <p className="font-bold text-slate-800 text-sm">R$ {remuneracoes[srv.idServidor].data.bruta}</p>
                                </div>
                                <div className="bg-white p-3 rounded-xl border border-slate-200/60 shadow-sm transition-shadow hover:shadow-md">
                                  <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Férias</p>
                                  <p className="font-semibold text-slate-700 text-[13px]">R$ {remuneracoes[srv.idServidor].data.ferias}</p>
                                </div>
                                <div className="bg-white p-3 rounded-xl border border-slate-200/60 shadow-sm transition-shadow hover:shadow-md">
                                  <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Grat. Natalina</p>
                                  <p className="font-semibold text-slate-700 text-[13px]">R$ {remuneracoes[srv.idServidor].data.gratificacaoNatalina}</p>
                                </div>
                                <div className="bg-white p-3 rounded-xl border border-slate-200/60 shadow-sm transition-shadow hover:shadow-md">
                                  <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Verbas Indenizatórias</p>
                                  <p className="font-semibold text-slate-700 text-[13px]">R$ {remuneracoes[srv.idServidor].data.verbasIndenizatorias}</p>
                                </div>
                                <div className="bg-white p-3 rounded-xl border border-slate-200/60 shadow-sm transition-shadow hover:shadow-md">
                                  <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider" title="Outras Remunerações Eventuais (Ex: Auxílio Alimentação)">Outras Remunerações</p>
                                  <p className="font-semibold text-slate-700 text-[13px]">R$ {remuneracoes[srv.idServidor].data.outrasRemuneracoes}</p>
                                </div>
                                <div className="bg-red-50 p-3 rounded-xl border border-red-100 shadow-sm transition-shadow hover:shadow-md">
                                  <p className="text-[9px] text-red-500 uppercase font-bold tracking-wider">Imposto Retido</p>
                                  <p className="font-bold text-red-700 text-[13px]">{remuneracoes[srv.idServidor].data.impostoRetido}</p>
                                </div>
                                <div className="bg-red-50 p-3 rounded-xl border border-red-100 shadow-sm transition-shadow hover:shadow-md">
                                  <p className="text-[9px] text-red-500 uppercase font-bold tracking-wider">Previdência Oficial</p>
                                  <p className="font-bold text-red-700 text-[13px]">{remuneracoes[srv.idServidor].data.previdencia}</p>
                                </div>
                                <div className="bg-gradient-to-r from-emerald-50 to-teal-50/50 p-4 rounded-xl border border-emerald-200 shadow-[inset_0_2px_10px_rgba(16,185,129,0.04)] col-span-2 lg:col-span-4 flex justify-between items-center mt-2 relative overflow-hidden group">
                                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-400/10 rounded-full blur-2xl -mr-10 -mt-10 group-hover:scale-110 transition-transform duration-500"></div>
                                  <p className="text-[11px] text-emerald-800 uppercase font-extrabold tracking-widest relative z-10">Remuneração Líquida</p>
                                  <p className="font-black text-xl sm:text-2xl bg-gradient-to-br from-emerald-600 to-teal-700 bg-clip-text text-transparent relative z-10 drop-shadow-sm">R$ {remuneracoes[srv.idServidor].data.liquida}</p>
                                </div>
                              </div>
                            ) : !remuneracoes[srv.idServidor]?.loading ? (
                              <p className="text-[13px] text-slate-400 bg-slate-50 p-4 rounded-lg border border-slate-100 text-center">Informação não disponível no Portal da Transparência.</p>
                            ) : null}
                          </div>

                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
                })}
              </tbody>
            </table>
        </div>
      )}
    </div>
  )
}
