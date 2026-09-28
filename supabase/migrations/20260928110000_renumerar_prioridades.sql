-- Replace P1-Critica with a three-level priority scale:
-- P1-Alta, P2-Media and P3-Baixa.
CREATE TYPE public.ticket_priority_new AS ENUM ('p1', 'p2', 'p3');

-- Preserve the SLA configuration for the three priorities that remain.
DELETE FROM public.sla_config WHERE priority = 'p1';

ALTER TABLE public.tickets
  ALTER COLUMN priority DROP DEFAULT;

ALTER TABLE public.tickets
  ALTER COLUMN priority TYPE public.ticket_priority_new
  USING (
    CASE priority::text
      WHEN 'p1' THEN 'p1'
      WHEN 'p2' THEN 'p1'
      WHEN 'p3' THEN 'p2'
      WHEN 'p4' THEN 'p3'
    END
  )::public.ticket_priority_new;

ALTER TABLE public.sla_config
  ALTER COLUMN priority TYPE public.ticket_priority_new
  USING (
    CASE priority::text
      WHEN 'p2' THEN 'p1'
      WHEN 'p3' THEN 'p2'
      WHEN 'p4' THEN 'p3'
    END
  )::public.ticket_priority_new;

DROP TYPE public.ticket_priority;
ALTER TYPE public.ticket_priority_new RENAME TO ticket_priority;

ALTER TABLE public.tickets
  ALTER COLUMN priority SET DEFAULT 'p2';
