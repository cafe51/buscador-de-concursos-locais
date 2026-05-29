'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { updatePassword } from '@/app/auth/actions'
import { useSearchParams } from 'next/navigation'

const passwordSchema = z.string()
  .min(8, 'A senha deve ter pelo menos 8 caracteres')
  .regex(/[a-z]/, 'A senha deve conter pelo menos uma letra minúscula')
  .regex(/[A-Z]/, 'A senha deve conter pelo menos uma letra maiúscula')
  .regex(/[0-9]/, 'A senha deve conter pelo menos um número')
  .regex(/[^a-zA-Z0-9]/, 'A senha deve conter pelo menos um símbolo')

const updateSchema = z.object({
  password: passwordSchema,
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
})

type UpdateFormValues = z.infer<typeof updateSchema>

import { Suspense } from 'react'

export default function UpdatePasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white">Carregando...</div>}>
      <UpdatePasswordContent />
    </Suspense>
  )
}

function UpdatePasswordContent() {
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  const {
    register,
    formState: { errors, isValid },
    watch,
  } = useForm<UpdateFormValues>({
    resolver: zodResolver(updateSchema),
    mode: 'onChange',
  })

  const passwordValue = watch('password') || ''

  const onSubmit = () => {
    setIsSubmitting(true)
    const form = document.getElementById('update-password-form') as HTMLFormElement;
    if (form) form.requestSubmit();
  }

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute bottom-[10%] left-[10%] w-96 h-96 bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md bg-neutral-900/50 backdrop-blur-xl border border-neutral-800 p-8 rounded-2xl shadow-2xl z-10 relative">
        
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white tracking-tight mb-2">Criar Nova Senha</h1>
          <p className="text-sm text-neutral-400">Digite sua nova senha de acesso.</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-500 text-sm text-center">
            {error}
          </div>
        )}

        <form id="update-password-form" action={updatePassword} className="space-y-5">
          {/* Password Field */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">Nova Senha</label>
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
            <label className="block text-sm font-medium text-neutral-300 mb-1">Confirmar Nova Senha</label>
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
            onClick={onSubmit}
            disabled={!isValid || isSubmitting}
            className="w-full py-3 px-4 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white rounded-xl font-medium transition-all duration-300 disabled:opacity-50 mt-4 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Atualizando...
              </>
            ) : (
              'Atualizar Senha'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
