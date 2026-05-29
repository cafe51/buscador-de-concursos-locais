import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // INTERCEPÇÃO DE CÓDIGO PKCE:
  // Se a URL contiver um ?code= (comum quando o Supabase falha em usar o emailRedirectTo e manda pra Home),
  // o middleware assume a responsabilidade de trocar esse código por uma sessão.
  const code = request.nextUrl.searchParams.get('code')
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Pega o parâmetro next, se existir
      const nextPath = request.nextUrl.searchParams.get('next') || request.nextUrl.pathname
      
      // Remove o código da URL para deixar limpo e redireciona para a mesma página (ou para o next) sem o código
      const url = request.nextUrl.clone()
      url.pathname = nextPath === '/' ? request.nextUrl.pathname : nextPath
      url.searchParams.delete('code')
      url.searchParams.delete('next')
      // Adicionamos os cookies à resposta de redirecionamento para garantir
      const redirectResponse = NextResponse.redirect(url)
      
      // Transferir os cookies atualizados (agora com a sessão) para a resposta de redirecionamento
      supabaseResponse.cookies.getAll().forEach(cookie => {
        redirectResponse.cookies.set(cookie.name, cookie.value)
      })
      
      return redirectResponse
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Se houver intenção de resetar a senha salva em cookie, redireciona para a página e apaga o cookie
  const authIntent = request.cookies.get('auth_intent')?.value
  if (user && authIntent === 'password_reset') {
    const url = request.nextUrl.clone()
    url.pathname = '/update-password'
    const response = NextResponse.redirect(url)
    
    // Deleta o cookie
    response.cookies.delete('auth_intent')
    
    // Repassa os cookies do supabase para manter a sessão
    supabaseResponse.cookies.getAll().forEach(cookie => {
      response.cookies.set(cookie.name, cookie.value)
    })
    
    return response
  }

  if (
    !user &&
    request.nextUrl.pathname.startsWith("/profile")
  ) {
    // no user, potentially respond by redirecting the user to the login page
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Se o usuário já está logado, ele não deveria acessar /login, /signup ou /reset-password
  if (
    user &&
    (request.nextUrl.pathname.startsWith("/login") || 
     request.nextUrl.pathname.startsWith("/signup") || 
     request.nextUrl.pathname.startsWith("/reset-password"))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  return supabaseResponse;
}
