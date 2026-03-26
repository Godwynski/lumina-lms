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
import { AdminTableShell } from "@/components/admin/AdminTableShell";


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

  const filteredCards = cards.filter(card => {
    const fullName = card.profiles?.full_name?.toLowerCase() || '';
    const studentId = card.profiles?.student_id?.toLowerCase() || '';
    const cardNumber = card.card_number?.toLowerCase() || '';
    const search = searchQuery.toLowerCase();

    return fullName.includes(search) || 
           studentId.includes(search) || 
           cardNumber.includes(search);
  });

  const totalPages = Math.max(1, Math.ceil(filteredCards.length / pageSize));
  const paginatedCards = filteredCards.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filter]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  return (
    <AdminTableShell
      title="Card Approvals"
      description="Review and update student library card status quickly."
      headerActions={(
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
      )}
      feedback={
        notification ? (
          <div
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
              notification.type === "success"
                ? "status-success"
                : "status-danger"
            }`}
          >
            {notification.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <span>{notification.message}</span>
          </div>
        ) : null
      }
      controls={(
        <div className="relative w-full sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by name, ID, or card #"
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      )}
      pagination={
        !loading && filteredCards.length > 0 ? (
          <CompactPagination
            page={currentPage}
            totalItems={filteredCards.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          />
        ) : null
      }
    >
      <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/60">
                <th className="px-4 py-2.5 font-medium text-muted-foreground">Student</th>
                <th className="px-4 py-2.5 font-medium text-muted-foreground">Card</th>
                <th className="px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-2.5 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    Loading...
                  </td>
                </tr>
              ) : paginatedCards.length > 0 ? (
                paginatedCards.map((card) => (
                  <tr key={card.id} className="hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="h-8 w-8 overflow-hidden rounded-md border border-border bg-muted">
                          {card.profiles?.avatar_url ? (
                            <Image src={card.profiles.avatar_url} alt="" width={32} height={32} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-muted-foreground">
                              {card.profiles?.full_name?.charAt(0)}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{card.profiles?.full_name}</p>
                          <p className="truncate text-xs text-muted-foreground">{card.profiles?.student_id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      <p className="font-medium text-foreground">{card.card_number}</p>
                      <p>{card.profiles?.department}</p>
                      <p>{new Date(card.issued_at).toLocaleDateString()}</p>
                    </td>
                    <td className="px-4 py-3">
                      <CardStatusBadge status={card.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
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
                            className="h-8 px-3 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                          >
                            <ShieldAlert className="mr-1 h-3.5 w-3.5" />
                            Suspend
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No results found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
    </AdminTableShell>
  );
}

function CardStatusBadge({ status }: { status: PendingCard["status"] }) {
  const styles: Record<PendingCard["status"], string> = {
    active: "status-success",
    pending: "status-warning",
    suspended: "status-danger",
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${styles[status]}`}>
      {status}
    </span>
  );
}
