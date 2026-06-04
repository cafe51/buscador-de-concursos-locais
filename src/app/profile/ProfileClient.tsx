'use client'

import { useState } from 'react'
import { User } from '@supabase/supabase-js'
import { logout, updateEmail, deleteAccount } from '@/app/auth/actions'
import { Mail, LogOut, ArrowRight, ShieldCheck, AlertTriangle, Bell, User as UserIcon, Lock, Server } from 'lucide-react'
import Link from 'next/link'
import AdminScraperConfigs from './AdminScraperConfigs'
import { type ScraperConfigDTO } from '@/app/admin/actions'

const CIDADES_DISPONIVEIS = [
  'Álvares Florence',
  'Dolcinópolis',
  "Estrela d'Oeste",
  'Fernandópolis',
  "Guarani d'Oeste",
  'Indiaporã',
  'Jales',
  'Macedônia',
  'Meridiano',
  'Mira Estrela',
  'Ouroeste',
  'Parisi',
  'Pedranópolis',
  'Pontalinda',
  'Santa Salete',
  'São João das Duas Pontes',
  'Urânia',
  'Valentim Gentil',
  'Vitória Brasil',
  'Votuporanga'
].sort();

export default function ProfileClient({ 
  user, 
  isAdmin, 
  adminConfigs 
}: { 
  user: User, 
  isAdmin?: boolean, 
  adminConfigs?: ScraperConfigDTO[] 
}) {
  const [activeTab, setActiveTab] = useState<'conta' | 'notificacoes' | 'seguranca' | 'admin'>('conta')

  const [isEditingEmail, setIsEditingEmail] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [isSubmittingEmail, setIsSubmittingEmail] = useState(false)

  const [isDeleting, setIsDeleting] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // Notificações
  const [notificationsEnabled, setNotificationsEnabled] = useState(user.user_metadata?.notifications?.enabled ?? false)
  const [organsOption, setOrgansOption] = useState<'todos' | 'prefeitura' | 'camara'>(user.user_metadata?.notifications?.organs ?? 'todos')
  const [selectedCities, setSelectedCities] = useState<string[]>(user.user_metadata?.notifications?.cities ?? ['todas'])
  const [isSavingNotifications, setIsSavingNotifications] = useState(false)
  const [notificationsMessage, setNotificationsMessage] = useState('')
  const [notificationsError, setNotificationsError] = useState('')

  const handleLogout = async () => {
    await logout()
  }

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEmail || newEmail === user.email) return
    setIsSubmittingEmail(true)
    const form = document.getElementById('update-email-form') as HTMLFormElement;
    if (form) form.requestSubmit();
  }

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!deletePassword) return
    
    setIsSubmittingDelete(true)
    setDeleteError('')
    
    const formData = new FormData()
    formData.append('password', deletePassword)
    
    const res = await deleteAccount(formData)
    if (res?.error) {
      setDeleteError(res.error)
      setIsSubmittingDelete(false)
    }
  }

  const handleToggleCity = (city: string) => {
    if (selectedCities.includes(city)) {
      const newCities = selectedCities.filter(c => c !== city);
      setSelectedCities(newCities.length === 0 ? ['todas'] : newCities);
    } else {
      setSelectedCities([...selectedCities.filter(c => c !== 'todas'), city]);
    }
  }

  const handleSaveNotifications = async () => {
    setIsSavingNotifications(true)
    setNotificationsMessage('')
    setNotificationsError('')

    const { updateNotificationSettings } = await import('@/app/auth/actions')

    const res = await updateNotificationSettings({
      enabled: notificationsEnabled,
      organs: organsOption,
      cities: selectedCities
    })

    if (res?.error) {
      setNotificationsError(res.error)
    } else {
      setNotificationsMessage('Configurações salvas com sucesso!')
      setTimeout(() => setNotificationsMessage(''), 4000)
    }
    setIsSavingNotifications(false)
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-12">
      
      {/* Sidebar Navigation */}
      <div className="md:col-span-1 space-y-6">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors mb-2">
          &larr; Voltar para a Página Inicial
        </Link>
        <div className="bg-white/80 backdrop-blur-xl border border-slate-200 p-6 rounded-2xl shadow-sm text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">
            {(user.user_metadata?.username?.charAt(0) || user.email?.charAt(0))?.toUpperCase()}
          </div>
          <h2 className="text-xl font-semibold text-indigo-900 mb-1">
            {user.user_metadata?.username ? `@${user.user_metadata.username}` : 'Seu Perfil'}
          </h2>
          <p className="text-slate-500 text-sm mb-6 flex items-center justify-center gap-2">
            <ShieldCheck size={16} className="text-emerald-600" /> Conta Verificada
          </p>

          <button 
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors w-full bg-slate-100 hover:bg-slate-200 py-2 rounded-xl"
          >
            <LogOut size={16} /> Sair da conta
          </button>
        </div>

        <nav className="bg-white/80 backdrop-blur-xl border border-slate-200 p-3 rounded-2xl shadow-sm flex flex-col gap-1">
          <button 
            onClick={() => setActiveTab('conta')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === 'conta' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <UserIcon size={18} /> Detalhes da Conta
          </button>
          <button 
            onClick={() => setActiveTab('notificacoes')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === 'notificacoes' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Bell size={18} /> Notificações
          </button>
          <button 
            onClick={() => setActiveTab('seguranca')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === 'seguranca' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Lock size={18} /> Segurança
          </button>
          {isAdmin && (
            <button 
              onClick={() => setActiveTab('admin')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors mt-2 border-t border-slate-100 pt-3 ${activeTab === 'admin' ? 'bg-emerald-50 text-emerald-700' : 'text-emerald-600 hover:bg-emerald-50'}`}
            >
              <Server size={18} /> Administração
            </button>
          )}
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="md:col-span-3">
        
        {/* ABA CONTA */}
        {activeTab === 'conta' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-white/80 backdrop-blur-xl border border-slate-200 p-6 rounded-2xl shadow-sm">
              <h3 className="text-lg font-medium text-indigo-900 mb-4 flex items-center gap-2">
                <Mail size={18} className="text-indigo-600" /> Alterar E-mail
              </h3>
              
              <div className="mb-6 pb-6 border-b border-slate-100">
                <p className="text-xs text-slate-500 mb-1">E-mail atual</p>
                <p className="text-base text-slate-800 font-medium">{user.email}</p>
              </div>

              <p className="text-sm text-slate-500 mb-6">
                O link de confirmação será enviado para o novo e-mail. Seu e-mail antigo só será desassociado após você clicar no link.
              </p>

              {!isEditingEmail ? (
                <button
                  onClick={() => setIsEditingEmail(true)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 rounded-lg text-sm font-medium transition-colors"
                >
                  Mudar E-mail
                </button>
              ) : (
                <form id="update-email-form" action={updateEmail} onSubmit={handleUpdateEmail} className="space-y-4 max-w-md">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Novo E-mail</label>
                    <input
                      type="email"
                      name="email"
                      required
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all duration-200 text-slate-800"
                      placeholder="novo@email.com"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="submit"
                      disabled={isSubmittingEmail || !newEmail || newEmail === user.email}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {isSubmittingEmail ? 'Enviando...' : 'Enviar link de confirmação'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingEmail(false)}
                      className="px-4 py-2 text-slate-500 hover:text-slate-800 rounded-lg text-sm font-medium transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Danger Zone */}
            <div className="bg-red-50 border border-red-200 p-6 rounded-2xl shadow-sm mt-12">
              <h3 className="text-lg font-medium text-red-600 mb-2 flex items-center gap-2">
                <AlertTriangle size={18} /> Zona de Perigo
              </h3>
              <p className="text-sm text-slate-600 mb-6">
                A exclusão da conta é permanente e não poderá ser desfeita. Todos os seus dados serão apagados.
              </p>

              {!isDeleting ? (
                <button
                  onClick={() => setIsDeleting(true)}
                  className="px-4 py-2 bg-red-100 hover:bg-red-200 border border-red-300 text-red-700 rounded-lg text-sm font-medium transition-colors"
                >
                  Excluir minha conta
                </button>
              ) : (
                <form onSubmit={handleDeleteAccount} className="space-y-4 max-w-sm">
                  <div className="p-3 bg-red-100 border border-red-200 rounded-lg text-red-700 text-xs mb-4">
                    Para confirmar a exclusão, digite sua senha de acesso atual abaixo:
                  </div>
                  
                  {deleteError && (
                    <div className="text-red-500 text-sm font-medium">{deleteError}</div>
                  )}

                  <div>
                    <input
                      type="password"
                      required
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      className="w-full px-4 py-2 bg-white border border-red-300 rounded-xl focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all duration-200 text-slate-800 placeholder-slate-400"
                      placeholder="Sua senha atual"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="submit"
                      disabled={isSubmittingDelete || !deletePassword}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {isSubmittingDelete ? 'Excluindo...' : 'Confirmar Exclusão'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsDeleting(false)
                        setDeletePassword('')
                        setDeleteError('')
                      }}
                      className="px-4 py-2 text-slate-500 hover:text-slate-800 rounded-lg text-sm font-medium transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* ABA NOTIFICAÇÕES */}
        {activeTab === 'notificacoes' && (
          <div className="bg-white/80 backdrop-blur-xl border border-slate-200 p-6 rounded-2xl shadow-sm space-y-6 animate-fade-in">
            <div className="flex justify-between items-center pb-4 border-b border-slate-200">
              <div>
                <h3 className="text-lg font-medium text-indigo-900 mb-1 flex items-center gap-2">
                  <Bell size={18} className="text-indigo-600" /> Notificações por E-mail
                </h3>
                <p className="text-sm text-slate-500">
                  Receba alertas em tempo real quando novos editais de concursos e seleções forem publicados.
                </p>
              </div>
              <div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={notificationsEnabled} 
                    onChange={(e) => setNotificationsEnabled(e.target.checked)} 
                    className="sr-only peer" 
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
            </div>

            {notificationsEnabled ? (
              <div className="space-y-6">
                {/* Órgãos filter */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Filtrar por Órgão</label>
                  <div className="flex flex-wrap gap-3">
                    {(['todos', 'prefeitura', 'camara'] as const).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setOrgansOption(opt)}
                        className={`px-4 py-2 border rounded-xl text-sm font-medium transition-all ${
                          organsOption === opt 
                            ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-semibold' 
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {opt === 'todos' ? 'Todos os Órgãos' : opt === 'prefeitura' ? 'Apenas Prefeitura' : 'Apenas Câmara'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cidades filter */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Filtrar por Cidade</label>
                  
                  <div className="flex items-center gap-2 mb-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <input
                      type="checkbox"
                      id="city-all"
                      checked={selectedCities.includes('todas')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedCities(['todas']);
                        } else {
                          setSelectedCities([]);
                        }
                      }}
                      className="w-4 h-4 text-indigo-600 bg-white border-slate-300 rounded focus:ring-indigo-500"
                    />
                    <label htmlFor="city-all" className="text-sm font-medium text-slate-800 cursor-pointer w-full">
                      Todas as Cidades (Receber notificações de toda a região)
                    </label>
                  </div>

                  {!selectedCities.includes('todas') && (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Selecionar Cidades Específicas</span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedCities(CIDADES_DISPONIVEIS)}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                          >
                            Marcar Todas
                          </button>
                          <span className="text-slate-300">|</span>
                          <button
                            type="button"
                            onClick={() => setSelectedCities([])}
                            className="text-xs text-slate-500 hover:text-slate-800 font-medium"
                          >
                            Desmarcar Todas
                          </button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {CIDADES_DISPONIVEIS.map((city) => {
                          const isChecked = selectedCities.includes(city);
                          return (
                            <label 
                              key={city} 
                              className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                                isChecked 
                                  ? 'bg-white border-indigo-400 shadow-sm text-indigo-900 font-medium' 
                                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50/80'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleCity(city)}
                                className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                              />
                              <span className="text-sm">{city}</span>
                            </label>
                          );
                        })}
                      </div>
                      
                      {selectedCities.length === 0 && (
                        <p className="text-xs text-amber-600 font-medium mt-4">
                          ⚠️ Atenção: Nenhuma cidade selecionada. Você não receberá alertas até marcar ao menos uma cidade.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-500 text-sm">
                As notificações por e-mail estão desativadas.
              </div>
            )}

            <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                {notificationsMessage && (
                  <p className="text-sm text-emerald-600 font-medium">{notificationsMessage}</p>
                )}
                {notificationsError && (
                  <p className="text-sm text-red-500 font-medium">{notificationsError}</p>
                )}
              </div>
              <button
                type="button"
                onClick={handleSaveNotifications}
                disabled={isSavingNotifications || (notificationsEnabled && !selectedCities.includes('todas') && selectedCities.length === 0)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
              >
                {isSavingNotifications ? 'Salvando...' : 'Salvar Preferências'}
              </button>
            </div>
          </div>
        )}

        {/* ABA SEGURANÇA */}
        {activeTab === 'seguranca' && (
          <div className="bg-white/80 backdrop-blur-xl border border-slate-200 p-6 rounded-2xl shadow-sm animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-lg font-medium text-indigo-900 mb-1 flex items-center gap-2">
                  <Lock size={18} className="text-indigo-600" /> Segurança
                </h3>
                <p className="text-sm text-slate-500">
                  Gerencie sua senha de acesso de forma segura.
                </p>
              </div>
              <Link 
                href="/update-password"
                className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
              >
                Alterar Senha <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        )}

        {/* ABA ADMIN */}
        {activeTab === 'admin' && isAdmin && adminConfigs && (
          <div className="animate-fade-in">
            <AdminScraperConfigs initialConfigs={adminConfigs} />
          </div>
        )}

      </div>

    </div>
  )
}
