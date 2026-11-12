import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSupabaseApiOrigin } from "../lib/supabase-storage-url.mjs";

test("keeps the regular Supabase project API hostname", () => {
  assert.equal(
    normalizeSupabaseApiOrigin("https://project-ref.supabase.co/"),
    "https://project-ref.supabase.co",
  );
});

test("converts the dedicated Supabase Storage S3 hostname to the project API hostname", () => {
  assert.equal(
    normalizeSupabaseApiOrigin("https://project-ref.storage.supabase.co"),
    "https://project-ref.supabase.co",
  );
});

test("does not rewrite custom Supabase API domains", () => {
  assert.equal(
    normalizeSupabaseApiOrigin("https://db.example.com"),
    "https://db.example.com",
  );
});

test("rejects URLs with paths, credentials, query strings, or unsupported protocols", () => {
  for (const value of [
    "https://project-ref.supabase.co/storage/v1/s3",
    "https://user:pass@project-ref.supabase.co",
    "https://project-ref.supabase.co?apikey=secret",
    "ftp://project-ref.supabase.co",
  ]) {
    assert.throws(() => normalizeSupabaseApiOrigin(value), /OBJECT_STORAGE_CONFIGURATION_INVALID/);
  }
});
