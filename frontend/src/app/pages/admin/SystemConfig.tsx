import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { 
  Shield, 
  Clock, 
  Database, 
  Mail, 
  Save, 
  Key, 
  Lock, 
  Server, 
  FileText,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export function SystemConfig() {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [activeTab, setActiveTab] = useState<'security' | 'session' | 'database' | 'email' | 'logs' | 'rbac'>('security');

  // Security Settings State
  const [securitySettings, setSecuritySettings] = useState({
    minPasswordLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    passwordExpiration: 90,
    maxLoginAttempts: 5,
    lockoutDuration: 30,
    enableTwoFactor: false,
    sessionTimeout: 60,
  });

  // Session Management State
  const [sessionSettings, setSessionSettings] = useState({
    sessionDuration: 60,
    maxConcurrentSessions: 3,
    forceLogoutInactive: true,
    inactiveTimeout: 30,
    rememberMeDuration: 7,
  });

  // Database Settings State
  const [databaseSettings, setDatabaseSettings] = useState({
    autoBackup: true,
    backupFrequency: 'daily',
    backupTime: '02:00',
    backupRetention: 30,
    maintenanceDay: 'Sunday',
    maintenanceTime: '03:00',
    dataRetentionPeriod: 365,
  });

  // Email/SMTP Settings State
  const [emailSettings, setEmailSettings] = useState({
    smtpHost: 'smtp.example.com',
    smtpPort: 587,
    smtpUser: 'noreply@nsdgam.edu.ph',
    smtpPassword: '••••••••',
    smtpEncryption: 'TLS',
    fromEmail: 'noreply@nsdgam.edu.ph',
    fromName: 'NSDGA Marikina',
    testEmailSent: false,
  });

  // Log Settings State
  const [logSettings, setLogSettings] = useState({
    logLevel: 'info',
    logRetention: 90,
    auditTrailRetention: 365,
    enableDetailedLogging: true,
    logStoragePath: '/var/log/nsdga',
  });

  // RBAC Settings State
  const [rbacSettings, setRbacSettings] = useState({
    strictRoleEnforcement: true,
    allowRoleEscalation: false,
    auditRoleChanges: true,
    sessionBasedPermissions: true,
  });

  const handleSave = () => {
    setSaveStatus('saving');
    // Simulate save operation
    setTimeout(() => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 1000);
  };

  const tabs = [
    { id: 'security', label: 'Security Settings', icon: Shield },
    { id: 'session', label: 'Session Management', icon: Clock },
    { id: 'database', label: 'Database & Backup', icon: Database },
    { id: 'email', label: 'Email/SMTP', icon: Mail },
    { id: 'logs', label: 'Logs & Audit', icon: FileText },
    { id: 'rbac', label: 'RBAC Config', icon: Lock },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">System Configuration</h2>
          <p className="text-gray-600">Manage technical settings and system parameters</p>
        </div>
        <Button 
          onClick={handleSave}
          disabled={saveStatus === 'saving'}
          className="bg-[#2D5016] hover:bg-[#2D5016]/90 text-white"
        >
          {saveStatus === 'saving' ? (
            <>
              <Server className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : saveStatus === 'saved' ? (
            <>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Saved
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save All Changes
            </>
          )}
        </Button>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <div className="flex space-x-8 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 pb-4 px-1 border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-[#8B1538] text-[#8B1538]'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Security Settings Tab */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-[#8B1538]" />
                Password Policy Configuration
              </CardTitle>
              <CardDescription>Define password requirements and security policies</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Minimum Password Length
                  </label>
                  <input
                    type="number"
                    value={securitySettings.minPasswordLength}
                    onChange={(e) => setSecuritySettings({...securitySettings, minPasswordLength: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B1538]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password Expiration (Days)
                  </label>
                  <input
                    type="number"
                    value={securitySettings.passwordExpiration}
                    onChange={(e) => setSecuritySettings({...securitySettings, passwordExpiration: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B1538]"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={securitySettings.requireUppercase}
                    onChange={(e) => setSecuritySettings({...securitySettings, requireUppercase: e.target.checked})}
                    className="w-4 h-4 text-[#8B1538] border-gray-300 rounded focus:ring-[#8B1538]"
                  />
                  <span className="text-sm text-gray-700">Require Uppercase Letters</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={securitySettings.requireLowercase}
                    onChange={(e) => setSecuritySettings({...securitySettings, requireLowercase: e.target.checked})}
                    className="w-4 h-4 text-[#8B1538] border-gray-300 rounded focus:ring-[#8B1538]"
                  />
                  <span className="text-sm text-gray-700">Require Lowercase Letters</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={securitySettings.requireNumbers}
                    onChange={(e) => setSecuritySettings({...securitySettings, requireNumbers: e.target.checked})}
                    className="w-4 h-4 text-[#8B1538] border-gray-300 rounded focus:ring-[#8B1538]"
                  />
                  <span className="text-sm text-gray-700">Require Numbers</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={securitySettings.requireSpecialChars}
                    onChange={(e) => setSecuritySettings({...securitySettings, requireSpecialChars: e.target.checked})}
                    className="w-4 h-4 text-[#8B1538] border-gray-300 rounded focus:ring-[#8B1538]"
                  />
                  <span className="text-sm text-gray-700">Require Special Characters</span>
                </label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-[#8B1538]" />
                Login Security
              </CardTitle>
              <CardDescription>Configure login attempt limits and lockout policies</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Login Attempts
                  </label>
                  <input
                    type="number"
                    value={securitySettings.maxLoginAttempts}
                    onChange={(e) => setSecuritySettings({...securitySettings, maxLoginAttempts: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B1538]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Lockout Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    value={securitySettings.lockoutDuration}
                    onChange={(e) => setSecuritySettings({...securitySettings, lockoutDuration: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B1538]"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={securitySettings.enableTwoFactor}
                  onChange={(e) => setSecuritySettings({...securitySettings, enableTwoFactor: e.target.checked})}
                  className="w-4 h-4 text-[#8B1538] border-gray-300 rounded focus:ring-[#8B1538]"
                />
                <span className="text-sm text-gray-700">Enable Two-Factor Authentication (2FA)</span>
              </label>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Session Management Tab */}
      {activeTab === 'session' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#8B1538]" />
                Session Duration & Limits
              </CardTitle>
              <CardDescription>Configure user session timeouts and concurrent login policies</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Session Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    value={sessionSettings.sessionDuration}
                    onChange={(e) => setSessionSettings({...sessionSettings, sessionDuration: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B1538]"
                  />
                  <p className="text-xs text-gray-500 mt-1">Automatic logout after inactivity</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Concurrent Sessions
                  </label>
                  <input
                    type="number"
                    value={sessionSettings.maxConcurrentSessions}
                    onChange={(e) => setSessionSettings({...sessionSettings, maxConcurrentSessions: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B1538]"
                  />
                  <p className="text-xs text-gray-500 mt-1">Per user account</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Inactive Timeout (Minutes)
                  </label>
                  <input
                    type="number"
                    value={sessionSettings.inactiveTimeout}
                    onChange={(e) => setSessionSettings({...sessionSettings, inactiveTimeout: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B1538]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    "Remember Me" Duration (Days)
                  </label>
                  <input
                    type="number"
                    value={sessionSettings.rememberMeDuration}
                    onChange={(e) => setSessionSettings({...sessionSettings, rememberMeDuration: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B1538]"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={sessionSettings.forceLogoutInactive}
                  onChange={(e) => setSessionSettings({...sessionSettings, forceLogoutInactive: e.target.checked})}
                  className="w-4 h-4 text-[#8B1538] border-gray-300 rounded focus:ring-[#8B1538]"
                />
                <span className="text-sm text-gray-700">Force Logout Inactive Users</span>
              </label>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Database & Backup Tab */}
      {activeTab === 'database' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5 text-[#8B1538]" />
                Automatic Backup Configuration
              </CardTitle>
              <CardDescription>Schedule and manage database backups</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={databaseSettings.autoBackup}
                  onChange={(e) => setDatabaseSettings({...databaseSettings, autoBackup: e.target.checked})}
                  className="w-4 h-4 text-[#8B1538] border-gray-300 rounded focus:ring-[#8B1538]"
                />
                <span className="text-sm text-gray-700">Enable Automatic Backups</span>
              </label>

              {databaseSettings.autoBackup && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Backup Frequency
                    </label>
                    <select
                      value={databaseSettings.backupFrequency}
                      onChange={(e) => setDatabaseSettings({...databaseSettings, backupFrequency: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B1538]"
                    >
                      <option value="hourly">Hourly</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Backup Time
                    </label>
                    <input
                      type="time"
                      value={databaseSettings.backupTime}
                      onChange={(e) => setDatabaseSettings({...databaseSettings, backupTime: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B1538]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Backup Retention (Days)
                    </label>
                    <input
                      type="number"
                      value={databaseSettings.backupRetention}
                      onChange={(e) => setDatabaseSettings({...databaseSettings, backupRetention: parseInt(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B1538]"
                    />
                    <p className="text-xs text-gray-500 mt-1">Old backups will be automatically deleted</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="w-5 h-5 text-[#8B1538]" />
                Database Maintenance
              </CardTitle>
              <CardDescription>Configure scheduled maintenance windows</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Maintenance Day
                  </label>
                  <select
                    value={databaseSettings.maintenanceDay}
                    onChange={(e) => setDatabaseSettings({...databaseSettings, maintenanceDay: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B1538]"
                  >
                    <option value="Sunday">Sunday</option>
                    <option value="Monday">Monday</option>
                    <option value="Tuesday">Tuesday</option>
                    <option value="Wednesday">Wednesday</option>
                    <option value="Thursday">Thursday</option>
                    <option value="Friday">Friday</option>
                    <option value="Saturday">Saturday</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Maintenance Time
                  </label>
                  <input
                    type="time"
                    value={databaseSettings.maintenanceTime}
                    onChange={(e) => setDatabaseSettings({...databaseSettings, maintenanceTime: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B1538]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Data Retention Period (Days)
                  </label>
                  <input
                    type="number"
                    value={databaseSettings.dataRetentionPeriod}
                    onChange={(e) => setDatabaseSettings({...databaseSettings, dataRetentionPeriod: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B1538]"
                  />
                  <p className="text-xs text-gray-500 mt-1">Archive or delete old data</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Email/SMTP Tab */}
      {activeTab === 'email' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-[#8B1538]" />
                SMTP Server Configuration
              </CardTitle>
              <CardDescription>Configure email delivery settings for system notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    SMTP Host
                  </label>
                  <input
                    type="text"
                    value={emailSettings.smtpHost}
                    onChange={(e) => setEmailSettings({...emailSettings, smtpHost: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B1538]"
                    placeholder="smtp.example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    SMTP Port
                  </label>
                  <input
                    type="number"
                    value={emailSettings.smtpPort}
                    onChange={(e) => setEmailSettings({...emailSettings, smtpPort: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B1538]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    SMTP Username
                  </label>
                  <input
                    type="text"
                    value={emailSettings.smtpUser}
                    onChange={(e) => setEmailSettings({...emailSettings, smtpUser: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B1538]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    SMTP Password
                  </label>
                  <input
                    type="password"
                    value={emailSettings.smtpPassword}
                    onChange={(e) => setEmailSettings({...emailSettings, smtpPassword: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B1538]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Encryption
                  </label>
                  <select
                    value={emailSettings.smtpEncryption}
                    onChange={(e) => setEmailSettings({...emailSettings, smtpEncryption: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B1538]"
                  >
                    <option value="None">None</option>
                    <option value="TLS">TLS</option>
                    <option value="SSL">SSL</option>
                  </select>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Sender Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      From Email
                    </label>
                    <input
                      type="email"
                      value={emailSettings.fromEmail}
                      onChange={(e) => setEmailSettings({...emailSettings, fromEmail: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B1538]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      From Name
                    </label>
                    <input
                      type="text"
                      value={emailSettings.fromName}
                      onChange={(e) => setEmailSettings({...emailSettings, fromName: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B1538]"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t">
                <Button variant="outline" className="border-[#8B1538] text-[#8B1538] hover:bg-red-50">
                  <Mail className="w-4 h-4 mr-2" />
                  Send Test Email
                </Button>
                {emailSettings.testEmailSent && (
                  <Badge variant="default" className="bg-[#2D5016]">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Test email sent successfully
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Logs & Audit Tab */}
      {activeTab === 'logs' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#8B1538]" />
                Log Configuration
              </CardTitle>
              <CardDescription>Configure system logging and audit trail settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Log Level
                  </label>
                  <select
                    value={logSettings.logLevel}
                    onChange={(e) => setLogSettings({...logSettings, logLevel: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B1538]"
                  >
                    <option value="error">Error Only</option>
                    <option value="warning">Warning & Error</option>
                    <option value="info">Info, Warning & Error</option>
                    <option value="debug">Debug (All Events)</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Higher levels include more detailed logs</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Log Storage Path
                  </label>
                  <input
                    type="text"
                    value={logSettings.logStoragePath}
                    onChange={(e) => setLogSettings({...logSettings, logStoragePath: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B1538]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Log Retention (Days)
                  </label>
                  <input
                    type="number"
                    value={logSettings.logRetention}
                    onChange={(e) => setLogSettings({...logSettings, logRetention: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B1538]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Audit Trail Retention (Days)
                  </label>
                  <input
                    type="number"
                    value={logSettings.auditTrailRetention}
                    onChange={(e) => setLogSettings({...logSettings, auditTrailRetention: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B1538]"
                  />
                  <p className="text-xs text-gray-500 mt-1">Security and compliance logs</p>
                </div>
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={logSettings.enableDetailedLogging}
                  onChange={(e) => setLogSettings({...logSettings, enableDetailedLogging: e.target.checked})}
                  className="w-4 h-4 text-[#8B1538] border-gray-300 rounded focus:ring-[#8B1538]"
                />
                <span className="text-sm text-gray-700">Enable Detailed Logging (includes user actions and system events)</span>
              </label>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-900">Storage Consideration</p>
                  <p className="text-sm text-yellow-700 mt-1">
                    Detailed logging may consume significant disk space. Monitor storage regularly.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* RBAC Configuration Tab */}
      {activeTab === 'rbac' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-[#8B1538]" />
                Role-Based Access Control (RBAC)
              </CardTitle>
              <CardDescription>Configure system-wide permission and role enforcement</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={rbacSettings.strictRoleEnforcement}
                    onChange={(e) => setRbacSettings({...rbacSettings, strictRoleEnforcement: e.target.checked})}
                    className="w-4 h-4 text-[#8B1538] border-gray-300 rounded focus:ring-[#8B1538]"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700">Strict Role Enforcement</span>
                    <p className="text-xs text-gray-500">Deny access to features not explicitly assigned to user role</p>
                  </div>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={rbacSettings.allowRoleEscalation}
                    onChange={(e) => setRbacSettings({...rbacSettings, allowRoleEscalation: e.target.checked})}
                    className="w-4 h-4 text-[#8B1538] border-gray-300 rounded focus:ring-[#8B1538]"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700">Allow Role Escalation</span>
                    <p className="text-xs text-gray-500">Permit temporary elevated permissions (requires approval)</p>
                  </div>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={rbacSettings.auditRoleChanges}
                    onChange={(e) => setRbacSettings({...rbacSettings, auditRoleChanges: e.target.checked})}
                    className="w-4 h-4 text-[#8B1538] border-gray-300 rounded focus:ring-[#8B1538]"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700">Audit Role Changes</span>
                    <p className="text-xs text-gray-500">Log all permission modifications and role assignments</p>
                  </div>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={rbacSettings.sessionBasedPermissions}
                    onChange={(e) => setRbacSettings({...rbacSettings, sessionBasedPermissions: e.target.checked})}
                    className="w-4 h-4 text-[#8B1538] border-gray-300 rounded focus:ring-[#8B1538]"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700">Session-Based Permissions</span>
                    <p className="text-xs text-gray-500">Refresh permissions on each login (more secure, slight performance impact)</p>
                  </div>
                </label>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                <h4 className="text-sm font-medium text-blue-900 mb-2">Role Hierarchy</h4>
                <div className="space-y-2 text-sm text-blue-800">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4" />
                    <span><strong>Admin:</strong> Full system access & configuration</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4" />
                    <span><strong>Registrar:</strong> Student account management & document verification</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4" />
                    <span><strong>Student:</strong> View-only access to personal records</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}