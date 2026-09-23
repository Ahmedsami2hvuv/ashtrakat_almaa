-- كود إنشاء جداول قاعدة البيانات في سوبابيس (Supabase)
-- انسخ هذا الكود بالكامل وضعه في محرر الـ SQL داخل سوبابيس واضغط Run

-- 1. جدول المناطق
CREATE TABLE IF NOT EXISTS public.areas (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 1
);

-- 2. جدول الأفرع
CREATE TABLE IF NOT EXISTS public.branches (
    id TEXT PRIMARY KEY,
    area_id TEXT REFERENCES public.areas(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 1
);

-- 3. جدول المشتركين
CREATE TABLE IF NOT EXISTS public.subscribers (
    id BIGINT PRIMARY KEY,
    name TEXT NOT NULL,
    area_id TEXT REFERENCES public.areas(id) ON DELETE SET NULL,
    branch_id TEXT REFERENCES public.branches(id) ON DELETE SET NULL,
    phone TEXT,
    property_type TEXT DEFAULT 'سكني',
    meter_type TEXT DEFAULT '4 متر',
    detailed_address TEXT,
    location_lat DOUBLE PRECISION,
    location_lng DOUBLE PRECISION,
    location_link TEXT,
    door_image TEXT,
    remaining_prev NUMERIC DEFAULT 0,
    fee NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. جدول الدفعات والفترات
CREATE TABLE IF NOT EXISTS public.payments (
    id BIGSERIAL PRIMARY KEY,
    subscriber_id BIGINT REFERENCES public.subscribers(id) ON DELETE CASCADE,
    period INTEGER NOT NULL,
    year INTEGER NOT NULL,
    period_label TEXT NOT NULL,
    old_debt NUMERIC DEFAULT 0,
    paid NUMERIC DEFAULT 0,
    remaining NUMERIC DEFAULT 0,
    is_manual BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_sub_period_year UNIQUE (subscriber_id, period, year)
);

-- 5. جدول التسعير
CREATE TABLE IF NOT EXISTS public.pricing (
    id BIGSERIAL PRIMARY KEY,
    property_type TEXT NOT NULL,
    meter_type TEXT NOT NULL,
    amount NUMERIC DEFAULT 0,
    CONSTRAINT unique_pricing_type UNIQUE (property_type, meter_type)
);

-- 6. جدول بيانات المحصل
CREATE TABLE IF NOT EXISTS public.collector (
    id BIGSERIAL PRIMARY KEY,
    name TEXT,
    phone TEXT,
    range_from INTEGER DEFAULT 1,
    range_to INTEGER DEFAULT 9999
);

-- تعطيل حماية الوصول المؤقتة RLS للتسهيل ليعمل الموقع مباشرة وبكل سلاسة
ALTER TABLE public.areas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscribers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.collector DISABLE ROW LEVEL SECURITY;

-- إضافة تسعيرات افتراضية إذا لم تكن موجودة
INSERT INTO public.pricing (property_type, meter_type, amount) VALUES
('سكني', '3 متر', 15000),
('سكني', '4 متر', 24600)
ON CONFLICT (property_type, meter_type) DO NOTHING;

-- التجاري يحسب داخل التطبيق: مقدار الاستهلاك × 60 × 200 لكل شهرين.

-- إضافة بيانات افتراضية للمحصل
INSERT INTO public.collector (name, phone, range_from, range_to)
SELECT 'المحصل العام', '07700000000', 5203, 6202
WHERE NOT EXISTS (SELECT 1 FROM public.collector);
