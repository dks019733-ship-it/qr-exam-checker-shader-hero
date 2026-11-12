export function normalizeSupabaseApiOrigin(value) {
  let parsed;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error("OBJECT_STORAGE_CONFIGURATION_INVALID");
  }

  if (
    parsed.protocol !== "https:" &&
    !(parsed.protocol === "http:" && parsed.hostname === "localhost")
  ) {
    throw new Error("OBJECT_STORAGE_CONFIGURATION_INVALID");
  }

  if (parsed.username || parsed.password || parsed.search || parsed.hash || (parsed.pathname && parsed.pathname !== "/")) {
    throw new Error("OBJECT_STORAGE_CONFIGURATION_INVALID");
  }

  // The *.storage.supabase.co hostname is the dedicated S3 endpoint.
  // The REST Storage API must use the project's regular *.supabase.co API host.
  if (parsed.hostname.endsWith(".storage.supabase.co")) {
    const projectRef = parsed.hostname.slice(0, -".storage.supabase.co".length);
    if (!projectRef) throw new Error("OBJECT_STORAGE_CONFIGURATION_INVALID");
    parsed.hostname = projectRef + ".supabase.co";
  }

  return parsed.origin;
}
