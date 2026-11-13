-- ====================================================================
-- KRENOX DATABASE SCHEMA (Supabase / PostgreSQL)
-- Multi-organisation virtual queue management platform
-- ====================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ORGANISATIONS
CREATE TABLE IF NOT EXISTS public.organisations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. FACILITIES (Campuses / Branches)
CREATE TABLE IF NOT EXISTS public.facilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    location TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. SERVICES (e.g. Student Records, Tuition & Payments)
CREATE TABLE IF NOT EXISTS public.services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    prefix TEXT NOT NULL, -- e.g. 'R', 'T', 'A'
    avg_duration_minutes INT DEFAULT 15,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. SERVICE DESKS (Physical or virtual counter positions)
CREATE TABLE IF NOT EXISTS public.service_desks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- e.g. 'Desk 1', 'Counter 2'
    is_open BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TICKETS (Customer queue tickets)
CREATE TYPE public.ticket_status AS ENUM (
    'waiting',
    'called',
    'serving',
    'completed',
    'skipped',
    'absent',
    'cancelled'
);

CREATE TABLE IF NOT EXISTS public.tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
    ticket_number TEXT NOT NULL,
    pin TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    reminder_opt_in BOOLEAN DEFAULT TRUE,
    status public.ticket_status DEFAULT 'waiting',
    service_desk_id UUID REFERENCES public.service_desks(id) ON DELETE SET NULL,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    called_at TIMESTAMPTZ,
    served_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- 6. QUEUE AUDIT EVENTS (For tracking lifecycle & simulation validation)
CREATE TABLE IF NOT EXISTS public.queue_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
    previous_status public.ticket_status,
    new_status public.ticket_status NOT NULL,
    actor TEXT DEFAULT 'system',
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices for rapid queue queries
CREATE INDEX IF NOT EXISTS idx_tickets_service_status ON public.tickets(service_id, status);
CREATE INDEX IF NOT EXISTS idx_tickets_pin ON public.tickets(pin);

-- ====================================================================
-- SEED INITIAL DEMO DATA (University of Buea)
-- ====================================================================

DO $$
DECLARE
    org_id UUID;
    fac_id UUID;
    svc_records UUID;
    svc_tuition UUID;
    svc_advising UUID;
    desk_1 UUID;
    desk_2 UUID;
BEGIN
    -- Check if UB already exists
    SELECT id INTO org_id FROM public.organisations WHERE slug = 'ubuea' LIMIT 1;
    
    IF org_id IS NULL THEN
        -- Insert Organisation
        INSERT INTO public.organisations (name, slug)
        VALUES ('University of Buea', 'ubuea')
        RETURNING id INTO org_id;

        -- Insert Facility
        INSERT INTO public.facilities (organisation_id, name, location)
        VALUES (org_id, 'Student Services', 'Main Campus')
        RETURNING id INTO fac_id;

        -- Insert Desks
        INSERT INTO public.service_desks (facility_id, name, is_open)
        VALUES (fac_id, 'Desk 1', TRUE)
        RETURNING id INTO desk_1;

        INSERT INTO public.service_desks (facility_id, name, is_open)
        VALUES (fac_id, 'Desk 2', TRUE)
        RETURNING id INTO desk_2;

        -- Insert Services
        INSERT INTO public.services (facility_id, name, prefix, avg_duration_minutes)
        VALUES (fac_id, 'Student Records', 'R', 18)
        RETURNING id INTO svc_records;

        INSERT INTO public.services (facility_id, name, prefix, avg_duration_minutes)
        VALUES (fac_id, 'Tuition & Payments', 'T', 30)
        RETURNING id INTO svc_tuition;

        INSERT INTO public.services (facility_id, name, prefix, avg_duration_minutes)
        VALUES (fac_id, 'Academic Advising', 'A', 15)
        RETURNING id INTO svc_advising;

        -- Seed initial waiting tickets for live demonstration
        INSERT INTO public.tickets (service_id, ticket_number, pin, customer_name, customer_phone, status, joined_at)
        VALUES 
            (svc_records, 'R-038', '112233', 'John E.', '+237670000001', 'serving', NOW() - INTERVAL '10 minutes'),
            (svc_records, 'R-039', '223344', 'Marie A.', '+237670000002', 'waiting', NOW() - INTERVAL '8 minutes'),
            (svc_records, 'R-040', '334455', 'Emmanuel T.', '+237670000003', 'waiting', NOW() - INTERVAL '5 minutes');

    END IF;
END $$;

