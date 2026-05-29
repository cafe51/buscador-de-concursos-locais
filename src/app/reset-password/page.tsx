'use client'

import { useState } from 'react'
import { Loader2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { requestPasswordReset } from '@/app/auth/actions'
import { useSearchParams } from 'next/navigation'

import { Suspense } from 'react'

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white">Carregando...</div>}>
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
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-[10%] right-[10%] w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md bg-neutral-900/50 backdrop-blur-xl border border-neutral-800 p-8 rounded-2xl shadow-2xl z-10 relative">
        
        <Link href="/login" className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors mb-6">
          <ArrowLeft size={16} /> Voltar para o login
        </Link>

        <div className="text-left mb-8">
          <h1 className="text-2xl font-bold text-white tracking-tight mb-2">Recuperar Senha</h1>
          <p className="text-sm text-neutral-400">Digite o seu e-mail de cadastro. Enviaremos um link para você criar uma nova senha.</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-500 text-sm text-center">
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
            <label className="block text-sm font-medium text-neutral-300 mb-1">E-mail</label>
            <input
              name="email"
              type="email"
              required
              className="w-full px-4 py-3 bg-neutral-950/50 border border-neutral-800 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all duration-200 text-white"
              placeholder="seu@email.com"
            />
          </div>

          <button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting}
            className="w-full py-3 px-4 bg-neutral-100 hover:bg-white text-neutral-900 rounded-xl font-medium transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2"
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
