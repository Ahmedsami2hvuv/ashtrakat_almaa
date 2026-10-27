// أداة تحويل وضغط الصور بصيغة WebP بنسبة 90% لتسريع الفتح وتقليل استهلاك البيانات

export async function compressAndConvertToWebP(
  file: File | Blob,
  maxDimension: number = 1280,
  quality: number = 0.15 // ضغط بنسبة تقارب 85-90% لإنتاج ملفات خفيفة جداً بجودة واضحة
): Promise<{ dataUrl: string; originalSize: number; compressedSize: number }> {
  return new Promise((resolve, reject) => {
    const originalSize = file.size
    const reader = new FileReader()

    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        let width = img.width
        let height = img.height

        // تصغير الأبعاد المتناسبة إن كانت أطول من الحد الأقصى
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width)
            width = maxDimension
          } else {
            width = Math.round((width * maxDimension) / height)
            height = maxDimension
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('تعذر إنشاء سياق رسم الصورة'))
          return
        }

        // رسم الصورة بجودة متدرجة ناعمة
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, 0, 0, width, height)

        // التحويل إلى webp مع نسبة الضغط
        let webpDataUrl = canvas.toDataURL('image/webp', quality)

        // إذا كان المتصفح لا يدعم webp في toDataURL، نستخدم jpeg كبديل مع نفس الضغط
        if (!webpDataUrl.startsWith('data:image/webp')) {
          webpDataUrl = canvas.toDataURL('image/jpeg', quality)
        }

        // حساب الحجم التقريبي بعد الضغط
        const compressedSize = Math.round((webpDataUrl.length * 3) / 4)

        resolve({
          dataUrl: webpDataUrl,
          originalSize,
          compressedSize
        })
      }

      img.onerror = () => reject(new Error('فشل تحميل الصورة للمعالجة'))
      img.src = event.target?.result as string
    }

    reader.onerror = () => reject(new Error('فشل قراءة ملف الصورة'))
    reader.readAsDataURL(file)
  })
}
