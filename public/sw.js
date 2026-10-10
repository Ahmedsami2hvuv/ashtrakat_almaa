// Service Worker لتشغيل تطبيق اشتراكات ماء البصرة بدون إنترنت (أوفلاين)
const CACHE_NAME = 'ashtrakat-almaa-cache-v1'

const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icon.svg',
  '/favicon.ico',
  '/icons/water-logo.jpg'
]

// 1. التثبيت وحفظ الملفات الأساسية في الكاش
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Cache pre-fetch error:', err)
      })
    })
  )
  self.skipWaiting()
})

// 2. التفعيل وحذف أي كاش قديم
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key)
          }
        })
      )
    })
  )
  self.clients.claim()
})

// 3. اعتراض الطلبات وتوفير النسخ المخزنة عند انقطاع الإنترنت
self.addEventListener('fetch', (event) => {
  const request = event.request

  // تجاهل طلبات غير الـ GET أو طلبات الـ WebSocket و Supabase Realtime
  if (request.method !== 'GET') return
  if (request.url.includes('supabase.co/realtime')) return

  // لطلبات صفحات التنقل (HTML Documents): الشبكة أولاً مع الرجوع للكاش عند انقطاع النت
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const cloned = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, cloned)
          })
          return response
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request)
          if (cachedResponse) return cachedResponse
          const rootMatch = await caches.match('/')
          if (rootMatch) return rootMatch
          return new Response('أنت غير متصل بالإنترنت حالياً', {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          })
        })
    )
    return
  }

  // لملفات Next.js الثابتة والخطوط والأيقونات
  if (
    request.url.includes('/_next/static/') ||
    request.url.includes('/icons/') ||
    request.url.endsWith('.svg') ||
    request.url.endsWith('.png') ||
    request.url.endsWith('.ico')
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse

        return fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone()
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
            }
            return networkResponse
          })
          .catch(() => cachedResponse)
      })
    )
    return
  }
})
