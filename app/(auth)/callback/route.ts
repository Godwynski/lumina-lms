import { createClient } from "@/lib/supabase/server";
import { ensureStaticLibraryCardAssets } from "@/lib/library-card-assets.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // if "next" is in param, use it as the redirection URL
  const next = searchParams.get("next") ?? "/dashboard";

  const providerError = searchParams.get("error_description") || searchParams.get("error");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // 1. Check if user already exists in profiles
        const { data: profile, error: profileCheckError } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", user.id)
          .maybeSingle();

        if (profileCheckError && profileCheckError.code !== 'PGRST116') {
          console.error("Profile check error:", profileCheckError);
        }

        // 2. If no profile exists, validate and create one
        if (!profile) {
          const email = user.email?.toLowerCase() || "";
          
          // Domain Validation
          // Student: lastname.id@Alabang.sti.edu.ph
          const isFaculty = /^[a-z0-9-]+\.[a-z0-9-]+@alabang\.sti\.edu\.ph$/.test(email);
          const isStudent = /^[a-z0-9-]+\.[a-z0-9-]+@alabang\.sti\.edu\.ph$/.test(email);
          const isTest = email.endsWith("@lumina.test");

          if (!isFaculty && !isStudent && !isTest) {
            await supabase.auth.signOut();
            return NextResponse.redirect(`${origin}/error?error=restricted_access`);
          }

          // Create initial profile using Admin Client to bypass RLS
          const admin = createAdminClient();
          const { error: createError } = await admin
            .from("profiles")
            .insert({
              id: user.id,
              email: email,
              full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
              avatar_url: user.user_metadata?.avatar_url || null,
              role: 'student', // Default role
              status: 'PENDING' // Require admin approval
            });

          if (createError) {
            console.error("Failed to create profile:", createError);
            return NextResponse.redirect(`${origin}/error?error=${encodeURIComponent("Failed to create user profile")}`);
          }
        }

        // 3. Provision assets (QR code, etc)
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

      return NextResponse.redirect(`${origin}${next}`);
    }

    if (error) {
      return NextResponse.redirect(`${origin}/error?error=${encodeURIComponent(error.message)}`);
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/error?error=${encodeURIComponent(providerError || "No code provided")}`);
}
