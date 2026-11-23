ALTER TABLE public."StudentWelcomeDismissal" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'StudentWelcomeDismissal'
      AND policyname = 'deny_public_api'
  ) THEN
    CREATE POLICY "deny_public_api"
    ON public."StudentWelcomeDismissal"
    AS RESTRICTIVE
    FOR ALL
    TO anon, authenticated
    USING (false)
    WITH CHECK (false);
  END IF;
END
$$;

REVOKE ALL PRIVILEGES ON TABLE public."StudentWelcomeDismissal" FROM anon, authenticated;
