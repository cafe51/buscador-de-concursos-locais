'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown, ChevronUp, ExternalLink, ArrowUpRight } from 'lucide-react'

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
          <div className="p-2 border-b border-slate-100 shrink-0">
            <input
              type="text"
              autoFocus
              className="w-full px-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
    <div className="bg-white/80 backdrop-blur-xl border border-slate-200 p-6 rounded-2xl shadow-sm animate-fade-in">
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
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 rounded-tl-lg w-8"></th>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Situação</th>
                <th className="px-4 py-3">Cargo / Função</th>
                <th className="px-4 py-3 rounded-tr-lg">Remuneração Bruta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {servidores.map(srv => {
                const isExpanded = expandedId === srv.idServidor;
                const ficha = srv.rawData?.fichasCargoEfetivo?.[0] || srv.rawData?.fichasDemaisSituacoes?.[0];
                return (
                  <React.Fragment key={srv.idServidor}>
                    <tr 
                      className={`hover:bg-slate-50 transition-colors cursor-pointer ${isExpanded ? 'bg-slate-50' : ''}`}
                      onClick={() => toggleExpand(srv)}
                    >
                      <td className="px-4 py-3 text-slate-400">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        <div className="flex items-center justify-between gap-4">
                          <span className="truncate">{srv.nome}</span>
                          {srv.rawData?.servidor?.idServidorAposentadoPensionista && (
                            <a
                              href={`https://portaldatransparencia.gov.br/servidores/${srv.rawData.servidor.idServidorAposentadoPensionista}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white rounded-lg transition-all duration-200 text-[11px] font-bold uppercase tracking-wider shadow-sm"
                              title="Abrir página oficial do servidor no Portal da Transparência"
                            >
                              <ArrowUpRight size={14} strokeWidth={2.5} />
                              Portal
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                          srv.situacao === 'Ativo' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {srv.situacao}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs truncate max-w-[200px]" title={ficha?.cargo || ficha?.situacaoServidor || 'Não informado'}>
                        {ficha?.cargo || ficha?.situacaoServidor || 'Não informado'}
                      </td>
                      <td className="px-4 py-3 text-slate-700 font-medium whitespace-nowrap">
                        {remuneracoes[srv.idServidor]?.loading ? (
                          <span className="animate-pulse bg-slate-200 h-4 w-16 block rounded"></span>
                        ) : remuneracoes[srv.idServidor]?.data ? (
                          `R$ ${remuneracoes[srv.idServidor].data.bruta}`
                        ) : (
                          <span className="text-xs text-slate-400">N/D</span>
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-slate-50/50">
                        <td colSpan={4} className="px-8 py-4 border-t border-slate-100">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-xs text-slate-500 font-medium uppercase mb-1">CPF</p>
                              <p className="text-slate-800">{srv.cpfFormatado || 'Não informado'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 font-medium uppercase mb-1">Regime Jurídico</p>
                              <p className="text-slate-800">{ficha?.regimeJuridico || 'Não informado'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 font-medium uppercase mb-1">Jornada</p>
                              <p className="text-slate-800">{ficha?.jornadaTrabalho || 'Não informada'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 font-medium uppercase mb-1">Ingresso no Órgão</p>
                              <p className="text-slate-800">{ficha?.dataIngressoOrgao || 'Não informada'}</p>
                            </div>
                          </div>

                          <div className="col-span-full border-t border-slate-200 mt-4 pt-4">
                            <p className="text-xs text-slate-500 font-medium uppercase mb-3 flex items-center gap-2">
                              Remuneração Transparência 
                              {remuneracoes[srv.idServidor]?.loading && (
                                <span className="animate-spin h-3 w-3 border-2 border-indigo-600 border-t-transparent rounded-full inline-block"></span>
                              )}
                            </p>
                            {remuneracoes[srv.idServidor]?.error ? (
                              <p className="text-xs text-red-500">{remuneracoes[srv.idServidor].error}</p>
                            ) : remuneracoes[srv.idServidor]?.data ? (
                              <div className="flex flex-wrap gap-x-8 gap-y-4">
                                <div>
                                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Mês Ref.</p>
                                  <p className="font-medium text-slate-700 text-sm">{remuneracoes[srv.idServidor].data.mesReferencia}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Bruta</p>
                                  <p className="font-medium text-slate-800 text-sm">R$ {remuneracoes[srv.idServidor].data.bruta}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Imposto Retido</p>
                                  <p className="font-medium text-red-500 text-sm">{remuneracoes[srv.idServidor].data.impostoRetido}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Previdência</p>
                                  <p className="font-medium text-red-500 text-sm">{remuneracoes[srv.idServidor].data.previdencia}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Líquida</p>
                                  <p className="font-medium text-emerald-600 text-sm">R$ {remuneracoes[srv.idServidor].data.liquida}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Férias</p>
                                  <p className="font-medium text-slate-700 text-sm">R$ {remuneracoes[srv.idServidor].data.ferias}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Grat. Natalina</p>
                                  <p className="font-medium text-slate-700 text-sm">R$ {remuneracoes[srv.idServidor].data.gratificacaoNatalina}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Verbas Indeniz.</p>
                                  <p className="font-medium text-slate-700 text-sm">R$ {remuneracoes[srv.idServidor].data.verbasIndenizatorias}</p>
                                </div>
                              </div>
                            ) : !remuneracoes[srv.idServidor]?.loading ? (
                              <p className="text-xs text-slate-400">Informação não disponível no Portal.</p>
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
