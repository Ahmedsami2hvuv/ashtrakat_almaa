-- ==============================================================================
-- سكيما الحماية القصوى والأداء العالي لقاعدة بيانات مديرية ماء البصرة (سوبابيس)
-- مصممة لاستيعاب ملايين المشتركين وحماية البيانات الحساسة من أي وصول غير مصرح به
-- ==============================================================================

-- 1. جدول مزامنة تطبيقات المديرية (app_sync)
CREATE TABLE IF NOT EXISTS public.app_sync (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. جدول المناطق
CREATE TABLE IF NOT EXISTS public.areas (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 1
);

-- 3. جدول الأفرع
CREATE TABLE IF NOT EXISTS public.branches (
    id TEXT PRIMARY KEY,
    area_id TEXT REFERENCES public.areas(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 1
);

-- 4. جدول المشتركين (مهيأ لملايين السجلات)
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

-- 5. جدول الدفعات والديون
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

-- 6. جدول التسعير
CREATE TABLE IF NOT EXISTS public.pricing (
    id BIGSERIAL PRIMARY KEY,
    property_type TEXT NOT NULL,
    meter_type TEXT NOT NULL,
    amount NUMERIC DEFAULT 0,
    CONSTRAINT unique_pricing_type UNIQUE (property_type, meter_type)
);

-- 7. جدول بيانات المحصلين
CREATE TABLE IF NOT EXISTS public.collector (
    id BIGSERIAL PRIMARY KEY,
    name TEXT,
    phone TEXT,
    range_from INTEGER DEFAULT 1,
    range_to INTEGER DEFAULT 9999
);

-- ==============================================================================
-- إنشاء فهارس سريعة ومتقدمة (Indexes) لتسريع استعلام ملايين المشتركين
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_subscribers_id ON public.subscribers(id);
CREATE INDEX IF NOT EXISTS idx_subscribers_branch_id ON public.subscribers(branch_id);
CREATE INDEX IF NOT EXISTS idx_subscribers_area_id ON public.subscribers(area_id);
CREATE INDEX IF NOT EXISTS idx_subscribers_name ON public.subscribers(name);
CREATE INDEX IF NOT EXISTS idx_subscribers_phone ON public.subscribers(phone);
CREATE INDEX IF NOT EXISTS idx_payments_sub_period ON public.payments(subscriber_id, period, year);
CREATE INDEX IF NOT EXISTS idx_app_sync_key ON public.app_sync(key);

-- ==============================================================================
-- تفعيل سياسات الأمان الصارمة (Row Level Security - RLS)
-- ==============================================================================
ALTER TABLE public.app_sync ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collector ENABLE ROW LEVEL SECURITY;

-- السماح الكامل لدور الخدمة المشفرة فقط (service_role) بالقراءة والتعديل من خلال السيرفر
DO $$
BEGIN
    -- سياسات جدول app_sync
    DROP POLICY IF EXISTS "service_role_all_sync" ON public.app_sync;
    CREATE POLICY "service_role_all_sync" ON public.app_sync FOR ALL TO service_role USING (true) WITH CHECK (true);

    -- سياسات جدول المشتركين
    DROP POLICY IF EXISTS "service_role_all_subscribers" ON public.subscribers;
    CREATE POLICY "service_role_all_subscribers" ON public.subscribers FOR ALL TO service_role USING (true) WITH CHECK (true);

    -- سياسات جدول الدفعات
    DROP POLICY IF EXISTS "service_role_all_payments" ON public.payments;
    CREATE POLICY "service_role_all_payments" ON public.payments FOR ALL TO service_role USING (true) WITH CHECK (true);

    -- سياسات جدول المناطق والأفرع والتسعير
    DROP POLICY IF EXISTS "service_role_all_areas" ON public.areas;
    CREATE POLICY "service_role_all_areas" ON public.areas FOR ALL TO service_role USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "service_role_all_branches" ON public.branches;
    CREATE POLICY "service_role_all_branches" ON public.branches FOR ALL TO service_role USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "service_role_all_pricing" ON public.pricing;
    CREATE POLICY "service_role_all_pricing" ON public.pricing FOR ALL TO service_role USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "service_role_all_collector" ON public.collector;
    CREATE POLICY "service_role_all_collector" ON public.collector FOR ALL TO service_role USING (true) WITH CHECK (true);

    -- سياسة قراءة فقط آمنة (مسموحة للمتصفح إذا لزم الأمر بدون إمكانية التعديل أو الحذف)
    DROP POLICY IF EXISTS "anon_read_sync" ON public.app_sync;
    CREATE POLICY "anon_read_sync" ON public.app_sync FOR SELECT TO anon USING (true);

    DROP POLICY IF EXISTS "anon_read_areas" ON public.areas;
    CREATE POLICY "anon_read_areas" ON public.areas FOR SELECT TO anon USING (true);

    DROP POLICY IF EXISTS "anon_read_branches" ON public.branches;
    CREATE POLICY "anon_read_branches" ON public.branches FOR SELECT TO anon USING (true);

    DROP POLICY IF EXISTS "anon_read_pricing" ON public.pricing;
    CREATE POLICY "anon_read_pricing" ON public.pricing FOR SELECT TO anon USING (true);
END $$;
