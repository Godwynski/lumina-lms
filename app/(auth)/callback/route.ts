import { createClient } from "@/lib/supabase/server";
import { ensureStaticLibraryCardAssets } from "@/lib/library-card-assets.server";
import { NextResponse } from "next/server";
import { safeNextPath } from "@/lib/utils";

export const dynamic = "force-dynamic";

function parseEnvHost(raw: string | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  try {
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    return new URL(withScheme).host.toLowerCase();
  } catch {
    return null;
  }
}

function getAllowedForwardedHosts(): Set<string> {
  const hosts = new Set<string>();
  for (const envVar of [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
  ]) {
    const host = parseEnvHost(envVar);
    if (host) hosts.add(host);
  }
  return hosts;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  const forwardedHost = request.headers.get("x-forwarded-host")?.trim().toLowerCase();
  const isLocalEnv = process.env.NODE_ENV === "development";
  const allowedHosts = getAllowedForwardedHosts();
  const host = isLocalEnv
    ? origin
    : forwardedHost && allowedHosts.has(forwardedHost)
      ? `https://${forwardedHost}`
      : origin;

  const providerError = searchParams.get("error_description") || searchParams.get("error");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // The profile already exists: the handle_new_user trigger creates it at sign-up
        // and rejects non-school email domains there.
        try {
          await ensureStaticLibraryCardAssets({
            userId: user.id,
            fallbackEmail: user.email,
            fallbackAvatarUrl:
              (user.user_metadata?.avatar_url as string | undefined) || null,
          });
        } catch (assetError) {
          console.error("Failed to provision static card assets:", assetError);
          // We don't block login if asset provisioning fails, as long as the profile exists
        }
      }

      return NextResponse.redirect(`${host}${next}`);
    }

    if (error) {
      console.error("[AUTH CALLBACK] Code exchange error:", error);
      return NextResponse.redirect(`${host}/error?error=${encodeURIComponent(error.message)}`);
    }
  }

  // Supabase reports the sign-up trigger's domain rejection as this generic error.
  if (providerError?.includes("Database error saving new user")) {
    return NextResponse.redirect(`${host}/error?error=restricted_access`);
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${host}/error?error=${encodeURIComponent(providerError || "No code provided")}`);
}
