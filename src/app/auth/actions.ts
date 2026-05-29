'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { z } from 'zod'

export async function login(formData: FormData) {
  const supabase = await createClient()

  // type-casting here for convenience
  // in practice, you should validate your inputs
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  // O username normal pode vir do hidden input caso não seja capturado direto, ou do field.
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const username = formData.get('username_hidden') as string || formData.get('username') as string

  // Note: the confirm_password should be validated on the client side to avoid unnecessary server calls
  // The zod validation in the client already does this.

  const { error, data } = await supabase.auth.signUp({
    email,
    password,
    options: {
       data: {
         username: username,
       },
       emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://buscador-de-concursos-locais.vercel.app'}/auth/callback`,
    },
  })

  if (error) {
    return redirect(`/signup?error=${encodeURIComponent(error.message)}`)
  }

  if (data?.user && data.user.identities && data.user.identities.length === 0) {
    return redirect(`/signup?error=${encodeURIComponent('Este email já está cadastrado.')}`)
  }

  return redirect('/signup?message=Check+your+email+to+continue+sign+in process')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  
  revalidatePath('/', 'layout')
  redirect('/login')
}

export async function requestPasswordReset(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string

  // Definir um cookie indicando a intenção do usuário para recuperar a senha
  // Assim, mesmo se o Supabase limpar a URL, o middleware vai saber pra onde mandar
  import('next/headers').then(async ({ cookies }) => {
    const cookieStore = await cookies()
    cookieStore.set('auth_intent', 'password_reset', { maxAge: 60 * 15, path: '/' })
  })

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://buscador-de-concursos-locais.vercel.app'}/update-password`,
  })

  if (error) {
    return redirect(`/reset-password?error=${encodeURIComponent(error.message)}`)
  }

  return redirect('/reset-password?message=Verifique+seu+email+para+recuperar+sua+senha')
}

export async function updatePassword(formData: FormData) {
  const supabase = await createClient()
  const password = formData.get('password') as string

  const { error } = await supabase.auth.updateUser({
    password: password
  })

  if (error) {
    return redirect(`/update-password?error=${encodeURIComponent(error.message)}`)
  }

  return redirect('/profile?message=Senha+atualizada+com+sucesso')
}

export async function updateEmail(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string

  const { error } = await supabase.auth.updateUser({
    email: email
  }, {
    emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://buscador-de-concursos-locais.vercel.app'}/auth/callback`
  })

  if (error) {
    return redirect(`/profile?error=${encodeURIComponent(error.message)}`)
  }

  return redirect('/profile?message=Verifique+o+novo+email+para+confirmar+a+troca')
}

export async function deleteAccount(formData: FormData) {
  const supabase = await createClient()
  const password = formData.get('password') as string

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.email) {
    return { error: 'Não autenticado' }
  }

  // 1. Verify password by attempting to sign in
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: password
  })

  if (signInError) {
    return { error: 'Senha incorreta' }
  }

  // 2. Delete user using Service Role Key (Admin API)
  // Needs to create an admin client
  const { createClient: createAdminClient } = await import('@supabase/supabase-js')
  
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: 'A chave SUPABASE_SERVICE_ROLE_KEY não está configurada no servidor. Solicite ao administrador do sistema para adicionar a Service Role Key nas variáveis de ambiente.' }
  }

  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )

  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id)

  if (deleteError) {
    return { error: deleteError.message }
  }

  // Sign out the current session
  await supabase.auth.signOut()
  
  revalidatePath('/', 'layout')
  redirect('/login?message=Conta+excluida+com+sucesso')
}
