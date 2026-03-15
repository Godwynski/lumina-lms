import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const OFFLINE_JWT_SECRET = process.env.OFFLINE_JWT_SECRET || "fallback_secret";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { pin } = await request.json();

  if (!pin || pin.length !== 6) {
    return NextResponse.json({ error: "Invalid PIN format" }, { status: 400 });
  }

  try {
    // 1. Get current active PIN
    const { data: activePins } = await supabase
      .from("offline_pins")
      .select("*")
      .eq("is_revoked", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (!activePins || activePins.length === 0) {
      return NextResponse.json({ error: "No active emergency PIN found. Please contact librarian." }, { status: 404 });
    }

    const currentPin = activePins[0];

    // 2. Brute-force protection: Check attempts in last 30 mins
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { count: attemptCount } = await supabase
      .from("offline_access_logs")
      .select("*", { count: 'exact', head: true })
      .eq("pin_id", currentPin.id)
      .gte("attempt_time", thirtyMinsAgo)
      .eq("is_successful", false);

    if (attemptCount !== null && attemptCount >= 5) {
      // Invalidate PIN
      await supabase
        .from("offline_pins")
        .update({ is_revoked: true })
        .eq("id", currentPin.id);
        
      return NextResponse.json({ error: "PIN invalidated due to multiple failed attempts. Librarian notified." }, { status: 429 });
    }

    // 3. Verify PIN
    const isValid = await bcrypt.compare(pin, currentPin.pin_hash);

    // 4. Log attempt
    await supabase
      .from("offline_access_logs")
      .insert({
        pin_id: currentPin.id,
        is_successful: isValid
      });

    if (!isValid) {
      return NextResponse.json({ error: "Incorrect PIN" }, { status: 401 });
    }

    // 5. Issue opaque offline token
    const token = jwt.sign(
      { 
        type: "OFFLINE_EMERGENCY", 
        exp: Math.floor(new Date(currentPin.expires_at).getTime() / 1000) 
      },
      OFFLINE_JWT_SECRET
    );

    const response = NextResponse.json({ success: true, redirect: "/protected/resources" });
    
    // Set cookie
    response.cookies.set("offline_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7200, // 2 hours
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("PIN validation error:", error);
    return NextResponse.json({ error: "Validation failed" }, { status: 500 });
  }
}
