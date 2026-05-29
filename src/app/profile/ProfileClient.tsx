'use client'

import { useState } from 'react'
import { User } from '@supabase/supabase-js'
import { logout, updateEmail, deleteAccount } from '@/app/auth/actions'
import { Mail, LogOut, ArrowRight, ShieldCheck, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

export default function ProfileClient({ user }: { user: User }) {
  const [isEditingEmail, setIsEditingEmail] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [isSubmittingEmail, setIsSubmittingEmail] = useState(false)

  const [isDeleting, setIsDeleting] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false)
  const [deleteError, setDeleteError] = useState('')

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
    // se não houver erro, a action fará o redirect!
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-12">
      
      {/* Left Column: User Info Card */}
      <div className="md:col-span-1 space-y-6">
        <div className="bg-neutral-900/50 backdrop-blur-xl border border-neutral-800 p-6 rounded-2xl shadow-xl">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-4">
            {(user.user_metadata?.username?.charAt(0) || user.email?.charAt(0))?.toUpperCase()}
          </div>
          <h2 className="text-xl font-semibold text-white mb-1">
            {user.user_metadata?.username ? `@${user.user_metadata.username}` : 'Seu Perfil'}
          </h2>
          <p className="text-neutral-400 text-sm mb-6 flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-500" /> Conta Verificada
          </p>

          <div className="pt-4 border-t border-neutral-800">
            <p className="text-xs text-neutral-500 mb-1">E-mail atual</p>
            <p className="text-sm text-neutral-200 font-medium truncate" title={user.email}>{user.email}</p>
          </div>

          <div className="pt-6 mt-6 border-t border-neutral-800">
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors w-full"
            >
              <LogOut size={16} /> Sair da conta
            </button>
          </div>
        </div>
      </div>

      {/* Right Column: Settings */}
      <div className="md:col-span-2 space-y-6">
        
        {/* Email Settings */}
        <div className="bg-neutral-900/50 backdrop-blur-xl border border-neutral-800 p-6 rounded-2xl shadow-xl">
          <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
            <Mail size={18} className="text-indigo-400" /> Alterar E-mail
          </h3>
          <p className="text-sm text-neutral-400 mb-6">
            O link de confirmação será enviado para o novo e-mail. Seu e-mail antigo só será desassociado após você clicar no link.
          </p>

          {!isEditingEmail ? (
            <button
              onClick={() => setIsEditingEmail(true)}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Mudar E-mail
            </button>
          ) : (
            <form id="update-email-form" action={updateEmail} onSubmit={handleUpdateEmail} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">Novo E-mail</label>
                <input
                  type="email"
                  name="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-neutral-950/50 border border-neutral-800 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all duration-200 text-white"
                  placeholder="novo@email.com"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={isSubmittingEmail || !newEmail || newEmail === user.email}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {isSubmittingEmail ? 'Enviando...' : 'Enviar link de confirmação'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingEmail(false)}
                  className="px-4 py-2 text-neutral-400 hover:text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Password Settings */}
        <div className="bg-neutral-900/50 backdrop-blur-xl border border-neutral-800 p-6 rounded-2xl shadow-xl">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-medium text-white mb-1">Segurança</h3>
              <p className="text-sm text-neutral-400">
                Gerencie sua senha de acesso.
              </p>
            </div>
            <Link 
              href="/update-password"
              className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Alterar Senha <ArrowRight size={16} />
            </Link>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-red-950/10 border border-red-900/50 p-6 rounded-2xl shadow-xl mt-12">
          <h3 className="text-lg font-medium text-red-500 mb-2 flex items-center gap-2">
            <AlertTriangle size={18} /> Zona de Perigo
          </h3>
          <p className="text-sm text-neutral-400 mb-6">
            A exclusão da conta é permanente e não poderá ser desfeita. Todos os seus dados serão apagados.
          </p>

          {!isDeleting ? (
            <button
              onClick={() => setIsDeleting(true)}
              className="px-4 py-2 bg-red-900/30 hover:bg-red-900/50 border border-red-900/50 text-red-400 rounded-lg text-sm font-medium transition-colors"
            >
              Excluir minha conta
            </button>
          ) : (
            <form onSubmit={handleDeleteAccount} className="space-y-4 max-w-sm">
              <div className="p-3 bg-red-900/20 border border-red-900/30 rounded-lg text-red-400 text-xs mb-4">
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
                  className="w-full px-4 py-2 bg-neutral-950/50 border border-red-900/30 rounded-xl focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all duration-200 text-white placeholder-neutral-600"
                  placeholder="Sua senha atual"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={isSubmittingDelete || !deletePassword}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
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
                  className="px-4 py-2 text-neutral-400 hover:text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>

      </div>

    </div>
  )
}
