-- ====================================================================
-- KRENOX MIGRATION: Organisation Onboarding & Administrative Approval Workflow
-- Enforces multi-tenant onboarding, contact verification, and approval gating
-- ====================================================================

-- 1. Extend Organisations table with onboarding and review fields
ALTER TABLE public.organisations 
ADD COLUMN IF NOT EXISTS registration_ref TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Other',
ADD COLUMN IF NOT EXISTS contact_name TEXT,
ADD COLUMN IF NOT EXISTS contact_channel TEXT CHECK (contact_channel IN ('email', 'whatsapp')),
ADD COLUMN IF NOT EXISTS contact_value TEXT,
ADD COLUMN IF NOT EXISTS contact_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'APPROVED' CHECK (status IN ('DRAFT', 'PENDING_VERIFICATION', 'PENDING_REVIEW', 'ACTION_REQUIRED', 'APPROVED', 'REJECTED', 'SUSPENDED')),
ADD COLUMN IF NOT EXISTS status_reason TEXT,
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reviewed_by TEXT,
ADD COLUMN IF NOT EXISTS additional_info TEXT;

-- 2. Ensure initial seed organization (University of Buea) is marked APPROVED
UPDATE public.organisations 
SET status = 'APPROVED', 
    registration_ref = 'KRN-ORG-00001', 
    category = 'Academic', 
    contact_name = 'Registrar Academic Affairs',
    contact_channel = 'email',
    contact_value = 'admin@ubuea.cm',
    contact_verified = TRUE,
    location = 'Main Campus, Buea'
WHERE slug = 'ubuea';

-- 3. Create Organisation Audit Logs Table
CREATE TABLE IF NOT EXISTS public.organisation_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organisation_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE,
    registration_ref TEXT,
    action TEXT NOT NULL,
    actor TEXT NOT NULL,
    previous_status TEXT,
    new_status TEXT,
    reason TEXT,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices for fast application queries
CREATE INDEX IF NOT EXISTS idx_organisations_status ON public.organisations(status);
CREATE INDEX IF NOT EXISTS idx_organisations_reg_ref ON public.organisations(registration_ref);
CREATE INDEX IF NOT EXISTS idx_organisation_audit_ref ON public.organisation_audit_logs(registration_ref);

