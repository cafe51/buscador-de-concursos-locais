'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { login } from '@/app/auth/actions'
import { useSearchParams } from 'next/navigation'

const loginSchema = z.object({
  email: z.string().email('Formato de e-mail inválido'),
  password: z.string().min(1, 'A senha é obrigatória'),
})

type LoginFormValues = z.infer<typeof loginSchema>

import { Suspense } from 'react'

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white">Carregando...</div>}>
      <LoginContent />
    </Suspense>
  )
}

function LoginContent() {
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
  })

  const onSubmit = async () => {
    setIsSubmitting(true)
    const form = document.getElementById('login-form') as HTMLFormElement;
    if (form) {
      form.requestSubmit();
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-indigo-600/30 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-purple-600/30 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md bg-neutral-900/50 backdrop-blur-xl border border-neutral-800 p-8 rounded-2xl shadow-2xl z-10 relative">
        
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Bem-vindo de volta</h1>
          <p className="text-neutral-400">Acesse sua conta para ver os últimos editais.</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-500 text-sm text-center">
            {error === 'Invalid login credentials' ? 'Email ou senha incorretos' : error}
          </div>
        )}

        <form id="login-form" action={login} className="space-y-5">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">E-mail</label>
            <input
              {...register('email')}
              name="email"
              type="email"
              className={`w-full px-4 py-3 bg-neutral-950/50 border rounded-xl focus:outline-none focus:ring-2 transition-all duration-200 text-white
                ${errors.email ? 'border-red-500 focus:ring-red-500/20' : 'border-neutral-800 focus:border-indigo-500 focus:ring-indigo-500/20'}
              `}
              placeholder="seu@email.com"
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                <span className="text-xs">✕</span> {errors.email.message}
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium text-neutral-300">Senha</label>
              <Link href="/reset-password" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                Esqueceu a senha?
              </Link>
            </div>
            <div className="relative">
              <input
                {...register('password')}
                name="password"
                type={showPassword ? 'text' : 'password'}
                className={`w-full px-4 py-3 bg-neutral-950/50 border rounded-xl focus:outline-none focus:ring-2 transition-all duration-200 text-white pr-10
                  ${errors.password ? 'border-red-500 focus:ring-red-500/20' : 'border-neutral-800 focus:border-indigo-500 focus:ring-indigo-500/20'}
                `}
                placeholder="Sua senha"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSubmit(onSubmit)}
            disabled={!isValid || isSubmitting}
            className="w-full py-3 px-4 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white rounded-xl font-medium transition-all duration-300 transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none mt-4 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Entrando...
              </>
            ) : (
              'Entrar'
            )}
          </button>
        </form>

        <p className="text-center text-sm text-neutral-400 mt-6">
          Não tem uma conta?{' '}
          <Link href="/signup" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
            Cadastre-se
          </Link>
        </p>
      </div>
    </div>
  )
}
