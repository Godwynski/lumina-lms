"use client";

import { useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AlertCircle, ArrowLeft, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-4 text-center">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative mb-8 flex h-20 w-20 items-center justify-center rounded-3xl bg-destructive/10 text-destructive shadow-sm ring-1 ring-destructive/20"
      >
        <AlertCircle size={40} />
        <div className="absolute -inset-1 animate-pulse rounded-3xl bg-destructive/5" />
      </motion.div>

      <motion.h1
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
      >
        Something went wrong
      </motion.h1>

      <motion.p
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="mt-4 max-w-md text-muted-foreground"
      >
        An unexpected error occurred while processing your request. Our team has been notified.
      </motion.p>

      {process.env.NODE_ENV === "development" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-6 w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-muted/50 p-4 text-left text-xs text-muted-foreground"
        >
          <p className="font-mono font-bold uppercase tracking-wider text-muted-foreground">Error Digest: {error.digest}</p>
          <pre className="mt-2 overflow-auto whitespace-pre-wrap font-mono uppercase">
            {error.message || "No error message available"}
          </pre>
        </motion.div>
      )}

      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.4 }}
        className="mt-10 flex flex-col items-center gap-3 sm:flex-row"
      >
        <Button
          onClick={() => reset()}
          size="lg"
          className="h-12 w-full rounded-2xl bg-primary text-primary-foreground px-8 text-sm font-semibold shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98] sm:w-auto"
        >
          <RefreshCcw className="mr-2 h-4 w-4" />
          Try again
        </Button>
        <Link href="/" className="w-full sm:w-auto">
          <Button
            variant="outline"
            size="lg"
            className="h-12 w-full rounded-2xl border-input px-8 text-sm font-semibold hover:bg-muted sm:w-auto"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go to Home
          </Button>
        </Link>
      </motion.div>
    </div>
  );
}
