import { InspectionImage } from './inspectionTypes'

/** رابط عرض الصورة: بروكسي تليجرام أو dataUrl المحلي أثناء الرفع */
export function getInspectionImageSrc(img: InspectionImage | null | undefined): string {
  if (!img) return ''
  if (img.telegramFileId) {
    return `/api/telegram/image?file_id=${encodeURIComponent(img.telegramFileId)}`
  }
  if (img.dataUrl && img.dataUrl.length > 32) return img.dataUrl
  return ''
}

export function inspectionHasDisplayableImages(images: InspectionImage[] | undefined | null): boolean {
  if (!images || images.length === 0) return false
  return images.some((img) => Boolean(getInspectionImageSrc(img)))
}

/** هل نحتاج جلب الكشف الكامل من السيرفر؟ (صور base64 قديمة بدون تليجرام) */
export function inspectionNeedsFullImagePayload(images: InspectionImage[] | undefined | null): boolean {
  if (!images || images.length === 0) return false
  return images.some((img) => {
    const hasTg = Boolean(img.telegramFileId)
    const hasData = Boolean(img.dataUrl && img.dataUrl.length > 32)
    return !hasTg && !hasData
  })
}
