import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MANAGER_ROLES = new Set(["admin", "librarian", "staff"]);

type Role = "admin" | "librarian" | "staff" | "student";

function normalizeRole(value: unknown): Role | null {
  if (typeof value !== "string") return null;
  const role = value.trim().toLowerCase();
  if (role === "admin" || role === "librarian" || role === "staff" || role === "student") {
    return role;
  }
  return null;
}

function mapProfileToUser(row: Record<string, unknown>) {
  const createdAt = typeof row.created_at === "string" ? row.created_at : null;
  const created = createdAt ? new Date(createdAt) : null;
  const email = typeof row.email === "string" ? row.email : "";
  const nameFromEmail = email.split("@")[0]?.split(".").map((part) => part ? part[0].toUpperCase() + part.slice(1) : "").join(" ");
  return {
    id: String(row.id ?? ""),
    name: typeof row.full_name === "string" && row.full_name.trim() ? row.full_name : (nameFromEmail || "Unnamed User"),
    email,
    role: normalizeRole(row.role) ?? "student",
    status: typeof row.status === "string" ? row.status : "active",
    department: typeof row.department === "string" && row.department.trim() ? row.department : "General",
    joined: created
      ? created.toLocaleDateString("en-US", { month: "short", year: "numeric" })
      : "Unknown",
  };
}

async function getAuthorizedProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError) {
    return { error: NextResponse.json({ error: profileError.message }, { status: 400 }) };
  }

  const role = normalizeRole(profile?.role);
  if (!role || !MANAGER_ROLES.has(role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { supabase, role };
}

export async function GET() {
  const auth = await getAuthorizedProfile();
  if ("error" in auth) return auth.error;

  const { supabase } = auth;
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const users = (data ?? []).map((row) => mapProfileToUser(row as Record<string, unknown>));

  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const auth = await getAuthorizedProfile();
  if ("error" in auth) return auth.error;

  const { supabase } = auth;

  let body: { email?: unknown; role?: unknown; department?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = normalizeRole(body.role);
  const department = typeof body.department === "string" ? body.department.trim() : "";

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  if (!role) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  if (!profile) {
    return NextResponse.json(
      { error: "No existing account found for this email. Ask the user to sign up first." },
      { status: 404 },
    );
  }

  const updates: Record<string, unknown> = {};
  if (Object.prototype.hasOwnProperty.call(profile, "role")) updates.role = role;
  if (Object.prototype.hasOwnProperty.call(profile, "status")) updates.status = "pending";
  if (Object.prototype.hasOwnProperty.call(profile, "department")) updates.department = department || "General";

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No writable profile fields available" }, { status: 400 });
  }

  const { data: updated, error: updateError } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", profile.id)
    .select("*")
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  return NextResponse.json({ user: mapProfileToUser(updated as Record<string, unknown>) });
}

export async function PATCH(request: Request) {
  const auth = await getAuthorizedProfile();
  if ("error" in auth) return auth.error;

  const { supabase } = auth;

  let body: {
    id?: unknown;
    name?: unknown;
    email?: unknown;
    role?: unknown;
    status?: unknown;
    department?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) {
    return NextResponse.json({ error: "User id is required" }, { status: 400 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  const nextName = typeof body.name === "string" ? body.name.trim() : null;
  if (nextName && Object.prototype.hasOwnProperty.call(profile, "full_name")) {
    updates.full_name = nextName;
  }

  const nextEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : null;
  if (nextEmail && Object.prototype.hasOwnProperty.call(profile, "email")) {
    updates.email = nextEmail;
  }

  const nextRole = normalizeRole(body.role);
  if (nextRole && Object.prototype.hasOwnProperty.call(profile, "role")) {
    updates.role = nextRole;
  }

  const nextStatus = typeof body.status === "string" ? body.status.trim().toLowerCase() : null;
  if (nextStatus && Object.prototype.hasOwnProperty.call(profile, "status")) {
    updates.status = nextStatus;
  }

  const nextDepartment = typeof body.department === "string" ? body.department.trim() : null;
  if (nextDepartment !== null && Object.prototype.hasOwnProperty.call(profile, "department")) {
    updates.department = nextDepartment || "General";
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ user: mapProfileToUser(profile as Record<string, unknown>) });
  }

  const { data: updated, error: updateError } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  return NextResponse.json({ user: mapProfileToUser(updated as Record<string, unknown>) });
}
