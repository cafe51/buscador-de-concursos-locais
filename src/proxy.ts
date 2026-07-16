import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET_ENV = process.env.JWT_SECRET || 'fallback-secret-at-least-32-characters-long';
const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_ENV);

export default async function proxy(request: NextRequest) {
  const token = request.cookies.get('session')?.value;
  let user = null;

  if (token) {
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      user = payload;
    } catch {
      // Token inválido ou expirado
    }
  }

  const { pathname } = request.nextUrl;

  // Se o usuário não estiver logado e tentar acessar rotas protegidas
  if (!user && (pathname.startsWith('/profile') || pathname.startsWith('/developer') || pathname.startsWith('/admin'))) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Se o usuário já estiver logado e tentar acessar login, signup ou reset-password
  if (user && (pathname.startsWith('/login') || pathname.startsWith('/signup') || pathname.startsWith('/reset-password'))) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
