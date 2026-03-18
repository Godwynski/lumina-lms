import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

type ProfileRole = "admin" | "librarian" | "staff" | "student";

export async function POST(request: Request) {
  const supabase = await createClient();
  const body = await request.json();
  const { pin, student_id } = body;

  if (!pin || pin.length !== 6) {
    return NextResponse.json({ error: "Invalid PIN format" }, { status: 400 });
  }

  if (!student_id || typeof student_id !== "string" || !student_id.trim()) {
    return NextResponse.json({ error: "Student ID is required" }, { status: 400 });
  }

  const normalizedStudentId = student_id.trim().toUpperCase();

  try {
    // ── 1. Per-student brute-force protection ──────────────────────────────
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { count: attemptCount } = await supabase
      .from("offline_auth_attempts")
      .select("*", { count: "exact", head: true })
      .eq("student_id", normalizedStudentId)
      .eq("is_successful", false)
      .gte("attempt_time", thirtyMinsAgo);

    if (attemptCount !== null && attemptCount >= 5) {
      // Invalidate the active PIN on the 5th strike
      const { data: pinToInvalidate } = await supabase
        .from("offline_pins")
        .select("id")
        .gt("expires_at", new Date().toISOString())
        .is("used_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pinToInvalidate) {
        await supabase
          .from("offline_pins")
          .update({ expires_at: new Date().toISOString() })
          .eq("id", pinToInvalidate.id);
      }

      // Notify librarian via notifications table
      await supabase.from("notifications").insert({
        type: "security_alert",
        message: `Offline PIN locked: 5 failed attempts detected for student ID "${normalizedStudentId}" within 30 minutes. Offline PIN has been invalidated.`,
        is_read: false,
      }).select(); // don't throw if this table doesn't exist yet

      return NextResponse.json(
        {
          error:
            "PIN invalidated due to multiple failed attempts. Librarian notified. Please return to the library desk.",
        },
        { status: 429 }
      );
    }

    const { data: targetProfile, error: targetProfileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("student_id", normalizedStudentId)
      .single();

    if (targetProfileError || !targetProfile) {
      return NextResponse.json(
        { error: "Invalid student ID. Please return to the desk." },
        { status: 401 }
      );
    }

    if ((targetProfile.role as ProfileRole) !== "student") {
      return NextResponse.json(
        { error: "Offline emergency PIN is available for students only." },
        { status: 403 }
      );
    }

    // ── 2. Get the current active, unused PIN ──────────────────────────────
    const { data: activePins } = await supabase
      .from("offline_pins")
      .select("*")
      .gt("expires_at", new Date().toISOString())
      .is("used_at", null) // ← replay attack prevention: must be unused
      .order("created_at", { ascending: false });

    if (!activePins || activePins.length === 0) {
      return NextResponse.json(
        {
          error:
            "No active emergency PIN found. Please contact the librarian at the desk.",
        },
        { status: 404 }
      );
    }

    const currentPin = activePins[0];

    // ── 3. Verify PIN hash ─────────────────────────────────────────────────
    const isValid = await bcrypt.compare(pin, currentPin.pin_hash);

    // ── 4. Log the attempt (per student_id) ───────────────────────────────
    await supabase.from("offline_auth_attempts").insert({
      student_id: normalizedStudentId,
      is_successful: isValid,
    });

    if (!isValid) {
      // Check if this was the 5th failure (just inserted above)
      const { count: newCount } = await supabase
        .from("offline_auth_attempts")
        .select("*", { count: "exact", head: true })
        .eq("student_id", normalizedStudentId)
        .eq("is_successful", false)
        .gte("attempt_time", thirtyMinsAgo);

      if (newCount !== null && newCount >= 5) {
        // Invalidate PIN and notify librarian
        await supabase
          .from("offline_pins")
          .update({ expires_at: new Date().toISOString() })
          .eq("id", currentPin.id);

        await supabase.from("notifications").insert({
          type: "security_alert",
          message: `Offline PIN locked: student ID "${normalizedStudentId}" failed PIN entry 5 times. PIN has been invalidated. Student must return to the desk.`,
          is_read: false,
        }).select();

        return NextResponse.json(
          {
            error:
              "Too many failed attempts. This PIN has been invalidated and the librarian has been notified. Please return to the library desk.",
          },
          { status: 429 }
        );
      }

      return NextResponse.json({ error: "Incorrect PIN" }, { status: 401 });
    }

    // ── 5. Consume PIN (replay attack prevention) ──────────────────────────
    await supabase
      .from("offline_pins")
      .update({ used_at: new Date().toISOString() })
      .eq("id", currentPin.id);

    // ── 6. Issue opaque offline session token ─────────────────────────────
    const sessionToken = crypto.randomUUID();

    const { error: sessionError } = await supabase
      .from("offline_sessions")
      .insert({
        user_id: targetProfile.id,
        session_token: sessionToken,
      });

    if (sessionError) throw sessionError;

    const response = NextResponse.json({
      success: true,
      redirect: "/protected/resources",
    });

    // Set opaque session cookie (httpOnly — not accessible from JS)
    response.cookies.set("offline_session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7200, // 2 hours
      path: "/",
    });

    return response;
  } catch (error: unknown) {
    console.error("PIN validation error:", error);
    return NextResponse.json({ error: "Validation failed" }, { status: 500 });
  }
}
