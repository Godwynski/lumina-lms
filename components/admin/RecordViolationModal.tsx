"use client"

import { useState, useCallback, useTransition, useEffect } from 'react'
import {
  Search
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
  email: string
}

const SEVERITY_OPTIONS = [
  { value: 'minor', label: 'Minor' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'major', label: 'Major' },
  { value: 'severe', label: 'Severe' },
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
    violationType: '',
    severity: 'minor',
    points: 1,
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

  const resetCreateForm = () => {
    setSelectedStudent(initialStudent || null)
    setStudentSearch('')
    setStudentResults([])
    setNewViolation({
      violationType: '',
      severity: 'minor',
      points: 1,
      description: '',
      incidentDate: new Date().toISOString().split('T')[0],
    })
  }

  const handleCreateViolation = () => {
    if (!selectedStudent || !newViolation.violationType) {
      return
    }

    startTransition(async () => {
      try {
        await createViolation({
          userId: selectedStudent.id,
          violationType: newViolation.violationType,
          severity: newViolation.severity,
          points: newViolation.points,
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
                  <p className="text-sm text-muted-foreground">{selectedStudent.email}</p>
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
                          setStudentSearch(`${student.full_name} (${student.email})`)
                        }}
                      >
                        <p className="font-medium">{student.full_name}</p>
                        <p className="text-sm text-muted-foreground">{student.email}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label htmlFor="violationType">Violation / Offense Name *</Label>
              <Input
                id="violationType"
                placeholder="e.g., Bringing food inside, Unauthorized desk usage..."
                value={newViolation.violationType}
                onChange={(e) => setNewViolation(prev => ({ ...prev, violationType: e.target.value }))}
                className="mt-1"
              />
              <p className="mt-1 text-[10px] text-muted-foreground italic">
                Librarian/Admin: Specify the exact nature of the offense. This will appear on the Guidance Referral Ticket.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="points">Demerit Points *</Label>
              <Input
                id="points"
                type="number"
                min={0}
                max={100}
                value={newViolation.points}
                onChange={(e) => setNewViolation(prev => ({ ...prev, points: parseInt(e.target.value) || 0 }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Severity</Label>
              <select
                value={newViolation.severity}
                onChange={(e) => setNewViolation(prev => ({ ...prev, severity: e.target.value }))}
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {SEVERITY_OPTIONS.map(sev => (
                  <option key={sev.value} value={sev.value}>{sev.label}</option>
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
            <Label>Description (Optional)</Label>
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
            disabled={!selectedStudent || isPending}
            onClick={() => handleCreateViolation()}
          >
            {isPending ? 'Recording...' : 'Record Violation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
