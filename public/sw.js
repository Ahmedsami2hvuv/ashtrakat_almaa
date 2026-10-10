// Service Worker لتشغيل تطبيق اشتراكات ماء البصرة بدون إنترنت (أوفلاين بنسبة 100%)
const CACHE_NAME = 'ashtrakat-almaa-v2'
const OFFLINE_URL = '/'

const INITIAL_CACHE_URLS = [
  '/',
  '/manifest.json',
  '/icon.svg',
  '/favicon.ico',
  '/icons/water-logo.jpg'
]

// 1. التثبيت وحفظ الصفحات الأولية
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      try {
        await cache.addAll(INITIAL_CACHE_URLS)
      } catch (err) {
        console.warn('Initial cache error (non-fatal):', err)
      }
    })
  )
  self.skipWaiting()
})

// 2. التفعيل وحذف الإصدارات القديمة من الكاش
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
    }).then(() => self.clients.claim())
  )
})

// استقبال رسائل لتحديث الكاش أو التخطي
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// 3. اعتراض الطلبات وتوفير الملفات والصفحات عند انقطاع الإنترنت
self.addEventListener('fetch', (event) => {
  const request = event.request

  // تجاهل غير طلبات GET وتجاهل اشتراكات Supabase Realtime
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return
  if (url.href.includes('supabase.co/realtime')) return

  // أ. لطلبات التنقل بين الصفحات (HTML Navigation مثل فتح رابط المحصل أو الصفحة الرئيسية)
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // محاولة جلب الصفحة من الشبكة أولاً
          const networkResponse = await fetch(request)
          if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME)
            // حفظ الصفحة تحت الرابط المطلوب، وأيضاً كصفحة أوفلاين عامة
            cache.put(request, networkResponse.clone())
            cache.put(OFFLINE_URL, networkResponse.clone())
          }
          return networkResponse
        } catch (networkError) {
          // في حال انقطاع الإنترنت تماماً: استرجاع الصفحة المخزنة
          const cache = await caches.open(CACHE_NAME)

          // 1. محاولة مطابقة الرابط المطلوب مع تجاهل معلمات البحث ?role=...
          const matchedByUrl = await cache.match(request, { ignoreSearch: true })
          if (matchedByUrl) return matchedByUrl

          // 2. محاولة مطابقة الصفحة الرئيسية '/'
          const matchedRoot = await cache.match(OFFLINE_URL, { ignoreSearch: true })
          if (matchedRoot) return matchedRoot

          // 3. البحث عن أي صفحة HTML مخزنة في الكاش
          const requests = await cache.keys()
          for (const req of requests) {
            const res = await cache.match(req)
            const type = res?.headers.get('content-type') || ''
            if (type.includes('text/html')) {
              return res
            }
          }

          // رسالة احتياطية خفيفة إذا لم يتم العثور على أي ملف
          return new Response(
            `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>تطبيق اشتراكات الماء</title><style>body{font-family:sans-serif;background:#0f172a;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;padding:20px}h1{font-size:18px}p{font-size:14px;color:#94a3b8}button{background:#2563eb;color:#fff;border:none;padding:10px 20px;border-radius:12px;font-weight:bold;cursor:pointer;margin-top:15px}</style></head><body><div><h1>أنت في وضع عدم الاتصال بالإنترنت</h1><p>يرجى فتح التطبيق مرة واحدة بوجود إنترنت ليتم حفظ كافة الملفات على جهازك.</p><button onclick="window.location.reload()">إعادة المحاولة</button></div></body></html>`,
            { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          )
        }
      })()
    )
    return
  }

  // ب. لملفات Next.js والأيقونات والخطوط والتنسيقات الثابتة
  if (
    url.pathname.startsWith('/_next/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.woff2')
  ) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME)
        const cachedResponse = await cache.match(request)
        if (cachedResponse) {
          // إذا كان الملف موجوداً في الكاش، نرجعه فوراً
          // ونقوم بتحديثه في الخلفية إذا كان النت متاحاً (Stale-While-Revalidate)
          fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                cache.put(request, networkResponse)
              }
            })
            .catch(() => {})
          return cachedResponse
        }

        // إذا لم يكن في الكاش، نجلبه من الشبكة ونخزنه
        try {
          const networkResponse = await fetch(request)
          if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone())
          }
          return networkResponse
        } catch (err) {
          return cachedResponse || new Response('', { status: 408 })
        }
      })()
    )
    return
  }
})
