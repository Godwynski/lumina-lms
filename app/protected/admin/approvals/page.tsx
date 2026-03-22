"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { 
  CheckCircle2, 
  AlertCircle,
  Search,
  ShieldAlert
} from "lucide-react";
import { sendWelcomeEmail } from "@/lib/notifications";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CompactPagination } from "@/components/ui/compact-pagination";


interface PendingCard {
  id: string;
  user_id: string;
  card_number: string;
  status: "pending" | "active" | "suspended";
  issued_at: string;
  profiles: {
    full_name: string;
    student_id: string;
    department: string;
    avatar_url: string;
    email: string | null;
  };
}

export default function ApprovalsPage() {
  const [cards, setCards] = useState<PendingCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "active" | "suspended">("pending");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  const supabase = createClient();
  const filterLabels: Record<typeof filter, string> = {
    all: "All",
    pending: "Pending",
    active: "Active",
    suspended: "Suspended",
  };


  const fetchCards = React.useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("library_cards")
      .select(`
        *,
        profiles:user_id (
          full_name,
          student_id,
          department,
          avatar_url,
          email
        )
      `);

    if (filter !== "all") {
      query = query.eq("status", filter);
    } else {
      query = query.order("issued_at", { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
      setNotification({ message: error.message || "Failed to load records.", type: "error" });
    } else {
      setCards((data as unknown as PendingCard[]) || []);
    }
    setLoading(false);
  }, [filter, supabase]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const handleApprove = async (cardId: string) => {
    if (processingId) return;
    setProcessingId(cardId);
    try {
      // 1. Update card status
      const { error: updateError } = await supabase
        .from("library_cards")
        .update({ status: "active" })
        .eq("id", cardId);

      if (updateError) throw updateError;

      // 2. Trigger automated email
      // Note: This requires service_role for admin tasks, but for mock purposes:
      // In a real app, we would fetch the email from supabase.auth.admin or have it in the profiles table.
      const targetCard = cards.find((c) => c.id === cardId);
      const recipientEmail = targetCard?.profiles?.email;
      if (!recipientEmail) {
        throw new Error("Student email not found for card holder");
      }

      await sendWelcomeEmail(
        targetCard?.profiles.full_name || "Student",
        recipientEmail
      );

      setNotification({ message: "Card approved and email sent.", type: 'success' });
      setTimeout(() => setNotification(null), 5000);

      // Refresh list
      setCards(cards => cards.filter(c => c.id !== cardId));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setNotification({ message: "Failed to approve card: " + message, type: 'error' });
      setTimeout(() => setNotification(null), 5000);
    } finally {
      setProcessingId(null);
    }
  };


  const handleSuspend = async (cardId: string) => {
    if (!confirm("Suspend this card?")) return;
    if (processingId) return;
    
    setProcessingId(cardId);
    try {
      const { error: updateError } = await supabase
        .from("library_cards")
        .update({ status: "suspended" })
        .eq("id", cardId);

      if (updateError) throw updateError;
      
      fetchCards();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setNotification({ message: "Failed to suspend card: " + message, type: "error" });
      setTimeout(() => setNotification(null), 5000);
    } finally {
      setProcessingId(null);
    }
  };

  const filteredCards = cards.filter(card => 
    card.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    card.profiles?.student_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    card.card_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filteredCards.length / pageSize));
  const paginatedCards = filteredCards.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filter]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
      <div className="flex flex-col justify-between gap-3 border-b border-border pb-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Card Approvals</h1>
          <p className="text-sm text-muted-foreground">Review and update student library card status quickly.</p>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {(["pending", "active", "suspended", "all"] as const).map((f) => (
            <Button
              key={f}
              onClick={() => setFilter(f)}
              variant={filter === f ? "default" : "outline"}
              className="h-8 px-3 text-xs"
            >
              {filterLabels[f]}
            </Button>
          ))}
        </div>
      </div>

      {notification && (
        <div
          className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
            notification.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {notification.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <span>{notification.message}</span>
        </div>
      )}

      <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text" 
            placeholder="Search by name, ID, or card #"
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-transparent" />
          <p className="text-muted-foreground font-medium">Loading...</p>
        </div>
      ) : filteredCards.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-16 text-center">
          <h3 className="text-lg font-semibold text-foreground">No results found</h3>
          <p className="mt-1 text-sm text-muted-foreground">Try adjusting filter or search.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="divide-y divide-border">
            {paginatedCards.map((card) => (
              <div key={card.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="h-10 w-10 overflow-hidden rounded-md border border-border bg-muted">
                    {card.profiles?.avatar_url ? (
                      <Image src={card.profiles.avatar_url} alt="" width={40} height={40} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-muted-foreground">
                        {card.profiles?.full_name?.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{card.profiles?.full_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {card.profiles?.student_id} - {card.profiles?.department}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {card.card_number} - {new Date(card.issued_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`text-xs font-medium capitalize ${
                      card.status === "active"
                        ? "text-emerald-600"
                        : card.status === "pending"
                        ? "text-amber-600"
                        : "text-red-600"
                    }`}
                  >
                    {card.status}
                  </span>

                  {card.status !== "active" && (
                    <Button
                      onClick={() => handleApprove(card.id)}
                      disabled={processingId === card.id}
                      className="h-8 px-3 text-xs"
                    >
                      {processingId === card.id ? "Processing..." : card.status === "pending" ? "Approve" : "Re-activate"}
                    </Button>
                  )}

                  {card.status === "active" && (
                    <Button
                      onClick={() => handleSuspend(card.id)}
                      disabled={processingId === card.id}
                      variant="outline"
                      className="h-8 px-3 text-xs text-red-600 hover:text-red-600"
                    >
                      <ShieldAlert className="mr-1 h-3.5 w-3.5" />
                      Suspend
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-border p-2">
            <CompactPagination
              page={currentPage}
              totalItems={filteredCards.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
            />
          </div>
        </div>
      )}
    </div>
  );
}
