import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type ResolveScanRequest = {
  scanValue: string;
  expectedType?: "auto" | "student" | "book";
};

type CardScanRow = {
  card_number: string;
  status: string;
  user_id: string;
  profiles:
    | {
        full_name: string | null;
        student_id: string | null;
        status: string | null;
      }[]
    | {
        full_name: string | null;
        student_id: string | null;
        status: string | null;
      }
    | null;
};

type BookScanRow = {
  id: string;
  qr_string: string;
  status: string;
  book_id: string;
  books:
    | {
        title: string | null;
      }[]
    | {
        title: string | null;
      }
    | null;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "librarian", "staff"].includes(profile.role)) {
    return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
  }

  let body: ResolveScanRequest;
  try {
    body = (await request.json()) as ResolveScanRequest;
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON payload" }, { status: 400 });
  }

  const scanValue = body.scanValue?.trim();
  const expectedType = body.expectedType ?? "auto";

  if (!scanValue) {
    return NextResponse.json({ ok: false, message: "Scanned value is required." }, { status: 400 });
  }

  if (expectedType !== "book") {
    const { data: card, error: cardError } = await supabase
      .from("library_cards")
      .select(`
        card_number,
        status,
        user_id,
        profiles:user_id (
          full_name,
          student_id,
          status
        )
      `)
      .eq("card_number", scanValue)
      .maybeSingle();

    if (cardError) {
      return NextResponse.json({ ok: false, message: cardError.message }, { status: 500 });
    }

    if (card) {
      const typedCard = card as CardScanRow;
      const profile = Array.isArray(typedCard.profiles) ? typedCard.profiles[0] : typedCard.profiles;
      
      // Early validation for student status
      if (typedCard.status?.toUpperCase() !== "ACTIVE") {
        return NextResponse.json(
          { ok: false, message: "Library card is not active." },
          { status: 400 }
        );
      }

      const profileStatus = profile?.status?.toUpperCase() ?? "ACTIVE";
      if (profileStatus !== "ACTIVE") {
        return NextResponse.json(
          { ok: false, message: `Student account is ${profileStatus.toLowerCase()}.` },
          { status: 400 }
        );
      }

      return NextResponse.json({
        ok: true,
        type: "student",
        data: {
          cardNumber: typedCard.card_number,
          status: typedCard.status,
          userId: typedCard.user_id,
          fullName: profile?.full_name ?? "Student",
          studentId: profile?.student_id ?? "N/A",
        },
      });
    }
  }

  if (expectedType !== "student") {
    const { data: copy, error: copyError } = await supabase
      .from("book_copies")
      .select(`
        id,
        qr_string,
        status,
        book_id,
        books:book_id (
          title
        )
      `)
      .eq("qr_string", scanValue)
      .maybeSingle();

    if (copyError) {
      return NextResponse.json({ ok: false, message: copyError.message }, { status: 500 });
    }

    if (copy) {
      const typedCopy = copy as BookScanRow;
      const book = Array.isArray(typedCopy.books) ? typedCopy.books[0] : typedCopy.books;
      return NextResponse.json({
        ok: true,
        type: "book",
        data: {
          copyId: typedCopy.id,
          qrString: typedCopy.qr_string,
          status: typedCopy.status,
          bookId: typedCopy.book_id,
          bookTitle: book?.title ?? "Unknown title",
        },
      });
    }
  }

  return NextResponse.json(
    {
      ok: false,
      code: "NOT_FOUND",
      message: "Scanned QR is not recognized by the circulation system.",
    },
    { status: 404 },
  );
}
