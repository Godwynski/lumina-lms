'use client'

import { useCallback, useState, useTransition, use } from 'react'
import { useRouter } from 'next/navigation'
import {
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Plus,
  Search,
  Trash2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatDate } from '@/lib/utils'
import { AdminTableShell } from '@/components/admin/AdminTableShell'
import { RecordViolationModal } from '@/components/admin/RecordViolationModal'
import {
  deleteViolation,
  resolveViolation,
  referToGuidance,
  type ViolationWithProfile,
  type ViolationStats,
} from '@/lib/actions/violations'
import { ViolationTicket } from '@/components/admin/ViolationTicket'

type Props = {
  dataPromise: Promise<{ violations: ViolationWithProfile[]; stats: ViolationStats; role: string }>
}

export default function ViolationsClient({ dataPromise }: Props) {
  const { violations: initialViolations, role } = use(dataPromise)
  const router = useRouter()
  const isStudent = role === 'student'
  const [isPending, startTransition] = useTransition()
  const violations = initialViolations
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [resolveModalOpen, setResolveModalOpen] = useState<ViolationWithProfile | null>(null)
  const [resolveNotes, setResolveNotes] = useState('')
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<ViolationWithProfile | null>(null)
  const [isExporting, setIsExporting] = useState<string | null>(null)

  const refreshViolations = useCallback(() => {
    startTransition(() => {
      router.refresh()
    })
  }, [router])

  const handleResolveViolation = () => {
    if (!resolveModalOpen) return

    startTransition(async () => {
      try {
        await resolveViolation(resolveModalOpen.id, resolveNotes)
        setNotice({ type: 'success', message: 'Violation marked as resolved' })
        void refreshViolations()
      } catch {
        setNotice({ type: 'error', message: 'Failed to resolve violation' })
      } finally {
        setResolveModalOpen(null)
        setResolveNotes('')
      }
    })
  }

  const handleReferToGuidance = (violationId: string) => {
    startTransition(async () => {
      try {
        await referToGuidance(violationId)
        setNotice({ type: 'success', message: 'Violation referred to Guidance Office' })
        void refreshViolations()
      } catch {
        setNotice({ type: 'error', message: 'Failed to refer violation' })
      }
    })
  }

  const handleExportTicket = async (v: ViolationWithProfile) => {
    if (isExporting) return
    setIsExporting(v.id)
    
    try {
      // Small timeout to ensure the ticket is rendered in the DOM before capture
      await new Promise(resolve => setTimeout(resolve, 100))
      
      const { toPng } = await import('html-to-image')
      const elementId = `ticket-${v.case_number?.replace(/[^a-zA-Z0-9]/g, '-')}`
      const el = document.getElementById(elementId)
      
      if (!el) throw new Error('Ticket element not found')
      
      const dataUrl = await toPng(el, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      })
      
      const link = document.createElement('a')
      link.download = `referral-ticket-${v.case_number || v.id}.png`
      link.href = dataUrl
      link.click()
    } catch {
      setNotice({ type: 'error', message: 'Failed to generate ticket' })
    } finally {
      setIsExporting(null)
    }
  }

  const filteredViolations = violations.filter((v) => {
    const searchLower = searchQuery.toLowerCase()
    const matchesStatus = statusFilter === 'all' || v.status?.toLowerCase() === statusFilter.toLowerCase()
    
    const matchesSearch = !searchQuery ||
      v.profiles?.full_name?.toLowerCase().includes(searchLower) ||
      v.profiles?.student_id?.toLowerCase().includes(searchLower) ||
      v.case_number?.toLowerCase().includes(searchLower) ||
      v.violation_type.toLowerCase().includes(searchLower) ||
      v.description.toLowerCase().includes(searchLower)

      return matchesStatus && matchesSearch
  })

  const getSeverityColor = (sev: string) => {
    switch(sev.toLowerCase()) {
      case 'severe': return 'bg-red-200 text-red-900 border-red-300'
      case 'major': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'moderate': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      default: return 'bg-blue-100 text-blue-800 border-blue-200'
    }
  }

  return (
    <>
      <AdminTableShell
        title="Violations Management"
        description="Official school violation activity and referral log."
        headerActions={!isStudent && (
          <Button onClick={() => setCreateModalOpen(true)} size="sm" className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            Record Violation
          </Button>
        )}
        feedback={
          notice && (
            <div
              className={`rounded-lg border px-4 py-3 text-sm ${
                notice.type === 'success'
                  ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                  : 'border-destructive/20 bg-destructive/10 text-destructive'
              }`}
            >
              {notice.message}
            </div>
          )
        }
        controls={
          <>
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, ID, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex w-full sm:w-auto overflow-x-auto whitespace-nowrap scrollbar-hide gap-1 pb-1">
              {(['all', 'active', 'referred', 'resolved'] as const).map((tab) => (
                <Button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  variant={statusFilter === tab ? 'default' : 'outline'}
                  className="h-8 px-3 text-xs capitalize"
                >
                  {tab === 'all' ? 'All Records' : tab}
                </Button>
              ))}
            </div>
          </>
        }
      >
        <div className="w-full overflow-hidden">
          <div className="md:hidden flex flex-col divide-y divide-border">
            {isPending ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Loading...</div>
            ) : filteredViolations.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No violations found</div>
            ) : (
              filteredViolations.map((v) => (
                  <div key={v.id} className="p-4 flex flex-col gap-3 hover:bg-muted/40 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                       <div className="min-w-0">
                         <div className="flex items-center gap-2">
                           <p className="font-medium text-foreground truncate">{v.profiles?.full_name || 'Unknown'}</p>
                           <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-muted rounded border">{v.case_number}</span>
                         </div>
                         <p className="text-xs text-muted-foreground truncate">{v.profiles?.email || 'N/A'}</p>
                       </div>
                       <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide shrink-0 ${
                          v.status === 'active'
                            ? 'bg-orange-100 text-orange-800'
                            : v.status === 'resolved'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {v.status === 'active' && <Clock className="h-3 w-3" />}
                        {v.status === 'resolved' && <CheckCircle2 className="h-3 w-3" />}
                        {v.status}
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2 text-xs bg-muted/40 rounded p-2">
                      <span className="font-bold uppercase text-foreground">{v.violation_type}</span>
                      <span className="text-muted-foreground">•</span>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide border ${getSeverityColor(v.severity)}`}>
                        {v.severity}
                      </span>
                      <span className="text-muted-foreground">•</span>
                      <span className="font-medium">{v.points} pts</span>
                    </div>

                    <p className="text-sm text-foreground">{v.description}</p>
                    <p className="text-xs text-muted-foreground text-right">{formatDate(v.created_at)}</p>

                    {!isStudent && (
                        <div className="flex items-center gap-2 pt-2 border-t border-border mt-1">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="flex-1 h-8 text-[11px] font-bold uppercase tracking-wider gap-2" 
                            onClick={() => handleExportTicket(v)}
                            disabled={!!isExporting}
                          >
                            <FileText className="h-3.5 w-3.5" />
                            {isExporting === v.id ? 'Exporting...' : 'Export Ticket'}
                          </Button>
                          {v.status === 'active' && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="flex-1 h-8 text-[11px] font-bold uppercase text-blue-600 hover:bg-blue-50" 
                              onClick={() => handleReferToGuidance(v.id)}
                            >
                              Refer
                            </Button>
                          )}
                          {v.status === 'active' && (
                            <Button size="sm" variant="outline" className="flex-1 h-8 text-[11px] font-bold uppercase text-emerald-600 hover:bg-emerald-50" onClick={() => setResolveModalOpen(v)}>Resolve</Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-8 text-[11px] font-bold text-red-600 hover:bg-red-50" onClick={() => setDeleteConfirm(v)}>Delete</Button>
                        </div>
                    )}
                  </div>
              ))
            )}
          </div>

          <table className="hidden md:table w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-2 font-medium text-muted-foreground text-[10px] uppercase tracking-wider">Case #</th>
              <th className="px-4 py-2 font-medium text-muted-foreground text-[10px] uppercase tracking-wider">Student</th>
              <th className="px-4 py-2 font-medium text-muted-foreground text-[10px] uppercase tracking-wider">Violation Name</th>
              <th className="px-4 py-2 font-medium text-muted-foreground text-[10px] uppercase tracking-wider">Severity</th>
              <th className="px-4 py-2 font-medium text-muted-foreground text-[10px] uppercase tracking-wider">Pts</th>
              <th className="px-4 py-2 font-medium text-muted-foreground text-[10px] uppercase tracking-wider">Status</th>
              <th className="px-4 py-2 font-medium text-muted-foreground text-[10px] uppercase tracking-wider">Date</th>
              {!isStudent && <th className="px-4 py-2 font-medium text-muted-foreground text-[10px] uppercase tracking-wider text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isPending ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Loading...
                </td>
              </tr>
            ) : filteredViolations.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No violations found
                </td>
              </tr>
            ) : (
              filteredViolations.map((v) => (
                  <tr key={v.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-muted rounded border whitespace-nowrap">{v.case_number}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-bold text-foreground text-xs uppercase tracking-tight">{v.profiles?.full_name || 'Unknown'}</p>
                        <p className="text-[10px] text-muted-foreground font-medium">
                          {v.profiles?.email || 'N/A'}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-black text-[11px] uppercase tracking-tight text-foreground block max-w-[150px] truncate">
                        {v.violation_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${getSeverityColor(v.severity)}`}>
                        {v.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-black text-xs">
                      {v.points}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${
                          v.status === 'active'
                            ? 'bg-orange-100 text-orange-800'
                            : v.status === 'referred'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {v.status === 'active' && <Clock className="h-2.5 w-2.5" />}
                        {v.status === 'referred' && <FileText className="h-2.5 w-2.5" />}
                        {v.status === 'resolved' && <CheckCircle2 className="h-2.5 w-2.5" />}
                        {v.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[10px] font-medium text-muted-foreground">
                      {formatDate(v.created_at)}
                    </td>
                    {!isStudent && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 flex items-center justify-center hover:bg-primary/10 hover:text-primary transition-colors"
                            onClick={() => handleExportTicket(v)}
                            title="Export Ticket"
                            disabled={!!isExporting}
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                          {v.status === 'active' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[10px] font-bold px-3 uppercase tracking-wider text-blue-600 hover:bg-blue-50 hover:border-blue-200 transition-all"
                              onClick={() => handleReferToGuidance(v.id)}
                            >
                              Refer
                            </Button>
                          )}
                          {v.status === 'active' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[10px] font-bold px-3 uppercase tracking-wider text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200 transition-all"
                              onClick={() => setResolveModalOpen(v)}
                            >
                              Resolve
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 flex items-center justify-center text-rose-500 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                            onClick={() => setDeleteConfirm(v)}
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
              ))
            )}
          </tbody>
          </table>
        </div>
      </AdminTableShell>

      <RecordViolationModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onSuccess={() => {
          setNotice({ type: 'success', message: 'Violation recorded successfully' })
          void refreshViolations()
        }}
      />

      <Dialog open={!!resolveModalOpen} onOpenChange={(v) => !v && setResolveModalOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Violation</DialogTitle>
            <DialogDescription>
              Mark this violation as resolved. Provide any notes or outcomes below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted p-3">
              <p className="font-medium">{resolveModalOpen?.profiles?.full_name}</p>
              <p className="text-sm text-muted-foreground">{resolveModalOpen?.description}</p>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Resolution Notes (Optional)</label>
              <textarea
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
                rows={3}
                placeholder="Student returned book, paid fine, gave a warning..."
                value={resolveNotes}
                onChange={(e) => setResolveNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResolveModalOpen(null)}>
              Cancel
            </Button>
            <Button
              disabled={isPending}
              onClick={() => handleResolveViolation()}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {isPending ? 'Resolving...' : 'Confirm Resolution'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={(v) => !v && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Violation</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this violation record? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteConfirm && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
              <p className="font-medium text-destructive">{deleteConfirm.profiles?.full_name}</p>
              <p className="text-sm text-muted-foreground">{deleteConfirm.violation_type}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={() => {
                if (!deleteConfirm) return
                startTransition(async () => {
                  try {
                    await deleteViolation(deleteConfirm.id)
                    setNotice({ type: 'success', message: 'Violation deleted successfully' })
                    void refreshViolations()
                  } catch {
                    setNotice({ type: 'error', message: 'Failed to delete violation' })
                  } finally {
                    setDeleteConfirm(null)
                  }
                })
              }}
            >
              {isPending ? 'Deleting...' : 'Delete Record'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="fixed left-[-12000px] top-0 pointer-events-none opacity-0" aria-hidden>
        {isExporting && violations.find(v => v.id === isExporting) && (
          <ViolationTicket data={violations.find(v => v.id === isExporting)!} />
        )}
      </div>
    </>
  )
}
