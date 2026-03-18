import { NextResponse } from "next/server";

export async function POST(request: Request) {
  let body: { student_id?: string; pin?: string };

  try {
    body = (await request.json()) as { student_id?: string; pin?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const student_id = body.student_id?.trim();
  const pin = body.pin?.trim();

  if (!student_id || !pin) {
    return NextResponse.json({ error: "student_id and pin are required" }, { status: 400 });
  }

  const upstream = new URL("/api/offline/validate", request.url);
  const proxied = await fetch(upstream, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: request.headers.get("cookie") ?? "",
    },
    body: JSON.stringify({ student_id, pin }),
  });

  const data = await proxied.json();
  const response = NextResponse.json(data, { status: proxied.status });
  const setCookie = proxied.headers.get("set-cookie");

  if (setCookie) {
    response.headers.set("set-cookie", setCookie);
  }

  return response;
}
