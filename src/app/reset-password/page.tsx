'use client'

import { useState } from 'react'
import { Loader2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { requestPasswordReset } from '@/app/auth/actions'
import { useSearchParams } from 'next/navigation'

import { Suspense } from 'react'

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-900">Carregando...</div>}>
      <ResetPasswordContent />
    </Suspense>
  )
}

function ResetPasswordContent() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const message = searchParams.get('message')

  const onSubmit = () => {
    setIsSubmitting(true)
    const form = document.getElementById('reset-form') as HTMLFormElement;
    if (form) form.requestSubmit();
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-[10%] right-[10%] w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md bg-white/80 backdrop-blur-xl border border-slate-200 p-8 rounded-2xl shadow-xl z-10 relative">
        
        <Link href="/login" className="inline-flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 transition-colors mb-6">
          <ArrowLeft size={16} /> Voltar para o login
        </Link>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-indigo-900 tracking-tight mb-2">Recuperar Senha</h1>
          <p className="text-sm text-slate-500">Digite o seu e-mail de cadastro. Enviaremos um link para você criar uma nova senha.</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm text-center">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/50 rounded-lg text-emerald-400 text-sm text-center font-medium">
            {message}
          </div>
        )}

        <form id="reset-form" action={requestPasswordReset} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
            <input
              name="email"
              type="email"
              required
              className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all shadow-sm"
              placeholder="seu@email.com"
            />
          </div>

          <button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting}
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md rounded-xl font-medium transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Enviando...
              </>
            ) : (
              'Enviar link de recuperação'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
