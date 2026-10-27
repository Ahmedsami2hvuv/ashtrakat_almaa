import { NextRequest, NextResponse } from 'next/server'

/**
 * Give each branch-manager section a real, bookmarkable URL while keeping the
 * existing single-page app and preserving the manager token query parameters.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (pathname === '/manager' || pathname.startsWith('/manager/')) {
    const rewriteUrl = request.nextUrl.clone()
    rewriteUrl.pathname = '/'
    return NextResponse.rewrite(rewriteUrl)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/manager', '/manager/:path*']
}
