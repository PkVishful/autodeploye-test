-- OTP codes table for secure OTP storage
CREATE TABLE public.otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  otp_code text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  verified boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Index for fast lookup
CREATE INDEX idx_otp_codes_phone_expires ON public.otp_codes (phone, expires_at DESC);

-- Auto-cleanup old OTPs
CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  DELETE FROM public.otp_codes WHERE expires_at < now() - interval '24 hours';
$$;

-- RLS: Only service role can access OTP codes
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

-- Add distributed_beds jsonb column to running_bed_maintenance_details for per-bed cost tracking
ALTER TABLE public.running_bed_maintenance_details 
ADD COLUMN IF NOT EXISTS distributed_beds jsonb DEFAULT '{}';

-- Drop running_maintenance table
DROP TABLE IF EXISTS public.running_maintenance;
