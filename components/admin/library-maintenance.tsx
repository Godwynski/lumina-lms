'use client'

import React, { useState } from 'react'
import { Wrench, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
    <Card className="border-primary/20 shadow-sm overflow-hidden">
      <CardHeader className="bg-primary/5 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
            <Wrench className="h-5 w-5" />
          </div>
          <CardTitle className="text-xl">Library Maintenance</CardTitle>
        </div>
        <CardDescription>
          Run automated checks for overdue books, due date reminders, and expired reservations.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="pt-6 space-y-4">
        <div className="bg-muted/30 p-4 rounded-lg border border-border/40 text-sm">
          <p className="font-medium mb-2">What this does:</p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>Notifies users with books due in 2 days.</li>
            <li>Sends alerts for overdue items.</li>
            <li>Cancels reservations ready for more than 3 days.</li>
          </ul>
        </div>

        {results && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                <p className="text-xs text-blue-600 font-medium uppercase tracking-wider">Reminders</p>
                <p className="text-2xl font-bold">{results.remindersSent}</p>
              </div>
              <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                <p className="text-xs text-amber-600 font-medium uppercase tracking-wider">Overdue Alerts</p>
                <p className="text-2xl font-bold">{results.overdueTagged}</p>
              </div>
              <div className="p-3 bg-rose-500/5 border border-rose-500/20 rounded-lg">
                <p className="text-xs text-rose-600 font-medium uppercase tracking-wider">Expired</p>
                <p className="text-2xl font-bold">{results.reservationsExpired}</p>
              </div>
            </div>

            {results.errors.length > 0 && (
              <div className="p-3 bg-destructive/5 border border-destructive/20 rounded-lg flex gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <div className="text-xs text-destructive">
                  <p className="font-semibold mb-1">Errors encountered:</p>
                  <ul className="list-disc list-inside">
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
          className="w-full h-12 text-base shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Processing Library Data...
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-2 h-5 w-5" />
              Execute Maintenance Tasks
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
