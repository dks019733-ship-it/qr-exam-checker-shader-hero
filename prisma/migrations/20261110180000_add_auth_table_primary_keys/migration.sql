DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Session_pkey'
      AND conrelid = '"Session"'::regclass
  ) THEN
    ALTER TABLE "Session"
      ADD CONSTRAINT "Session_pkey" PRIMARY KEY USING INDEX "Session_sessionToken_key";
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'VerificationToken_pkey'
      AND conrelid = '"VerificationToken"'::regclass
  ) THEN
    ALTER TABLE "VerificationToken"
      ADD CONSTRAINT "VerificationToken_pkey" PRIMARY KEY USING INDEX "VerificationToken_token_key";
  END IF;
END
$$;
