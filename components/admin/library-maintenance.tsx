'use client'

import React, { useState } from 'react'
import { Wrench, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export function LibraryMaintenance() {
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<{
    remindersSent: number
    overdueTagged: number
    reservationsExpired: number
    errors: string[]
  } | null>(null)

  const handleRunMaintenance = async () => {
    setLoading(true)
    setResults(null)
    try {
      const response = await fetch('/api/notifications/maintenance', {
        method: 'POST',
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to run maintenance')
      }
      
      setResults(data)
      toast.success('Library maintenance completed')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An unknown error occurred'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2">
        <div>
          <h2 className="text-xl font-black text-foreground tracking-tight">Library Maintenance</h2>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70 mt-1">
            Automated system health &amp; integrity checks
          </p>
        </div>
      </div>
      
      <div className="space-y-4">
        <div className="bg-muted/30 p-5 rounded-2xl border border-border/40 text-sm">
          <p className="font-bold mb-3 text-foreground/80 flex items-center gap-2">
             <Wrench className="h-4 w-4 text-primary" /> System Operations
          </p>
          <ul className="space-y-2 text-muted-foreground font-medium">
            <li className="flex items-center gap-2">
              <div className="h-1 w-1 rounded-full bg-primary/40" />
              Notifies users with books due in 2 days
            </li>
            <li className="flex items-center gap-2">
              <div className="h-1 w-1 rounded-full bg-primary/40" />
              Sends alerts for overdue items
            </li>
            <li className="flex items-center gap-2">
              <div className="h-1 w-1 rounded-full bg-primary/40" />
              Cancels reservations ready for more than 3 days
            </li>
          </ul>
        </div>

        {results && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl">
                <p className="text-[10px] text-blue-600 font-black uppercase tracking-[0.2em] mb-1">Reminders</p>
                <p className="text-2xl font-black text-blue-700">{results.remindersSent}</p>
              </div>
              <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl">
                <p className="text-[10px] text-amber-600 font-black uppercase tracking-[0.2em] mb-1">Overdue</p>
                <p className="text-2xl font-black text-amber-700">{results.overdueTagged}</p>
              </div>
              <div className="p-4 bg-rose-500/5 border border-rose-500/10 rounded-2xl">
                <p className="text-[10px] text-rose-600 font-black uppercase tracking-[0.2em] mb-1">Expired</p>
                <p className="text-2xl font-black text-rose-700">{results.reservationsExpired}</p>
              </div>
            </div>

            {results.errors.length > 0 && (
              <div className="p-4 bg-destructive/5 border border-destructive/10 rounded-2xl flex gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
                <div className="text-xs text-destructive/80 font-medium">
                  <p className="font-bold mb-1 text-destructive uppercase tracking-wider">Maintenance Logs:</p>
                  <ul className="list-disc list-inside opacity-90">
                    {results.errors.map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        <Button 
          onClick={handleRunMaintenance} 
          disabled={loading}
          className="w-full h-12 rounded-2xl text-sm font-black uppercase tracking-widest shadow-xl shadow-primary/10 hover:shadow-primary/20 transition-all active:scale-[0.98]"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Optimizing Database...
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Execute System Maintenance
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
