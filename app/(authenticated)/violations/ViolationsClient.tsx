'use client'

import { useCallback, useState, useTransition, use } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  XCircle
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
  type ViolationWithProfile,
  type ViolationStats,
} from '@/lib/actions/violations'

const VIOLATION_TYPES = [
  { value: 'late_return', label: 'Late Return', icon: Clock, color: 'text-yellow-600', points: 1 },
  { value: 'damaged_book', label: 'Damaged Book', icon: Trash2, color: 'text-orange-600', points: 3 },
  { value: 'lost_book', label: 'Lost Book', icon: XCircle, color: 'text-red-600', points: 5 },
  { value: 'noise', label: 'Noise Violation', icon: AlertTriangle, color: 'text-blue-600', points: 1 },
  { value: 'food_drink', label: 'Food/Drink in Library', icon: AlertTriangle, color: 'text-blue-600', points: 1 },
  { value: 'disruptive_behavior', label: 'Disruptive Behavior', icon: ShieldAlert, color: 'text-red-600', points: 2 },
  { value: 'theft', label: 'Theft/Tampering', icon: ShieldAlert, color: 'text-red-800', points: 5 },
  { value: 'talking_loudly', label: 'Talking Loudly', icon: AlertTriangle, color: 'text-blue-600', points: 1 },
  { value: 'phone_usage', label: 'Phone Usage', icon: AlertTriangle, color: 'text-yellow-600', points: 1 },
  { value: 'unauthorized_area', label: 'Unauthorized Area', icon: XCircle, color: 'text-orange-600', points: 2 },
  { value: 'policy_violation', label: 'Policy Violation', icon: ShieldAlert, color: 'text-red-600', points: 2 },
  { value: 'other', label: 'Other', icon: AlertTriangle, color: 'text-gray-600', points: 1 },
]

const SEVERITY_OPTIONS = [
  { value: 'minor', label: 'Minor', color: 'bg-yellow-100 text-yellow-800', points: 1 },
  { value: 'moderate', label: 'Moderate', color: 'bg-orange-100 text-orange-800', points: 2 },
  { value: 'major', label: 'Major', color: 'bg-red-100 text-red-800', points: 3 },
  { value: 'severe', label: 'Severe', color: 'bg-red-200 text-red-900', points: 5 },
]

type Props = {
  dataPromise: Promise<{ violations: ViolationWithProfile[]; stats: ViolationStats; role: string }>
}

export default function ViolationsClient({ dataPromise }: Props) {
  const { violations: initialViolations, stats: initialStats, role } = use(dataPromise)
  const router = useRouter()
  const isStudent = role === 'student'
  const [isPending, startTransition] = useTransition()
  const violations = initialViolations
  const stats = initialStats
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [resolveModalOpen, setResolveModalOpen] = useState<ViolationWithProfile | null>(null)
  const [resolveNotes, setResolveNotes] = useState('')
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<ViolationWithProfile | null>(null)

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

  const handleDeleteViolation = () => {
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
  }

  const filteredViolations = violations.filter((v) => {
    const searchLower = searchQuery.toLowerCase()
    return (
      !searchQuery ||
      v.profiles?.full_name?.toLowerCase().includes(searchLower) ||
      v.profiles?.student_id?.toLowerCase().includes(searchLower) ||
      v.description.toLowerCase().includes(searchLower)
    )
  })

  const getTypeInfo = (type: string) => VIOLATION_TYPES.find(t => t.value === type) || VIOLATION_TYPES[0]
  const getSeverityInfo = (sev: string) => SEVERITY_OPTIONS.find(s => s.value === sev) || SEVERITY_OPTIONS[0]

  return (
    <>
      <div className="grid gap-4 md:grid-cols-4 mb-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Violations</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active</p>
              <p className="text-2xl font-bold">{stats.active}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Resolved</p>
              <p className="text-2xl font-bold">{stats.resolved}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10">
              <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{isStudent ? 'My Demerit Points' : 'Demerit Points'}</p>
              <p className="text-2xl font-bold">{stats.totalPoints}</p>
            </div>
          </div>
        </div>
      </div>

      <AdminTableShell
        title={isStudent ? "My Violation History" : "Violation Records"}
        description={isStudent ? "A record of your conduct and library policy violations" : "Track and manage student school violations"}
        headerActions={!isStudent && (
          <Button onClick={() => setCreateModalOpen(true)} className="w-full sm:w-auto">
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
              {(['all', 'active', 'resolved', 'appealed'] as const).map((tab) => (
                <Button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  variant={statusFilter === tab ? 'default' : 'outline'}
                  className="h-8 px-3 text-xs capitalize"
                >
                  {tab === 'all' ? 'All Status' : tab}
                </Button>
              ))}
            </div>
            <div className="flex w-full sm:w-auto">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full rounded-md border border-border bg-card px-3 py-1.5 text-sm sm:w-auto h-8"
              >
                <option value="all">All Types</option>
                {VIOLATION_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
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
              filteredViolations.map((v) => {
                const typeInfo = getTypeInfo(v.violation_type)
                const sevInfo = getSeverityInfo(v.severity)
                const TypeIcon = typeInfo.icon
                return (
                  <div key={v.id} className="p-4 flex flex-col gap-3 hover:bg-muted/40 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                       <div className="min-w-0">
                         <p className="font-medium text-foreground truncate">{v.profiles?.full_name || 'Unknown'}</p>
                         <p className="text-xs text-muted-foreground truncate">{v.profiles?.student_id || 'N/A'}</p>
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
                      <span className={`inline-flex items-center gap-1 font-medium ${typeInfo.color}`}>
                        <TypeIcon className="h-3.5 w-3.5" />
                        {typeInfo.label}
                      </span>
                      <span className="text-muted-foreground">•</span>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${sevInfo.color}`}>
                        {sevInfo.label}
                      </span>
                      <span className="text-muted-foreground">•</span>
                      <span className="font-medium">{v.points} pts</span>
                    </div>

                    <p className="text-sm text-foreground">{v.description}</p>
                    <p className="text-xs text-muted-foreground text-right">{formatDate(v.created_at)}</p>

                    {!isStudent && (
                        <div className="flex items-center gap-2 pt-2 border-t border-border mt-1">
                          {v.status === 'active' && (
                            <Button size="sm" variant="outline" className="flex-1 h-8 text-xs text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200" onClick={() => setResolveModalOpen(v)}>Resolve</Button>
                          )}
                          <Button size="sm" variant="ghost" className={`${v.status === 'active' ? 'flex-1' : 'w-full'} h-8 text-xs text-red-600 hover:bg-red-50 hover:text-red-700`} onClick={() => setDeleteConfirm(v)}>Delete</Button>
                        </div>
                    )}
                  </div>
                )
              })
            )}
          </div>

          <table className="hidden md:table w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/60">
              <th className="px-4 py-2.5 font-medium text-muted-foreground">Student</th>
              <th className="px-4 py-2.5 font-medium text-muted-foreground">Type</th>
              <th className="px-4 py-2.5 font-medium text-muted-foreground">Severity</th>
              <th className="px-4 py-2.5 font-medium text-muted-foreground">Points</th>
              <th className="px-4 py-2.5 font-medium text-muted-foreground">Description</th>
              <th className="px-4 py-2.5 font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-2.5 font-medium text-muted-foreground">Date</th>
              {!isStudent && <th className="px-4 py-2.5 font-medium text-muted-foreground">Actions</th>}
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
              filteredViolations.map((v) => {
                const typeInfo = getTypeInfo(v.violation_type)
                const sevInfo = getSeverityInfo(v.severity)
                const TypeIcon = typeInfo.icon
                return (
                  <tr key={v.id} className="hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-foreground">{v.profiles?.full_name || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">
                          {v.profiles?.student_id || 'N/A'}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${typeInfo.color}`}>
                        <TypeIcon className="h-3.5 w-3.5" />
                        {typeInfo.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${sevInfo.color}`}>
                        {sevInfo.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {v.points} {v.points === 1 ? 'pt' : 'pts'}
                    </td>
                    <td className="px-4 py-3 max-w-[200px] truncate text-xs">
                      {v.description}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                          v.status === 'active'
                            ? 'bg-orange-100 text-orange-800'
                            : v.status === 'resolved'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {v.status === 'active' && <Clock className="h-3 w-3" />}
                        {v.status === 'resolved' && <CheckCircle2 className="h-3 w-3" />}
                        {v.status.charAt(0).toUpperCase() + v.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatDate(v.created_at)}
                    </td>
                    {!isStudent && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {v.status === 'active' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs font-medium text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                              onClick={() => setResolveModalOpen(v)}
                            >
                              Resolve
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => setDeleteConfirm(v)}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })
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

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Violation</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this violation record? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteConfirm && (
            <div className="rounded-lg border border-border bg-muted p-3">
              <p className="font-medium">{deleteConfirm.profiles?.full_name}</p>
              <p className="text-sm text-muted-foreground">{deleteConfirm.description}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={isPending} onClick={() => handleDeleteViolation()}>
              {isPending ? 'Deleting...' : 'Delete Violation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
