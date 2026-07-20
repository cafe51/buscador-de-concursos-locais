'use client'

import { carregarScrapingLogs, ScrapingLog } from '@/lib/storage';
import { useState, useEffect } from 'react';
import Link from 'next/link';

import { getSessionUser } from '@/app/auth/actions';

function formatDateTime(isoString: string) {
  try {
    const d = new Date(isoString);
    return d.toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  } catch {
    return isoString;
  }
}

export default function DeveloperLogs() {
  const [authorized, setAuthorized] = useState(false);
  const [password, setPassword] = useState('');
  const [logs, setLogs] = useState<ScrapingLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  useEffect(() => {
    getSessionUser().then((user) => {
      if (user?.user_metadata?.role === 'admin') {
        setAuthorized(true);
      } else if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('dev_auth');
        if (saved === 'true') {
          setAuthorized(true);
        }
      }
    });
  }, []);

  useEffect(() => {
    if (authorized) {
      loadLogs();
    }
  }, [authorized]);

  async function loadLogs() {
    setLoading(true);
    try {
      const data = await carregarScrapingLogs();
      setLogs(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const correctPassword = process.env.NEXT_PUBLIC_DEV_PASSWORD || 'admin';
    if (password === correctPassword) {
      localStorage.setItem('dev_auth', 'true');
      setAuthorized(true);
    } else {
      alert("Senha incorreta.");
      setPassword('');
    }
  }

  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <form onSubmit={handleLogin} className="bg-white p-8 rounded-xl shadow-lg w-full max-w-sm border border-gray-100">
          <div className="text-center mb-6">
            <span className="text-4xl">🔐</span>
            <h1 className="text-xl font-bold mt-4 text-gray-800">Painel do Desenvolvedor</h1>
            <p className="text-sm text-gray-500 mt-1">Acesso restrito aos logs de raspagem</p>
          </div>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Senha de Acesso"
            className="w-full border border-gray-200 p-3 rounded-lg mb-4 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-center tracking-widest"
            autoFocus
          />
          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-colors shadow-md">
            Acessar Logs
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 md:p-8 text-gray-800">
      <div className="max-w-5xl mx-auto animate-fade-in">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 bg-white p-6 rounded-xl shadow-sm border border-gray-100 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Link href="/" className="text-gray-400 hover:text-gray-600 transition-colors" title="Voltar à Tela Inicial">
                🏠 Início
              </Link>
              <span className="text-gray-300">|</span>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
                <span>📡</span> Logs
              </h1>
            </div>
            <p className="text-gray-500 mt-1 font-medium text-sm">Histórico detalhado dos últimos 20 blocos de automação</p>
          </div>
          <div className="flex flex-col gap-2 items-end w-full md:w-auto">
            <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
              <Link href="/" className="bg-gray-100 hover:bg-gray-200 text-gray-700 p-2 px-4 rounded-lg font-bold transition-colors text-sm flex items-center gap-2 md:hidden">
                🏠 Voltar
              </Link>
              <button onClick={loadLogs} className="bg-blue-50 hover:bg-blue-100 text-blue-700 p-2 px-4 rounded-lg font-bold transition-colors text-sm flex items-center gap-2 w-full md:w-auto justify-center">
                {loading ? '⏳ Atualizando...' : '🔄 Atualizar Agora'}
              </button>
            </div>
            <button onClick={() => {
              localStorage.removeItem('dev_auth');
              setAuthorized(false);
            }} className="text-xs text-gray-400 hover:text-gray-600 underline">
              Sair da sessão
            </button>
          </div>
        </header>

        {loading && logs.length === 0 ? (
          <div className="text-center p-12 text-gray-400 animate-pulse font-medium">Carregando histórico na nuvem...</div>
        ) : logs.length === 0 ? (
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center text-gray-500 font-medium">Nenhum log encontrado na nuvem.</div>
        ) : (
          <div className="space-y-4">
            {logs.map((log) => {
              const isExpanded = expandedLogId === log.id;

              let statusColors = "bg-emerald-50 border-emerald-200 text-emerald-800";
              let badgeColors = "bg-emerald-100 text-emerald-700";
              let statusIcon = "✅";
              let statusText = "Sucesso Total";

              if (log.status === 'falha') {
                statusColors = "bg-red-50 border-red-200 text-red-800";
                badgeColors = "bg-red-100 text-red-700";
                statusIcon = "❌";
                statusText = "Falha Geral";
              } else if (log.status === 'falha_parcial') {
                statusColors = "bg-orange-50 border-orange-200 text-orange-800";
                badgeColors = "bg-orange-100 text-orange-700";
                statusIcon = "⚠️";
                statusText = "Falha Parcial";
              }

              return (
                <div key={log.id} className={`rounded-xl border transition-all duration-300 overflow-hidden shadow-sm hover:shadow-md bg-white ${isExpanded ? 'ring-2 ring-blue-500/30' : ''}`}>
                  {/* Cabeçalho do Card */}
                  <div
                    className={`p-5 cursor-pointer flex flex-col md:flex-row gap-4 justify-between items-start md:items-center ${statusColors} bg-opacity-40 hover:bg-opacity-60 transition-colors`}
                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                  >
                    <div className="flex items-start gap-4">
                      <div className="text-2xl mt-0.5">{statusIcon}</div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-gray-900">{statusText}</h3>
                          <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${badgeColors} flex items-center gap-1`}>
                            <span>↻</span> Usou {log.tentativas} de 4 tentativas
                          </span>
                        </div>
                        <p className="text-sm font-medium opacity-80">
                          Início: {formatDateTime(log.inicio)} — Duração: {Math.floor(log.duracaoSegundos / 60)}m {log.duracaoSegundos % 60}s
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-sm w-full md:w-auto justify-between md:justify-end border-t md:border-0 border-current pt-3 md:pt-0 opacity-90">
                      <div className="font-bold bg-white/50 px-3 py-1.5 rounded-lg shadow-sm">
                        📄 {log.totalEditais} Editais
                      </div>
                      <div className="text-xl transform transition-transform duration-300">
                        {isExpanded ? '🔽' : '▶️'}
                      </div>
                    </div>
                  </div>

                  {/* Corpo Expandido */}
                  {isExpanded && (
                    <div className="bg-white border-t border-gray-100 animate-fade-in divide-y divide-gray-100">
                      
                      {/* Sessão da Nuvem (Sync) */}
                      {log.syncInfo && (log.syncInfo.adicionados > 0 || log.syncInfo.atualizados > 0) && (
                        <div className="p-6 bg-blue-50/20">
                          <h4 className="font-bold text-blue-900 flex items-center gap-2 mb-4">
                            <span>☁️</span> Sincronização com Vercel Blob
                          </h4>
                          
                          <div className="flex gap-4 mb-4">
                            {log.syncInfo.adicionados > 0 && (
                              <div className="bg-blue-100 text-blue-800 px-3 py-1.5 rounded-md text-xs font-bold shadow-sm border border-blue-200">
                                📈 {log.syncInfo.adicionados} Adicionados
                              </div>
                            )}
                            {log.syncInfo.atualizados > 0 && (
                              <div className="bg-purple-100 text-purple-800 px-3 py-1.5 rounded-md text-xs font-bold shadow-sm border border-purple-200">
                                🔄 {log.syncInfo.atualizados} Atualizados
                              </div>
                            )}
                          </div>

                          {log.syncInfo.relatorioAdicoes.length > 0 && (
                            <div className="mb-4">
                              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Novos Editais Adicionados</p>
                              <div className="flex flex-col gap-2">
                                {log.syncInfo.relatorioAdicoes.map((adicao, i) => (
                                  <div key={i} className="bg-white border border-green-100 p-3 rounded-lg shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-green-300 transition-colors">
                                    <div className="flex items-start gap-3">
                                      <span className="text-green-500 text-lg mt-0.5">✨</span>
                                      <div>
                                        <p className="text-sm font-bold text-gray-800">{adicao.cidade}</p>
                                        <p className="text-xs text-gray-600 font-medium">{adicao.titulo}</p>
                                      </div>
                                    </div>
                                    <a href={adicao.link} target="_blank" rel="noopener noreferrer" className="text-xs bg-green-50 text-green-700 hover:bg-green-100 px-3 py-1.5 rounded-md font-bold whitespace-nowrap self-start sm:self-auto transition-colors border border-green-200 flex-shrink-0">
                                      Ver Documento
                                    </a>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {log.syncInfo.relatorioAtualizacoes.length > 0 && (
                            <div>
                              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Editais Atualizados</p>
                              <div className="flex flex-col gap-2">
                                {log.syncInfo.relatorioAtualizacoes.map((atualizacao, i) => (
                                  <div key={i} className="bg-white border border-blue-100 p-3 rounded-lg shadow-sm flex flex-col gap-3 hover:border-blue-300 transition-colors">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                      <div className="flex items-start gap-3">
                                        <span className="text-blue-500 text-lg mt-0.5">🔄</span>
                                        <div>
                                          <p className="text-sm font-bold text-gray-800">{atualizacao.cidade}</p>
                                          <p className="text-xs text-gray-600 font-medium">{atualizacao.titulo}</p>
                                        </div>
                                      </div>
                                      <a href={atualizacao.link} target="_blank" rel="noopener noreferrer" className="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-1.5 rounded-md font-bold whitespace-nowrap self-start sm:self-auto transition-colors border border-blue-200 flex-shrink-0">
                                        Ver Documento
                                      </a>
                                    </div>
                                    <div className="bg-gray-50 p-2.5 rounded border border-gray-100 ml-0 sm:ml-8 flex flex-wrap gap-2">
                                      {atualizacao.mudancas.map((m, idx) => (
                                        <span key={idx} className="bg-white border border-gray-200 text-gray-600 px-2 py-1 rounded text-[10px] font-mono shadow-sm">
                                          {m}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Tabela de Raspagem */}
                      <div className="overflow-x-auto p-0">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                          <thead className="bg-gray-50 border-b border-gray-100">
                            <tr className="text-gray-500 text-xs uppercase tracking-wider">
                              <th className="py-4 px-6 font-bold">Cidade-Alvo</th>
                              <th className="py-4 px-6 font-bold text-center">Tempo</th>
                              <th className="py-4 px-6 font-bold">Status</th>
                              <th className="py-4 px-6 font-bold text-center">Itens Extraídos</th>
                              <th className="py-4 px-6 font-bold text-center">Resolução na</th>
                              <th className="py-4 px-6 font-bold w-full">Detalhes do Erro</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {log.detalhesCidades.map((det, i) => {
                              let badge = <span className="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-md text-xs font-bold inline-block">🟢 OK</span>;
                              if (!det.sucesso && det.aviso) {
                                badge = <span className="bg-yellow-100 text-yellow-700 px-2.5 py-1 rounded-md text-xs font-bold inline-block">🟡 AVISO</span>;
                              } else if (!det.sucesso) {
                                badge = <span className="bg-red-100 text-red-700 px-2.5 py-1 rounded-md text-xs font-bold inline-block">🔴 FALHOU</span>;
                              }

                              return (
                                <tr key={i} className="hover:bg-blue-50/50 transition-colors">
                                  <td className="py-3 px-6 font-bold text-gray-700">{det.cidade}</td>
                                  <td className="py-3 px-6 text-gray-500 text-center font-mono text-xs">
                                    {(det.tempoGastoSegundos || 0).toFixed(2)}s
                                  </td>
                                  <td className="py-3 px-6">{badge}</td>
                                  <td className="py-3 px-6 font-medium text-gray-600 text-center">{det.itens}</td>
                                  <td className="py-3 px-6 text-gray-500 text-center font-medium">
                                    {det.tentativaSucesso > 0 ? `Tentativa ${det.tentativaSucesso}` : '-'}
                                  </td>
                                  <td className="py-3 px-6 max-w-sm truncate whitespace-normal leading-tight">
                                    {det.erro ? (
                                      <span className="text-red-600 italic text-xs bg-red-50 px-2 py-1 rounded inline-block" title={det.erro}>
                                        {det.erro}
                                      </span>
                                    ) : (
                                      <span className="text-gray-300">-</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
