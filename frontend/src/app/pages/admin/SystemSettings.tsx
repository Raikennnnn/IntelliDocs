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
  Settings,
  Mail,
  Shield,
  Save,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function SystemSettings() {
  // OTP/Email Configuration
  const [emailConfig, setEmailConfig] = useState({
    smtpServer: "smtp.gmail.com",
    smtpPort: "587",
    emailAddress: "nsdg.intellidocs@gmail.com",
    emailPassword: "••••••••",
    otpExpiry: "10",
  });

  // Role Permissions
  const [permissions, setPermissions] = useState({
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

  const handleSaveEmailConfig = () => {
    toast.success("Email/OTP configuration saved successfully");
  };

  const handleSavePermissions = () => {
    toast.success("Role permissions updated successfully");
  };

  const handleTestEmail = () => {
    toast.info("Sending test email...");
    setTimeout(() => {
      toast.success("Test email sent successfully!");
    }, 1500);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">
          System Settings
        </h2>
        <p className="text-gray-600">
          Configure system-wide settings and permissions
        </p>
      </div>

      {/* Email/OTP Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-[#8B1538]" />
            Email & OTP Configuration
          </CardTitle>
          <CardDescription>
            Configure SMTP settings for email notifications and OTP verification
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-[#8B1538] bg-red-50">
            <AlertCircle className="h-4 w-4 text-[#8B1538]" />
            <AlertDescription className="text-gray-700">
              <strong>Important:</strong> Changes to email configuration will
              affect OTP verification for student registration and password
              recovery.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="smtpServer">SMTP Server</Label>
              <Input
                id="smtpServer"
                value={emailConfig.smtpServer}
                onChange={(e) =>
                  setEmailConfig({ ...emailConfig, smtpServer: e.target.value })
                }
                placeholder="smtp.gmail.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtpPort">SMTP Port</Label>
              <Input
                id="smtpPort"
                value={emailConfig.smtpPort}
                onChange={(e) =>
                  setEmailConfig({ ...emailConfig, smtpPort: e.target.value })
                }
                placeholder="587"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emailAddress">Email Address</Label>
              <Input
                id="emailAddress"
                type="email"
                value={emailConfig.emailAddress}
                onChange={(e) =>
                  setEmailConfig({
                    ...emailConfig,
                    emailAddress: e.target.value,
                  })
                }
                placeholder="noreply@nsdg.edu.ph"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emailPassword">Email Password</Label>
              <Input
                id="emailPassword"
                type="password"
                value={emailConfig.emailPassword}
                onChange={(e) =>
                  setEmailConfig({
                    ...emailConfig,
                    emailPassword: e.target.value,
                  })
                }
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="otpExpiry">OTP Expiry (minutes)</Label>
              <Input
                id="otpExpiry"
                type="number"
                value={emailConfig.otpExpiry}
                onChange={(e) =>
                  setEmailConfig({ ...emailConfig, otpExpiry: e.target.value })
                }
                placeholder="10"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={handleSaveEmailConfig}
              className="bg-[#2D5016] hover:bg-[#2D5016]/90 text-white"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Configuration
            </Button>
            <Button variant="outline" onClick={handleTestEmail}>
              <Mail className="w-4 h-4 mr-2" />
              Send Test Email
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Role Permissions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#8B1538]" />
            Role Permissions
          </CardTitle>
          <CardDescription>
            Configure permissions for each user role
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Student Permissions */}
          <div>
            <h3 className="font-semibold text-lg mb-3 text-[#8B1538]">
              Student Permissions
            </h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="student-viewApplicationStatus"
                  checked={permissions.student.viewApplicationStatus}
                  onChange={(e) =>
                    setPermissions({
                      ...permissions,
                      student: {
                        ...permissions.student,
                        viewApplicationStatus: e.target.checked,
                      },
                    })
                  }
                  className="w-4 h-4 text-[#8B1538] border-gray-300 rounded focus:ring-[#8B1538]"
                />
                <Label
                  htmlFor="student-viewApplicationStatus"
                  className="cursor-pointer"
                >
                  View Application Status
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="student-uploadDocuments"
                  checked={permissions.student.uploadDocuments}
                  onChange={(e) =>
                    setPermissions({
                      ...permissions,
                      student: {
                        ...permissions.student,
                        uploadDocuments: e.target.checked,
                      },
                    })
                  }
                  className="w-4 h-4 text-[#8B1538] border-gray-300 rounded focus:ring-[#8B1538]"
                />
                <Label
                  htmlFor="student-uploadDocuments"
                  className="cursor-pointer"
                >
                  Upload Documents
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="student-editProfile"
                  checked={permissions.student.editProfile}
                  onChange={(e) =>
                    setPermissions({
                      ...permissions,
                      student: {
                        ...permissions.student,
                        editProfile: e.target.checked,
                      },
                    })
                  }
                  className="w-4 h-4 text-[#8B1538] border-gray-300 rounded focus:ring-[#8B1538]"
                />
                <Label htmlFor="student-editProfile" className="cursor-pointer">
                  Edit Profile
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="student-viewNotifications"
                  checked={permissions.student.viewNotifications}
                  onChange={(e) =>
                    setPermissions({
                      ...permissions,
                      student: {
                        ...permissions.student,
                        viewNotifications: e.target.checked,
                      },
                    })
                  }
                  className="w-4 h-4 text-[#8B1538] border-gray-300 rounded focus:ring-[#8B1538]"
                />
                <Label
                  htmlFor="student-viewNotifications"
                  className="cursor-pointer"
                >
                  View Notifications
                </Label>
              </div>
            </div>
          </div>

          {/* Registrar Permissions */}
          <div>
            <h3 className="font-semibold text-lg mb-3 text-[#2D5016]">
              Registrar Permissions
            </h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="registrar-viewApplications"
                  checked={permissions.registrar.viewApplications}
                  onChange={(e) =>
                    setPermissions({
                      ...permissions,
                      registrar: {
                        ...permissions.registrar,
                        viewApplications: e.target.checked,
                      },
                    })
                  }
                  className="w-4 h-4 text-[#2D5016] border-gray-300 rounded focus:ring-[#2D5016]"
                />
                <Label
                  htmlFor="registrar-viewApplications"
                  className="cursor-pointer"
                >
                  View Applications
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="registrar-approveApplications"
                  checked={permissions.registrar.approveApplications}
                  onChange={(e) =>
                    setPermissions({
                      ...permissions,
                      registrar: {
                        ...permissions.registrar,
                        approveApplications: e.target.checked,
                      },
                    })
                  }
                  className="w-4 h-4 text-[#2D5016] border-gray-300 rounded focus:ring-[#2D5016]"
                />
                <Label
                  htmlFor="registrar-approveApplications"
                  className="cursor-pointer"
                >
                  Approve Applications
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="registrar-rejectApplications"
                  checked={permissions.registrar.rejectApplications}
                  onChange={(e) =>
                    setPermissions({
                      ...permissions,
                      registrar: {
                        ...permissions.registrar,
                        rejectApplications: e.target.checked,
                      },
                    })
                  }
                  className="w-4 h-4 text-[#2D5016] border-gray-300 rounded focus:ring-[#2D5016]"
                />
                <Label
                  htmlFor="registrar-rejectApplications"
                  className="cursor-pointer"
                >
                  Reject Applications
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="registrar-addRemarks"
                  checked={permissions.registrar.addRemarks}
                  onChange={(e) =>
                    setPermissions({
                      ...permissions,
                      registrar: {
                        ...permissions.registrar,
                        addRemarks: e.target.checked,
                      },
                    })
                  }
                  className="w-4 h-4 text-[#2D5016] border-gray-300 rounded focus:ring-[#2D5016]"
                />
                <Label
                  htmlFor="registrar-addRemarks"
                  className="cursor-pointer"
                >
                  Add Remarks
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="registrar-viewAIResults"
                  checked={permissions.registrar.viewAIResults}
                  onChange={(e) =>
                    setPermissions({
                      ...permissions,
                      registrar: {
                        ...permissions.registrar,
                        viewAIResults: e.target.checked,
                      },
                    })
                  }
                  className="w-4 h-4 text-[#2D5016] border-gray-300 rounded focus:ring-[#2D5016]"
                />
                <Label
                  htmlFor="registrar-viewAIResults"
                  className="cursor-pointer"
                >
                  View AI Verification Results
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="registrar-generateReports"
                  checked={permissions.registrar.generateReports}
                  onChange={(e) =>
                    setPermissions({
                      ...permissions,
                      registrar: {
                        ...permissions.registrar,
                        generateReports: e.target.checked,
                      },
                    })
                  }
                  className="w-4 h-4 text-[#2D5016] border-gray-300 rounded focus:ring-[#2D5016]"
                />
                <Label
                  htmlFor="registrar-generateReports"
                  className="cursor-pointer"
                >
                  Generate Reports
                </Label>
              </div>
            </div>
          </div>

          {/* Admin Permissions */}
          <div>
            <h3 className="font-semibold text-lg mb-3 text-[#8B1538]">
              Admin Permissions
            </h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="admin-manageUsers"
                  checked={permissions.admin.manageUsers}
                  onChange={(e) =>
                    setPermissions({
                      ...permissions,
                      admin: {
                        ...permissions.admin,
                        manageUsers: e.target.checked,
                      },
                    })
                  }
                  className="w-4 h-4 text-[#8B1538] border-gray-300 rounded focus:ring-[#8B1538]"
                />
                <Label htmlFor="admin-manageUsers" className="cursor-pointer">
                  Manage Users
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="admin-viewActivityLogs"
                  checked={permissions.admin.viewActivityLogs}
                  onChange={(e) =>
                    setPermissions({
                      ...permissions,
                      admin: {
                        ...permissions.admin,
                        viewActivityLogs: e.target.checked,
                      },
                    })
                  }
                  className="w-4 h-4 text-[#8B1538] border-gray-300 rounded focus:ring-[#8B1538]"
                />
                <Label
                  htmlFor="admin-viewActivityLogs"
                  className="cursor-pointer"
                >
                  View Activity Logs
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="admin-configureSystem"
                  checked={permissions.admin.configureSystem}
                  onChange={(e) =>
                    setPermissions({
                      ...permissions,
                      admin: {
                        ...permissions.admin,
                        configureSystem: e.target.checked,
                      },
                    })
                  }
                  className="w-4 h-4 text-[#8B1538] border-gray-300 rounded focus:ring-[#8B1538]"
                />
                <Label
                  htmlFor="admin-configureSystem"
                  className="cursor-pointer"
                >
                  Configure System Settings
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="admin-viewReports"
                  checked={permissions.admin.viewReports}
                  onChange={(e) =>
                    setPermissions({
                      ...permissions,
                      admin: {
                        ...permissions.admin,
                        viewReports: e.target.checked,
                      },
                    })
                  }
                  className="w-4 h-4 text-[#8B1538] border-gray-300 rounded focus:ring-[#8B1538]"
                />
                <Label htmlFor="admin-viewReports" className="cursor-pointer">
                  View System Reports
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="admin-manageRoles"
                  checked={permissions.admin.manageRoles}
                  onChange={(e) =>
                    setPermissions({
                      ...permissions,
                      admin: {
                        ...permissions.admin,
                        manageRoles: e.target.checked,
                      },
                    })
                  }
                  className="w-4 h-4 text-[#8B1538] border-gray-300 rounded focus:ring-[#8B1538]"
                />
                <Label htmlFor="admin-manageRoles" className="cursor-pointer">
                  Manage Role Permissions
                </Label>
              </div>
            </div>
          </div>

          <Button
            onClick={handleSavePermissions}
            className="bg-[#2D5016] hover:bg-[#2D5016]/90 text-white"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Permissions
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
