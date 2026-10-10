import type { Metadata, Viewport } from 'next'
import { Tajawal } from 'next/font/google'
import './globals.css'

const tajawal = Tajawal({
  subsets: ['arabic'],
  weight: ['400', '500', '700'],
  display: 'swap',
  variable: '--font-tajawal',
})

export const metadata: Metadata = {
  title: 'نظام اشتراكات الماء',
  description: 'نظام إدارة اشتراكات الماء للمحصلين',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'اشتراكات الماء',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0f172a',
}

import ServiceWorkerRegister from '@/components/ServiceWorkerRegister'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar" dir="rtl" className={tajawal.variable}>
      <body className={tajawal.className}>
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  )
}
