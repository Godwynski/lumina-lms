"use client"

import { Logo } from "@/components/layout/Logo"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"

interface ViolationTicketProps {
  data: {
    case_number: string | null
    violation_type: string
    description: string
    points: number
    severity: string
    incident_date: string
    profiles: {
      full_name: string
      email: string
    } | null
    created_at: string
  }
}

export function ViolationTicket({ data }: ViolationTicketProps) {
  const containerId = `ticket-${data.case_number?.replace(/[^a-zA-Z0-9]/g, '-')}`

  return (
    <div 
      id={containerId}
      className="w-[800px] bg-white p-12 text-black font-sans relative overflow-hidden flex flex-col gap-8"
      style={{ minHeight: '1000px' }}
    >
      {/* Decorative Watermark */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03] rotate-[-30deg] pointer-events-none">
        <Logo size={500} />
      </div>

      {/* Header */}
      <div className="flex items-start justify-between border-b-4 border-black pb-6">
        <div className="flex items-center gap-4">
          <Logo size={48} className="bg-black" />
          <div>
            <h1 className="text-3xl font-black tracking-tighter uppercase">Lumina Library</h1>
            <p className="text-sm font-bold tracking-widest uppercase opacity-60">Official Referral Ticket</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold uppercase tracking-widest opacity-40">Case Number</p>
          <p className="text-2xl font-black font-mono">{data.case_number || 'N/A'}</p>
        </div>
      </div>

      {/* To Section */}
      <div className="grid grid-cols-2 gap-12">
        <div className="space-y-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-1">To: Guidance Office</p>
            <div className="h-0.5 w-12 bg-black" />
          </div>
          <div className="space-y-1">
            <p className="text-sm">Please be informed that the student listed below has been recorded for a behavior violation within the library premises.</p>
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-1">Incident Date</p>
            <div className="h-0.5 w-12 bg-black" />
          </div>
          <p className="text-lg font-bold">
            {format(new Date(data.incident_date), "MMMM dd, yyyy")}
          </p>
        </div>
      </div>

      {/* Student Profile Box */}
      <div className="bg-gray-50 border-2 border-black p-6 rounded-sm">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-4">Subject Profile</p>
        <div className="grid grid-cols-2 gap-8">
          <div>
            <Label text="Full Name" />
            <p className="text-xl font-black uppercase">{data.profiles?.full_name || 'N/A'}</p>
          </div>
          <div>
            <Label text="Email Address" />
            <p className="text-xl font-mono font-bold">{data.profiles?.email || 'N/A'}</p>
          </div>
        </div>
      </div>

      {/* Incident Details */}
      <div className="flex-1 space-y-8">
        <div>
          <Label text="Offense / Violation Name" />
          <div className="mt-2 border-b-2 border-black pb-2">
            <p className="text-2xl font-black uppercase leading-tight">{data.violation_type}</p>
          </div>
        </div>

        <div>
          <Label text="Incident Narrative / Description" />
          <p className="mt-4 text-lg italic leading-relaxed text-gray-800 border-l-4 border-gray-200 pl-6">
            {data.description ? `"${data.description}"` : "No additional description provided."}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-8">
          <div>
            <Label text="Demerit Points" />
            <p className="text-3xl font-black">{data.points} pts</p>
          </div>
          <div>
            <Label text="Severity" />
            <div className="mt-2">
              <Badge className="bg-black text-white hover:bg-black uppercase px-4 py-1.5 text-xs font-bold rounded-none">
                {data.severity}
              </Badge>
            </div>
          </div>
          <div>
            <Label text="Form Status" />
            <p className="mt-2 text-sm font-bold uppercase tracking-widest text-green-600 font-mono">REFERRED_TO_GUIDANCE</p>
          </div>
        </div>
      </div>

      {/* Signatures */}
      <div className="mt-auto grid grid-cols-2 gap-24 pt-12 border-t-2 border-gray-100">
        <div className="space-y-4">
          <div className="h-px bg-black opacity-30" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-center">Librarian / Reporting Officer</p>
          <p className="text-[10px] text-center opacity-40 uppercase">(Signature Over Printed Name)</p>
        </div>
        <div className="space-y-4">
          <div className="h-px bg-black opacity-30" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-center">Guidance Office Acknowledgement</p>
          <p className="text-[10px] text-center opacity-40 uppercase">Date Received: ____ / ____ / ________</p>
        </div>
      </div>

      {/* Footer Branding */}
      <div className="text-center pt-8">
        <p className="text-[9px] font-bold uppercase tracking-[0.5em] opacity-30">Lumina LMS Behavior Management Module &copy; 2026</p>
      </div>
    </div>
  )
}

function Label({ text }: { text: string }) {
  return <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-1">{text}</p>
}
