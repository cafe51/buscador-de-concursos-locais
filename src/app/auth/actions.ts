'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import connectToDatabase from '@/lib/mongodb'
import { UserModel } from '@/models/User'
import { 
  hashPassword, 
  comparePassword, 
  signToken, 
  setSessionCookie, 
  deleteSessionCookie,
  getSessionUser as getSession
} from '@/lib/auth'
import { enviarEmail } from '@/lib/email'

export async function getSessionUser() {
  return getSession();
}

export async function login(formData: FormData) {
  try {
    await connectToDatabase()
  } catch (dbError: any) {
    console.error('Database connection error in login:', dbError)
    return redirect(`/login?error=${encodeURIComponent(`Erro de conexão com o banco de dados: ${dbError.message || dbError}`)}`)
  }

  try {
    const email = (formData.get('email') as string || '').toLowerCase().trim()
    const password = formData.get('password') as string

    if (!email || !password) {
      return redirect(`/login?error=${encodeURIComponent('E-mail e senha são obrigatórios.')}`)
    }

    const user = await UserModel.findOne({ email }).lean()
    if (!user) {
      return redirect(`/login?error=${encodeURIComponent('Email ou senha incorretos')}`)
    }

    const passwordValid = await comparePassword(password, user.passwordHash)
    if (!passwordValid) {
      return redirect(`/login?error=${encodeURIComponent('Email ou senha incorretos')}`)
    }

    // Criar token e session cookie
    const token = await signToken({
      id: user._id.toString(),
      email: user.email,
      username: user.username,
      role: user.role
    })

    await setSessionCookie(token)
  } catch (error: any) {
    if (error && error.digest && error.digest.startsWith('NEXT_REDIRECT')) {
      throw error;
    }
    console.error('Login error:', error)
    return redirect(`/login?error=${encodeURIComponent(`Erro interno no login: ${error.message || error}`)}`)
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signup(formData: FormData) {
  try {
    await connectToDatabase()
  } catch (dbError: any) {
    console.error('Database connection error in signup:', dbError)
    return redirect(`/signup?error=${encodeURIComponent(`Erro de conexão com o banco de dados: ${dbError.message || dbError}`)}`)
  }

  try {
    const email = (formData.get('email') as string || '').toLowerCase().trim()
    const password = formData.get('password') as string
    const username = (formData.get('username_hidden') as string || formData.get('username') as string || '').trim()

    if (!email || !password || !username) {
      return redirect(`/signup?error=${encodeURIComponent('Preencha todos os campos obrigatórios.')}`)
    }

    // Verificar se usuário existe
    const existingUser = await UserModel.findOne({ email }).lean()
    if (existingUser) {
      return redirect(`/signup?error=${encodeURIComponent('Este email já está cadastrado.')}`)
    }

    // Hash password e cria usuário
    const passwordHash = await hashPassword(password)
    
    const newUser = new UserModel({
      email,
      passwordHash,
      username,
      role: 'user', // padrão
      notifications: {
        enabled: false,
        organs: 'todos',
        cities: ['todas']
      }
    })

    await newUser.save()

    // Login automático
    const token = await signToken({
      id: newUser._id.toString(),
      email: newUser.email,
      username: newUser.username,
      role: newUser.role
    })

    await setSessionCookie(token)
  } catch (error: any) {
    if (error && error.digest && error.digest.startsWith('NEXT_REDIRECT')) {
      throw error;
    }
    console.error('Signup error:', error)
    return redirect(`/signup?error=${encodeURIComponent(`Erro interno no cadastro: ${error.message || error}`)}`)
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function logout() {
  await deleteSessionCookie()
  revalidatePath('/', 'layout')
  redirect('/login')
}

export async function requestPasswordReset(formData: FormData) {
  await connectToDatabase()
  const email = (formData.get('email') as string || '').toLowerCase().trim()

  if (!email) {
    return redirect(`/reset-password?error=${encodeURIComponent('E-mail é obrigatório.')}`)
  }

  const user = await UserModel.findOne({ email })
  if (!user) {
    // Redireciona com mensagem de sucesso genérica para evitar enumeração de e-mails (segurança)
    return redirect('/reset-password?message=Se+o+email+estiver+cadastrado,+você+receberá+um+link+de+recuperação.')
  }

  // Gerar token de redefinição
  const crypto = await import('crypto')
  const token = crypto.randomUUID()
  
  user.passwordResetToken = token
  user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000) // 1 hora de validade
  await user.save()

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://buscador-de-concursos-locais.vercel.app'
  const resetLink = `${siteUrl}/update-password?token=${token}`

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: sans-serif; background-color: #f8fafc; padding: 20px; margin: 0;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 12px; border: 1px solid #e2e8f0;">
        <h2 style="color: #4f46e5; margin-top: 0;">Recuperação de Senha</h2>
        <p style="color: #334155; font-size: 15px;">Olá!</p>
        <p style="color: #334155; font-size: 15px;">Recebemos uma solicitação de redefinição de senha para a sua conta no Radar de Concursos. Para redefinir sua senha, clique no botão abaixo:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" target="_blank" style="display: inline-block; padding: 12px 28px; background-color: #4f46e5; color: #ffffff; font-size: 14px; font-weight: bold; text-decoration: none; border-radius: 8px;">
            Redefinir Senha
          </a>
        </div>
        
        <p style="color: #64748b; font-size: 13px;">Este link é válido por 1 hora. Se você não solicitou essa alteração, ignore este e-mail.</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="color: #94a3b8; font-size: 11px; text-align: center;">Radar de Concursos - Monitoramento de Editais</p>
      </div>
    </body>
    </html>
  `

  const result = await enviarEmail(user.email, 'Recuperação de senha - Radar de Concursos', emailHtml)
  
  if (result.error) {
    console.error('Erro ao enviar email de reset:', result.error)
    return redirect(`/reset-password?error=${encodeURIComponent('Falha ao enviar e-mail de recuperação. Tente novamente mais tarde.')}`)
  }

  return redirect('/reset-password?message=Verifique+seu+email+para+recuperar+sua+senha')
}

export async function updatePassword(formData: FormData) {
  await connectToDatabase()
  const password = formData.get('password') as string
  const token = formData.get('token') as string // token enviado via formulário oculto se vier do e-mail

  if (!password || password.length < 8) {
    return redirect(`/update-password?error=${encodeURIComponent('A nova senha deve ter pelo menos 8 caracteres.')}`)
  }

  const passwordHash = await hashPassword(password)

  if (token) {
    // Redefinição via token do e-mail
    const user = await UserModel.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: new Date() }
    })

    if (!user) {
      return redirect(`/update-password?error=${encodeURIComponent('O link de recuperação é inválido ou expirou.')}`)
    }

    user.passwordHash = passwordHash
    user.passwordResetToken = null
    user.passwordResetExpires = null
    await user.save()

    // Login automático pós redefinição bem sucedida
    const sessionToken = await signToken({
      id: user._id.toString(),
      email: user.email,
      username: user.username,
      role: user.role
    })
    await setSessionCookie(sessionToken)
    
    revalidatePath('/', 'layout')
    return redirect('/profile?message=Senha+redefinida+com+sucesso')
  } else {
    // Redefinição com usuário logado
    const sessionUser = await getSession()
    if (!sessionUser) {
      return redirect('/login')
    }

    await UserModel.updateOne(
      { _id: sessionUser.id },
      { $set: { passwordHash } }
    )

    return redirect('/profile?message=Senha+atualizada+com+sucesso')
  }
}

export async function updateEmail(formData: FormData) {
  await connectToDatabase()
  const sessionUser = await getSession()
  if (!sessionUser) {
    return redirect('/login')
  }

  const newEmail = (formData.get('email') as string || '').toLowerCase().trim()
  if (!newEmail) {
    return redirect(`/profile?error=${encodeURIComponent('E-mail é obrigatório.')}`)
  }

  // Verificar se o novo e-mail já existe
  const existingUser = await UserModel.findOne({ email: newEmail }).lean()
  if (existingUser) {
    return redirect(`/profile?error=${encodeURIComponent('Este e-mail já está em uso por outra conta.')}`)
  }

  // Atualizar e-mail no MongoDB
  await UserModel.updateOne(
    { _id: sessionUser.id },
    { $set: { email: newEmail } }
  )

  // Re-emitir cookie de sessão com o novo e-mail
  const token = await signToken({
    id: sessionUser.id,
    email: newEmail,
    username: sessionUser.user_metadata.username,
    role: sessionUser.user_metadata.role
  })
  await setSessionCookie(token)

  revalidatePath('/', 'layout')
  return redirect('/profile?message=E-mail+atualizado+com+sucesso')
}

export async function deleteAccount(formData: FormData) {
  await connectToDatabase()
  const sessionUser = await getSession()
  if (!sessionUser) {
    return { error: 'Não autenticado' }
  }

  const password = formData.get('password') as string
  if (!password) {
    return { error: 'A senha é obrigatória' }
  }

  // Buscar usuário completo
  const user = await UserModel.findById(sessionUser.id).lean()
  if (!user) {
    return { error: 'Usuário não encontrado' }
  }

  // Validar senha
  const passwordValid = await comparePassword(password, user.passwordHash)
  if (!passwordValid) {
    return { error: 'Senha incorreta' }
  }

  // Excluir conta
  await UserModel.deleteOne({ _id: sessionUser.id })

  // Limpar sessão
  await deleteSessionCookie()

  revalidatePath('/', 'layout')
  redirect('/login?message=Conta+excluída+com+sucesso')
}

export async function updateNotificationSettings(settings: {
  enabled: boolean;
  organs: 'todos' | 'prefeitura' | 'camara';
  cities: string[];
}) {
  await connectToDatabase()
  const sessionUser = await getSession()
  if (!sessionUser) {
    return { error: 'Não autenticado' }
  }

  await UserModel.updateOne(
    { _id: sessionUser.id },
    { $set: { notifications: settings } }
  )

  revalidatePath('/profile')
  return { success: true }
}
