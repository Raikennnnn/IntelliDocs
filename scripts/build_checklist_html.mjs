import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '../docs/ALT_F4_CHECKLIST_COPYPASTE.html');

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function table(headers, rows) {
  let h = '<table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;width:100%;font-family:Calibri,Arial,sans-serif;font-size:11pt;"><tr>';
  for (const x of headers) h += `<th style="background:#d9d9d9;">${esc(x)}</th>`;
  h += '</tr>';
  for (const row of rows) {
    h += '<tr>';
    for (const cell of row) h += `<td valign="top">${esc(cell)}</td>`;
    h += '</tr>';
  }
  return `${h}</table><br/>\n`;
}

function parsePct(cell) {
  if (!cell || cell === '') return null;
  const n = parseInt(String(cell).replace(/%/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

/** std5 rows: [task, status, pct, evidence, remarks] */
function statsStd5(rows, { completedAt = 100 } = {}) {
  const items = rows.filter((r) => {
    if (!r[0] || /^TOTAL$/i.test(r[0])) return false;
    if (r[1] === '' && parsePct(r[2]) === null) return false; // section header (c4 style)
    if (/^\d+\.\s/.test(String(r[0]))) return false; // numbered section parent — avoid double-counting
    return parsePct(r[2]) !== null;
  });
  const pcts = items.map((r) => parsePct(r[2]));
  const total = items.length;
  const completed = pcts.filter((p) => p >= completedAt).length;
  const avg = total ? Math.round(pcts.reduce((a, b) => a + b, 0) / total) : 0;
  return { total, completed, avg };
}

/** c3 rows: status col index 5 */
function statsC3(rows) {
  const statusPct = {
    'Completed and Validated': 100,
    Completed: 100,
    'Mostly Completed / For Testing': 75,
    'Partially Completed': 50,
    'Initial Development': 25,
    'Needs Deployment Validation': 25,
    'Not Started': 0,
    'Not Applicable': null,
  };
  const items = rows.filter((r) => r[0] && statusPct[r[5]] !== null && statusPct[r[5]] !== undefined);
  const pcts = items.map((r) => statusPct[r[5]]);
  const total = items.length;
  const completed = pcts.filter((p) => p >= 100).length;
  const avg = total ? Math.round(pcts.reduce((a, b) => a + b, 0) / total) : 0;
  return { total, completed, avg };
}

function applyTotal(rows, pctCol = 2) {
  const { avg } = statsStd5(rows);
  return rows.map((r) => (/^TOTAL$/i.test(r[0]) ? [...r.slice(0, pctCol), `${avg}%`, ...r.slice(pctCol + 1)] : r));
}

function pct(n) {
  return `${n}%`;
}

function eRow(category, sourceRows, opts = {}) {
  const s = opts.useC3 ? statsC3(sourceRows) : statsStd5(sourceRows, opts);
  const weight = opts.weight ?? '';
  const weighted = weight !== '' && weight !== null ? Math.round((s.avg * Number(weight)) / 100) : '';
  return [category, String(s.total), String(s.completed), pct(s.avg), weight !== '' && weight !== null ? `${weight}%` : '', weighted !== '' ? pct(weighted) : '', opts.remarks ?? ''];
}

const std5 = ['Specific Modules / Tasks', 'Status', 'Percentage', 'Evidence / Proof', 'Remarks'];
const c3h = ['Security Feature', 'Related Threat', 'Security Requirement', 'Test Case', 'Evidence / Proof', 'Status', 'Remarks'];
const d2h = ['Specific Objective No.', 'Approved Specific Objective', 'Related System Module / Research Output', 'Chapter 4 Evidence', 'Chapter 5 Conclusion Link', 'Chapter 6 Recommendation, if needed', 'Status', 'Percentage', 'Remarks'];

// Percentages follow CodeBusters scale: 75% = implemented, needs formal validation evidence
let b1 = [
  ['Chapter 4 | Results and Discussion', 'Initial Development', '25%', '', 'Output of Methodology sections 3.3 and 3.4.'],
  ['System Implementation Overview', 'Partially Completed', '50%', 'Screenshots / localhost demo', 'System built on XAMPP; deployment link pending.'],
  ['Implemented Web Modules Summary (SO1)', 'Mostly Completed / For Testing', '75%', 'Module screenshots', 'User Account Management; Online Enrollment; Document Submission and Management; AI Document Verification Feature; Reports and Monitoring.'],
  ['Security Components Implementation Summary (SO2)', 'Mostly Completed / For Testing', '69%', 'auth.php, session_token.php, ai_verify_document.php', 'Auth/RBAC/AI implemented (75%); HTTPS/TLS not deployed (50%). Avg of SO2 items.'],
  ['Results of System Quality Evaluation (SO4 / ISO 25010)', 'Not Started', '0%', 'Survey / evaluation tables', 'Functional suitability, usability, reliability, performance efficiency, security — survey not yet conducted.'],
  ['Functional Suitability Results', 'Not Started', '0%', 'Functional requirement test results', ''],
  ['Performance Efficiency Results', 'Not Started', '0%', 'KPI / response time results', ''],
  ['Reliability Results', 'Not Started', '0%', 'Uptime / stability logs', ''],
  ['Usability Results', 'Not Started', '0%', 'Survey results', ''],
  ['Adaptable Evaluation Table Included', 'Not Started', '0%', 'ISO/IEC 25010 table', ''],
  ['Results of Security Testing and Vulnerability Assessment', 'Not Started', '0%', 'Security testing report', 'Paper test plan — formal runs and metrics pending.'],
  ['Unauthorized Access Results', 'Not Started', '0%', 'Table 1 — rejection rate ≥99%', 'No Chapter 4 results table yet. Auth controls exist in code.'],
  ['Input Validation Results', 'Not Started', '0%', 'Table 1 — prevention rate ≥99%', 'No Chapter 4 results table yet. Validation exists in code.'],
  ['Brute Force Attack Results', 'Not Started', '0%', 'Table 1 — lockout effectiveness ≥98%', 'Lockout in auth.php; no measured results documented.'],
  ['Session Management Results', 'Not Started', '0%', 'Table 1 — token invalidation ≥99%', 'Tokens implemented; no measured results documented.'],
  ['Access Control (RBAC) Results', 'Not Started', '0%', 'Table 1 — enforcement rate ≥99%', 'RBAC in code; no measured results documented.'],
  ['AI Document Verification Results (SO3)', 'Not Started', '0%', 'Table 1 — detection accuracy ≥90%', 'AI pipeline works; controlled evaluation not documented in Ch.4.'],
  ['Discussion of Findings', 'Not Started', '0%', 'Narrative interpretation', ''],
  ['Interpretation of Results', 'Not Started', '0%', 'Comparison / cited discussion', ''],
  ['Implication of Findings', 'Not Started', '0%', 'Implication paragraph', ''],
  ['TOTAL', '', '', '', ''],
];

let b3 = [
  ['Chapter 5 | Conclusion', 'Not Started', '0%', '', ''],
  ['Summary of Key Findings', 'Not Started', '0%', 'Condensed major results', ''],
  ['Conclusions and Implications', 'Not Started', '0%', 'Conclusion section', ''],
  ['Objective-to-Finding Alignment', 'Not Started', '0%', 'Matrix / discussion', ''],
  ['Security Conclusion', 'Not Started', '0%', 'Security assessment summary', ''],
  ['TOTAL', '', '', '', ''],
];

let b4 = [
  ['Chapter 6 | Recommendations', 'Not Started', '0%', '', ''],
  ['System Enhancements', 'Not Started', '0%', 'Enhancement list', ''],
  ['Security Improvements', 'Not Started', '0%', 'Security improvement list', 'Recommend HTTPS/production SSL, forgot-password flow, formal Ch.4 security test tables, unauthorized-access anomaly logging.'],
  ['Future Research', 'Not Started', '0%', 'Future research direction', ''],
  ['Deployment Advice', 'Not Started', '0%', 'Deployment checklist / live link', ''],
  ['TOTAL', '', '', '', ''],
];

let b5 = [
  ['C. Bibliography', 'Not Started', '0%', '', 'References section pending final manuscript.'],
  ['Bibliography / References completed', 'Not Started', '0%', 'Final reference list', ''],
  ['Formatted bibliography', 'Not Started', '0%', '', 'ACM format pending.'],
  ['Sources are relevant, credible, and updated', 'Not Started', '0%', '', ''],
  ['Use of cybersecurity standards and frameworks is properly cited', 'Not Started', '0%', '', ''],
  ['D. Appendices', 'Not Started', '0%', 'Appendix section of manuscript', ''],
  ['Communication Letter', 'Not Started', '0%', 'Signed/received copy', ''],
  ['Transcript of Interview', 'Not Started', '0%', 'Transcript file', ''],
  ['Panel Comments', 'Not Started', '0%', 'Panel comment sheet', ''],
  ['Signed FRS', 'Partially Completed', '50%', 'Signed copy', 'FRS exists; signed appendix pending.'],
  ['Expert Validation', 'Not Started', '0%', 'Validation forms', ''],
  ['System Functionality Evaluation Questionnaire', 'Not Started', '0%', 'Questionnaire copy', ''],
  ['Security Testing and Assessment Evaluation', 'Not Started', '0%', 'Evaluation tool', ''],
  ['Security Test Case', 'Not Started', '0%', 'Test case document', ''],
  ['Ethics Clearance Certification', 'Not Started', '0%', 'Certificate', ''],
  ['Security Testing Video Review and Validation Form', 'Not Started', '0%', 'Video review form', ''],
  ['Curriculum Vitae', 'Not Started', '0%', 'CV file', ''],
  ['TOTAL', '', '', '', ''],
];

const b5Bibliography = b5.slice(0, 5);
const b5Appendices = b5.slice(5).filter((r) => !/^TOTAL$/i.test(r[0]));

let c1 = [
  ['1. Authentication and Access Control', '', '', '', 'Supports SO2(a) authentication and role-based authorization.'],
  ['a. User Registration', 'Mostly Completed / For Testing', '75%', 'RegistrationPage.tsx', 'Registration with DPA consent and OTP step.'],
  ['b. User Authentication', 'Mostly Completed / For Testing', '75%', 'Login.tsx, auth.php', 'Email/school ID login; student MFA after password; admin and registrar skip login OTP.'],
  ['c. Password Management', 'Partially Completed', '50%', 'ChangePassword.tsx', 'Change-password only; no forgot-password flow.'],
  ['d. Role-Based Access Control (RBAC)', 'Mostly Completed / For Testing', '75%', 'ProtectedRoute.tsx, user_role.php', 'Student, Registrar, Administrator on routes and APIs.'],
  ['e. Multi-Factor Authentication (OTP)', 'Mostly Completed / For Testing', '75%', 'RegistrationPage.tsx, Login.tsx', 'Registration OTP + student login MFA; admin/registrar password-only login.'],
  ['f. Account Lockout Mechanism', 'Mostly Completed / For Testing', '75%', 'login_attempts, auth.php', 'Paper: >5 failures in 5 min. Default window now 5 min; logs anomaly_excessive_login_failures.'],
  ['g. Session Management', 'Mostly Completed / For Testing', '75%', 'session_token.php', 'Bearer tokens, idle/absolute expiry, logout revoke; sessions table bootstrap fixed for MySQL.'],
  ['2. Core System Modules (SO1)', '', '', '', 'Per Chapter 1 specific objective 1.'],
  ['a. User Account Management Module', 'Mostly Completed / For Testing', '75%', 'admin_users.php', 'Secure access for administrators and registrar personnel.'],
  ['b. Online Enrollment Application Module', 'Mostly Completed / For Testing', '75%', 'StudentEnrollment.tsx, student_enrollment.php', '6-step enrollment; school year gate; Grade 12 re-enrollment and draft/submit workflow.'],
  ['c. Document Submission and Management Module', 'Mostly Completed / For Testing', '75%', 'documents.php, ReviewDocuments.tsx', 'Required docs + registrar review/approve/reject workflow.'],
  ['d. AI Document Verification Feature', 'Mostly Completed / For Testing', '75%', 'ai/app.py, ai_verify_document.php', 'Multi-layer tamper/forgery analysis implemented.'],
  ['e. Reports and Monitoring Module', 'Mostly Completed / For Testing', '75%', 'registrar_reports.php, ActivityLogs.tsx', 'Applicant lists, summaries, verification results, exports.'],
  ['3. Cybersecurity Measures (SO2)', '', '', '', 'Per Chapter 1 specific objective 2.'],
  ['a. Authentication and role-based authorization', 'Mostly Completed / For Testing', '75%', 'RBAC + session tokens', 'Restricts access by role.'],
  ['b. Encryption — secure password hashing', 'Mostly Completed / For Testing', '75%', 'password_hash in auth.php', 'bcrypt via PHP password_hash().'],
  ['c. Encryption — HTTPS/TLS', 'Partially Completed', '50%', 'SSL proof pending', 'Local XAMPP HTTP only; no production TLS.'],
  ['d. AI-assisted document verification (security)', 'Mostly Completed / For Testing', '75%', 'ai_verify_document.php', 'Detects editing, manipulation, inconsistencies.'],
  ['TOTAL', '', '', '', ''],
];

let c2 = [
  ['Unauthorized Access Test', 'Partially Completed', '50%', 'Authentication logs / test result', 'Target: ≥99% rejection rate. Auth + OTP + RBAC in code; formal test run pending.'],
  ['Input Validation Test', 'Partially Completed', '50%', 'Validation logs / test result', 'Target: ≥99% prevention rate. Client/server validation in code; formal test pending.'],
  ['Brute Force Attack Test', 'Partially Completed', '50%', 'Lockout screenshots / logs', 'Target: ≥98% lockout effectiveness. login_attempts throttle implemented; formal test pending.'],
  ['Session Management Test', 'Partially Completed', '50%', 'Token invalidation test', 'Target: ≥99% invalidation rate. Logout revoke + expiry implemented; formal test pending.'],
  ['Access Control (RBAC) Test', 'Partially Completed', '50%', 'Role bypass test result', 'Target: ≥99% enforcement rate. RBAC enforced; formal Student/Registrar/Admin tests pending.'],
  ['AI Document Verification Test (SO3)', 'Partially Completed', '50%', 'Controlled sample test results', 'Target: ≥90% detection accuracy. AI pipeline works; controlled evaluation not documented.'],
  ['TOTAL', '', '', '', ''],
];

const c3 = [
  ['Password Hashing (SO2b)', 'Information Disclosure', 'Passwords must not be stored in plaintext.', 'Verify database value is hashed.', 'auth.php / DB screenshot', 'Mostly Completed / For Testing', ''],
  ['MFA / OTP', 'Unauthorized Access', 'Identity verified before system access.', 'Complete student registration/login OTP; staff login without OTP.', 'OTP screenshot', 'Mostly Completed / For Testing', 'Students only at login; admin/registrar exempt'],
  ['RBAC', 'Unauthorized Access Attempt', 'Users may only access modules for their role.', 'Access registrar/admin as student.', 'Test screenshot', 'Mostly Completed / For Testing', 'Formal test pending'],
  ['Input Validation', 'Invalid Input Submission', 'System must reject invalid and malicious input.', 'Submit invalid enrollment/upload data.', 'Validation log', 'Mostly Completed / For Testing', ''],
  ['Audit Trail', 'Repudiation', 'Critical actions must be logged.', 'Login, upload, approve/reject actions.', 'activity_logs screenshot', 'Mostly Completed / For Testing', ''],
  ['HTTPS / TLS (SO2b)', 'Information Disclosure', 'Data in transit must be protected.', 'Verify certificate on live domain.', 'SSL report', 'Needs Deployment Validation', 'Local HTTP only'],
  ['DPA / User Consent', 'Compliance Risk', 'Consent required before personal data processing.', 'Attempt registration without consent.', 'Registration screenshot', 'Mostly Completed / For Testing', ''],
  ['Account Lockout (Brute Force)', 'Brute Force Attack', 'Repeated failed logins trigger lockout.', 'Attempt consecutive failed logins.', 'Lockout log', 'Mostly Completed / For Testing', '5 failures / 5 min window'],
  ['Session Timeout / Invalidation', 'Session Management', 'Sessions expire and invalidate on logout.', 'Idle timeout and post-logout access test.', 'Session test', 'Mostly Completed / For Testing', ''],
  ['Secure File Upload Validation', 'Document Tampering', 'Restrict upload type and size.', 'Upload disallowed file types.', 'Upload validation screenshot', 'Mostly Completed / For Testing', ''],
  ['AI Document Verification (SO2c / SO3)', 'Document Tampering', 'Detect edited or forged enrollment documents.', 'Run controlled document samples.', 'AI verification results', 'Mostly Completed / For Testing', 'Accuracy test pending'],
  ['Excessive Login Failures Anomaly', 'Excessive Login Failures', 'Flag >5 failed logins within 5 minutes.', 'Simulate failed login burst.', 'activity_logs anomaly row', 'Mostly Completed / For Testing', 'anomaly_excessive_login_failures logged'],
  ['Unauthorized Access Anomaly', 'Unauthorized Access Attempt', 'Detect access outside role permissions.', 'Attempt restricted module access.', '403 + logs', 'Partially Completed', 'RBAC blocks; no dedicated anomaly log'],
  ['Post-Approval Modification Anomaly', 'Post-Approval Record Modification', 'Detect changes after Approved status.', 'Modify approved enrollment record.', 'Test log', 'Partially Completed', 'Upload block exists; flag unverified'],
  ['Rapid Sequential Actions Anomaly', 'Rapid Sequential Actions', 'Flag >10 actions within 2 minutes.', 'Burst API mutations.', 'anomaly_rapid_actions log', 'Mostly Completed / For Testing', 'Default threshold 10 / 2 min window'],
  ['Unusual Access Timing Anomaly', 'Unusual Access Timing', 'Flag access outside configured hours.', 'Login outside APP_ACTIVE_HOURS.', 'anomaly_unusual_hours log', 'Partially Completed', 'Log-only; default always-on'],
];

let c4 = [
  ['1. Authentication and Credential Security', '', '', '', ''],
  ['Secure hashing algorithm used', 'Mostly Completed / For Testing', '75%', 'password_hash in auth.php', ''],
  ['Plaintext password storage avoided', 'Mostly Completed / For Testing', '75%', 'DB screenshot', ''],
  ['Generic login error messages used', 'Mostly Completed / For Testing', '75%', 'Login screenshot', ''],
  ['Session timeout configured', 'Mostly Completed / For Testing', '75%', 'session_token.php config', ''],
  ['Session destroyed after logout', 'Mostly Completed / For Testing', '75%', 'logout API test', ''],
  ['Password complexity policy enforced', 'Mostly Completed / For Testing', '75%', 'Registration validation', 'Min length enforced at registration.'],
  ['Multi-Factor Authentication (OTP) implemented', 'Mostly Completed / For Testing', '75%', 'RegistrationPage.tsx, Login.tsx', 'Registration + student login MFA; staff roles skip login OTP.'],
  ['Account lockout after failed login attempts', 'Mostly Completed / For Testing', '75%', 'login_attempts test', '5 failures / 5 min window per paper.'],
  ['Session regeneration after login/password change', 'Mostly Completed / For Testing', '75%', 'New token on login/change', 'New Bearer token issued; all sessions revoked on password change.'],
  ['2. Input Validation and Error Handling', '', '', '', ''],
  ['Client-side input validation implemented', 'Mostly Completed / For Testing', '75%', 'Screenshot', ''],
  ['Server-side input validation implemented', 'Mostly Completed / For Testing', '75%', 'auth.php, API validation', ''],
  ['Output encoding applied where needed', 'Partially Completed', '50%', 'React default escaping', 'Formal XSS review pending.'],
  ['Technical stack traces hidden in production', 'Initial Development', '25%', 'Error page screenshot', 'Production error handling not yet validated.'],
  ['Errors logged securely', 'Mostly Completed / For Testing', '75%', 'Log proof', ''],
  ['Parameterized queries / prepared statements used', 'Mostly Completed / For Testing', '75%', 'PDO prepared statements in api/', 'Prevent SQL injection.'],
  ['File upload validation implemented', 'Mostly Completed / For Testing', '75%', 'documents.php', 'Extension whitelist and size cap.'],
  ['Business logic validation enforced', 'Mostly Completed / For Testing', '75%', 'Enrollment workflow tests', ''],
  ['3. API Protection and Session Management', '', '', '', ''],
  ['API endpoints require authentication', 'Mostly Completed / For Testing', '75%', '401 without token test', ''],
  ['API endpoints validate authorization', 'Mostly Completed / For Testing', '75%', 'RBAC API test', ''],
  ['Sensitive API responses minimized', 'Partially Completed', '50%', 'public_privacy.php', 'Name stripping on public endpoints.'],
  ['Rate limiting applied to sensitive endpoints', 'Partially Completed', '50%', 'Login throttle config', 'Login lockout only; no global API rate limit.'],
  ['Session IDs are not exposed in URLs', 'Mostly Completed / For Testing', '75%', 'Bearer header auth', 'Tokens in Authorization header, not URL.'],
  ['4. Data Protection and Security Monitoring', '', '', '', ''],
  ['HTTPS/TLS encryption implemented', 'Partially Completed', '50%', 'SSL configuration', 'Pending production deployment.'],
  ['Activity / audit logging implemented', 'Mostly Completed / For Testing', '75%', 'activity_logs screenshots', ''],
  ['Security event logging implemented', 'Mostly Completed / For Testing', '75%', 'admin_security_logs.php, SecurityMonitoring.tsx', 'API + admin Security Monitoring page routed.'],
  ['AI document verification integrated', 'Mostly Completed / For Testing', '75%', 'ai_verify_document.php', ''],
  ['Database access controls implemented', 'Partially Completed', '50%', 'MySQL user config', 'Local dev credentials; production hardening pending.'],
  ['Protected credentials and secrets management', 'Partially Completed', '50%', 'env_loader.php, .env', 'Secrets in .env; not committed to git.'],
  ['TOTAL', '', '', '', ''],
];

let c5 = [
  ['System includes Data Privacy Agreement', 'Mostly Completed / For Testing', '75%', 'LegalDocumentPage.tsx, legalDocuments.ts', ''],
  ['User consent is required before registration or system use', 'Mostly Completed / For Testing', '75%', 'RegistrationPage.tsx consent checkbox', ''],
  ['Privacy notice states purpose of data collection', 'Mostly Completed / For Testing', '75%', 'DPA / privacy page content', ''],
  ['Data retention policy is stated', 'Mostly Completed / For Testing', '75%', 'DPA / privacy page', ''],
  ['User rights are stated: access, correction, deletion, withdrawal of consent', 'Mostly Completed / For Testing', '75%', 'DPA page', ''],
  ['Consent timestamp is stored', 'Mostly Completed / For Testing', '75%', 'user_registration_consents table', ''],
  ['Logs do not expose sensitive data', 'Mostly Completed / For Testing', '75%', 'Log screenshot review', ''],
  ['TOTAL', '', '', '', ''],
];

let c6 = [
  ['Domain name proposed and documented', 'Not Started', '0%', 'Domain proposal', ''],
  ['Domain connected to hosting server', 'Not Started', '0%', 'DNS / hosting proof', ''],
  ['SSL certificate installed', 'Not Started', '0%', 'SSL checker / browser proof', ''],
  ['Website uses HTTPS', 'Not Started', '0%', 'Live domain screenshot', ''],
  ['HTTP redirects to HTTPS', 'Not Started', '0%', 'Browser test', ''],
  ['Production environment configured', 'Not Started', '0%', 'Hosting proof', 'Currently XAMPP localhost only.'],
  ['Debug mode disabled', 'Not Started', '0%', 'Config proof', ''],
  ['Environment variables protected', 'Partially Completed', '50%', 'env.example, .gitignore', '.env not in repository.'],
  ['Default admin credentials changed', 'Partially Completed', '50%', 'Admin proof', 'Per-deployment practice required.'],
  ['Backup procedure configured and tested', 'Partially Completed', '50%', 'scripts/backup_db.ps1', 'Script exists; restore test pending.'],
  ['Security features validated in production', 'Not Started', '0%', 'Production test results', 'MFA, RBAC, audit logs need online validation.'],
  ['TOTAL', '', '', '', ''],
];

let d1 = [
  ['General Objective is consistent with the approved title, scope, and FRS', 'Mostly Completed / For Testing', '75%', 'Chapter 1 / signed FRS', 'To develop and evaluate IntelliDocs with AI-assisted document verification.'],
  ['General Objective is supported by completed system implementation', 'Mostly Completed / For Testing', '75%', 'System screenshots / localhost demo', 'SO1–SO2 modules demonstrable.'],
  ['General Objective has corresponding Chapter 4 results and evidence', 'Not Started', '0%', 'Chapter 4 results tables', 'Manuscript results section pending.'],
  ['General Objective is answered in Chapter 5 conclusion', 'Not Started', '0%', 'Conclusion section', ''],
  ['General Objective gaps, limitations, or future work are addressed in Chapter 6', 'Not Started', '0%', 'Recommendations section', ''],
  ['TOTAL', '', '', '', ''],
];

const d2 = [
  ['SO1', 'To design and develop a web-based student enrollment system that facilitates the digital submission, verification, and management of student enrollment records for the institution.', 'a) User Account Management Module; b) Online Enrollment Application Module; c) Document Submission and Management Module; d) AI Document Verification Feature; e) Reports and Monitoring Module', '☐ Present ☐ Needs Revision ☐ Not Present', '☐ Linked ☐ Needs Revision ☐ Not Linked', '☐ Provided ☐ Not Needed ☐ Needs Revision', 'In Progress', '75%', 'All five SO1 modules implemented; Ch.4 evidence pending'],
  ['SO2', 'To apply cybersecurity measures within the platform, including authentication and role-based authorization, encryption of sensitive data using secure hashing and HTTPS/TLS, and AI-assisted document verification.', 'a) Authentication and RBAC; b) Secure hashing + HTTPS/TLS; c) AI document verification for tampering/manipulation', '☐ Present ☐ Needs Revision ☐ Not Present', '☐ Linked ☐ Needs Revision ☐ Not Linked', '☐ Provided ☐ Not Needed ☐ Needs Revision', 'In Progress', '69%', 'Auth/hash/AI ~75%; HTTPS 50%; formal tests pending'],
  ['SO3', 'To evaluate the effectiveness of the AI-assisted document verification features through controlled testing and validation of uploaded enrollment documents to determine the system\'s capability in detecting anomalies or irregularities.', 'Controlled document samples; AI detection accuracy (≥90%); verification test logs', '☐ Present ☐ Needs Revision ☐ Not Present', '☐ Linked ☐ Needs Revision ☐ Not Linked', '☐ Provided ☐ Not Needed ☐ Needs Revision', 'In Progress', '50%', 'AI feature built; controlled evaluation not yet documented in Ch.4'],
  ['SO4', 'To evaluate the overall software quality of IntelliDocs using the ISO/IEC 25010 software quality model, focusing on functional suitability, usability, reliability, performance efficiency, and security.', 'ISO/IEC 25010 survey and results tables (5 characteristics per paper)', '☐ Present ☐ Needs Revision ☐ Not Present', '☐ Linked ☐ Needs Revision ☐ Not Linked', '☐ Provided ☐ Not Needed ☐ Needs Revision', 'Initial Development', '25%', 'Survey and evaluation tables not started'],
  ['TOTAL', '', '', '', '', '', '', '', ''],
];

// Auto-compute TOTAL rows (CodeBusters: Category Completion % = sum of item % / number of items)
b1 = applyTotal(b1);
b3 = applyTotal(b3);
b4 = applyTotal(b4);
b5 = applyTotal(b5);
c1 = applyTotal(c1);
c2 = applyTotal(c2);
c4 = applyTotal(c4);
c5 = applyTotal(c5);
c6 = applyTotal(c6);
d1 = applyTotal(d1);

const c1SecurityComponents = c1.filter((r) => {
  const t = r[0];
  return [
    'a. Authentication and role-based authorization',
    'b. Encryption — secure password hashing',
    'c. Encryption — HTTPS/TLS',
    'd. AI-assisted document verification (security)',
  ].includes(t);
});

const c1So1Modules = c1.filter((r) =>
  [
    'a. User Account Management Module',
    'b. Online Enrollment Application Module',
    'c. Document Submission and Management Module',
    'd. AI Document Verification Feature',
    'e. Reports and Monitoring Module',
  ].includes(r[0]),
);

const d2SoRows = d2.filter((r) => r[0].startsWith('SO'));
// Auto-sync objective % from C.1 module averages where applicable
d2[0][7] = pct(statsStd5(c1So1Modules).avg);
d2[1][7] = pct(statsStd5(c1SecurityComponents).avg);
const d2Avg = d2SoRows.length
  ? Math.round(d2SoRows.reduce((s, r) => s + parsePct(r[7]), 0) / d2SoRows.length)
  : 0;
d2[d2.length - 1][7] = pct(d2Avg);

// Re-sync B.1 SO1/SO2 summary rows from computed C.1 averages, then refresh B.1 TOTAL
const so1AvgComputed = statsStd5(c1So1Modules).avg;
const so2AvgComputed = statsStd5(c1SecurityComponents).avg;
const b1So1Idx = b1.findIndex((r) => r[0].startsWith('Implemented Web Modules Summary'));
const b1So2Idx = b1.findIndex((r) => r[0].startsWith('Security Components Implementation Summary'));
if (b1So1Idx >= 0) {
  b1[b1So1Idx][2] = pct(so1AvgComputed);
  b1[b1So1Idx][4] = 'User Account Management; Online Enrollment; Document Submission; AI Verification; Reports and Monitoring.';
}
if (b1So2Idx >= 0) {
  b1[b1So2Idx][2] = pct(so2AvgComputed);
  b1[b1So2Idx][4] = `Auth/RBAC/AI ~75%; HTTPS/TLS 50%. Computed SO2 avg ${pct(so2AvgComputed)}.`;
}
b1 = applyTotal(b1);

const eCategories = [
  eRow('Chapter 4 | Results and Discussion', b1, { remarks: 'B.1' }),
  eRow('Chapter 5 | Conclusion', b3, { remarks: 'B.3' }),
  eRow('Chapter 6 | Recommendations', b4, { remarks: 'B.4' }),
  eRow('Bibliography', b5Bibliography, { remarks: 'B.5 bibliography items' }),
  eRow('Appendices', b5Appendices, { remarks: 'B.5 appendix items' }),
  eRow('Web Development Scope', c1, { remarks: 'C.1' }),
  eRow('Security Components', c1SecurityComponents, { remarks: 'C.1 §3 SO2 security measures' }),
  eRow('Security Testing (Paper Test Plan)', c2, { remarks: 'C.2 — unauthorized access, input validation, brute force, session, RBAC, AI verification' }),
  eRow('Security Requirements Traceability Matrix', c3, { useC3: true, remarks: 'C.3' }),
  eRow('Secure Coding Compliance', c4, { remarks: 'C.4' }),
  eRow('Data Privacy Clause and Compliance', c5, { remarks: 'C.5' }),
  eRow('Deployment Requirements and Security Validation', c6, { remarks: 'C.6' }),
];

const overallAvg = Math.round(
  eCategories.reduce((sum, row) => sum + parsePct(row[3]), 0) / eCategories.length
);
const e = [
  ...eCategories,
  ['TOTAL OVERALL COMPLETION', '', '', pct(overallAvg), '100%', pct(overallAvg), 'Average of 12 category completion percentages'],
];

const d3 = [
  ['All approved objectives are listed and checked', 'Mostly Completed / For Testing', pct(75), 'Approved Chapter 1 objectives', 'SO1–SO4 listed in D.2 matrix.'],
  ['Each objective has measurable output or verifiable indicator', 'Mostly Completed / For Testing', pct(75), 'FRS / system demo', 'Modules map to each objective.'],
  ['Each objective is linked to an implemented module, feature, or research output', 'Mostly Completed / For Testing', pct(75), 'System demo / module screenshots', 'Enrollment, security, AI modules demonstrable.'],
  ['Each objective has Chapter 4 evidence', 'Not Started', pct(0), 'Results table / test case / survey result', 'Manuscript Chapter 4 pending.'],
  ['Each objective is addressed in Chapter 5 conclusion', 'Not Started', pct(0), 'Conclusion section', ''],
  ['Objectives with partial completion have clear Chapter 6 recommendations', 'Not Started', pct(0), 'Recommendations section', ''],
  ['All objective-related evidence is included in the appendices', 'Not Started', pct(0), 'Appendices / signed forms', ''],
  ['Overall objective completion supports defense readiness', 'Partially Completed', pct(50), 'Objective compliance matrix', 'System ahead of documentation.'],
  ['TOTAL', '', pct(Math.round((75 + 75 + 75 + 0 + 0 + 0 + 0 + 50) / 8)), '', ''],
];

const fullyAchieved = d2SoRows.filter((r) => parsePct(r[7]) >= 100).length;
const partiallyAchieved = d2SoRows.filter((r) => parsePct(r[7]) >= 25 && parsePct(r[7]) < 100).length;
const notAchieved = d2SoRows.filter((r) => parsePct(r[7]) < 25).length;
const totalObjectives = d2SoRows.length;
const objectivePct = totalObjectives ? Math.round((fullyAchieved / totalObjectives) * 100) : 0;

const d4 = [
  ['Total Number of Approved Objectives', String(totalObjectives), 'Count only Specific Objectives (SO1–SO4) unless adviser includes General Objective.'],
  ['Number of Fully Achieved Objectives', String(fullyAchieved), 'Objectives with complete implementation, evidence, conclusion, and appendix proof.'],
  ['Number of Partially Achieved Objectives', String(partiallyAchieved), 'Objectives with incomplete evidence, partial implementation, or pending validation.'],
  ['Number of Not Yet Achieved Objectives', String(notAchieved), 'Objectives with no proof or not implemented.'],
  ['Objective Completion Percentage', pct(objectivePct), 'Formula: Fully Achieved Objectives / Total Approved Objectives × 100.'],
  ['Defense Readiness Decision', overallAvg >= 75 ? 'Conditionally Ready' : 'Not Yet Ready', 'System modules strong; documentation and security testing evidence must be completed before final defense.'],
];

const d5Rubric = [
  ['Objectives Compliance', '2', 'SO1–SO4 partially supported by system; Ch.4–6 manuscript evidence weak.'],
  ['Chapter 4 Results and Evidence', '2', 'Manuscript results section not yet written; security metric tables pending.'],
  ['System Development and FRS Compliance', '3', 'Core SO1 modules, enrollment workflow, and school year management demonstrable.'],
  ['Security Testing and Vulnerability Assessment', '2', 'Six paper security tests implemented in code; formal measured results not documented.'],
  ['Secure Coding and Privacy Compliance', '3', 'Session tokens, student MFA, DPA, audit/security monitoring, paper-aligned lockout; HTTPS pending.'],
  ['Deployment Readiness', '1', 'No production deployment or SSL.'],
  ['Documentation and Appendices', '2', 'Bibliography, appendices, signed validation pending.'],
  ['Total Rubric Score (sum of scores)', '15', 'Maximum = 28 (7 criteria × 4).'],
  ['Total Rubric Result', `${Math.round((15 / 28) * 100)}%`, 'Not Yet Defense Ready — complete Ch.4–6 documentation, security test evidence, and deployment.'],
];

const d5ScoringGuide = [
  ['Total Rubric Result', 'Readiness Decision', 'Recommended Action'],
  ['90–100%', 'Defense Ready', 'May proceed to defense after final formatting, adviser approval, and submission requirements.'],
  ['75–89%', 'Conditionally Defense Ready', 'May proceed only after addressing listed minor revisions and completing missing evidence.'],
  ['50–74%', 'Not Yet Defense Ready', 'Requires major revision in documentation, system validation, security testing, or objective alignment.'],
  ['Below 50%', 'Not Ready', 'Requires substantial redevelopment, retesting, or rewriting before another readiness review.'],
];

let html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>ALT F4 BSIT Cybersecurity Research Progress Checklist</title>
<style>
body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; margin: 24px; line-height: 1.35; }
h1 { font-size: 16pt; text-align: center; }
h2 { font-size: 13pt; margin-top: 20px; }
h3 { font-size: 11pt; margin-top: 14px; font-style: italic; }
.note { background: #fff3cd; border: 1px solid #ffc107; padding: 10px; margin-bottom: 16px; }
p { margin: 8px 0; }
table { width: 100%; margin-bottom: 12px; }
th { background: #d9d9d9; text-align: left; }
</style>
</head>
<body>
<div class="note"><b>How to copy into Word:</b> Click anywhere on this page → Ctrl+A → Ctrl+C → open Word → Ctrl+V. Tables and formatting will transfer.<br>
<b>Reference:</b> Modules, security tests, and anomaly rules aligned with Chapter 1 (SECURITY PARTS AND MODULES TO REMEMBER). Elevation of Privilege not used per paper scope.<br>
<b>Status basis (June 7, 2026):</b> Percentages verified against IntelliDocs codebase — 75% = implemented, needs formal test/manuscript evidence; 0% for Ch.4–6 results not yet written. Recent: student login MFA, staff OTP exempt, paper lockout (5 min), rapid-action threshold 10, Security Monitoring UI, sessions table fix, school year enrollment gate.</div>

<h1>BSIT CYBERSECURITY RESEARCH PROGRESS CHECKLIST</h1>
<p style="text-align:center;">Chapter 4 to Chapter 6, Development Scope, Security Validation, and Deployment Readiness Template</p>

<h2>A. Project Information</h2>
<table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;">
<tr><td><b>Group Name</b></td><td>ALT F4</td></tr>
<tr><td><b>Project Title</b></td><td>IntelliDocs: A Web-Based Student Enrollment System with AI-Assisted Multi-Layer Document Verification for Nuestra Señora De Guia Academy of Marikina – Main</td></tr>
<tr><td><b>Group Members</b></td><td>1. Reyes, Kyle Jennifer M.<br>2. Jose, Lea Joy L.<br>3. Taruc, Isaiah Casey M.<br>4. Torres, Kenneth Raichen B.</td></tr>
<tr><td><b>Client / Beneficiary Name</b></td><td>NUESTRA SEÑORA DE GUIA ACADEMY OF MARIKINA-MAIN</td></tr>
<tr><td><b>Company / Institution</b></td><td>Nuestra Señora De Guia Academy of Marikina – Main</td></tr>
<tr><td><b>Adviser</b></td><td>Dr. Jay-Ar P. Lalata</td></tr>
<tr><td><b>Course / Section</b></td><td>BSITCST - TC32</td></tr>
<tr><td><b>Evaluation Period</b></td><td>Pre-Final Defense Readiness</td></tr>
<tr><td><b>Date Checked</b></td><td>June 7, 2026</td></tr>
<tr><td><b>Evaluation Model Used</b></td><td>☑ ISO/IEC 25010 &nbsp; ☐ FURPS &nbsp; ☐ Hybrid &nbsp; ☐ Other: __________________</td></tr>
</table>

<h3>Important Instruction for Chapter 4 Results Presentation</h3>
<p>The presentation of results in Chapter 4 must remain flexible. Each team may use different evaluation standards such as ISO/IEC 25010, FURPS, hybrid quality models, KPIs, or project-specific rubrics. Therefore, the checklist should verify that the results are complete, evidence-based, and aligned with the team's approved methodology rather than forcing one uniform table format for all projects.</p>

<h3>Template Use and Progress Scale</h3>
<table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;">
<tr><th>Percentage</th><th>Interpretation</th><th>Description</th></tr>
<tr><td>0%</td><td>Not Started</td><td>No output or evidence yet.</td></tr>
<tr><td>25%</td><td>Initial Development</td><td>Initial draft, prototype, or partial output exists.</td></tr>
<tr><td>50%</td><td>Partially Completed</td><td>Major components are drafted or implemented but incomplete.</td></tr>
<tr><td>75%</td><td>Mostly Completed / For Testing</td><td>Output is substantially complete but needs validation, revision, or evidence.</td></tr>
<tr><td>100%</td><td>Completed and Validated</td><td>Output is complete, checked, and supported by evidence.</td></tr>
</table><br/>

<h2>B. Document Progress Checklist: Chapter 4 to Chapter 6 Only</h2>
<h3>B.1 Chapter 4 | Results and Discussion Checklist</h3>
${table(std5, b1)}

<h3>B.3 Chapter 5 | Conclusion Checklist</h3>
${table(std5, b3)}

<h3>B.4 Chapter 6 | Recommendations Checklist</h3>
${table(std5, b4)}

<h3>B.5 Bibliography and Appendices Checklist</h3>
${table(std5, b5)}

<h2>C. Cybersecurity Development Scope Checklist</h2>
<p><b>FRS-Based Checking Note:</b> All web modules, security components, user roles, workflows, and database features to be checked in this section must be based on the signed and approved Functional Requirements Specification (FRS). Required proof may include: signed FRS, approved module list, role-access matrix, ERD/database schema, adviser/client validation notes, GitHub commits, screenshots, and test evidence.</p>

<h3>C.1 Development Scope and Security Components</h3>
<p><i>Rows customized for IntelliDocs per Chapter 1 SO1 and SO2 (authentication, modules, cybersecurity measures).</i></p>
${table(std5, c1)}

<h3>C.2 Security Testing (Paper Test Plan)</h3>
<p><i>Aligned with approved methodology — not STRIDE. Elevation of Privilege excluded per paper. Targets: Unauthorized Access ≥99%, Input Validation ≥99%, Brute Force ≥98%, Session Management ≥99%, RBAC ≥99%, AI Verification ≥90%.</i></p>
${table(std5, c2)}

<h3>C.3 Security Requirements Traceability Matrix</h3>
${table(c3h, c3)}

<h3>C.4 Secure Coding Compliance Checklist</h3>
${table(std5, c4)}

<h3>C.5 Data Privacy Clause and Compliance Checklist</h3>
${table(std5, c5)}

<h3>C.6 Deployment Requirements and Deployment Security Validation Checklist</h3>
${table(std5, c6)}

<h2>D. Research Objectives Completion and Defense Readiness Compliance</h2>
<h3>D.1 General Objective Compliance Checklist</h3>
${table(std5, d1)}

<h3>D.2 Specific Objectives Compliance Matrix</h3>
${table(d2h, d2)}

<h3>D.3 Objective-Based Defense Readiness Checklist</h3>
${table(std5, d3)}

<h3>D.4 Objective Completion and Defense Readiness Decision Summary</h3>
${table(['Item', 'Value / Result', 'Remarks'], d4)}

<h3>D.5 Defense Readiness Rubric</h3>
${table(['Criterion', 'Score (1–4)', 'Remarks'], d5Rubric.slice(1, -2))}
${table(['Item', 'Score / Result', 'Remarks'], d5Rubric.slice(-2))}
<p><b>Defense Readiness Rubric Scoring Guide</b></p>
${table(['Total Rubric Result', 'Readiness Decision', 'Recommended Action'], d5ScoringGuide.slice(1))}

<h2>E. Category Completion and Overall Progress Summary</h2>
<p>Place this table before the signatories. Compute each category completion based on the average percentage of completed checklist items or the approved adviser weighting. The overall completion percentage should identify the readiness level of the research and system deliverables.</p>
${table(['Category', 'Total Items', 'Completed Items', 'Average Category Completion %', 'Weight % (Optional)', 'Weighted Score', 'Remarks'], e)}

<p><b>Computation Guide</b></p>
<ul>
<li>Category Completion % = Sum of item percentages under the category / Number of checklist items in the category.</li>
<li>Overall Completion % = Average of category completion percentages, or weighted total if the adviser assigns category weights.</li>
<li>Suggested readiness interpretation: 0–24% Not Started, 25–49% Initial Development, 50–74% Partially Completed, 75–99% Mostly Completed / Needs Final Validation, 100% Completed and Validated.</li>
<li>For Chapter 4, use the approved evaluation model of each team. Do not penalize a team for using FURPS instead of ISO/IEC 25010 if FURPS was approved in its methodology.</li>
<li><b>Completed Items</b> = checklist rows at 100% (Completed and Validated). Rows at 75% count toward category average but not as fully completed until formal evidence is attached.</li>
</ul>

<h2>F. Signatories</h2>
${table(['Role', 'Name and Signature', 'Date'], [
  ['Project Adviser', 'Dr. Jay-Ar P. Lalata', ''],
  ['Project Manager', 'Kyle Jennifer M. Reyes', ''],
  ['Course Adviser', 'Abricam S. Tinga', ''],
  ['Security Tester / Validator (optional)', '', ''],
  ['Client / Beneficiary Representative (optional)', '', ''],
])}

</body></html>`;

fs.writeFileSync(OUT, html, 'utf8');
console.log('Written:', OUT);
