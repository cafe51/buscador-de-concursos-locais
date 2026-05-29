'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { signup } from '@/app/auth/actions'
import { useSearchParams } from 'next/navigation'

const passwordSchema = z.string()
  .min(8, 'A senha deve ter pelo menos 8 caracteres')
  .regex(/[a-z]/, 'A senha deve conter pelo menos uma letra minúscula')
  .regex(/[A-Z]/, 'A senha deve conter pelo menos uma letra maiúscula')
  .regex(/[0-9]/, 'A senha deve conter pelo menos um número')
  .regex(/[^a-zA-Z0-9]/, 'A senha deve conter pelo menos um símbolo (ex: @, #, $, %)')

const signupSchema = z.object({
  username: z.string()
    .min(3, 'O nome de usuário deve ter pelo menos 3 caracteres')
    .max(20, 'O nome de usuário pode ter no máximo 20 caracteres')
    .regex(/^[a-zA-Z0-9_]+$/, 'Apenas letras, números e underline (_) são permitidos'),
  email: z.string().email('Formato de e-mail inválido'),
  password: passwordSchema,
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
})

type SignupFormValues = z.infer<typeof signupSchema>

import { Suspense } from 'react'

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white">Carregando...</div>}>
      <SignupContent />
    </Suspense>
  )
}

function SignupContent() {
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const message = searchParams.get('message')

  const {
    register,
    handleSubmit,
    formState: { errors, isValid, touchedFields },
    watch,
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    mode: 'onChange', // Trigger validation as user types
  })

  const passwordValue = watch('password') || ''

  const onSubmit = async (data: SignupFormValues) => {
    setIsSubmitting(true)
    const formData = new FormData()
    formData.append('username', data.username)
    formData.append('email', data.email)
    formData.append('password', data.password)
    
    // We call the server action manually. 
    // Wait, server actions return a redirect which throws an error we need to let propagate.
    // However, if it returns normally, it means it didn't redirect.
    // Actually, Next.js server actions using `redirect` inside `onSubmit` might cause issues if not handled carefully, 
    // but React handles it. Or we can use a native form approach.
    // To be safe, we submit via a hidden form or native action.
    
    // Let's use standard native submission for the action, 
    // we can use a ref and form.submit() or just use the action attribute.
    // Since we want Zod validation first, we'll do this:
    const form = document.getElementById('signup-form') as HTMLFormElement;
    
    // update hidden inputs if using native submit
    let usernameInput = form.querySelector('input[name="username_hidden"]') as HTMLInputElement;
    if (!usernameInput) {
      usernameInput = document.createElement('input');
      usernameInput.type = 'hidden';
      usernameInput.name = 'username_hidden';
      form.appendChild(usernameInput);
    }
    usernameInput.value = data.username;

    if (form) {
      form.requestSubmit(); // Triggers the native action
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background gradients for aesthetics */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-indigo-600/30 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-purple-600/30 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md bg-neutral-900/50 backdrop-blur-xl border border-neutral-800 p-8 rounded-2xl shadow-2xl z-10 relative">
        
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Crie sua Conta</h1>
          <p className="text-neutral-400">Junte-se para receber notificações de concursos.</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-500 text-sm text-center">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/50 rounded-lg text-emerald-400 text-sm text-center font-medium">
            Por favor, verifique sua caixa de entrada e clique no link de confirmação enviado para o seu e-mail.
          </div>
        )}

        <form id="signup-form" action={signup} className="space-y-5">
          {/* Username Field */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">Nome de Usuário</label>
            <input
              {...register('username')}
              name="username"
              type="text"
              className={`w-full px-4 py-3 bg-neutral-950/50 border rounded-xl focus:outline-none focus:ring-2 transition-all duration-200 text-white
                ${errors.username ? 'border-red-500 focus:ring-red-500/20' : 'border-neutral-800 focus:border-indigo-500 focus:ring-indigo-500/20'}
              `}
              placeholder="ex: joao_silva"
            />
            {errors.username && (
              <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                <span className="text-xs">✕</span> {errors.username.message}
              </p>
            )}
            {touchedFields.username && !errors.username && (
              <p className="mt-1 text-sm text-emerald-500 flex items-center gap-1">
                <span className="text-xs">✓</span> Nome válido
              </p>
            )}
          </div>

          {/* Email Field */}
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
            {touchedFields.email && !errors.email && (
              <p className="mt-1 text-sm text-emerald-500 flex items-center gap-1">
                <span className="text-xs">✓</span> E-mail válido
              </p>
            )}
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">Senha</label>
            <div className="relative">
              <input
                {...register('password')}
                name="password"
                type={showPassword ? 'text' : 'password'}
                className={`w-full px-4 py-3 bg-neutral-950/50 border rounded-xl focus:outline-none focus:ring-2 transition-all duration-200 text-white pr-10
                  ${errors.password ? 'border-red-500 focus:ring-red-500/20' : 'border-neutral-800 focus:border-indigo-500 focus:ring-indigo-500/20'}
                `}
                placeholder="Crie uma senha forte"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            
            {/* Dynamic Password Validation UI */}
            <div className="mt-2 space-y-1">
              <div className={`text-xs flex items-center gap-2 ${passwordValue.length >= 8 ? 'text-emerald-500' : 'text-neutral-500'}`}>
                <span>{passwordValue.length >= 8 ? '✓' : '○'}</span> Mínimo de 8 caracteres
              </div>
              <div className={`text-xs flex items-center gap-2 ${/[A-Z]/.test(passwordValue) ? 'text-emerald-500' : 'text-neutral-500'}`}>
                <span>{/[A-Z]/.test(passwordValue) ? '✓' : '○'}</span> Letra maiúscula
              </div>
              <div className={`text-xs flex items-center gap-2 ${/[a-z]/.test(passwordValue) ? 'text-emerald-500' : 'text-neutral-500'}`}>
                <span>{/[a-z]/.test(passwordValue) ? '✓' : '○'}</span> Letra minúscula
              </div>
              <div className={`text-xs flex items-center gap-2 ${/[0-9]/.test(passwordValue) ? 'text-emerald-500' : 'text-neutral-500'}`}>
                <span>{/[0-9]/.test(passwordValue) ? '✓' : '○'}</span> Pelo menos um número
              </div>
              <div className={`text-xs flex items-center gap-2 ${/[^a-zA-Z0-9]/.test(passwordValue) ? 'text-emerald-500' : 'text-neutral-500'}`}>
                <span>{/[^a-zA-Z0-9]/.test(passwordValue) ? '✓' : '○'}</span> Pelo menos um símbolo
              </div>
            </div>
          </div>

          {/* Confirm Password Field */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">Confirmar Senha</label>
            <input
              {...register('confirmPassword')}
              type={showPassword ? 'text' : 'password'}
              className={`w-full px-4 py-3 bg-neutral-950/50 border rounded-xl focus:outline-none focus:ring-2 transition-all duration-200 text-white
                ${errors.confirmPassword ? 'border-red-500 focus:ring-red-500/20' : 'border-neutral-800 focus:border-indigo-500 focus:ring-indigo-500/20'}
              `}
              placeholder="Digite a senha novamente"
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                <span className="text-xs">✕</span> {errors.confirmPassword.message}
              </p>
            )}
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
                Criando conta...
              </>
            ) : (
              'Criar Conta'
            )}
          </button>
        </form>

        <p className="text-center text-sm text-neutral-400 mt-6">
          Já tem uma conta?{' '}
          <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
            Faça login
          </Link>
        </p>
      </div>
    </div>
  )
}
