import { useState } from 'react';
import { toast } from 'sonner';
import { apiFetch } from '../../lib/api';
import { useSchoolYear } from '../../context/SchoolYearContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';
import { 
  Calendar,
  Plus,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Save,
  Clock,
  Power,
  PowerOff,
  Info
} from 'lucide-react';

/** Parse "YYYY-YYYY" for date pickers and suggested academic-year bounds. */
function parseSchoolYearInput(input: string): {
  startYear: number;
  endYear: number;
  suggestedStart: string;
  suggestedEnd: string;
  minDate: string;
  maxDate: string;
} | null {
  const match = input.trim().match(/^(\d{4})-(\d{4})$/);
  if (!match) return null;
  const startYear = Number(match[1]);
  const endYear = Number(match[2]);
  if (!Number.isFinite(startYear) || !Number.isFinite(endYear) || endYear < startYear) {
    return null;
  }
  return {
    startYear,
    endYear,
    suggestedStart: `${startYear}-06-01`,
    suggestedEnd: `${endYear}-03-31`,
    minDate: `${startYear}-01-01`,
    maxDate: `${endYear}-12-31`,
  };
}

export function SchoolYearManagement() {
  const {
    schoolYears,
    activeSchoolYear,
    reloadSchoolYearSettings,
    ongoingSchoolYearLabel,
    enrollmentSchoolYearLabel,
    endedSchoolYears,
  } = useSchoolYear();
  const [isSaving, setIsSaving] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState<any>(null);
  const [isActivateDialogOpen, setIsActivateDialogOpen] = useState(false);
  const [isSetOngoingDialogOpen, setIsSetOngoingDialogOpen] = useState(false);
  const [selectedOngoingYear, setSelectedOngoingYear] = useState<any>(null);
  const [isEndDialogOpen, setIsEndDialogOpen] = useState(false);
  const [selectedEndYear, setSelectedEndYear] = useState<{ year: string } | null>(null);
  const [isReopenDialogOpen, setIsReopenDialogOpen] = useState(false);
  const [selectedReopenYear, setSelectedReopenYear] = useState<{ year: string } | null>(null);
  const [isCloseEnrollmentDialogOpen, setIsCloseEnrollmentDialogOpen] = useState(false);
  const [selectedCloseYear, setSelectedCloseYear] = useState<{ year: string } | null>(null);
  
  const [newSchoolYear, setNewSchoolYear] = useState({
    year: '',
    startDate: '',
    endDate: '',
    status: 'Inactive'
  });

  const parsedNewYear = parseSchoolYearInput(newSchoolYear.year);

  const handleNewSchoolYearFieldChange = (year: string) => {
    const parsed = parseSchoolYearInput(year);
    setNewSchoolYear((prev) => {
      const next = { ...prev, year };
      if (parsed) {
        // Pre-fill dates so the native calendar opens on the typed school year.
        next.startDate = parsed.suggestedStart;
        next.endDate = parsed.suggestedEnd;
      }
      return next;
    });
  };

  const handleCreateSchoolYear = () => {
    // Validation
    if (!newSchoolYear.year || !newSchoolYear.startDate || !newSchoolYear.endDate) {
      alert('Please fill in all required fields');
      return;
    }
    void (async () => {
      setIsSaving(true);
      try {
        const res = await apiFetch('/api/school-year', {
          method: 'POST',
          body: JSON.stringify({
            year: newSchoolYear.year.trim(),
            startDate: newSchoolYear.startDate,
            endDate: newSchoolYear.endDate,
          }),
        });
        const j = (await res.json()) as { success?: boolean; error?: string };
        if (!res.ok || !j.success) {
          toast.error(j.error || 'Failed to create school year');
          return;
        }
        toast.success(`School year ${newSchoolYear.year.trim()} created`);
        setIsCreateDialogOpen(false);
        setNewSchoolYear({
          year: '',
          startDate: '',
          endDate: '',
          status: 'Inactive',
        });
        await reloadSchoolYearSettings();
        window.dispatchEvent(new Event('school-year-settings-changed'));
      } catch {
        toast.error('Failed to create school year');
      } finally {
        setIsSaving(false);
      }
    })();
  };

  const handleActivateSchoolYear = (schoolYear: any) => {
    setSelectedYear(schoolYear);
    setIsActivateDialogOpen(true);
  };

  const handleSetOngoingSchoolYear = (schoolYear: any) => {
    setSelectedOngoingYear(schoolYear);
    setIsSetOngoingDialogOpen(true);
  };

  const confirmActivateSchoolYear = async () => {
    if (!selectedYear?.year) return;
    setIsSaving(true);
    try {
      const res = await apiFetch('/api/school-year', {
        method: 'PUT',
        body: JSON.stringify({ enrollment_school_year: selectedYear.year }),
      });
      const j = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !j.success) {
        toast.error(j.error || 'Failed to set active school year');
        return;
      }
      toast.success(`Active school year is now ${selectedYear.year}`);
      await reloadSchoolYearSettings();
      window.dispatchEvent(new Event('school-year-settings-changed'));
      setIsActivateDialogOpen(false);
      setSelectedYear(null);
    } catch {
      toast.error('Failed to update school year');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseEnrollment = (schoolYear: { year: string }) => {
    setSelectedCloseYear(schoolYear);
    setIsCloseEnrollmentDialogOpen(true);
  };

  const confirmCloseEnrollment = async () => {
    if (!selectedCloseYear?.year) return;
    setIsSaving(true);
    try {
      const res = await apiFetch('/api/school-year', {
        method: 'PUT',
        body: JSON.stringify({ enrollment_school_year: '' }),
      });
      const j = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !j.success) {
        toast.error(j.error || 'Failed to close enrollment');
        return;
      }
      toast.success(
        `Enrollment closed. Use Set Enrollment on ${selectedCloseYear.year} (or another year) to open it again.`,
      );
      await reloadSchoolYearSettings();
      window.dispatchEvent(new Event('school-year-settings-changed'));
      setIsCloseEnrollmentDialogOpen(false);
      setSelectedCloseYear(null);
    } catch {
      toast.error('Failed to update school year');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReopenEnrollment = (schoolYear: { year: string }) => {
    setSelectedReopenYear(schoolYear);
    setIsReopenDialogOpen(true);
  };

  const confirmReopenEnrollment = async () => {
    if (!selectedReopenYear?.year) return;
    setIsSaving(true);
    try {
      const res = await apiFetch('/api/school-year', {
        method: 'PUT',
        body: JSON.stringify({
          reopen_school_year: selectedReopenYear.year,
          open_enrollment: true,
        }),
      });
      const j = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !j.success) {
        toast.error(j.error || 'Failed to reopen enrollment');
        return;
      }
      toast.success(`Enrollment is open again for ${selectedReopenYear.year}.`);
      await reloadSchoolYearSettings();
      window.dispatchEvent(new Event('school-year-settings-changed'));
      setIsReopenDialogOpen(false);
      setSelectedReopenYear(null);
    } catch {
      toast.error('Failed to reopen enrollment');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEndSchoolYear = (schoolYear: { year: string }) => {
    setSelectedEndYear(schoolYear);
    setIsEndDialogOpen(true);
  };

  const confirmEndSchoolYear = async () => {
    if (!selectedEndYear?.year) return;
    setIsSaving(true);
    try {
      const res = await apiFetch('/api/school-year', {
        method: 'PUT',
        body: JSON.stringify({ end_school_year: selectedEndYear.year }),
      });
      const j = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !j.success) {
        toast.error(j.error || 'Failed to end school year');
        return;
      }
      toast.success(`School year ${selectedEndYear.year} ended. Rosters for that year are now archived.`);
      await reloadSchoolYearSettings();
      window.dispatchEvent(new Event('school-year-settings-changed'));
      setIsEndDialogOpen(false);
      setSelectedEndYear(null);
    } catch {
      toast.error('Failed to end school year');
    } finally {
      setIsSaving(false);
    }
  };

  const confirmSetOngoingSchoolYear = async () => {
    if (!selectedOngoingYear?.year) return;
    setIsSaving(true);
    try {
      const res = await apiFetch('/api/school-year', {
        method: 'PUT',
        body: JSON.stringify({ ongoing_school_year: selectedOngoingYear.year }),
      });
      const j = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !j.success) {
        toast.error(j.error || 'Failed to set ongoing school year');
        return;
      }
      toast.success(`Ongoing school year is now ${selectedOngoingYear.year}`);
      await reloadSchoolYearSettings();
      window.dispatchEvent(new Event('school-year-settings-changed'));
      setIsSetOngoingDialogOpen(false);
      setSelectedOngoingYear(null);
    } catch {
      toast.error('Failed to update school year');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">School Year Management</h2>
        <p className="text-gray-600">Create, activate, and manage school year cycles</p>
      </div>

      {/* Active School Year Alert */}
      {activeSchoolYear ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-green-900">Active School Year: {activeSchoolYear.year}</p>
            <p className="text-sm text-green-700 mt-1">
              Current period:{' '}
              {activeSchoolYear.startDate && activeSchoolYear.endDate
                ? `${new Date(activeSchoolYear.startDate).toLocaleDateString()} - ${new Date(activeSchoolYear.endDate).toLocaleDateString()}`
                : '—'}
            </p>
            <p className="text-sm text-green-700">
              Total enrolled students: {activeSchoolYear.enrolledStudents}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleCloseEnrollment(activeSchoolYear)}
            disabled={isSaving}
            className="border-red-600 text-red-600 hover:bg-red-50"
          >
            <PowerOff className="w-4 h-4 mr-2" />
            Deactivate
          </Button>
        </div>
      ) : (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-900">No Active School Year</p>
            <p className="text-sm text-red-700 mt-1">
              ⚠️ WARNING: Enrollment cannot proceed without an active school year. Please activate a school year to enable enrollments.
            </p>
          </div>
        </div>
      )}

      {/* Ongoing School Year Alert (separate from enrollment year) */}
      {ongoingSchoolYearLabel ? (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-blue-900">Ongoing School Year: {ongoingSchoolYearLabel}</p>
            <p className="text-sm text-blue-700 mt-1">
              This is the school year the system treats as the current academic year.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-yellow-900">No Ongoing School Year Selected</p>
            <p className="text-sm text-yellow-700 mt-1">
              You can set an ongoing school year separately from the enrollment year.
            </p>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total School Years</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{schoolYears.length}</div>
            <p className="text-xs text-gray-500 mt-1">All time records</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Active School Year</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[#2D5016]">
              {activeSchoolYear ? '1' : '0'}
            </div>
            <p className="text-xs text-gray-500 mt-1">Currently accepting enrollments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Current Enrollment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[#8B1538]">
              {activeSchoolYear?.enrolledStudents || 0}
            </div>
            <p className="text-xs text-gray-500 mt-1">Students this year</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Inactive Years</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-600">
              {schoolYears.filter(sy => sy.status === 'Inactive').length}
            </div>
            <p className="text-xs text-gray-500 mt-1">Archived records</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#8B1538]" />
                School Year Records
              </CardTitle>
              <CardDescription>Manage academic year cycles and enrollment periods</CardDescription>
            </div>
            <Button 
              className="bg-[#2D5016] hover:bg-[#2D5016]/90 text-white"
              onClick={() => setIsCreateDialogOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create School Year
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Critical Notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">School Year Control Policy</p>
              <ul className="mt-2 space-y-1 list-disc list-inside">
                <li>Only ONE school year accepts new enrollments at a time (Set Enrollment)</li>
                <li>
                  <strong>Close Enrollment</strong> pauses new applications — use <strong>Set Enrollment</strong> on
                  the same year to open again
                </li>
                <li>
                  <strong>End School Year</strong> archives that year (grey class lists). Use{' '}
                  <strong>Reopen enrollment</strong> to accept students again
                </li>
                <li>Only Admin role can manage school years</li>
              </ul>
            </div>
          </div>

          {/* School Years Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="font-semibold">School Year</TableHead>
                  <TableHead className="font-semibold">Start Date</TableHead>
                  <TableHead className="font-semibold">End Date</TableHead>
                  <TableHead className="font-semibold text-center">Status</TableHead>
                  <TableHead className="font-semibold text-center">Enrolled Students</TableHead>
                  <TableHead className="font-semibold">Created By</TableHead>
                  <TableHead className="font-semibold text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schoolYears.map((sy) => {
                  const isEnded = endedSchoolYears.includes(sy.year);
                  return (
                  <TableRow
                    key={sy.id}
                    className={
                      sy.status === 'Active' ? 'bg-green-50' : isEnded ? 'bg-gray-50' : ''
                    }
                  >
                    <TableCell className="font-semibold text-gray-900">
                      {sy.year}
                      {isEnded ? (
                        <Badge variant="outline" className="ml-2 text-gray-500 border-gray-400">
                          Ended
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {sy.startDate ? new Date(sy.startDate).toLocaleDateString() : '—'}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {sy.endDate ? new Date(sy.endDate).toLocaleDateString() : '—'}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {sy.status === 'Active' ? (
                        <Badge className="bg-[#2D5016] hover:bg-[#2D5016] text-white">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-gray-600">
                          <XCircle className="w-3 h-3 mr-1" />
                          Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-2xl font-bold text-gray-900">{sy.enrolledStudents}</span>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">{sy.createdBy}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2 flex-wrap">
                      {sy.status === 'Inactive' && !isEnded ? (
                        <Button
                          size="sm"
                          onClick={() => handleActivateSchoolYear(sy)}
                          disabled={isSaving}
                          className="bg-[#2D5016] hover:bg-[#2D5016]/90 text-white"
                        >
                          <Power className="w-4 h-4 mr-1" />
                          Set Enrollment
                        </Button>
                      ) : isEnded ? (
                        <Button
                          size="sm"
                          onClick={() => handleReopenEnrollment(sy)}
                          disabled={isSaving}
                          className="bg-[#2D5016] hover:bg-[#2D5016]/90 text-white"
                        >
                          <Power className="w-4 h-4 mr-1" />
                          Reopen enrollment
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCloseEnrollment(sy)}
                          disabled={isSaving}
                          className="border-red-600 text-red-600 hover:bg-red-50"
                        >
                          <PowerOff className="w-4 h-4 mr-1" />
                          Close Enrollment
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSetOngoingSchoolYear(sy)}
                        disabled={isSaving || isEnded}
                        className={sy.year === ongoingSchoolYearLabel ? 'border-blue-600 text-blue-700' : ''}
                      >
                        Set Ongoing
                      </Button>
                      {!isEnded ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEndSchoolYear(sy)}
                          disabled={isSaving}
                          className="border-gray-500 text-gray-600 hover:bg-gray-100"
                        >
                          End School Year
                        </Button>
                      ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create School Year Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New School Year</DialogTitle>
            <DialogDescription>
              Define a new academic year period. The school year will be created as inactive by default.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* School Year */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                School Year <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g., 2026-2027"
                value={newSchoolYear.year}
                onChange={(e) => handleNewSchoolYearFieldChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B1538]"
              />
              <p className="text-xs text-gray-500 mt-1">
                Format: YYYY-YYYY (e.g., 2026-2027). Start and end dates are suggested automatically
                (June 1 – March 31) when you enter a valid school year.
              </p>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date <span className="text-red-600">*</span>
                </label>
                <input
                  type="date"
                  value={newSchoolYear.startDate}
                  min={parsedNewYear?.minDate}
                  max={parsedNewYear?.maxDate}
                  onChange={(e) => setNewSchoolYear({ ...newSchoolYear, startDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B1538]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Date <span className="text-red-600">*</span>
                </label>
                <input
                  type="date"
                  value={newSchoolYear.endDate}
                  min={parsedNewYear?.minDate}
                  max={parsedNewYear?.maxDate}
                  onChange={(e) => setNewSchoolYear({ ...newSchoolYear, endDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B1538]"
                />
              </div>
            </div>

            {/* Info Notice */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium">Important Notice</p>
                <p className="mt-1">The new school year will be created as <strong>Inactive</strong>. You must manually activate it when ready to accept enrollments.</p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateSchoolYear}
              className="bg-[#2D5016] hover:bg-[#2D5016]/90 text-white"
            >
              <Save className="w-4 h-4 mr-2" />
              Create School Year
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Activate Confirmation Dialog */}
      <Dialog open={isActivateDialogOpen} onOpenChange={setIsActivateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Enrollment Year {selectedYear?.year}?</DialogTitle>
            <DialogDescription>
              This will make {selectedYear?.year} the year that accepts new enrollments.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium">This will:</p>
                <ul className="mt-2 space-y-1 list-disc list-inside">
                  <li>Set {selectedYear?.year} as the enrollment year</li>
                  <li>Allow new enrollments for {selectedYear?.year}</li>
                  <li>Keep ongoing school year unchanged (unless you set it separately)</li>
                </ul>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsActivateDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => void confirmActivateSchoolYear()}
              disabled={isSaving}
              className="bg-[#2D5016] hover:bg-[#2D5016]/90 text-white"
            >
              <Power className="w-4 h-4 mr-2" />
              {isSaving ? 'Saving…' : 'Set Enrollment Year'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Set Ongoing School Year Dialog */}
      <Dialog
        open={isSetOngoingDialogOpen}
        onOpenChange={(open) => {
          setIsSetOngoingDialogOpen(open);
          if (!open && !isSaving) setSelectedOngoingYear(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Ongoing School Year {selectedOngoingYear?.year}?</DialogTitle>
            <DialogDescription>
              This sets the academic year shown as “ongoing” across the system. It does not automatically open enrollments.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSetOngoingDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void confirmSetOngoingSchoolYear()}
              disabled={isSaving}
              className="bg-[#2563eb] hover:bg-[#2563eb]/90 text-white"
            >
              {isSaving ? 'Saving…' : 'Set Ongoing'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close enrollment dialog */}
      <Dialog
        open={isCloseEnrollmentDialogOpen}
        onOpenChange={(open) => {
          setIsCloseEnrollmentDialogOpen(open);
          if (!open && !isSaving) setSelectedCloseYear(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close enrollment for {selectedCloseYear?.year}?</DialogTitle>
            <DialogDescription>
              New student enrollments will stop until you set an enrollment year again. This does not end or
              archive the school year.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCloseEnrollmentDialogOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              onClick={() => void confirmCloseEnrollment()}
              disabled={isSaving}
              className="border-red-600 bg-red-600 hover:bg-red-700 text-white"
            >
              {isSaving ? 'Closing…' : 'Close Enrollment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reopen enrollment dialog */}
      <Dialog
        open={isReopenDialogOpen}
        onOpenChange={(open) => {
          setIsReopenDialogOpen(open);
          if (!open && !isSaving) setSelectedReopenYear(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reopen enrollment for {selectedReopenYear?.year}?</DialogTitle>
            <DialogDescription>
              This removes the ended (archived) status and makes {selectedReopenYear?.year} the active enrollment
              year so students can apply again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReopenDialogOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              onClick={() => void confirmReopenEnrollment()}
              disabled={isSaving}
              className="bg-[#2D5016] hover:bg-[#2D5016]/90 text-white"
            >
              <Power className="w-4 h-4 mr-2" />
              {isSaving ? 'Opening…' : 'Reopen enrollment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* End School Year Confirmation Dialog */}
      <Dialog
        open={isEndDialogOpen}
        onOpenChange={(open) => {
          setIsEndDialogOpen(open);
          if (!open && !isSaving) setSelectedEndYear(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End school year {selectedEndYear?.year}?</DialogTitle>
            <DialogDescription>
              This archives the school year. Class lists will show student names greyed out for students enrolled in{' '}
              {selectedEndYear?.year}.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-gray-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-gray-800">
                <p className="font-medium">This will:</p>
                <ul className="mt-2 space-y-1 list-disc list-inside">
                  <li>Mark {selectedEndYear?.year} as ended (archived)</li>
                  <li>Grey out student names in section class lists for that year</li>
                  <li>Clear ongoing and enrollment settings if they use this year</li>
                </ul>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEndDialogOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void confirmEndSchoolYear()}
              disabled={isSaving}
              className="bg-gray-700 hover:bg-gray-800 text-white"
            >
              {isSaving ? 'Ending…' : 'End School Year'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}