"use client"

import { useState, useCallback, useTransition, useEffect } from 'react'
import {
  AlertTriangle,
  Clock,
  Search,
  ShieldAlert,
  Trash2,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { createViolation, searchStudents } from '@/lib/actions/violations'

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

interface RecordViolationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialStudent?: Student | null
  onSuccess?: () => void
}

export function RecordViolationModal({ open, onOpenChange, initialStudent, onSuccess }: RecordViolationModalProps) {
  const [isPending, startTransition] = useTransition()
  
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(initialStudent || null)
  const [studentSearch, setStudentSearch] = useState('')
  const [studentResults, setStudentResults] = useState<Student[]>([])
  
  const [newViolation, setNewViolation] = useState({
    violationType: 'late_return',
    severity: 'minor',
    description: '',
    incidentDate: new Date().toISOString().split('T')[0],
  })

  useEffect(() => {
    if (initialStudent) {
      setSelectedStudent(initialStudent)
    }
  }, [initialStudent])

  const handleStudentSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setStudentResults([])
      return
    }
    try {
      const results = await searchStudents(query)
      setStudentResults(results)
    } catch {
      // fail silently
    }
  }, [])

  const debouncedSearch = useCallback((query: string) => {
    const timer = setTimeout(() => {
      void handleStudentSearch(query)
    }, 300)
    return () => clearTimeout(timer)
  }, [handleStudentSearch])

  const handleTypeSelect = (type: string) => {
    const typeInfo = VIOLATION_TYPES.find(t => t.value === type)
    setNewViolation(prev => ({
      ...prev,
      violationType: type,
      severity: typeInfo?.points && typeInfo.points >= 3 ? 'major' : 'minor',
    }))
  }

  const resetCreateForm = () => {
    setSelectedStudent(initialStudent || null)
    setStudentSearch('')
    setStudentResults([])
    setNewViolation({
      violationType: 'late_return',
      severity: 'minor',
      description: '',
      incidentDate: new Date().toISOString().split('T')[0],
    })
  }

  const handleCreateViolation = () => {
    if (!selectedStudent || !newViolation.description) {
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
        onOpenChange(false)
        resetCreateForm()
        onSuccess?.()
      } catch {
        // fail silently or handle error externally
      }
    })
  }

  return (
    <Dialog 
      open={open} 
      onOpenChange={(v) => {
        if (!v) resetCreateForm()
        onOpenChange(v)
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                {!initialStudent && (
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
                )}
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
          <Button variant="ghost" onClick={() => { onOpenChange(false); resetCreateForm() }}>
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
  )
}
