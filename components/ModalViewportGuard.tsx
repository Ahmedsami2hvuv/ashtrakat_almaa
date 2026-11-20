'use client'

import { useEffect } from 'react'

/**
 * يساعد النوافذ المنبثقة (app-modal-overlay):
 * - زر Escape يغلق النافذة العلوية (يضغط زر الإغلاق المعلَّم data-modal-close)
 * - النقر على الخلفية يغلق النافذة إذا كانت معلَّمة data-backdrop-close
 */
function visibleOverlays(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('.app-modal-overlay')).filter(
    (el) => el.getClientRects().length > 0
  )
}

function topOverlay(): HTMLElement | null {
  const list = visibleOverlays()
  let best: HTMLElement | null = null
  let bestZ = -Infinity
  for (const el of list) {
    const z = parseInt(window.getComputedStyle(el).zIndex, 10)
    const zi = Number.isFinite(z) ? z : 0
    if (zi >= bestZ) {
      best = el
      bestZ = zi
    }
  }
  return best
}

function closeButtonOf(overlay: HTMLElement): HTMLButtonElement | null {
  const btns = Array.from(overlay.querySelectorAll<HTMLButtonElement>('[data-modal-close]'))
  return btns.find((b) => b.closest('.app-modal-overlay') === overlay) || null
}

export default function ModalViewportGuard() {
  useEffect(() => {
    let downTarget: EventTarget | null = null

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      const ov = topOverlay()
      if (!ov) return
      const btn = closeButtonOf(ov)
      if (btn && !btn.disabled) {
        e.preventDefault()
        btn.click()
      }
    }
    const onDown = (e: PointerEvent) => {
      downTarget = e.target
    }
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null
      if (!t || t !== downTarget) return
      if (!t.classList || !t.classList.contains('app-modal-overlay')) return
      if (!t.hasAttribute('data-backdrop-close')) return
      const btn = closeButtonOf(t)
      if (btn && !btn.disabled) btn.click()
    }

    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('click', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('click', onClick)
    }
  }, [])

  return null
}
