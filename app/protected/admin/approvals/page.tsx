"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Search,
  Mail,
  ShieldAlert
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { sendWelcomeEmail } from "@/lib/notifications";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";


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
  const [, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "active" | "suspended">("pending");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const supabase = createClient();


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
      setError(error.message);
    } else {
      setCards((data as unknown as PendingCard[]) || []);
    }
    setLoading(false);
  }, [filter, supabase]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const handleApprove = async (cardId: string) => {
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

      setNotification({ message: "Card approved and welcome email sent!", type: 'success' });
      setTimeout(() => setNotification(null), 5000);

      // Refresh list
      setCards(cards => cards.filter(c => c.id !== cardId));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setNotification({ message: "Error approving card: " + message, type: 'error' });
      setTimeout(() => setNotification(null), 5000);
    } finally {
      setProcessingId(null);
    }
  };


  const handleSuspend = async (cardId: string) => {
    if (!confirm("Are you sure you want to suspend this card for disciplinary reasons?")) return;
    
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
      alert("Error suspending card: " + message);
    } finally {
      setProcessingId(null);
    }
  };

  const filteredCards = cards.filter(card => 
    card.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    card.profiles?.student_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    card.card_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="relative space-y-8 animate-in fade-in duration-500">
      {/* Toast Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className={`fixed top-6 left-1/2 z-[100] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border ${
              notification.type === 'success' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-red-600 border-red-500 text-white'
            }`}
          >
            {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span className="font-bold text-sm tracking-tight">{notification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">

        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">E-Library Card Management</h1>
          <p className="text-muted-foreground">Review, approve, or suspend student digital library cards.</p>
        </div>
        
        <div className="flex items-center gap-2 rounded-xl border border-border bg-muted p-1">
          {(["pending", "active", "suspended", "all"] as const).map((f) => (
            <Button
              key={f}
              onClick={() => setFilter(f)}
              variant="ghost"
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                filter === f 
                  ? "bg-card text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text" 
            placeholder="Search by name, ID, or card number..."
            className="w-full rounded-xl border border-border py-3 pl-10 pr-4 outline-none transition-all focus:ring-2 focus:ring-ring"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-transparent" />
          <p className="text-muted-foreground font-medium">Loading records...</p>
        </div>
      ) : filteredCards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-20 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-muted">
            {filter === 'pending' ? <CheckCircle2 className="text-muted-foreground w-8 h-8" /> : <Search className="text-muted-foreground w-8 h-8" />}
          </div>
          <h3 className="text-xl font-bold text-foreground">No {filter} cards found</h3>
          <p className="text-muted-foreground mt-2">Try changing your filter or search query.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <AnimatePresence mode="popLayout">
            {filteredCards.map((card) => (
              <motion.div
                key={card.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex gap-4">
                      <div className="h-14 w-14 rounded-2xl bg-muted overflow-hidden border border-border">
                        {card.profiles?.avatar_url ? (
                          <Image 
                            src={card.profiles.avatar_url} 
                            alt="" 
                            width={56} 
                            height={56} 
                            className="h-full w-full object-cover" 
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-muted-foreground font-bold text-xl">
                            {card.profiles?.full_name?.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div>
                        <h4 className="font-bold text-foreground">{card.profiles?.full_name}</h4>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span className="bg-muted px-1.5 py-0.5 rounded font-mono">{card.profiles?.student_id}</span>
                          <span>•</span>
                          <span>{card.profiles?.department}</span>
                        </div>
                      </div>
                    </div>
                    <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                      card.status === 'active' ? 'bg-emerald-50 text-emerald-600' :
                      card.status === 'pending' ? 'bg-amber-50 text-amber-600' :
                      'bg-red-50 text-red-600'
                    }`}>
                      {card.status}
                    </div>
                  </div>

                  <div className="bg-muted rounded-xl p-4 flex justify-between items-center mb-6">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Card Number</p>
                      <p className="font-mono font-bold text-muted-foreground">{card.card_number}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Requested</p>
                      <p className="text-xs text-muted-foreground">{new Date(card.issued_at).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {card.status === 'pending' && (
                      <Button
                        onClick={() => handleApprove(card.id)}
                        disabled={!!processingId}
                          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white transition-all hover:bg-primary/90 disabled:opacity-50"
                        >
                        {processingId === card.id ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : <Mail className="w-4 h-4" />}
                        Approve & Send Email
                      </Button>
                    )}
                    
                    {card.status === 'active' && (
                      <Button
                        onClick={() => handleSuspend(card.id)}
                        disabled={!!processingId}
                        variant="outline"
                        className="flex-1 bg-card border border-red-200 text-red-600 hover:bg-red-50 rounded-xl py-2.5 text-sm font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {processingId === card.id ? (
                          <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                        ) : <ShieldAlert className="w-4 h-4" />}
                        Suspend Card
                      </Button>
                    )}

                    {card.status === 'suspended' && (
                      <Button
                        onClick={() => handleApprove(card.id)}
                        disabled={!!processingId}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-700 py-2.5 text-sm font-semibold text-white transition-all hover:bg-primary/90 disabled:opacity-50"
                      >
                        Re-activate
                      </Button>
                    )}
                    
                    <Button variant="ghost" className="px-4 bg-muted hover:bg-muted text-muted-foreground rounded-xl py-2.5 transition-all outline-none">
                      <Clock className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
