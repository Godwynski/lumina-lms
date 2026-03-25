'use client'

import { useCallback, useState, useTransition } from 'react'
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
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatDate } from '@/lib/utils'
import {
  createViolation,
  deleteViolation,
  searchStudents,
  type ViolationWithProfile,
  type ViolationStats,
} from '@/lib/actions/violations'

type Student = {
  id: string
  full_name: string
  student_id: string
}

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
  initialViolations: ViolationWithProfile[]
  initialStats: ViolationStats
}

export default function ViolationsClient({ initialViolations, initialStats }: Props) {
  const [isPending, startTransition] = useTransition()
  const [violations, setViolations] = useState(initialViolations)
  const [stats, setStats] = useState(initialStats)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<ViolationWithProfile | null>(null)

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [studentSearch, setStudentSearch] = useState('')
  const [studentResults, setStudentResults] = useState<Student[]>([])
  const [newViolation, setNewViolation] = useState({
    violationType: 'late_return',
    severity: 'minor',
    description: '',
    incidentDate: new Date().toISOString().split('T')[0],
  })

  const refreshViolations = useCallback(() => {
    startTransition(async () => {
      try {
        const params = new URLSearchParams()
        if (statusFilter !== 'all') params.set('status', statusFilter)
        if (typeFilter !== 'all') params.set('violationType', typeFilter)
        
        const response = await fetch(`/api/violations?${params.toString()}`)
        const data = await response.json()
        if (data.ok) {
          setViolations(data.violations || [])
          const newStats: ViolationStats = { total: 0, active: 0, resolved: 0, totalPoints: 0 }
          data.violations?.forEach((v: ViolationWithProfile) => {
            newStats.total++
            newStats.totalPoints += v.points
            if (v.status === 'active') newStats.active++
            else if (v.status === 'resolved') newStats.resolved++
          })
          setStats(newStats)
        }
      } catch {
        setNotice({ type: 'error', message: 'Failed to refresh violations' })
      }
    })
  }, [statusFilter, typeFilter])

  const handleStudentSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setStudentResults([])
      return
    }
    try {
      const results = await searchStudents(query)
      setStudentResults(results)
    } catch {
      setNotice({ type: 'error', message: 'Failed to search students' })
    }
  }, [])

  const debouncedSearch = useCallback((query: string) => {
    const timer = setTimeout(() => {
      void handleStudentSearch(query)
    }, 300)
    return () => clearTimeout(timer)
  }, [handleStudentSearch])

  const handleCreateViolation = () => {
    if (!selectedStudent || !newViolation.description) {
      setNotice({ type: 'error', message: 'Please fill in all required fields' })
      return
    }

    startTransition(async () => {
      try {
        const typeInfo = VIOLATION_TYPES.find(t => t.value === newViolation.violationType)
        await createViolation({
          userId: selectedStudent.id,
          violationType: newViolation.violationType,
          severity: newViolation.severity,
          points: typeInfo?.points || 1,
          description: newViolation.description,
          incidentDate: newViolation.incidentDate,
        })
        setNotice({ type: 'success', message: 'Violation recorded successfully' })
        setCreateModalOpen(false)
        resetCreateForm()
        void refreshViolations()
      } catch {
        setNotice({ type: 'error', message: 'Failed to create violation' })
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

  const resetCreateForm = () => {
    setSelectedStudent(null)
    setStudentSearch('')
    setStudentResults([])
    setNewViolation({
      violationType: 'late_return',
      severity: 'minor',
      description: '',
      incidentDate: new Date().toISOString().split('T')[0],
    })
  }

  const handleTypeSelect = (type: string) => {
    const typeInfo = VIOLATION_TYPES.find(t => t.value === type)
    setNewViolation(prev => ({
      ...prev,
      violationType: type,
      severity: typeInfo?.points && typeInfo.points >= 3 ? 'major' : 'minor',
    }))
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
    <div className="w-full space-y-4 pb-4">
      <div className="border-b border-border pb-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Violation Records</h1>
            <p className="text-sm text-muted-foreground">
              Track and manage student school violations
            </p>
          </div>
          <Button onClick={() => setCreateModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Record Violation
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Violations</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
              <Clock className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active</p>
              <p className="text-2xl font-bold">{stats.active}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Resolved</p>
              <p className="text-2xl font-bold">{stats.resolved}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100">
              <ShieldAlert className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Demerit Points</p>
              <p className="text-2xl font-bold">{stats.totalPoints}</p>
            </div>
          </div>
        </div>
      </div>

      {notice && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            notice.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {notice.message}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-4 border-b border-border p-4 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by student name, ID, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-md border border-border bg-card px-3 py-2 text-sm"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="resolved">Resolved</option>
              <option value="appealed">Appealed</option>
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-md border border-border bg-card px-3 py-2 text-sm"
            >
              <option value="all">All Types</option>
              {VIOLATION_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
            <Button variant="outline" onClick={() => void refreshViolations()} disabled={isPending}>
              Refresh
            </Button>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Points</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : filteredViolations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No violations found
                </TableCell>
              </TableRow>
            ) : (
              filteredViolations.map((v) => {
                const typeInfo = getTypeInfo(v.violation_type)
                const sevInfo = getSeverityInfo(v.severity)
                const TypeIcon = typeInfo.icon
                return (
                  <TableRow key={v.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{v.profiles?.full_name || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">
                          {v.profiles?.student_id || 'N/A'}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1 text-sm ${typeInfo.color}`}>
                        <TypeIcon className="h-4 w-4" />
                        {typeInfo.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${sevInfo.color}`}>
                        {sevInfo.label}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">
                      {v.points} {v.points === 1 ? 'point' : 'points'}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">
                      {v.description}
                    </TableCell>
                    <TableCell>
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
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(v.created_at)}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => setDeleteConfirm(v)}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Record School Violation</DialogTitle>
            <DialogDescription>
              Document a violation for a student (no monetary fine involved)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Student</Label>
              {selectedStudent ? (
                <div className="mt-1 flex items-center justify-between rounded-lg border border-border bg-muted p-3">
                  <div>
                    <p className="font-medium">{selectedStudent.full_name}</p>
                    <p className="text-sm text-muted-foreground">{selectedStudent.student_id}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setSelectedStudent(null)
                      setStudentSearch('')
                    }}
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search student by name or ID..."
                    value={studentSearch}
                    onChange={(e) => {
                      setStudentSearch(e.target.value)
                      void debouncedSearch(e.target.value)
                    }}
                    className="pl-9"
                  />
                  {studentResults.length > 0 && (
                    <div className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-border bg-card shadow-lg">
                      {studentResults.map(student => (
                        <button
                          key={student.id}
                          type="button"
                          className="w-full px-3 py-2 text-left hover:bg-muted"
                          onClick={() => {
                            setSelectedStudent(student)
                            setStudentResults([])
                            setStudentSearch(`${student.full_name} (${student.student_id})`)
                          }}
                        >
                          <p className="font-medium">{student.full_name}</p>
                          <p className="text-sm text-muted-foreground">{student.student_id}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <Label>Violation Type</Label>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {VIOLATION_TYPES.map(type => (
                  <button
                    key={type.value}
                    type="button"
                    className={`rounded-lg border p-2 text-left text-xs transition-colors hover:bg-muted ${
                      newViolation.violationType === type.value 
                        ? `border-primary bg-primary/5 ${type.color}` 
                        : 'border-border'
                    }`}
                    onClick={() => handleTypeSelect(type.value)}
                  >
                    <type.icon className="mb-1 h-4 w-4" />
                    <p className="font-medium">{type.label}</p>
                    <p className="text-muted-foreground">{type.points} pt{type.points !== 1 ? 's' : ''}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Severity</Label>
                <select
                  value={newViolation.severity}
                  onChange={(e) => setNewViolation(prev => ({ ...prev, severity: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
                >
                  {SEVERITY_OPTIONS.map(sev => (
                    <option key={sev.value} value={sev.value}>{sev.label} ({sev.points} pts)</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Incident Date</Label>
                <Input
                  type="date"
                  value={newViolation.incidentDate}
                  onChange={(e) => setNewViolation(prev => ({ ...prev, incidentDate: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label>Description *</Label>
              <textarea
                placeholder="Describe the violation in detail..."
                value={newViolation.description}
                onChange={(e) => setNewViolation(prev => ({ ...prev, description: e.target.value }))}
                className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => { setCreateModalOpen(false); resetCreateForm() }}>
              Cancel
            </Button>
            <Button
              disabled={!selectedStudent || !newViolation.description || isPending}
              onClick={() => handleCreateViolation()}
            >
              {isPending ? 'Recording...' : 'Record Violation'}
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
    </div>
  )
}
