ALTER TABLE "Session"
  ADD CONSTRAINT "Session_pkey" PRIMARY KEY USING INDEX "Session_sessionToken_key";

ALTER TABLE "VerificationToken"
  ADD CONSTRAINT "VerificationToken_pkey" PRIMARY KEY USING INDEX "VerificationToken_token_key";
