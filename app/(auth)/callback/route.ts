import { createClient } from "@/lib/supabase/server";
import { ensureStaticLibraryCardAssets } from "@/lib/library-card-assets.server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // if "next" is in param, use it as the redirection URL
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        try {
          await ensureStaticLibraryCardAssets({
            userId: user.id,
            fallbackEmail: user.email,
            fallbackAvatarUrl:
              (user.user_metadata?.avatar_url as string | undefined) || null,
          });
        } catch (assetError) {
          console.error("Failed to provision static card assets:", assetError);
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/error`);
}
