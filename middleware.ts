import { NextRequest, NextResponse } from 'next/server'

/**
 * Keep the main director dashboard available at /mder and preserve the
 * existing branch-manager URLs while serving the same single-page app.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (
    pathname === '/mder' ||
    pathname === '/manager' ||
    pathname.startsWith('/manager/')
  ) {
    const rewriteUrl = request.nextUrl.clone()
    rewriteUrl.pathname = '/'
    return NextResponse.rewrite(rewriteUrl)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/mder', '/manager', '/manager/:path*']
}
