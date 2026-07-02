import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { CheckCircle2, Loader2, Pencil, Wallet, X } from 'lucide-react';
import { useStudentPortal } from '../../hooks/useStudentPortal';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { apiFetch } from '../../lib/api';
import { toast } from 'sonner';
import { useStudentLocale } from '../../context/StudentLocaleContext';
import { EnrollmentGuide } from '../../components/student/EnrollmentGuide';

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium text-gray-900">{value || '—'}</p>
    </div>
  );
}

type EditableContactFieldKey = 'phone' | 'email' | 'address';

function EditableContactField({
  label,
  fieldKey,
  value,
  editing,
  saving,
  onStartEdit,
  onCancel,
  onChange,
  onSave,
  inputType = 'text',
  inputId,
}: {
  label: string;
  fieldKey: EditableContactFieldKey;
  value: string;
  editing: boolean;
  saving: boolean;
  onStartEdit: (key: EditableContactFieldKey) => void;
  onCancel: () => void;
  onChange: (v: string) => void;
  onSave: () => void;
  inputType?: 'text' | 'email';
  inputId: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      {editing ? (
        <div className="flex items-center gap-1.5">
          <Input
            id={inputId}
            type={inputType}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-8 text-sm flex-1 min-w-0"
            autoComplete={fieldKey === 'phone' ? 'tel' : fieldKey === 'email' ? 'email' : 'street-address'}
            disabled={saving}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSave();
              if (e.key === 'Escape') onCancel();
            }}
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0 text-[#2D5016] hover:bg-green-50"
            onClick={onSave}
            disabled={saving}
            aria-label={`Save ${label}`}
          >
            <CheckCircle2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0 text-gray-500 hover:bg-gray-100"
            onClick={onCancel}
            disabled={saving}
            aria-label={`Cancel editing ${label}`}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 min-h-8">
          <p className="text-sm font-medium text-gray-900 flex-1 min-w-0 break-words">{value || '—'}</p>
          <button
            type="button"
            onClick={() => onStartEdit(fieldKey)}
            className="shrink-0 rounded p-1 text-gray-400 hover:text-[#2D5016] hover:bg-green-50 transition-colors"
            aria-label={`Edit ${label}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

function appStatusPillClass(status: string) {
  const s = status.toLowerCase();
  if (s.includes('approved') || s.includes('enrolled')) return 'bg-green-100 text-green-800';
  if (s.includes('reject')) return 'bg-red-100 text-red-800';
  if (s.includes('review') || s.includes('pending')) return 'bg-blue-100 text-blue-800';
  return 'bg-gray-100 text-gray-800';
}

export function StudentDashboard() {
  const { user, patchUser } = useAuth();
  const { t } = useStudentLocale();
  const { data, loading, error, refetch } = useStudentPortal();
  const [voucherInput, setVoucherInput] = useState('');
  const [voucherSaving, setVoucherSaving] = useState(false);
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactAddress, setContactAddress] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [editingContactField, setEditingContactField] = useState<EditableContactFieldKey | null>(null);

  const hasEnrollment = !!data?.application?.id && String(data?.application?.id ?? '').trim().length > 0;
  const statusCode = String(data?.application?.status_code ?? '').toLowerCase();
  const needsResubmission = Boolean(data?.needs_resubmission);
  // Lock ONLY after an actual enrollment submission exists.
  // Brand new accounts should NOT be locked.
  const enrollmentLocked =
    hasEnrollment &&
    ['pending', 'under review', 'under_review', 'review', 'approved', 'enrolled'].includes(statusCode);
  const isFirstTimeStudent = !hasEnrollment && !enrollmentLocked;

  useEffect(() => {
    if (!data) return;
    if (enrollmentLocked) localStorage.setItem('studentEnrollmentLocked', '1');
    else localStorage.removeItem('studentEnrollmentLocked');
  }, [data, enrollmentLocked]);

  const enrollmentApproved = statusCode === 'approved' || statusCode === 'enrolled';
  const payMode = String(data?.application?.mode_of_payment || '').toLowerCase();
  const voucherSaved = String(data?.application?.voucher_no || '').trim();
  const showVoucherCard = enrollmentApproved && payMode && payMode !== 'cash';

  useEffect(() => {
    if (voucherSaved) setVoucherInput(voucherSaved);
  }, [voucherSaved]);

  useEffect(() => {
    if (!data?.profile) return;
    setContactPhone(data.profile.phone || '');
    setContactEmail(data.profile.email || '');
    setContactAddress(data.profile.address || '');
  }, [data?.profile.phone, data?.profile.email, data?.profile.address]);

  const startEditContact = (key: EditableContactFieldKey) => {
    if (!data?.profile) return;
    setContactPhone(data.profile.phone || '');
    setContactEmail(data.profile.email || '');
    setContactAddress(data.profile.address || '');
    setEditingContactField(key);
  };

  const cancelEditContact = () => {
    if (data?.profile) {
      setContactPhone(data.profile.phone || '');
      setContactEmail(data.profile.email || '');
      setContactAddress(data.profile.address || '');
    }
    setEditingContactField(null);
  };

  const saveContactField = async (field: EditableContactFieldKey) => {
    const phone = contactPhone.trim();
    const email = contactEmail.trim();
    const address = contactAddress.trim();
    if (field === 'phone' && !phone) {
      toast.error('Contact number is required.');
      return;
    }
    if (field === 'email' && !email) {
      toast.error('Email address is required.');
      return;
    }
    const payload =
      field === 'phone'
        ? { phone }
        : field === 'email'
          ? { email }
          : { address };

    setProfileSaving(true);
    try {
      const res = await apiFetch('/api/student/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      let json: { success?: boolean; error?: string; message?: string; profile?: { email?: string } } = {};
      try {
        json = JSON.parse(text);
      } catch {
        toast.error('Invalid server response');
        return;
      }
      if (!res.ok || !json.success) {
        toast.error(json.error || 'Could not save. Please try again.');
        return;
      }
      toast.success(json.message || 'Saved.');
      if (json.profile?.email) {
        patchUser({ email: json.profile.email });
      }
      setEditingContactField(null);
      await refetch();
    } catch {
      toast.error('Failed to save');
    } finally {
      setProfileSaving(false);
    }
  };

  const saveVoucher = async () => {
    const v = voucherInput.trim();
    if (!v) {
      toast.error('Enter your voucher number.');
      return;
    }
    setVoucherSaving(true);
    try {
      const res = await apiFetch('/api/student/enrollment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_voucher', voucher_no: v }),
      });
      const text = await res.text();
      let json: { success?: boolean; error?: string; message?: string } = {};
      try {
        json = JSON.parse(text);
      } catch {
        toast.error('Invalid server response');
        return;
      }
      if (!res.ok || !json.success) {
        toast.error(json.error || 'Could not save. Please try again.');
        return;
      }
      toast.success(json.message || 'Voucher number saved.');
      await refetch();
    } catch {
      toast.error('Failed to save voucher number');
    } finally {
      setVoucherSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      <EnrollmentGuide allowRestore={!isFirstTimeStudent} />

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">
            {isFirstTimeStudent ? t('dashboard.welcome') : t('dashboard.welcomeBack')}
          </h2>
          <p className="text-gray-600 mt-1">
            {isFirstTimeStudent
              ? t('dashboard.firstTimeSubtitle')
              : t('dashboard.returningSubtitle')}
          </p>
        </div>
        <div className="flex gap-2">
          {!enrollmentLocked && (
            <Link
              to="/student/enrollment"
              className="inline-flex items-center justify-center rounded-lg bg-[#8B1538] px-4 py-2 text-sm font-semibold text-white hover:bg-[#8B1538]/90"
            >
              {t('dashboard.continueEnrollment')}
            </Link>
          )}
          {enrollmentLocked && (
            <Link
              to="/student/application-status"
              className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold ${
                needsResubmission
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-[#8B1538] text-white hover:bg-[#8B1538]/90'
              }`}
            >
              {needsResubmission ? t('dashboard.resubmitDocs') : t('dashboard.checkStatus')}
            </Link>
          )}
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {t('dashboard.refresh')}
          </button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && !data && (
        <div className="flex items-center gap-2 text-gray-600 py-12 justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
          Loading your dashboard…
        </div>
      )}

      {data && (
        <>
          <Card className="border-gray-200 shadow-sm">
            <CardHeader className="border-b border-gray-100 bg-white">
              <CardTitle className="text-lg">Personal information</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <Detail
                  label="First name"
                  value={data.profile.first_name || data.profile.full_name}
                />
                <Detail label="Middle name" value={data.profile.middle_name} />
                <Detail label="Last name" value={data.profile.last_name} />
                <Detail label="Date of birth" value={data.profile.date_of_birth} />
                <Detail label="Gender" value={data.profile.gender} />
                <EditableContactField
                  label="Contact number"
                  fieldKey="phone"
                  value={contactPhone}
                  editing={editingContactField === 'phone'}
                  saving={profileSaving}
                  onStartEdit={startEditContact}
                  onCancel={cancelEditContact}
                  onChange={setContactPhone}
                  onSave={() => saveContactField('phone')}
                  inputId="dash-phone"
                />
                <EditableContactField
                  label="Email address"
                  fieldKey="email"
                  value={contactEmail}
                  editing={editingContactField === 'email'}
                  saving={profileSaving}
                  onStartEdit={startEditContact}
                  onCancel={cancelEditContact}
                  onChange={setContactEmail}
                  onSave={() => saveContactField('email')}
                  inputType="email"
                  inputId="dash-email"
                />
                <EditableContactField
                  label="Address"
                  fieldKey="address"
                  value={contactAddress}
                  editing={editingContactField === 'address'}
                  saving={profileSaving}
                  onStartEdit={startEditContact}
                  onCancel={cancelEditContact}
                  onChange={setContactAddress}
                  onSave={() => saveContactField('address')}
                  inputId="dash-address"
                />
                <Detail label="Strand" value={data.profile.strand} />
                <Detail label="Grade level" value={data.profile.grade_level} />
                <Detail label="School year" value={data.profile.school_year} />
                {enrollmentApproved && data.profile.school_username ? (
                  <Detail label="School username" value={data.profile.school_username} />
                ) : null}
                <div className="space-y-1 sm:col-span-2 lg:col-span-1">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Application status
                  </p>
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${appStatusPillClass(data.profile.application_status)}`}
                  >
                    {data.profile.application_status}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {showVoucherCard ? (
            <Card className="border border-gray-200 border-l-4 border-l-[#8B1538] shadow-sm">
              <CardHeader className="border-b border-gray-100 bg-white">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-[#8B1538]" aria-hidden />
                  Voucher number
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <p className="text-sm text-gray-600">
                  Your enrollment is approved. Enter the voucher number for your selected payment mode (
                  <span className="font-semibold uppercase">{payMode}</span>).
                </p>
                <div className="space-y-2 max-w-md">
                  <Label htmlFor="dash-voucher">Voucher No.</Label>
                  <Input
                    id="dash-voucher"
                    value={voucherInput}
                    onChange={(e) => setVoucherInput(e.target.value)}
                    placeholder="Enter voucher number"
                    autoComplete="off"
                  />
                </div>
                <Button
                  type="button"
                  onClick={saveVoucher}
                  disabled={voucherSaving}
                  className="bg-[#8B1538] hover:bg-[#8B1538]/90"
                >
                  {voucherSaving ? 'Saving…' : 'Save voucher number'}
                </Button>
                {voucherSaved ? (
                  <p className="text-xs text-green-800">
                    A voucher number is on file. You can update it above if it changes.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <Card className="border-gray-200 shadow-sm">
            <CardHeader className="border-b border-gray-100 bg-white">
              <CardTitle className="text-lg">Parent / guardian</CardTitle>
              <p className="text-sm text-gray-500 font-normal pt-1">
                From your enrollment application (mother, father, or legal guardian). Edit on the enrollment form while it is open; after submission, contact the Registrar for changes.
              </p>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <Detail label="Guardian name" value={data.guardian.name} />
                <Detail label="Relationship" value={data.guardian.relationship} />
                <Detail label="Guardian contact" value={data.guardian.contact} />
                <Detail label="Guardian email" value={data.guardian.email} />
                <Detail label="Occupation" value={data.guardian.occupation} />
              </div>
            </CardContent>
          </Card>

          <Card className="border-gray-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between border-b border-gray-100 bg-white space-y-0">
              <CardTitle className="text-lg">Enrollment progress</CardTitle>
              <span className="text-sm font-medium text-gray-600">
                {data.enrollment_progress.completed_count} of {data.enrollment_progress.total_steps}{' '}
                completed
              </span>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#2D5016] transition-all duration-500"
                  style={{ width: `${data.enrollment_progress.percent}%` }}
                />
              </div>
              <ul className="space-y-2">
                {data.enrollment_progress.steps.map((step) => {
                  const done = step.status === 'completed';
                  return (
                    <li
                      key={step.key}
                      className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                        done ? 'border-green-200 bg-green-50/80' : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <CheckCircle2
                          className={`h-5 w-5 shrink-0 ${done ? 'text-green-600' : 'text-gray-300'}`}
                        />
                        <span className={`font-medium ${done ? 'text-green-900' : 'text-gray-700'}`}>
                          {step.title}
                        </span>
                      </div>
                      {done ? (
                        <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded">
                          Completed
                        </span>
                      ) : step.status === 'current' ? (
                        <span className="text-xs font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                          In progress
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-gray-500">Pending</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
