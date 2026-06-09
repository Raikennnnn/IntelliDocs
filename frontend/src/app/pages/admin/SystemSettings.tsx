import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Alert, AlertDescription } from "../../components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import {
  Mail,
  Shield,
  Save,
  AlertCircle,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "../../lib/api";
import { useRolePermissions } from "../../context/RolePermissionsContext";

type EmailConfig = {
  mailProvider: "brevo" | "phpmail";
  smtpServer: string;
  smtpPort: string;
  emailAddress: string;
  fromName: string;
  emailPassword: string;
  otpExpiry: string;
};

type RolePermissions = {
  student: {
    viewApplicationStatus: boolean;
    uploadDocuments: boolean;
    editProfile: boolean;
    viewNotifications: boolean;
  };
  registrar: {
    viewApplications: boolean;
    approveApplications: boolean;
    rejectApplications: boolean;
    addRemarks: boolean;
    viewAIResults: boolean;
    generateReports: boolean;
  };
  admin: {
    manageUsers: boolean;
    viewActivityLogs: boolean;
    configureSystem: boolean;
    viewReports: boolean;
    manageRoles: boolean;
  };
};

type MailHealth = {
  ready: boolean;
  provider: string;
  from: string;
  issues: string[];
};

const ROLE_LABELS: Record<keyof RolePermissions, string> = {
  student: "Student",
  registrar: "Registrar",
  admin: "Admin",
};

const PERMISSION_LABELS: Record<keyof RolePermissions, Record<string, string>> = {
  student: {
    viewApplicationStatus: "View Application Status",
    uploadDocuments: "Upload Documents",
    editProfile: "Edit Profile",
    viewNotifications: "View Notifications",
  },
  registrar: {
    viewApplications: "View Applications",
    approveApplications: "Approve Applications",
    rejectApplications: "Reject Applications",
    addRemarks: "Add Remarks",
    viewAIResults: "View AI Verification Results",
    generateReports: "Generate Reports",
  },
  admin: {
    manageUsers: "Manage Users",
    viewActivityLogs: "View Activity Logs",
    configureSystem: "Configure System Settings",
    viewReports: "View System Reports",
    manageRoles: "Manage Role Permissions",
  },
};

function clonePermissions(perms: RolePermissions): RolePermissions {
  return {
    student: { ...perms.student },
    registrar: { ...perms.registrar },
    admin: { ...perms.admin },
  };
}

function summarizePermissionChanges(
  before: RolePermissions,
  after: RolePermissions,
): { disabled: string[]; enabled: string[] } {
  const disabled: string[] = [];
  const enabled: string[] = [];

  (Object.keys(PERMISSION_LABELS) as Array<keyof RolePermissions>).forEach((role) => {
    Object.entries(PERMISSION_LABELS[role]).forEach(([key, label]) => {
      const wasOn = before[role][key as keyof RolePermissions[typeof role]];
      const isOn = after[role][key as keyof RolePermissions[typeof role]];
      const line = `${ROLE_LABELS[role]} — ${label}`;
      if (wasOn && !isOn) disabled.push(line);
      if (!wasOn && isOn) enabled.push(line);
    });
  });

  return { disabled, enabled };
}

const defaultPermissions = (): RolePermissions => ({
  student: {
    viewApplicationStatus: true,
    uploadDocuments: true,
    editProfile: true,
    viewNotifications: true,
  },
  registrar: {
    viewApplications: true,
    approveApplications: true,
    rejectApplications: true,
    addRemarks: true,
    viewAIResults: true,
    generateReports: true,
  },
  admin: {
    manageUsers: true,
    viewActivityLogs: true,
    configureSystem: true,
    viewReports: true,
    manageRoles: true,
  },
});

export function SystemSettings() {
  const { reloadPermissions } = useRolePermissions();
  const [loading, setLoading] = useState(true);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mailHealth, setMailHealth] = useState<MailHealth | null>(null);

  const [emailConfig, setEmailConfig] = useState<EmailConfig>({
    mailProvider: "brevo",
    smtpServer: "smtp.gmail.com",
    smtpPort: "587",
    emailAddress: "",
    fromName: "Nuestra Señora De Guia Academy",
    emailPassword: "",
    otpExpiry: "10",
  });

  const [permissions, setPermissions] = useState<RolePermissions>(defaultPermissions);
  const [savedPermissions, setSavedPermissions] = useState<RolePermissions>(defaultPermissions);
  const [permissionsConfirmOpen, setPermissionsConfirmOpen] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/admin/settings");
      const text = await res.text();
      let json: Record<string, unknown> = {};
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error("Server returned an invalid response");
      }
      if (!res.ok || !json.success) {
        throw new Error((json.error as string) || `Failed to load settings (${res.status})`);
      }

      const email = (json.email ?? {}) as Record<string, string>;
      setEmailConfig({
        mailProvider: (email.mailProvider === "phpmail" ? "phpmail" : "brevo"),
        smtpServer: String(email.smtpServer ?? "smtp.gmail.com"),
        smtpPort: String(email.smtpPort ?? "587"),
        emailAddress: String(email.emailAddress ?? ""),
        fromName: String(email.fromName ?? "Nuestra Señora De Guia Academy"),
        emailPassword: String(email.emailPassword ?? ""),
        otpExpiry: String(email.otpExpiry ?? "10"),
      });

      const perms = json.permissions as RolePermissions | undefined;
      if (perms?.student && perms?.registrar && perms?.admin) {
        const loaded = clonePermissions(perms);
        setPermissions(loaded);
        setSavedPermissions(loaded);
      }

      const health = json.mailHealth as MailHealth | undefined;
      if (health) {
        setMailHealth(health);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const handleSaveEmailConfig = async () => {
    setSavingEmail(true);
    try {
      const res = await apiFetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          section: "email",
          ...emailConfig,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to save email configuration");
      }
      if (json.email) {
        const email = json.email as Record<string, string>;
        setEmailConfig((prev) => ({
          ...prev,
          emailPassword: String(email.emailPassword ?? prev.emailPassword),
        }));
      }
      await loadSettings();
      toast.success("Email configuration saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSavingEmail(false);
    }
  };

  const handleSavePermissions = async () => {
    setSavingPermissions(true);
    try {
      const res = await apiFetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          section: "permissions",
          permissions,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to save permissions");
      }
      toast.success("Role permissions saved");
      setSavedPermissions(clonePermissions(permissions));
      setPermissionsConfirmOpen(false);
      await reloadPermissions();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSavingPermissions(false);
    }
  };

  const permissionChanges = useMemo(
    () => summarizePermissionChanges(savedPermissions, permissions),
    [savedPermissions, permissions],
  );

  const permissionsDirty =
    permissionChanges.disabled.length > 0 || permissionChanges.enabled.length > 0;

  const handleTestEmail = async () => {
    setTestingEmail(true);
    try {
      const res = await apiFetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test_email",
          recipient: emailConfig.emailAddress || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        const issues = Array.isArray(json.issues) ? json.issues.join("; ") : "";
        throw new Error(
          (json.error as string) + (issues ? `: ${issues}` : "") || "Test email failed",
        );
      }
      toast.success(json.message || "Test email sent");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Test email failed");
    } finally {
      setTestingEmail(false);
    }
  };

  const apiKeyLabel =
    emailConfig.mailProvider === "brevo" ? "Brevo API Key" : "Mail Password (optional)";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">System Settings</h2>
        <p className="text-gray-600">
          Configure email delivery, OTP expiry, and role permission policies
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading settings…
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-[#8B1538]" />
            Email & OTP Configuration
          </CardTitle>
          <CardDescription>
            Settings are stored in the database and used for OTP and notification emails
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-[#8B1538] bg-red-50">
            <AlertCircle className="h-4 w-4 text-[#8B1538]" />
            <AlertDescription className="text-gray-700">
              <strong>Important:</strong> Changes affect OTP verification for registration,
              login, and password recovery. Use <strong>Brevo</strong> for production email
              delivery.
            </AlertDescription>
          </Alert>

          {mailHealth && (
            <Alert
              className={
                mailHealth.ready
                  ? "border-green-300 bg-green-50"
                  : "border-orange-300 bg-orange-50"
              }
            >
              {mailHealth.ready ? (
                <CheckCircle className="h-4 w-4 text-green-700" />
              ) : (
                <AlertCircle className="h-4 w-4 text-orange-700" />
              )}
              <AlertDescription className="text-gray-700">
                {mailHealth.ready ? (
                  <>
                    Mail transport is ready ({mailHealth.provider}
                    {mailHealth.from ? ` · ${mailHealth.from}` : ""}).
                  </>
                ) : (
                  <>
                    Mail transport needs attention:{" "}
                    {mailHealth.issues.length > 0
                      ? mailHealth.issues.join(" ")
                      : "Check provider and sender settings."}
                  </>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="mailProvider">Mail Provider</Label>
              <select
                id="mailProvider"
                value={emailConfig.mailProvider}
                onChange={(e) =>
                  setEmailConfig({
                    ...emailConfig,
                    mailProvider: e.target.value as EmailConfig["mailProvider"],
                  })
                }
                className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm"
                disabled={loading}
              >
                <option value="brevo">Brevo (recommended)</option>
                <option value="phpmail">PHP mail() — local/XAMPP only</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtpServer">SMTP Server (reference)</Label>
              <Input
                id="smtpServer"
                value={emailConfig.smtpServer}
                onChange={(e) =>
                  setEmailConfig({ ...emailConfig, smtpServer: e.target.value })
                }
                placeholder="smtp.gmail.com"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtpPort">SMTP Port (reference)</Label>
              <Input
                id="smtpPort"
                value={emailConfig.smtpPort}
                onChange={(e) =>
                  setEmailConfig({ ...emailConfig, smtpPort: e.target.value })
                }
                placeholder="587"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emailAddress">Sender Email Address</Label>
              <Input
                id="emailAddress"
                type="email"
                value={emailConfig.emailAddress}
                onChange={(e) =>
                  setEmailConfig({ ...emailConfig, emailAddress: e.target.value })
                }
                placeholder="nsdga.intellidocs@gmail.com"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fromName">Sender Display Name</Label>
              <Input
                id="fromName"
                value={emailConfig.fromName}
                onChange={(e) =>
                  setEmailConfig({ ...emailConfig, fromName: e.target.value })
                }
                placeholder="Nuestra Señora De Guia Academy"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emailPassword">{apiKeyLabel}</Label>
              <Input
                id="emailPassword"
                type="password"
                value={emailConfig.emailPassword}
                onChange={(e) =>
                  setEmailConfig({ ...emailConfig, emailPassword: e.target.value })
                }
                placeholder={emailConfig.emailPassword ? "••••••••" : "Enter API key"}
                disabled={loading}
              />
              <p className="text-xs text-gray-500">
                Leave masked value unchanged to keep the current key.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="otpExpiry">OTP Expiry (minutes)</Label>
              <Input
                id="otpExpiry"
                type="number"
                min={5}
                max={60}
                value={emailConfig.otpExpiry}
                onChange={(e) =>
                  setEmailConfig({ ...emailConfig, otpExpiry: e.target.value })
                }
                placeholder="10"
                disabled={loading}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => void handleSaveEmailConfig()}
              className="bg-[#2D5016] hover:bg-[#2D5016]/90 text-white"
              disabled={loading || savingEmail}
            >
              {savingEmail ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Configuration
            </Button>
            <Button
              variant="outline"
              onClick={() => void handleTestEmail()}
              disabled={loading || testingEmail}
            >
              {testingEmail ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Mail className="w-4 h-4 mr-2" />
              )}
              Send Test Email
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#8B1538]" />
            Role Permissions
          </CardTitle>
          <CardDescription>
            Permission policies saved for your institution (stored in app_settings)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="font-semibold text-lg mb-3 text-[#8B1538]">Student Permissions</h3>
            <div className="space-y-2">
              {(
                [
                  ["viewApplicationStatus", "View Application Status"],
                  ["uploadDocuments", "Upload Documents"],
                  ["editProfile", "Edit Profile"],
                  ["viewNotifications", "View Notifications"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`student-${key}`}
                    checked={permissions.student[key]}
                    onChange={(e) =>
                      setPermissions({
                        ...permissions,
                        student: { ...permissions.student, [key]: e.target.checked },
                      })
                    }
                    className="w-4 h-4 text-[#8B1538] border-gray-300 rounded focus:ring-[#8B1538]"
                    disabled={loading}
                  />
                  <Label htmlFor={`student-${key}`} className="cursor-pointer">
                    {label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3 text-[#2D5016]">Registrar Permissions</h3>
            <div className="space-y-2">
              {(
                [
                  ["viewApplications", "View Applications"],
                  ["approveApplications", "Approve Applications"],
                  ["rejectApplications", "Reject Applications"],
                  ["addRemarks", "Add Remarks"],
                  ["viewAIResults", "View AI Verification Results"],
                  ["generateReports", "Generate Reports"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`registrar-${key}`}
                    checked={permissions.registrar[key]}
                    onChange={(e) =>
                      setPermissions({
                        ...permissions,
                        registrar: { ...permissions.registrar, [key]: e.target.checked },
                      })
                    }
                    className="w-4 h-4 text-[#2D5016] border-gray-300 rounded focus:ring-[#2D5016]"
                    disabled={loading}
                  />
                  <Label htmlFor={`registrar-${key}`} className="cursor-pointer">
                    {label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3 text-[#8B1538]">Admin Permissions</h3>
            <div className="space-y-2">
              {(
                [
                  ["manageUsers", "Manage Users"],
                  ["viewActivityLogs", "View Activity Logs"],
                  ["configureSystem", "Configure System Settings"],
                  ["viewReports", "View System Reports"],
                  ["manageRoles", "Manage Role Permissions"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`admin-${key}`}
                    checked={permissions.admin[key]}
                    onChange={(e) =>
                      setPermissions({
                        ...permissions,
                        admin: { ...permissions.admin, [key]: e.target.checked },
                      })
                    }
                    className="w-4 h-4 text-[#8B1538] border-gray-300 rounded focus:ring-[#8B1538]"
                    disabled={loading}
                  />
                  <Label htmlFor={`admin-${key}`} className="cursor-pointer">
                    {label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <Button
            onClick={() => setPermissionsConfirmOpen(true)}
            className="bg-[#2D5016] hover:bg-[#2D5016]/90 text-white"
            disabled={loading || savingPermissions || !permissionsDirty}
          >
            {savingPermissions ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Permissions
          </Button>
        </CardContent>
      </Card>

      <AlertDialog
        open={permissionsConfirmOpen}
        onOpenChange={(open) => {
          if (!open && !savingPermissions) setPermissionsConfirmOpen(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save role permissions?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  These changes take effect immediately for all users in each role.
                  Disabled permissions hide pages from the sidebar and block the related API actions.
                </p>
                {permissionChanges.disabled.length > 0 && (
                  <div>
                    <p className="font-medium text-foreground">Will be disabled:</p>
                    <ul className="mt-1 list-disc pl-5 space-y-0.5">
                      {permissionChanges.disabled.map((line) => (
                        <li key={`off-${line}`}>{line}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {permissionChanges.enabled.length > 0 && (
                  <div>
                    <p className="font-medium text-foreground">Will be enabled:</p>
                    <ul className="mt-1 list-disc pl-5 space-y-0.5">
                      {permissionChanges.enabled.map((line) => (
                        <li key={`on-${line}`}>{line}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={savingPermissions}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#2D5016] hover:bg-[#2D5016]/90"
              disabled={savingPermissions}
              onClick={(e) => {
                e.preventDefault();
                void handleSavePermissions();
              }}
            >
              {savingPermissions ? "Saving…" : "Save permissions"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
