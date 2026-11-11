DO $$
DECLARE item record;
BEGIN
  FOR item IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = item.tablename
        AND policyname = 'deny_public_api'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I.%I AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
        'deny_public_api',
        'public',
        item.tablename
      );
    END IF;
  END LOOP;
END
$$;
