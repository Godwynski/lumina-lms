import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { student_id, pin } = await request.json();

  if (!student_id || !pin) {
    return NextResponse.json({ error: "student_id and pin are required" }, { status: 400 });
  }

  try {
    // 1. Find user by student_id
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("student_id", student_id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Invalid student_id" }, { status: 401 });
    }

    const userId = profile.id;

    // 2. Rate limiting check (last 30 mins)
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { count: failedCount } = await supabase
      .from("offline_auth_attempts")
      .select("*", { count: 'exact', head: true })
      .eq("student_id", student_id)
      .eq("is_successful", false)
      .gte("attempt_time", thirtyMinsAgo);

    if (failedCount !== null && failedCount >= 5) {
      // On 5th failure: Immediately invalidate the active PIN for this student
      const { data: pinsToInvalidate } = await supabase
        .from("offline_pins")
        .select("id")
        .eq("user_id", userId)
        .is("used_at", null)
        .gt("expires_at", new Date().toISOString());

      if (pinsToInvalidate && pinsToInvalidate.length > 0) {
        await supabase
          .from("offline_pins")
          .update({ expires_at: new Date().toISOString() })
          .in("id", pinsToInvalidate.map(p => p.id));
      }

      return NextResponse.json({ 
        error: "Too many failed attempts. PIN has been invalidated for security. Please contact librarian." 
      }, { status: 429 });
    }

    // 3. Find active PIN
    const { data: activePin } = await supabase
      .from("offline_pins")
      .select("*")
      .eq("user_id", userId)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!activePin) {
      return NextResponse.json({ error: "No active PIN found for this student. Contact librarian." }, { status: 404 });
    }

    // 4. Verify PIN
    const isValid = await bcrypt.compare(pin, activePin.pin_hash);

    // 5. Log attempt
    await supabase
      .from("offline_auth_attempts")
      .insert({
        student_id,
        is_successful: isValid,
      });

    if (!isValid) {
      return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
    }

    // 6. Success: Set used_at to prevent replay
    await supabase
      .from("offline_pins")
      .update({ used_at: new Date().toISOString() })
      .eq("id", activePin.id);

    // 7. Create Opaque Session Token
    const sessionToken = crypto.randomUUID();
    
    const { error: sessionError } = await supabase
      .from("offline_sessions")
      .insert({
        user_id: userId,
        session_token: sessionToken,
      });

    if (sessionError) throw sessionError;

    // 8. Return session token and set cookie
    const response = NextResponse.json({ 
      success: true, 
      session_token: sessionToken,
      expires_at: activePin.expires_at
    });

    response.cookies.set("offline_session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 2, // 2 hours
      path: "/",
      sameSite: "strict"
    });

    return response;

  } catch (error: any) {
    console.error("Offline access error:", error);
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
  }
}
