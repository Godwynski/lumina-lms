'use client';

import { useState } from 'react';
import { reportMissingBook } from '@/lib/actions/public-catalog';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ReportMissingButtonProps {
  bookId: string;
  disabled?: boolean;
  userType: 'student' | 'public';
}

export function ReportMissingButton({ bookId, disabled, userType }: ReportMissingButtonProps) {
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reported, setReported] = useState(false);

  const handleReportMissing = async () => {
    setReportSubmitting(true);
    try {
      const message = userType === 'student' 
        ? 'Student reported book missing from shelf.' 
        : 'User reported book missing from shelf.';
      await reportMissingBook(bookId, message);
      setReported(true);
    } catch (err) {
      console.error(err);
    } finally {
      setReportSubmitting(false);
    }
  };

  if (reported) {
    return (
      <div className="status-success border p-4 rounded-lg flex items-center justify-center">
        <p className="text-sm font-medium">Thank you! A librarian has been notified to check the shelf.</p>
      </div>
    );
  }

  return (
    <div className="pt-1">
      <Button
        onClick={handleReportMissing}
        disabled={reportSubmitting || disabled}
        variant="outline"
        className={
          userType === 'public'
            ? "flex items-center justify-center w-full py-3 px-4 border-destructive/30 text-destructive bg-destructive/5 rounded-lg hover:bg-destructive/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            : "h-9 w-full justify-center gap-2 text-xs"
        }
      >
        <AlertCircle className={userType === 'public' ? "w-5 h-5 mr-2" : "h-3.5 w-3.5"} />
        {reportSubmitting ? (userType === 'public' ? 'Submitting...' : 'Sending alert...') : "I can't find this book"}
      </Button>
      {disabled && (
        <p className="mt-2 text-xs text-center text-muted-foreground">
          This book is currently checked out, so it will not be on the shelf.
        </p>
      )}
    </div>
  );
}
