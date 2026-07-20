'use client'

import { useState } from 'react'
import { Server, Settings, Search, RefreshCw, BookOpen } from 'lucide-react'
import { toggleScraperConfigAction, toggleTipoFonteConfigAction, type ScraperConfigDTO } from '@/app/admin/actions'

export default function AdminScraperConfigs({ initialConfigs }: { initialConfigs: ScraperConfigDTO[] }) {
  const [configs, setConfigs] = useState<ScraperConfigDTO[]>(initialConfigs)
  const [searchTerm, setSearchTerm] = useState('')
  const [loadingCidade, setLoadingCidade] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const filteredConfigs = configs.filter(c => 
    c.nome.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleToggle = async (nome: string, currentValue: boolean) => {
    setLoadingCidade(nome)
    setMessage('')
    setError('')
    
    const newValue = !currentValue
    const res = await toggleScraperConfigAction(nome, newValue)
    
    if (res.success) {
      setConfigs(configs.map(c => c.nome === nome ? { ...c, verificarDisponibilidade: newValue } : c))
      setMessage(`Status de ${nome} atualizado!`)
      setTimeout(() => setMessage(''), 3000)
    } else {
      setError(res.error || 'Falha ao atualizar o status.')
      setTimeout(() => setError(''), 4000)
    }
    
    setLoadingCidade(null)
  }

  const handleToggleFonte = async (nome: string, currentTipo?: string) => {
    setLoadingCidade(nome)
    setMessage('')
    setError('')
    
    const newTipo = currentTipo === 'diario' ? 'portal' : 'diario'
    const res = await toggleTipoFonteConfigAction(nome, newTipo)
    
    if (res.success) {
      setConfigs(configs.map(c => c.nome === nome ? { ...c, tipoFonte: newTipo } : c))
      setMessage(`Fonte de ${nome} alterada para ${newTipo === 'diario' ? 'Diário Oficial' : 'Portal'}!`)
      setTimeout(() => setMessage(''), 3000)
    } else {
      setError(res.error || 'Falha ao atualizar a fonte do scraper.')
      setTimeout(() => setError(''), 4000)
    }
    
    setLoadingCidade(null)
  }

  return (
    <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-lg mt-12 relative overflow-hidden">
      {/* Background decoration for admin section */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none" />
      
      <div className="relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
              <Server size={20} className="text-emerald-400" /> Administração de Scrapers
            </h3>
            <p className="text-sm text-slate-400">
              Controle a fonte de dados (Portal vs Diário Oficial) e o Modo de Disponibilidade.
            </p>
          </div>
          
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input 
              type="text" 
              placeholder="Buscar cidade..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 bg-slate-800 border border-slate-600 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors w-full sm:w-64"
            />
          </div>
        </div>

        {/* Feedback messages */}
        {message && (
          <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-sm font-medium">
            {message}
          </div>
        )}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm font-medium">
            {error}
          </div>
        )}

        <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
          <div className="max-h-[400px] overflow-y-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800 sticky top-0 z-20 shadow-sm">
                <tr>
                  <th className="px-6 py-4 font-semibold text-slate-200">Cidade / Órgão</th>
                  <th className="px-6 py-4 font-semibold text-slate-200 text-center">Fonte Ativa</th>
                  <th className="px-6 py-4 font-semibold text-slate-200 text-center">Modo Ping</th>
                  <th className="px-6 py-4 font-semibold text-slate-200 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {filteredConfigs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                      Nenhum scraper encontrado com este nome.
                    </td>
                  </tr>
                ) : (
                  filteredConfigs.map((config) => (
                    <tr key={config.nome} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-6 py-4 font-medium text-white flex items-center gap-2">
                        {config.nome}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleToggleFonte(config.nome, config.tipoFonte)}
                          disabled={loadingCidade === config.nome}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                            config.tipoFonte === 'diario'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                              : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/20'
                          }`}
                        >
                          <BookOpen size={13} />
                          {config.tipoFonte === 'diario' ? 'Diário Oficial' : 'Portal Certames'}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {config.verificarDisponibilidade ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Ativo (Ping)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Desativado (Completo)
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <label className={`relative inline-flex items-center cursor-pointer ${loadingCidade === config.nome ? 'opacity-50 pointer-events-none' : ''}`}>
                          <input 
                            type="checkbox" 
                            checked={config.verificarDisponibilidade} 
                            onChange={() => handleToggle(config.nome, config.verificarDisponibilidade)} 
                            className="sr-only peer" 
                            disabled={loadingCidade === config.nome}
                          />
                          <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        
        <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
          <Settings size={14} /> Alterne entre "Portal Certames" e "Diário Oficial" para escolher de onde o robô irá extrair os editais.
        </div>
      </div>
    </div>
  )
}
