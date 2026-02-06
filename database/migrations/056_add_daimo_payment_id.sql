-- Adds the Daimo payment identifier so the service can store the provider reference
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS daimo_payment_id character varying(255);

COMMENT ON COLUMN public.payments.daimo_payment_id IS 'Identifier returned by Daimo Pay (useful to track webhook events and reconcile records).';

CREATE INDEX IF NOT EXISTS idx_payments_daimo_payment_id ON public.payments(daimo_payment_id);
