'use client';

import { User, Bookmark, CheckCircle2 } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export interface ActiveStudent {
  cardNumber: string;
  fullName: string;
  studentId: string;
  status: string;
}

export interface MemberPreviewProps {
  student: ActiveStudent;
}

/**
 * Reusable preview card displaying verified member/student identity in circulation workflows.
 */
export function MemberPreview({ student }: MemberPreviewProps) {
  return (
    <div className="mb-8 p-4 rounded-2xl bg-primary/5 border border-primary/10 flex items-center gap-4">
      <Avatar className="h-10 w-10 border border-primary/20 bg-background">
        <AvatarFallback>
          <User className="h-5 w-5 text-primary/60" />
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="text-xs font-bold truncate">{student.fullName}</h4>
          <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[9px] font-bold uppercase tracking-wider">
            {student.status}
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
          <Bookmark className="h-3 w-3" />
          {student.studentId}
        </p>
      </div>
      <CheckCircle2 className="h-4 w-4 text-primary" />
    </div>
  );
}
