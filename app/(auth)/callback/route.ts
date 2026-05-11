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
        // 1. Check if user already exists in profiles (ignore filter for existing users)
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", user.id)
          .single();

        if (!profile) {
          const email = user.email?.toLowerCase() || "";
          
          // Faculty: firstname.lastname@alabang.sti.edu.ph
          // Student: lastname.id.@Alabang.sti.edu.ph
          const isFaculty = /^[a-z0-9-]+\.[a-z0-9-]+@alabang\.sti\.edu\.ph$/.test(email);
          const isStudent = /^[a-z0-9-]+\.[a-z0-9-]+\.@alabang\.sti\.edu\.ph$/.test(email);

          if (!isFaculty && !isStudent && !email.endsWith("@lumina.test")) {
            await supabase.auth.signOut();
            return NextResponse.redirect(`${origin}/error?error=restricted_access`);
          }
        }

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
  return NextResponse.redirect(`${origin}/error`);
}
