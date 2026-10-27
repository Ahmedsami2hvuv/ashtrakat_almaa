// أنواع وهيكل بيانات نظام الكشوفات الفنية - مديرية ماء البصرة

export interface InspectionImage {
  id: string
  dataUrl: string // بصيغة webp مضغوطة بنسبة 90%
  name?: string
  createdAt: string
  sizeBytes?: number
}

export interface TechnicalReportTable {
  sequence: number        // ت (افتراضياً 1)
  governorate: string     // المحافظة (افتراضياً: البصرة)
  district: string        // القضاء (افتراضياً: ابي الخصيب)
  neighborhood: string    // المحلة / المنطقة (مثال: شيخ ابراهيم / العوجة)
  plotNumber: string      // رقم القطعة (مثال: 80/185)
  sectorNumber: string    // رقم المقاطعة (مثال: 20)
}

export interface InspectionRecord {
  id: string
  token: string
  branchId?: string
  branchName?: string
  writerOrCollectorName: string
  userRole: 'writer' | 'collector' | 'manager'
  rawReportText: string
  images: InspectionImage[]
  createdAt: string
  
  // حقول التقرير الفني المنظم بالذكاء الاصطناعي (قابلة للتعديل بالكامل من قبل المدير)
  citizenName: string                // اسم المواطن / صاحب العقار
  inspectionDate: string             // تاريخ الكشف (مثال: 2026/10/26)
  tableData: TechnicalReportTable    // جدول سند الطابو والعقار
  reportPoints: string[]             // نقاط تقرير الكشف المرتبة بدقة
  
  // التواقيع الرسمية
  inspectorEmployeeName: string      // موظف الكشف
  networksManagerName: string        // م. الشبكات
  revenuesManagerName: string        // م. الواردات
  typistName: string                 // منظم / طابع التقرير
  
  status: 'pending' | 'reviewed' | 'approved' | 'rejected'
  directorNotes?: string
  updatedAt: string
}
