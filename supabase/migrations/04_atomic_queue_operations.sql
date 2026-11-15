-- KRENOX: atomic ticket allocation and call-next operations.
-- Deploy after 03_ticket_capability_security.sql.

CREATE TABLE IF NOT EXISTS public.ticket_daily_sequences (
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  queue_date DATE NOT NULL,
  last_number INTEGER NOT NULL DEFAULT 39,
  PRIMARY KEY (service_id, queue_date)
);

CREATE UNIQUE INDEX IF NOT EXISTS tickets_service_number_day_unique
  ON public.tickets (service_id, ticket_number, ((joined_at AT TIME ZONE 'UTC')::date));

CREATE UNIQUE INDEX IF NOT EXISTS tickets_one_active_phone_unique
  ON public.tickets (customer_phone)
  WHERE customer_phone IS NOT NULL AND status IN ('waiting', 'called', 'serving');

CREATE OR REPLACE FUNCTION public.krenox_join_queue(
  p_service_id UUID,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_reminder_opt_in BOOLEAN,
  p_notify_threshold INTEGER,
  p_pin TEXT
)
RETURNS SETOF public.tickets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix TEXT;
  v_number INTEGER;
  v_is_active BOOLEAN;
  v_org_status TEXT;
  v_today DATE := (now() AT TIME ZONE 'UTC')::date;
BEGIN
  SELECT s.prefix, s.is_active, o.status
    INTO v_prefix, v_is_active, v_org_status
  FROM public.services s
  JOIN public.facilities f ON f.id = s.facility_id
  JOIN public.organisations o ON o.id = f.organisation_id
  WHERE s.id = p_service_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service not found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT v_is_active OR v_org_status <> 'APPROVED' THEN
    RAISE EXCEPTION 'Service is unavailable' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.ticket_daily_sequences (service_id, queue_date, last_number)
  VALUES (p_service_id, v_today, 40)
  ON CONFLICT (service_id, queue_date)
  DO UPDATE SET last_number = public.ticket_daily_sequences.last_number + 1
  RETURNING last_number INTO v_number;

  RETURN QUERY
  INSERT INTO public.tickets (
    service_id, ticket_number, pin_hash, customer_name, customer_phone,
    reminder_opt_in, notify_threshold, status
  ) VALUES (
    p_service_id, v_prefix || '-' || lpad(v_number::text, 3, '0'),
    crypt(p_pin, gen_salt('bf', 12)), p_customer_name, p_customer_phone,
    p_reminder_opt_in, p_notify_threshold, 'waiting'
  )
  RETURNING *;
END;
$$;

CREATE OR REPLACE FUNCTION public.krenox_call_next(
  p_service_id UUID,
  p_desk_id UUID,
  p_actor TEXT
)
RETURNS SETOF public.tickets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket_id UUID;
  v_service_facility UUID;
  v_desk_facility UUID;
BEGIN
  SELECT facility_id INTO v_service_facility FROM public.services WHERE id = p_service_id;
  SELECT facility_id INTO v_desk_facility FROM public.service_desks WHERE id = p_desk_id AND is_open = TRUE;
  IF v_service_facility IS NULL OR v_desk_facility IS NULL OR v_service_facility <> v_desk_facility THEN
    RAISE EXCEPTION 'Desk is not available for this service' USING ERRCODE = '22023';
  END IF;

  SELECT id INTO v_ticket_id
  FROM public.tickets
  WHERE service_id = p_service_id AND status = 'waiting'
  ORDER BY joined_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF v_ticket_id IS NULL THEN
    RAISE EXCEPTION 'No waiting tickets in this queue' USING ERRCODE = 'P0002';
  END IF;

  RETURN QUERY
  UPDATE public.tickets
  SET status = 'called', called_at = now(), service_desk_id = p_desk_id
  WHERE id = v_ticket_id
  RETURNING *;

  INSERT INTO public.queue_events (ticket_id, previous_status, new_status, actor, note)
  VALUES (v_ticket_id, 'waiting', 'called', p_actor, 'Called to service desk');
END;
$$;

REVOKE ALL ON FUNCTION public.krenox_join_queue(UUID, TEXT, TEXT, BOOLEAN, INTEGER, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.krenox_call_next(UUID, UUID, TEXT) FROM PUBLIC;

-- The FastAPI backend calls these RPCs using the Supabase service-role key.
-- Keep the functions unavailable to browser roles while allowing that trusted
-- server path to allocate and advance tickets.
GRANT EXECUTE ON FUNCTION public.krenox_join_queue(UUID, TEXT, TEXT, BOOLEAN, INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.krenox_call_next(UUID, UUID, TEXT) TO service_role;
