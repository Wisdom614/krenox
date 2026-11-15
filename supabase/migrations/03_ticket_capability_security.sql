-- KRENOX: public ticket capability hardening
-- Run in Supabase before deploying the matching application code.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS pin_hash TEXT,
  ADD COLUMN IF NOT EXISTS notify_threshold INT NOT NULL DEFAULT 2
    CHECK (notify_threshold BETWEEN 1 AND 10);

-- Migrate legacy plaintext PINs once, then permanently remove the column.
UPDATE public.tickets
SET pin_hash = crypt(pin, gen_salt('bf', 12))
WHERE pin_hash IS NULL AND pin IS NOT NULL;

ALTER TABLE public.tickets
  ALTER COLUMN pin_hash SET NOT NULL;

ALTER TABLE public.tickets DROP COLUMN IF EXISTS pin;

-- PIN verifiers must never be exposed through direct browser access.
REVOKE ALL ON public.tickets FROM anon, authenticated;
REVOKE ALL ON public.queue_events FROM anon, authenticated;

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_events ENABLE ROW LEVEL SECURITY;
