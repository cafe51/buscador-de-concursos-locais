import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  console.log('--- INICIO DO CALLBACK ---')
  console.log('URL completa recebida:', request.url)
  console.log('Origin:', origin)
  console.log('Code recebido:', code)

  if (code) {
    let response = NextResponse.redirect(`${origin}${next}`)
    
    const cookieStore = await cookies()
    console.log('Cookies presentes antes:', cookieStore.getAll().map(c => c.name))
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            console.log('Supabase tentou setar cookies:', cookiesToSet.map(c => c.name))
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
              response.cookies.set(name, value, options)
            })
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      console.log('ERRO no exchangeCodeForSession:', error.message)
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`)
    }
    
    console.log('exchangeCodeForSession SUCESSO!')
    return response
  }

  console.log('NENHUM code encontrado na URL. Redirecionando para Home.')
  return NextResponse.redirect(`${origin}/`)
}
