import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { apiFetch } from '../../lib/api';
import { useSchoolYear } from '../../context/SchoolYearContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Alert, AlertDescription } from '../../components/ui/alert';
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
  Info,
  Eye,
  EyeOff,
  Trash2,
  Archive
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

/** Next Philippine SY label from today's date (June boundary). */
function suggestNextSchoolYearLabel(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const start = m >= 6 ? y : y - 1;
  return `${start}-${start + 1}`;
}

function schoolYearFormWithSuggestedDates(year: string): {
  year: string;
  startDate: string;
  endDate: string;
  status: 'Inactive';
} {
  const parsed = parseSchoolYearInput(year);
  return {
    year,
    startDate: parsed?.suggestedStart ?? '',
    endDate: parsed?.suggestedEnd ?? '',
    status: 'Inactive',
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
    catalogStats,
    settingsLoaded,
    settingsError,
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
  const [showHiddenArchived, setShowHiddenArchived] = useState(false);
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
  const [selectedArchiveYear, setSelectedArchiveYear] = useState<{ year: string } | null>(null);
  const [isUnarchiveDialogOpen, setIsUnarchiveDialogOpen] = useState(false);
  const [selectedUnarchiveYear, setSelectedUnarchiveYear] = useState<{ year: string } | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedDeleteYear, setSelectedDeleteYear] = useState<{ year: string; enrolledStudents: number } | null>(null);
  
  const [newSchoolYear, setNewSchoolYear] = useState({
    year: '',
    startDate: '',
    endDate: '',
    status: 'Inactive'
  });

  const parsedNewYear = parseSchoolYearInput(newSchoolYear.year);

  const visibleSchoolYears = showHiddenArchived
    ? schoolYears
    : schoolYears.filter((sy) => !sy.archived);

  const hiddenArchivedCount = Math.max(
    schoolYears.filter((sy) => sy.archived).length,
    catalogStats.hidden,
  );
  const totalCatalogCount = Math.max(schoolYears.length, catalogStats.total);

  useEffect(() => {
    void reloadSchoolYearSettings();
  }, [reloadSchoolYearSettings]);

  useEffect(() => {
    if (!settingsLoaded) return;
    if (hiddenArchivedCount > 0 && (visibleSchoolYears.length === 0 || hiddenArchivedCount === totalCatalogCount)) {
      setShowHiddenArchived(true);
    }
  }, [settingsLoaded, hiddenArchivedCount, visibleSchoolYears.length, totalCatalogCount]);

  useEffect(() => {
    if (!isCreateDialogOpen) return;
    const parsed = parseSchoolYearInput(newSchoolYear.year);
    if (!parsed) return;
    setNewSchoolYear((prev) => {
      if (prev.startDate === parsed.suggestedStart && prev.endDate === parsed.suggestedEnd) {
        return prev;
      }
      return {
        ...prev,
        startDate: parsed.suggestedStart,
        endDate: parsed.suggestedEnd,
      };
    });
  }, [isCreateDialogOpen, newSchoolYear.year]);

  const openCreateSchoolYearDialog = () => {
    const suggested = suggestNextSchoolYearLabel();
    setNewSchoolYear(schoolYearFormWithSuggestedDates(suggested));
    setIsCreateDialogOpen(true);
  };

  const handleNewSchoolYearFieldChange = (year: string) => {
    const parsed = parseSchoolYearInput(year);
    setNewSchoolYear((prev) => {
      const next = { ...prev, year };
      if (parsed) {
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
        const j = (await res.json()) as { success?: boolean; error?: string; code?: string; action?: string };
        if (!res.ok || !j.success) {
          const err = j.error || 'Failed to create school year';
          toast.error(err);
          if (res.status === 409 || j.code === 'school_year_exists') {
            setShowHiddenArchived(true);
            await reloadSchoolYearSettings();
          }
          return;
        }
        if (j.action === 'restored') {
          toast.success(`School year ${newSchoolYear.year.trim()} was hidden — it has been restored.`);
        } else {
          toast.success(`School year ${newSchoolYear.year.trim()} created`);
        }
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

  const handleHideSchoolYear = (schoolYear: { year: string }) => {
    setSelectedArchiveYear(schoolYear);
    setIsArchiveDialogOpen(true);
  };

  const confirmHideSchoolYear = async () => {
    if (!selectedArchiveYear?.year) return;
    setIsSaving(true);
    try {
      const res = await apiFetch('/api/school-year', {
        method: 'PUT',
        body: JSON.stringify({ archive_school_year: selectedArchiveYear.year }),
      });
      const j = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !j.success) {
        toast.error(j.error || 'Failed to hide school year');
        return;
      }
      toast.success(`School year ${selectedArchiveYear.year} hidden from lists`);
      await reloadSchoolYearSettings();
      window.dispatchEvent(new Event('school-year-settings-changed'));
      setIsArchiveDialogOpen(false);
      setSelectedArchiveYear(null);
    } catch {
      toast.error('Failed to hide school year');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnhideSchoolYear = (schoolYear: { year: string }) => {
    setSelectedUnarchiveYear(schoolYear);
    setIsUnarchiveDialogOpen(true);
  };

  const confirmUnhideSchoolYear = async () => {
    if (!selectedUnarchiveYear?.year) return;
    setIsSaving(true);
    try {
      const res = await apiFetch('/api/school-year', {
        method: 'PUT',
        body: JSON.stringify({ unarchive_school_year: selectedUnarchiveYear.year }),
      });
      const j = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !j.success) {
        toast.error(j.error || 'Failed to restore school year');
        return;
      }
      toast.success(`School year ${selectedUnarchiveYear.year} restored`);
      await reloadSchoolYearSettings();
      window.dispatchEvent(new Event('school-year-settings-changed'));
      setIsUnarchiveDialogOpen(false);
      setSelectedUnarchiveYear(null);
    } catch {
      toast.error('Failed to restore school year');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSchoolYear = (schoolYear: { year: string; enrolledStudents: number }) => {
    setSelectedDeleteYear(schoolYear);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteSchoolYear = async () => {
    if (!selectedDeleteYear?.year) return;
    setIsSaving(true);
    try {
      const res = await apiFetch('/api/school-year', {
        method: 'DELETE',
        body: JSON.stringify({ year: selectedDeleteYear.year }),
      });
      const j = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !j.success) {
        toast.error(j.error || 'Failed to delete school year');
        return;
      }
      toast.success(`School year ${selectedDeleteYear.year} deleted`);
      await reloadSchoolYearSettings();
      window.dispatchEvent(new Event('school-year-settings-changed'));
      setIsDeleteDialogOpen(false);
      setSelectedDeleteYear(null);
    } catch {
      toast.error('Failed to delete school year');
    } finally {
      setIsSaving(false);
    }
  };

  const canHideYear = (sy: { year: string; status: string }) =>
    sy.status !== 'Active' &&
    sy.year !== ongoingSchoolYearLabel &&
    sy.year !== enrollmentSchoolYearLabel;

  const canDeleteYear = (sy: { year: string; status: string; enrolledStudents: number }) =>
    canHideYear(sy) && sy.enrolledStudents === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">School Year Management</h2>
        <p className="text-gray-600">Create, activate, and manage school year cycles</p>
      </div>

      {settingsError ? (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{settingsError}</span>
            <Button
              size="sm"
              variant="outline"
              className="bg-white"
              onClick={() => void reloadSchoolYearSettings()}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {!settingsError &&
      settingsLoaded &&
      totalCatalogCount === 0 &&
      !ongoingSchoolYearLabel &&
      !enrollmentSchoolYearLabel ? (
        <Alert>
          <AlertDescription>
            The dashboard may show school years from settings, but this page could not load the catalog
            yet. Click <strong>Show hidden</strong> if available, or press <strong>Retry</strong> after a
            hard refresh (Ctrl+Shift+R).
          </AlertDescription>
        </Alert>
      ) : null}

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
            <div className="text-3xl font-bold text-gray-900">{totalCatalogCount}</div>
            <p className="text-xs text-gray-500 mt-1">
              {hiddenArchivedCount > 0
                ? `${hiddenArchivedCount} hidden · ${Math.max(0, totalCatalogCount - hiddenArchivedCount)} visible`
                : 'All time records'}
            </p>
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
            <p className="text-xs text-gray-500 mt-1">Not accepting enrollments</p>
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
            <div className="flex items-center gap-2">
              {hiddenArchivedCount > 0 ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowHiddenArchived((v) => !v)}
                >
                  {showHiddenArchived ? (
                    <>
                      <EyeOff className="w-4 h-4 mr-2" />
                      Hide hidden ({hiddenArchivedCount})
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4 mr-2" />
                      Show hidden ({hiddenArchivedCount})
                    </>
                  )}
                </Button>
              ) : null}
              <Button 
                className="bg-[#2D5016] hover:bg-[#2D5016]/90 text-white"
                onClick={openCreateSchoolYearDialog}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create School Year
              </Button>
            </div>
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
                <li>
                  <strong>Hide</strong> removes a year from registrar dropdowns without deleting data.
                  Use <strong>Delete</strong> only for empty catalog entries with no enrollments.
                </li>
                <li>Only Admin role can manage school years</li>
              </ul>
            </div>
          </div>

          {/* Hidden years notice */}
          {hiddenArchivedCount > 0 && !showHiddenArchived ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 flex items-start justify-between gap-3">
              <div className="text-sm text-amber-900">
                <p className="font-medium">
                  {hiddenArchivedCount} school year{hiddenArchivedCount === 1 ? '' : 's'} hidden from this list
                </p>
                <p className="mt-1">
                  They still exist in the database. Creating the same year again will fail until you show or
                  restore them.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowHiddenArchived(true)}>
                <Eye className="w-4 h-4 mr-2" />
                Show hidden
              </Button>
            </div>
          ) : null}

          {/* School Years Table */}
          <div className="border rounded-lg overflow-x-auto">
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
                {visibleSchoolYears.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-gray-500 py-8">
                      {hiddenArchivedCount > 0
                        ? 'All school years are hidden. Turn on “Show hidden” to view them.'
                        : !settingsLoaded
                          ? 'Loading school years…'
                          : 'No school years in the catalog yet. Create one, or refresh after deploy if you already have enrollment years configured.'}
                    </TableCell>
                  </TableRow>
                ) : null}
                {visibleSchoolYears.map((sy) => {
                  const isEnded = endedSchoolYears.includes(sy.year);
                  const isHidden = Boolean(sy.archived);
                  return (
                  <TableRow
                    key={sy.id}
                    className={
                      sy.status === 'Active' ? 'bg-green-50' : isEnded || isHidden ? 'bg-gray-50' : ''
                    }
                  >
                    <TableCell className="font-semibold text-gray-900">
                      {sy.year}
                      {isEnded ? (
                        <Badge variant="outline" className="ml-2 text-gray-500 border-gray-400">
                          Ended
                        </Badge>
                      ) : null}
                      {isHidden ? (
                        <Badge variant="outline" className="ml-2 text-amber-700 border-amber-400">
                          Hidden
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
                      {isHidden ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUnhideSchoolYear(sy)}
                          disabled={isSaving}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Unhide
                        </Button>
                      ) : canHideYear(sy) ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleHideSchoolYear(sy)}
                          disabled={isSaving}
                        >
                          <Archive className="w-4 h-4 mr-1" />
                          Hide
                        </Button>
                      ) : null}
                      {canDeleteYear(sy) ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteSchoolYear(sy)}
                          disabled={isSaving}
                          className="border-red-600 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Delete
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

      {/* Hide school year dialog */}
      <Dialog
        open={isArchiveDialogOpen}
        onOpenChange={(open) => {
          setIsArchiveDialogOpen(open);
          if (!open && !isSaving) setSelectedArchiveYear(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hide school year {selectedArchiveYear?.year}?</DialogTitle>
            <DialogDescription>
              This removes the year from registrar filters and comboboxes. Enrollment records are kept.
              You can unhide it later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsArchiveDialogOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={() => void confirmHideSchoolYear()} disabled={isSaving}>
              {isSaving ? 'Hiding…' : 'Hide school year'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unhide school year dialog */}
      <Dialog
        open={isUnarchiveDialogOpen}
        onOpenChange={(open) => {
          setIsUnarchiveDialogOpen(open);
          if (!open && !isSaving) setSelectedUnarchiveYear(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore school year {selectedUnarchiveYear?.year}?</DialogTitle>
            <DialogDescription>
              This shows the year again in registrar school-year dropdowns.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUnarchiveDialogOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={() => void confirmUnhideSchoolYear()} disabled={isSaving}>
              {isSaving ? 'Restoring…' : 'Unhide school year'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete school year dialog */}
      <Dialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          setIsDeleteDialogOpen(open);
          if (!open && !isSaving) setSelectedDeleteYear(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete school year {selectedDeleteYear?.year}?</DialogTitle>
            <DialogDescription>
              This permanently removes the catalog entry. Only use this for mistaken or empty years
              with no enrollment records.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              onClick={() => void confirmDeleteSchoolYear()}
              disabled={isSaving}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isSaving ? 'Deleting…' : 'Delete permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}