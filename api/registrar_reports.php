<?php
declare(strict_types=1);

/**
 * Registrar Reports & Monitoring.
 *
 * GET /api/registrar/reports?report=<type>&school_year=current|all|YYYY-YYYY&format=json|csv|print
 *
 * report types:
 *   monitoring_summary, applicants, enrollment_summary, document_verification,
 *   approval_records, rejection_records, anomaly_summary, section_masterlist, quota_summary, document_completion
 */

if (!isset($pdo) || !($pdo instanceof PDO)) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'Database connection unavailable']);
    exit;
}

require_once __DIR__ . '/logging.php';
require_once __DIR__ . '/user_role.php';
require_once __DIR__ . '/enrollment_status_helpers.php';
require_once __DIR__ . '/school_year_helpers.php';
require_once __DIR__ . '/section_grade_helpers.php';

ini_set('display_errors', '0');
header('Content-Type: application/json');

if (!function_exists('tableExists')) {
    function tableExists(PDO $pdo, string $table): bool
    {
        $stmt = $pdo->prepare('SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :t LIMIT 1');
        $stmt->execute([':t' => $table]);
        return (bool)$stmt->fetchColumn();
    }
}
if (!function_exists('columnExists')) {
    function columnExists(PDO $pdo, string $table, string $column): bool
    {
        $stmt = $pdo->prepare('SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = :t AND column_name = :c LIMIT 1');
        $stmt->execute([':t' => $table, ':c' => $column]);
        return (bool)$stmt->fetchColumn();
    }
}

require_once __DIR__ . '/api_auth.php';
require_once __DIR__ . '/permission_guard.php';
$actor = apiRequireActor($pdo, 'registrar/reports');
$actorId = $actor['id'];
$actorRole = $actor['role'];

if (!in_array($actorRole, ['registrar', 'admin'], true)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Access denied']);
    exit;
}

requireActorPermission($pdo, $actor, 'generateReports');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

const REPORT_OVERALL_QUOTA = 4000;

/** @return array{filter: string, label: string} */
function reportResolveSchoolYear(PDO $pdo, string $raw): array
{
    $raw = trim($raw);
    if (strtolower($raw) === 'all') {
        return ['filter' => '', 'label' => 'All school years'];
    }
    if ($raw === '' || strtolower($raw) === 'current') {
        $ctx = rosterEnrollmentContext($pdo);

        return [
            'filter' => (string)$ctx['school_year'],
            'label' => $ctx['school_year'] !== '' ? 'SY ' . $ctx['school_year'] : 'All school years',
        ];
    }
    if (preg_match('/^\d{4}-\d{4}$/', $raw) === 1) {
        return ['filter' => $raw, 'label' => 'SY ' . $raw];
    }

    return ['filter' => '', 'label' => 'All school years'];
}

/** @return list<string> */
function reportSchoolYearOptions(PDO $pdo): array
{
    $years = [];
    if (tableExists($pdo, 'school_years')) {
        foreach ($pdo->query('SELECT year FROM school_years ORDER BY year DESC')->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
            $y = trim((string)($row['year'] ?? ''));
            if ($y !== '') {
                $years[$y] = true;
            }
        }
    }
    if (tableExists($pdo, 'enrollments')) {
        foreach ($pdo->query(
            "SELECT DISTINCT TRIM(school_year) AS sy FROM enrollments
              WHERE TRIM(COALESCE(school_year, '')) <> ''
              ORDER BY sy DESC"
        )->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
            $y = trim((string)($row['sy'] ?? ''));
            if ($y !== '') {
                $years[$y] = true;
            }
        }
    }
    $list = array_keys($years);
    rsort($list, SORT_STRING);

    return $list;
}

function reportStudentDisplayName(array $row): string
{
    $form = enrollmentStepsFormData((string)($row['enrollment_steps'] ?? ''));
    $userRow = [
        'first_name' => (string)($row['first_name'] ?? ''),
        'middle_name' => (string)($row['middle_name'] ?? ''),
        'last_name' => (string)($row['last_name'] ?? ''),
        'extension_name' => (string)($row['extension_name'] ?? ''),
        'full_name' => (string)($row['full_name'] ?? ''),
    ];
    $name = studentEnrollmentFormDisplayName($form, $userRow);

    return $name !== '' ? $name : 'Unknown';
}

function reportStatusLabel(string $status): string
{
    $n = strtolower(trim($status));
    return match (true) {
        $n === 'enrolled' => 'Enrolled',
        $n === 'approved' => 'Approved',
        $n === 'rejected' => 'Rejected',
        $n === 'cancelled' => 'Cancelled',
        in_array($n, ['under_review', 'under review', 'review'], true) => 'Under Review',
        $n === 'draft' => 'Draft',
        default => 'Pending',
    };
}

/** @return array{sql: string, params: array<string, string>} */
function reportSchoolYearClause(string $alias, string $syFilter): array
{
    if ($syFilter === '') {
        return ['sql' => '', 'params' => []];
    }

    return [
        'sql' => " AND TRIM(COALESCE({$alias}.school_year, '')) = :report_sy",
        'params' => [':report_sy' => $syFilter],
    ];
}

/**
 * @param list<string> $columns
 * @param list<array<string, scalar|null>> $rows
 */
function reportEmitCsv(string $filename, array $columns, array $rows): void
{
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    $out = fopen('php://output', 'w');
    if ($out === false) {
        throw new RuntimeException('Unable to open output stream');
    }
    fputcsv($out, $columns);
    foreach ($rows as $row) {
        $line = [];
        foreach ($columns as $col) {
            $line[] = (string)($row[$col] ?? '');
        }
        fputcsv($out, $line);
    }
    fclose($out);
    exit;
}

/**
 * @param list<string> $columns
 * @param list<array<string, scalar|null>> $rows
 */
function reportEmitPrintHtml(string $title, string $subtitle, array $columns, array $rows): void
{
    header('Content-Type: text/html; charset=utf-8');
    $esc = static fn ($v) => htmlspecialchars((string)$v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    echo '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' . $esc($title) . '</title>';
    echo '<style>
      body{font-family:Segoe UI,Arial,sans-serif;margin:24px;color:#111}
      h1{font-size:20px;margin:0 0 4px}
      p.meta{font-size:12px;color:#555;margin:0 0 16px}
      table{width:100%;border-collapse:collapse;font-size:11px}
      th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;vertical-align:top}
      th{background:#f3f4f6}
      @media print{body{margin:12px} button{display:none}}
    </style></head><body>';
    echo '<h1>' . $esc($title) . '</h1>';
    echo '<p class="meta">' . $esc($subtitle) . ' · Generated ' . $esc(date('Y-m-d H:i')) . '</p>';
    echo '<button onclick="window.print()">Print</button>';
    echo '<table><thead><tr>';
    foreach ($columns as $col) {
        echo '<th>' . $esc($col) . '</th>';
    }
    echo '</tr></thead><tbody>';
    foreach ($rows as $row) {
        echo '<tr>';
        foreach ($columns as $col) {
            echo '<td>' . $esc((string)($row[$col] ?? '')) . '</td>';
        }
        echo '</tr>';
    }
    echo '</tbody></table></body></html>';
    exit;
}

/**
 * @return array{title: string, columns: list<string>, rows: list<array<string, scalar|null>>, summary?: array<string, scalar|null>}
 */
function reportMonitoringSummary(PDO $pdo, string $syFilter, string $syLabel): array
{
    $sy = reportSchoolYearClause('e', $syFilter);
    $enrolled = 0;
    $pending = 0;
    $underReview = 0;
    $approved = 0;
    $rejected = 0;
    $strands = [];

    if (tableExists($pdo, 'enrollments')) {
        $sql = "
            SELECT
                SUM(CASE WHEN LOWER(TRIM(e.status)) IN ('approved', 'enrolled') THEN 1 ELSE 0 END) AS enrolled,
                SUM(CASE WHEN LOWER(TRIM(e.status)) = 'pending' THEN 1 ELSE 0 END) AS pending,
                SUM(CASE WHEN LOWER(TRIM(e.status)) IN ('under_review', 'under review', 'review') THEN 1 ELSE 0 END) AS under_review,
                SUM(CASE WHEN LOWER(TRIM(e.status)) IN ('approved', 'enrolled') THEN 1 ELSE 0 END) AS approved,
                SUM(CASE WHEN LOWER(TRIM(e.status)) = 'rejected' THEN 1 ELSE 0 END) AS rejected
            FROM enrollments e
            WHERE 1=1 {$sy['sql']}
        ";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($sy['params']);
        $s = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];
        $enrolled = (int)($s['enrolled'] ?? 0);
        $pending = (int)($s['pending'] ?? 0);
        $underReview = (int)($s['under_review'] ?? 0);
        $approved = (int)($s['approved'] ?? 0);
        $rejected = (int)($s['rejected'] ?? 0);

        $strandSql = "
            SELECT COALESCE(NULLIF(TRIM(e.strand), ''), 'Unassigned') AS strand_name,
                   SUM(CASE WHEN LOWER(TRIM(e.status)) IN ('pending', 'under_review', 'under review', 'review', 'draft') THEN 1 ELSE 0 END) AS applications,
                   SUM(CASE WHEN LOWER(TRIM(e.status)) IN ('approved', 'enrolled') THEN 1 ELSE 0 END) AS enrolled
              FROM enrollments e
             WHERE 1=1 {$sy['sql']}
             GROUP BY strand_name
             ORDER BY enrolled DESC, strand_name ASC
        ";
        $st2 = $pdo->prepare($strandSql);
        $st2->execute($sy['params']);
        foreach ($st2->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
            $strands[] = [
                'name' => (string)$row['strand_name'],
                'applications' => (int)$row['applications'],
                'enrolled' => (int)$row['enrolled'],
            ];
        }
    }

    $totalSections = 0;
    if (tableExists($pdo, 'sections')) {
        $totalSections = (int)$pdo->query('SELECT COUNT(*) FROM sections')->fetchColumn();
    }

    $totalDocuments = 0;
    $verifiedDocuments = 0;
    if (tableExists($pdo, 'documents') && tableExists($pdo, 'enrollments') && columnExists($pdo, 'documents', 'enrollment_id')) {
        $reviewedCase = columnExists($pdo, 'documents', 'registrar_reviewed')
            ? ' OR COALESCE(d.registrar_reviewed, 0) = 1' : '';
        $aiCase = columnExists($pdo, 'documents', 'ai_status')
            ? "LOWER(TRIM(COALESCE(d.ai_status, ''))) IN ('verified', 'approved', 'pass')
                             OR LOWER(TRIM(COALESCE(d.ai_status, ''))) LIKE '%verify%'"
            : '0';
        $docSql = "
            SELECT COUNT(*) AS total_docs,
                   SUM(CASE WHEN ({$aiCase}){$reviewedCase}
                        THEN 1 ELSE 0 END) AS verified_docs
              FROM documents d
              INNER JOIN enrollments e ON e.id = d.enrollment_id
             WHERE 1=1 {$sy['sql']}
        ";
        $dst = $pdo->prepare($docSql);
        $dst->execute($sy['params']);
        $doc = $dst->fetch(PDO::FETCH_ASSOC) ?: [];
        $totalDocuments = (int)($doc['total_docs'] ?? 0);
        $verifiedDocuments = (int)($doc['verified_docs'] ?? 0);
    }

    $remaining = max(0, REPORT_OVERALL_QUOTA - $enrolled);
    $quotaPct = REPORT_OVERALL_QUOTA > 0 ? round(($enrolled / REPORT_OVERALL_QUOTA) * 100, 1) : 0.0;
    $docPct = $totalDocuments > 0 ? round(($verifiedDocuments / $totalDocuments) * 100, 1) : 0.0;

    return [
        'title' => 'Monitoring Summary',
        'columns' => ['Metric', 'Value'],
        'rows' => [
            ['Metric' => 'School year scope', 'Value' => $syLabel],
            ['Metric' => 'Total enrolled', 'Value' => (string)$enrolled],
            ['Metric' => 'Pending applications', 'Value' => (string)$pending],
            ['Metric' => 'Under review', 'Value' => (string)$underReview],
            ['Metric' => 'Rejected', 'Value' => (string)$rejected],
            ['Metric' => 'Total sections', 'Value' => (string)$totalSections],
            ['Metric' => 'Quota utilization', 'Value' => $quotaPct . '%'],
            ['Metric' => 'Document verification rate', 'Value' => $docPct . '%'],
        ],
        'summary' => [
            'schoolYearLabel' => $syLabel,
            'totalEnrolled' => $enrolled,
            'totalSections' => $totalSections,
            'quotaUtilization' => $quotaPct,
            'documentCompletionRate' => $docPct,
            'overallQuota' => REPORT_OVERALL_QUOTA,
            'remainingSlots' => $remaining,
            'verifiedDocuments' => $verifiedDocuments,
            'totalDocuments' => $totalDocuments,
            'pending' => $pending,
            'underReview' => $underReview,
            'approved' => $approved,
            'rejected' => $rejected,
            'strands' => $strands,
        ],
    ];
}

/**
 * @return array{title: string, columns: list<string>, rows: list<array<string, scalar|null>>}
 */
function reportApplicants(PDO $pdo, string $syFilter, string $syLabel): array
{
    $columns = ['Application ID', 'Student Name', 'Email', 'Strand', 'Grade Level', 'Status', 'School Year', 'Submitted'];
    $rows = [];
    if (!tableExists($pdo, 'enrollments') || !tableExists($pdo, 'users')) {
        return ['title' => 'Applicant List', 'columns' => $columns, 'rows' => $rows];
    }

    $sy = reportSchoolYearClause('e', $syFilter);
    $selFirst = columnExists($pdo, 'users', 'first_name') ? 'u.first_name' : "'' AS first_name";
    $selLast = columnExists($pdo, 'users', 'last_name') ? 'u.last_name' : "'' AS last_name";
    $selMiddle = columnExists($pdo, 'users', 'middle_name') ? 'u.middle_name' : "'' AS middle_name";
    $selExt = columnExists($pdo, 'users', 'extension_name') ? 'u.extension_name' : "'' AS extension_name";

    $sql = "
        SELECT e.id, e.status, e.strand, e.grade_level, e.school_year, e.applied_at, e.enrollment_steps,
               u.email, u.full_name, {$selFirst}, {$selMiddle}, {$selLast}, {$selExt}
          FROM enrollments e
         INNER JOIN users u ON u.id = e.user_id
         WHERE LOWER(TRIM(COALESCE(e.status, ''))) IN ('pending', 'under_review', 'under review', 'review', 'draft', 'rejected')
         {$sy['sql']}
         ORDER BY e.applied_at DESC, e.id DESC
    ";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($sy['params']);
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
        $id = (int)$row['id'];
        $rows[] = [
            'Application ID' => 'APP-' . date('Y') . '-' . str_pad((string)$id, 3, '0', STR_PAD_LEFT),
            'Student Name' => reportStudentDisplayName($row),
            'Email' => (string)($row['email'] ?? ''),
            'Strand' => (string)($row['strand'] ?? ''),
            'Grade Level' => (string)($row['grade_level'] ?? ''),
            'Status' => reportStatusLabel((string)($row['status'] ?? '')),
            'School Year' => (string)($row['school_year'] ?? ''),
            'Submitted' => (string)($row['applied_at'] ?? ''),
        ];
    }

    return ['title' => 'Applicant List — ' . $syLabel, 'columns' => $columns, 'rows' => $rows];
}

/**
 * @return array{title: string, columns: list<string>, rows: list<array<string, scalar|null>>}
 */
function reportEnrollmentSummary(PDO $pdo, string $syFilter, string $syLabel): array
{
    $columns = ['Strand', 'Grade Level', 'Pending', 'Under Review', 'Approved/Enrolled', 'Rejected', 'Total'];
    $rows = [];
    if (!tableExists($pdo, 'enrollments')) {
        return ['title' => 'Enrollment Summary — ' . $syLabel, 'columns' => $columns, 'rows' => $rows];
    }

    $sy = reportSchoolYearClause('e', $syFilter);
    $gradeKey = sqlEnrollmentGradeKey('e.grade_level');
    $sql = "
        SELECT COALESCE(NULLIF(TRIM(e.strand), ''), 'Unassigned') AS strand_name,
               {$gradeKey} AS grade_key,
               SUM(CASE WHEN LOWER(TRIM(e.status)) = 'pending' THEN 1 ELSE 0 END) AS pending,
               SUM(CASE WHEN LOWER(TRIM(e.status)) IN ('under_review', 'under review', 'review') THEN 1 ELSE 0 END) AS under_review,
               SUM(CASE WHEN LOWER(TRIM(e.status)) IN ('approved', 'enrolled') THEN 1 ELSE 0 END) AS enrolled,
               SUM(CASE WHEN LOWER(TRIM(e.status)) = 'rejected' THEN 1 ELSE 0 END) AS rejected,
               COUNT(*) AS total
          FROM enrollments e
         WHERE 1=1 {$sy['sql']}
         GROUP BY strand_name, grade_key
         ORDER BY strand_name ASC, grade_key ASC
    ";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($sy['params']);
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
        $rows[] = [
            'Strand' => (string)$row['strand_name'],
            'Grade Level' => 'Grade ' . (string)($row['grade_key'] ?? '11'),
            'Pending' => (string)(int)$row['pending'],
            'Under Review' => (string)(int)$row['under_review'],
            'Approved/Enrolled' => (string)(int)$row['enrolled'],
            'Rejected' => (string)(int)$row['rejected'],
            'Total' => (string)(int)$row['total'],
        ];
    }

    return ['title' => 'Enrollment Summary — ' . $syLabel, 'columns' => $columns, 'rows' => $rows];
}

/**
 * @return array{title: string, columns: list<string>, rows: list<array<string, scalar|null>>}
 */
function reportDocumentVerification(PDO $pdo, string $syFilter, string $syLabel): array
{
    $columns = ['Student Name', 'Strand', 'Document Type', 'Verification Score', 'AI Status', 'Registrar Status', 'Anomalies', 'School Year'];
    $rows = [];
    if (!tableExists($pdo, 'documents') || !tableExists($pdo, 'enrollments') || !columnExists($pdo, 'documents', 'enrollment_id')) {
        return ['title' => 'Document Verification Results — ' . $syLabel, 'columns' => $columns, 'rows' => $rows];
    }

    $sy = reportSchoolYearClause('e', $syFilter);
    $selFirst = columnExists($pdo, 'users', 'first_name') ? 'u.first_name' : "'' AS first_name";
    $selLast = columnExists($pdo, 'users', 'last_name') ? 'u.last_name' : "'' AS last_name";
    $selMiddle = columnExists($pdo, 'users', 'middle_name') ? 'u.middle_name' : "'' AS middle_name";
    $selExt = columnExists($pdo, 'users', 'extension_name') ? 'u.extension_name' : "'' AS extension_name";
    $selReviewed = columnExists($pdo, 'documents', 'registrar_reviewed') ? 'd.registrar_reviewed' : '0 AS registrar_reviewed';
    $selDecision = columnExists($pdo, 'documents', 'registrar_doc_decision') ? 'd.registrar_doc_decision' : "'' AS registrar_doc_decision";
    $selType = columnExists($pdo, 'documents', 'type') ? 'd.type' : "'' AS type";
    $selAi = columnExists($pdo, 'documents', 'ai_status') ? 'd.ai_status' : "'' AS ai_status";
    $selScore = columnExists($pdo, 'documents', 'ai_score') ? 'd.ai_score' : 'NULL AS ai_score';
    $selSecurity = columnExists($pdo, 'documents', 'ai_security_json') ? 'd.ai_security_json' : 'NULL AS ai_security_json';

    $sql = "
        SELECT {$selType}, {$selAi}, {$selScore}, {$selSecurity}, {$selReviewed}, {$selDecision},
               e.school_year, e.strand, e.enrollment_steps,
               u.full_name, u.email, {$selFirst}, {$selMiddle}, {$selLast}, {$selExt}
          FROM documents d
         INNER JOIN enrollments e ON e.id = d.enrollment_id
         INNER JOIN users u ON u.id = e.user_id
         WHERE 1=1 {$sy['sql']}
         ORDER BY u.full_name ASC, d.id DESC
    ";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($sy['params']);
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
        $scoreRaw = $row['ai_score'] ?? null;
        $scorePct = '';
        if ($scoreRaw !== null && $scoreRaw !== '') {
            $n = (float)$scoreRaw;
            $scorePct = $n <= 1 ? (string)round($n * 100) . '%' : (string)round($n) . '%';
        }
        $anomalies = '';
        if (!empty($row['ai_security_json'])) {
            $sec = json_decode((string)$row['ai_security_json'], true);
            if (is_array($sec)) {
                $issues = [];
                if (!empty($sec['tamper_signals']) && is_array($sec['tamper_signals'])) {
                    $issues = array_merge($issues, $sec['tamper_signals']);
                }
                if (!empty($sec['issues']) && is_array($sec['issues'])) {
                    $issues = array_merge($issues, $sec['issues']);
                }
                $anomalies = implode('; ', array_slice(array_unique(array_map('strval', $issues)), 0, 5));
            }
        }
        $aiSt = strtolower(trim((string)($row['ai_status'] ?? '')));
        if ($anomalies === '' && (str_contains($aiSt, 'tamper') || str_contains($aiSt, 'reject'))) {
            $anomalies = (string)($row['ai_status'] ?? '');
        }
        $rows[] = [
            'Student Name' => reportStudentDisplayName($row),
            'Strand' => (string)($row['strand'] ?? ''),
            'Document Type' => (string)($row['type'] ?? 'Document'),
            'Verification Score' => $scorePct !== '' ? $scorePct : '—',
            'AI Status' => (string)($row['ai_status'] ?? 'pending'),
            'Registrar Status' => documentRegistrarUiStatus($row),
            'Anomalies' => $anomalies !== '' ? $anomalies : 'None detected',
            'School Year' => (string)($row['school_year'] ?? ''),
        ];
    }

    return ['title' => 'Document Verification Results — ' . $syLabel, 'columns' => $columns, 'rows' => $rows];
}

/**
 * @return array{title: string, columns: list<string>, rows: list<array<string, scalar|null>>}
 */
function reportApprovalRecords(PDO $pdo, string $syFilter, string $syLabel): array
{
    $columns = ['Application ID', 'Student Name', 'Email', 'Strand', 'Grade Level', 'Status', 'School Year', 'Approved Date', 'Remarks'];
    $rows = [];
    if (!tableExists($pdo, 'enrollments') || !tableExists($pdo, 'users')) {
        return ['title' => 'Approval Records — ' . $syLabel, 'columns' => $columns, 'rows' => $rows];
    }

    $sy = reportSchoolYearClause('e', $syFilter);
    $selFirst = columnExists($pdo, 'users', 'first_name') ? 'u.first_name' : "'' AS first_name";
    $selLast = columnExists($pdo, 'users', 'last_name') ? 'u.last_name' : "'' AS last_name";
    $selMiddle = columnExists($pdo, 'users', 'middle_name') ? 'u.middle_name' : "'' AS middle_name";
    $selExt = columnExists($pdo, 'users', 'extension_name') ? 'u.extension_name' : "'' AS extension_name";
    $selRemarks = columnExists($pdo, 'enrollments', 'registrar_remarks') ? 'e.registrar_remarks' : "'' AS registrar_remarks";
    $selUpdated = columnExists($pdo, 'enrollments', 'updated_at') ? 'e.updated_at' : 'NULL AS updated_at';

    $sql = "
        SELECT e.id, e.status, e.strand, e.grade_level, e.school_year, e.enrollment_steps,
               {$selRemarks}, {$selUpdated},
               u.email, u.full_name, {$selFirst}, {$selMiddle}, {$selLast}, {$selExt}
          FROM enrollments e
         INNER JOIN users u ON u.id = e.user_id
         WHERE LOWER(TRIM(COALESCE(e.status, ''))) IN ('approved', 'enrolled')
         {$sy['sql']}
         ORDER BY e.updated_at DESC, e.id DESC
    ";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($sy['params']);
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
        $id = (int)$row['id'];
        $rows[] = [
            'Application ID' => 'APP-' . date('Y') . '-' . str_pad((string)$id, 3, '0', STR_PAD_LEFT),
            'Student Name' => reportStudentDisplayName($row),
            'Email' => (string)($row['email'] ?? ''),
            'Strand' => (string)($row['strand'] ?? ''),
            'Grade Level' => (string)($row['grade_level'] ?? ''),
            'Status' => reportStatusLabel((string)($row['status'] ?? '')),
            'School Year' => (string)($row['school_year'] ?? ''),
            'Approved Date' => (string)($row['updated_at'] ?? ''),
            'Remarks' => (string)($row['registrar_remarks'] ?? ''),
        ];
    }

    return ['title' => 'Approval Records — ' . $syLabel, 'columns' => $columns, 'rows' => $rows];
}

/**
 * @return array{title: string, columns: list<string>, rows: list<array<string, scalar|null>>}
 */
function reportRejectionRecords(PDO $pdo, string $syFilter, string $syLabel): array
{
    $columns = ['Application ID', 'Student Name', 'Email', 'Strand', 'Rejection Type', 'Details', 'Verification Score', 'School Year', 'Date'];
    $rows = [];
    if (!tableExists($pdo, 'enrollments') || !tableExists($pdo, 'users')) {
        return ['title' => 'Rejection Records — ' . $syLabel, 'columns' => $columns, 'rows' => $rows];
    }

    $sy = reportSchoolYearClause('e', $syFilter);
    $selFirst = columnExists($pdo, 'users', 'first_name') ? 'u.first_name' : "'' AS first_name";
    $selLast = columnExists($pdo, 'users', 'last_name') ? 'u.last_name' : "'' AS last_name";
    $selMiddle = columnExists($pdo, 'users', 'middle_name') ? 'u.middle_name' : "'' AS middle_name";
    $selExt = columnExists($pdo, 'users', 'extension_name') ? 'u.extension_name' : "'' AS extension_name";
    $selRemarks = columnExists($pdo, 'enrollments', 'registrar_remarks') ? 'e.registrar_remarks' : "'' AS registrar_remarks";
    $selUpdated = columnExists($pdo, 'enrollments', 'updated_at') ? 'e.updated_at' : 'NULL AS updated_at';

    $sql = "
        SELECT e.id, e.status, e.strand, e.school_year, e.enrollment_steps,
               {$selRemarks}, {$selUpdated},
               u.email, u.full_name, {$selFirst}, {$selMiddle}, {$selLast}, {$selExt}
          FROM enrollments e
         INNER JOIN users u ON u.id = e.user_id
         WHERE LOWER(TRIM(COALESCE(e.status, ''))) = 'rejected'
         {$sy['sql']}
         ORDER BY e.updated_at DESC, e.id DESC
    ";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($sy['params']);
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
        $id = (int)$row['id'];
        $rows[] = [
            'Application ID' => 'APP-' . date('Y') . '-' . str_pad((string)$id, 3, '0', STR_PAD_LEFT),
            'Student Name' => reportStudentDisplayName($row),
            'Email' => (string)($row['email'] ?? ''),
            'Strand' => (string)($row['strand'] ?? ''),
            'Rejection Type' => 'Application',
            'Details' => (string)($row['registrar_remarks'] ?? ''),
            'Verification Score' => '—',
            'School Year' => (string)($row['school_year'] ?? ''),
            'Date' => (string)($row['updated_at'] ?? ''),
        ];
    }

    if (tableExists($pdo, 'documents') && columnExists($pdo, 'documents', 'enrollment_id')) {
        $selType = columnExists($pdo, 'documents', 'type') ? 'd.type' : "'' AS type";
        $selAi = columnExists($pdo, 'documents', 'ai_status') ? 'd.ai_status' : "'' AS ai_status";
        $selScore = columnExists($pdo, 'documents', 'ai_score') ? 'd.ai_score' : 'NULL AS ai_score';
        $selDecision = columnExists($pdo, 'documents', 'registrar_doc_decision') ? 'd.registrar_doc_decision' : "'' AS registrar_doc_decision";
        $selDocRemarks = columnExists($pdo, 'documents', 'registrar_doc_remarks') ? 'd.registrar_doc_remarks' : "'' AS registrar_doc_remarks";
        $selDecided = columnExists($pdo, 'documents', 'doc_decided_at') ? 'd.doc_decided_at' : 'NULL AS doc_decided_at';

        $docSql = "
            SELECT d.id, {$selType}, {$selAi}, {$selScore}, {$selDecision}, {$selDocRemarks}, {$selDecided},
                   e.id AS enrollment_id, e.school_year, e.strand, e.enrollment_steps,
                   u.email, u.full_name, {$selFirst}, {$selMiddle}, {$selLast}, {$selExt}
              FROM documents d
             INNER JOIN enrollments e ON e.id = d.enrollment_id
             INNER JOIN users u ON u.id = e.user_id
             WHERE (
                LOWER(TRIM(COALESCE({$selDecision}, ''))) = 'reject'
                OR LOWER(TRIM(COALESCE(d.ai_status, ''))) IN ('rejected', 'tampered')
                OR LOWER(TRIM(COALESCE(d.ai_status, ''))) LIKE '%reject%'
                OR LOWER(TRIM(COALESCE(d.ai_status, ''))) LIKE '%tamper%'
             )
             {$sy['sql']}
             ORDER BY d.id DESC
        ";
        $docStmt = $pdo->prepare($docSql);
        $docStmt->execute($sy['params']);
        foreach ($docStmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
            $eid = (int)($row['enrollment_id'] ?? 0);
            $scoreRaw = $row['ai_score'] ?? null;
            $scorePct = '—';
            if ($scoreRaw !== null && $scoreRaw !== '') {
                $n = (float)$scoreRaw;
                $scorePct = $n <= 1 ? (string)round($n * 100) . '%' : (string)round($n) . '%';
            }
            $decision = strtolower(trim((string)($row['registrar_doc_decision'] ?? '')));
            $type = $decision === 'reject' ? 'Document (Registrar)' : 'Document (AI)';
            $details = trim((string)($row['registrar_doc_remarks'] ?? ''));
            if ($details === '') {
                $details = (string)($row['ai_status'] ?? '');
            }
            $rows[] = [
                'Application ID' => 'APP-' . date('Y') . '-' . str_pad((string)$eid, 3, '0', STR_PAD_LEFT),
                'Student Name' => reportStudentDisplayName($row),
                'Email' => (string)($row['email'] ?? ''),
                'Strand' => (string)($row['strand'] ?? ''),
                'Rejection Type' => $type,
                'Details' => $details,
                'Verification Score' => $scorePct,
                'School Year' => (string)($row['school_year'] ?? ''),
                'Date' => (string)($row['doc_decided_at'] ?? ''),
            ];
        }
    }

    return ['title' => 'Rejection Records — ' . $syLabel, 'columns' => $columns, 'rows' => $rows];
}

/**
 * @return array{title: string, columns: list<string>, rows: list<array<string, scalar|null>>}
 */
function reportAnomalySummary(PDO $pdo, string $syFilter, string $syLabel): array
{
    $columns = ['Source', 'Student / Actor', 'Document / Target', 'Anomaly', 'Verification Score', 'Status', 'Date'];
    $rows = [];

    if (tableExists($pdo, 'documents') && tableExists($pdo, 'enrollments') && columnExists($pdo, 'documents', 'enrollment_id')) {
        $sy = reportSchoolYearClause('e', $syFilter);
        $selFirst = columnExists($pdo, 'users', 'first_name') ? 'u.first_name' : "'' AS first_name";
        $selLast = columnExists($pdo, 'users', 'last_name') ? 'u.last_name' : "'' AS last_name";
        $selMiddle = columnExists($pdo, 'users', 'middle_name') ? 'u.middle_name' : "'' AS middle_name";
        $selExt = columnExists($pdo, 'users', 'extension_name') ? 'u.extension_name' : "'' AS extension_name";
        $selType = columnExists($pdo, 'documents', 'type') ? 'd.type' : "'' AS type";
        $selAi = columnExists($pdo, 'documents', 'ai_status') ? 'd.ai_status' : "'' AS ai_status";
        $selScore = columnExists($pdo, 'documents', 'ai_score') ? 'd.ai_score' : 'NULL AS ai_score';
        $selSecurity = columnExists($pdo, 'documents', 'ai_security_json') ? 'd.ai_security_json' : 'NULL AS ai_security_json';
        $selUploaded = columnExists($pdo, 'documents', 'uploaded_at') ? 'd.uploaded_at' : 'NULL AS uploaded_at';

        $sql = "
            SELECT {$selType}, {$selAi}, {$selScore}, {$selSecurity}, {$selUploaded},
                   e.enrollment_steps, u.full_name, u.email, {$selFirst}, {$selMiddle}, {$selLast}, {$selExt}
              FROM documents d
             INNER JOIN enrollments e ON e.id = d.enrollment_id
             INNER JOIN users u ON u.id = e.user_id
             WHERE (
                LOWER(TRIM(COALESCE(d.ai_status, ''))) LIKE '%tamper%'
                OR LOWER(TRIM(COALESCE(d.ai_status, ''))) = 'rejected'
                OR (d.ai_security_json IS NOT NULL AND TRIM(d.ai_security_json) <> '' AND d.ai_security_json <> 'null')
             )
             {$sy['sql']}
             ORDER BY d.uploaded_at DESC, d.id DESC
        ";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($sy['params']);
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
            $anomaly = (string)($row['ai_status'] ?? 'Anomaly detected');
            if (!empty($row['ai_security_json'])) {
                $sec = json_decode((string)$row['ai_security_json'], true);
                if (is_array($sec)) {
                    $parts = [];
                    foreach (['issues', 'tamper_signals'] as $key) {
                        if (!empty($sec[$key]) && is_array($sec[$key])) {
                            $parts = array_merge($parts, array_map('strval', $sec[$key]));
                        }
                    }
                    if ($parts !== []) {
                        $anomaly = implode('; ', array_slice(array_unique($parts), 0, 3));
                    }
                }
            }
            $scoreRaw = $row['ai_score'] ?? null;
            $scorePct = '—';
            if ($scoreRaw !== null && $scoreRaw !== '') {
                $n = (float)$scoreRaw;
                $scorePct = $n <= 1 ? (string)round($n * 100) . '%' : (string)round($n) . '%';
            }
            $rows[] = [
                'Source' => 'AI Verification',
                'Student / Actor' => reportStudentDisplayName($row),
                'Document / Target' => (string)($row['type'] ?? 'Document'),
                'Anomaly' => $anomaly,
                'Verification Score' => $scorePct,
                'Status' => (string)($row['ai_status'] ?? ''),
                'Date' => (string)($row['uploaded_at'] ?? ''),
            ];
        }
    }

    if (tableExists($pdo, 'activity_logs')) {
        $logSql = "
            SELECT al.action, al.status, al.target_type, al.target_id, al.details_json, al.created_at,
                   u.full_name, u.email
              FROM activity_logs al
              LEFT JOIN users u ON u.id = al.actor_user_id
             WHERE al.action LIKE 'anomaly_%'
             ORDER BY al.created_at DESC
             LIMIT 200
        ";
        foreach ($pdo->query($logSql)->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
            $details = [];
            if (!empty($row['details_json'])) {
                $decoded = json_decode((string)$row['details_json'], true);
                if (is_array($decoded)) {
                    $details = $decoded;
                }
            }
            $rows[] = [
                'Source' => 'Security Monitor',
                'Student / Actor' => trim((string)($row['full_name'] ?? '')) !== ''
                    ? (string)$row['full_name']
                    : (string)($row['email'] ?? 'System'),
                'Document / Target' => trim((string)($row['target_type'] ?? '')) . ' #' . trim((string)($row['target_id'] ?? '')),
                'Anomaly' => str_replace('_', ' ', (string)($row['action'] ?? 'anomaly')),
                'Verification Score' => '—',
                'Status' => (string)($row['status'] ?? ''),
                'Date' => (string)($row['created_at'] ?? ''),
            ];
        }
    }

    return ['title' => 'Anomaly Summary — ' . $syLabel, 'columns' => $columns, 'rows' => $rows];
}

/**
 * @return array{title: string, columns: list<string>, rows: list<array<string, scalar|null>>}
 */
function reportSectionMasterlist(PDO $pdo, string $syFilter, string $syLabel): array
{
    $columns = ['Section', 'Strand', 'Shift', 'Grade Level', 'Student Name', 'Email', 'Gender', 'School Year'];
    $rows = [];
    if (!tableExists($pdo, 'students') || !tableExists($pdo, 'users') || !tableExists($pdo, 'enrollments')) {
        return ['title' => 'Section Masterlist — ' . $syLabel, 'columns' => $columns, 'rows' => $rows];
    }

    $rosterSy = $syFilter !== '' ? $syFilter : rosterEnrollmentContext($pdo)['school_year'];
    $enrollmentJoin = sqlEnrolledEnrollmentJoin('s.user_id');
    $selFirst = columnExists($pdo, 'users', 'first_name') ? 'u.first_name' : "'' AS first_name";
    $selLast = columnExists($pdo, 'users', 'last_name') ? 'u.last_name' : "'' AS last_name";
    $selMiddle = columnExists($pdo, 'users', 'middle_name') ? 'u.middle_name' : "'' AS middle_name";
    $selExt = columnExists($pdo, 'users', 'extension_name') ? 'u.extension_name' : "'' AS extension_name";
    $selGender = columnExists($pdo, 'users', 'gender') ? 'u.gender' : "'' AS gender";
    $shiftExpr = columnExists($pdo, 'students', 'section_shift')
        ? "COALESCE(NULLIF(TRIM(s.section_shift), ''), 'morning')"
        : "'morning'";

    $sql = "
        SELECT TRIM(s.section) AS section_name,
               {$shiftExpr} AS shift_name,
               COALESCE(NULLIF(TRIM(e.strand), ''), 'Unassigned') AS strand_name,
               COALESCE(NULLIF(TRIM(e.grade_level), ''), '11') AS grade_level,
               e.school_year, e.enrollment_steps,
               u.email, u.full_name, {$selFirst}, {$selMiddle}, {$selLast}, {$selExt}, {$selGender}
          FROM students s
         INNER JOIN users u ON u.id = s.user_id
         {$enrollmentJoin}
         WHERE TRIM(COALESCE(s.section, '')) <> ''
    ";
    $params = [
        ':roster_sy' => (string)$rosterSy,
        ':roster_sy_filter' => (string)$rosterSy,
        ':roster_sy_filter_val' => (string)$rosterSy,
    ];
    if ($syFilter !== '') {
        $sql .= " AND TRIM(COALESCE(e.school_year, '')) = :report_sy";
        $params[':report_sy'] = $syFilter;
    }
    $sql .= ' ORDER BY strand_name ASC, section_name ASC, u.full_name ASC';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
        $rows[] = [
            'Section' => (string)($row['section_name'] ?? ''),
            'Strand' => (string)($row['strand_name'] ?? ''),
            'Shift' => ucfirst((string)($row['shift_name'] ?? 'morning')),
            'Grade Level' => (string)($row['grade_level'] ?? ''),
            'Student Name' => reportStudentDisplayName($row),
            'Email' => (string)($row['email'] ?? ''),
            'Gender' => (string)($row['gender'] ?? ''),
            'School Year' => (string)($row['school_year'] ?? ''),
        ];
    }

    return ['title' => 'Section Masterlist — ' . $syLabel, 'columns' => $columns, 'rows' => $rows];
}

/**
 * @return array{title: string, columns: list<string>, rows: list<array<string, scalar|null>>}
 */
function reportQuotaSummary(PDO $pdo, string $syFilter, string $syLabel): array
{
    $mon = reportMonitoringSummary($pdo, $syFilter, $syLabel);
    $summary = is_array($mon['summary'] ?? null) ? $mon['summary'] : [];
    $columns = ['Strand', 'Enrolled', 'Applications In Queue', 'Quota Share'];
    $rows = [];
    $enrolledTotal = (int)($summary['totalEnrolled'] ?? 0);
    foreach (is_array($summary['strands'] ?? null) ? $summary['strands'] : [] as $st) {
        $en = (int)($st['enrolled'] ?? 0);
        $share = $enrolledTotal > 0 ? round(($en / $enrolledTotal) * 100, 1) . '%' : '0%';
        $rows[] = [
            'Strand' => (string)($st['name'] ?? ''),
            'Enrolled' => (string)$en,
            'Applications In Queue' => (string)(int)($st['applications'] ?? 0),
            'Quota Share' => $share,
        ];
    }
    array_unshift($rows, [
        'Strand' => 'OVERALL',
        'Enrolled' => (string)$enrolledTotal,
        'Applications In Queue' => (string)((int)($summary['pending'] ?? 0) + (int)($summary['underReview'] ?? 0)),
        'Quota Share' => (string)($summary['quotaUtilization'] ?? 0) . '% of ' . REPORT_OVERALL_QUOTA,
    ]);

    return ['title' => 'Quota Summary — ' . $syLabel, 'columns' => $columns, 'rows' => $rows];
}

/**
 * @return array{title: string, columns: list<string>, rows: list<array<string, scalar|null>>}
 */
function reportDocumentCompletion(PDO $pdo, string $syFilter, string $syLabel): array
{
    $columns = ['Student Name', 'Strand', 'Documents Verified', 'Documents Total', 'Completion %', 'Physical Docs Complete', 'School Year'];
    $rows = [];
    if (!tableExists($pdo, 'enrollments') || !tableExists($pdo, 'users')) {
        return ['title' => 'Document Completion Report — ' . $syLabel, 'columns' => $columns, 'rows' => $rows];
    }

    $sy = reportSchoolYearClause('e', $syFilter);
    $hasDocs = tableExists($pdo, 'documents') && columnExists($pdo, 'documents', 'enrollment_id');
    $hasReviewed = $hasDocs && columnExists($pdo, 'documents', 'registrar_reviewed');
    $hasAi = $hasDocs && columnExists($pdo, 'documents', 'ai_status');
    $hasPhysical = columnExists($pdo, 'enrollments', 'physical_docs_completed_at');
    $selFirst = columnExists($pdo, 'users', 'first_name') ? 'u.first_name' : "'' AS first_name";
    $selLast = columnExists($pdo, 'users', 'last_name') ? 'u.last_name' : "'' AS last_name";
    $selMiddle = columnExists($pdo, 'users', 'middle_name') ? 'u.middle_name' : "'' AS middle_name";
    $selExt = columnExists($pdo, 'users', 'extension_name') ? 'u.extension_name' : "'' AS extension_name";

    $verifiedExpr = '0';
    if ($hasReviewed && $hasAi) {
        $verifiedExpr = "SUM(CASE WHEN d.registrar_reviewed = 1
            OR LOWER(TRIM(d.ai_status)) IN ('verified', 'approved', 'pass')
            OR LOWER(TRIM(d.ai_status)) LIKE '%verify%' THEN 1 ELSE 0 END)";
    } elseif ($hasReviewed) {
        $verifiedExpr = 'SUM(CASE WHEN d.registrar_reviewed = 1 THEN 1 ELSE 0 END)';
    } elseif ($hasAi) {
        $verifiedExpr = "SUM(CASE WHEN LOWER(TRIM(d.ai_status)) IN ('verified', 'approved', 'pass')
            OR LOWER(TRIM(d.ai_status)) LIKE '%verify%' THEN 1 ELSE 0 END)";
    }

    $physicalSel = $hasPhysical ? 'e.physical_docs_completed_at' : 'NULL AS physical_docs_completed_at';

    $sql = "
        SELECT e.id, e.strand, e.school_year, e.enrollment_steps, {$physicalSel},
               u.full_name, u.email, {$selFirst}, {$selMiddle}, {$selLast}, {$selExt}
          FROM enrollments e
         INNER JOIN users u ON u.id = e.user_id
         WHERE LOWER(TRIM(COALESCE(e.status, ''))) IN ('approved', 'enrolled')
         {$sy['sql']}
         ORDER BY u.full_name ASC
    ";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($sy['params']);
    $countStmt = null;
    if ($hasDocs) {
        $countSql = "SELECT COUNT(*) AS total_docs, {$verifiedExpr} AS verified_docs
                       FROM documents d WHERE d.enrollment_id = :eid";
        $countStmt = $pdo->prepare($countSql);
    }
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
        $total = 0;
        $verified = 0;
        if ($countStmt !== null) {
            $countStmt->execute([':eid' => (int)$row['id']]);
            $c = $countStmt->fetch(PDO::FETCH_ASSOC) ?: [];
            $total = (int)($c['total_docs'] ?? 0);
            $verified = (int)($c['verified_docs'] ?? 0);
        }
        $pct = $total > 0 ? round(($verified / $total) * 100, 1) : 0.0;
        $rows[] = [
            'Student Name' => reportStudentDisplayName($row),
            'Strand' => (string)($row['strand'] ?? ''),
            'Documents Verified' => (string)$verified,
            'Documents Total' => (string)$total,
            'Completion %' => $pct . '%',
            'Physical Docs Complete' => !empty($row['physical_docs_completed_at']) ? 'Yes' : 'No',
            'School Year' => (string)($row['school_year'] ?? ''),
        ];
    }

    return ['title' => 'Document Completion Report — ' . $syLabel, 'columns' => $columns, 'rows' => $rows];
}

$reportType = strtolower(trim((string)($_GET['report'] ?? 'monitoring_summary')));
$format = strtolower(trim((string)($_GET['format'] ?? 'json')));
$syRaw = trim((string)($_GET['school_year'] ?? 'current'));
$syCtx = reportResolveSchoolYear($pdo, $syRaw);
$syFilter = $syCtx['filter'];
$syLabel = $syCtx['label'];

$builders = [
    'monitoring_summary' => 'reportMonitoringSummary',
    'applicants' => 'reportApplicants',
    'enrollment_summary' => 'reportEnrollmentSummary',
    'document_verification' => 'reportDocumentVerification',
    'approval_records' => 'reportApprovalRecords',
    'rejection_records' => 'reportRejectionRecords',
    'anomaly_summary' => 'reportAnomalySummary',
    'section_masterlist' => 'reportSectionMasterlist',
    'quota_summary' => 'reportQuotaSummary',
    'document_completion' => 'reportDocumentCompletion',
    // aliases for legacy UI ids
    'strand_enrollment' => 'reportEnrollmentSummary',
];

try {
    if (!isset($builders[$reportType])) {
        http_response_code(422);
        echo json_encode([
            'success' => false,
            'error' => 'Unknown report type',
            'available' => array_keys($builders),
        ]);
        exit;
    }

    $builder = $builders[$reportType];
    $payload = $builder($pdo, $syFilter, $syLabel);
    $title = (string)($payload['title'] ?? 'Report');
    $columns = is_array($payload['columns'] ?? null) ? $payload['columns'] : [];
    $rows = is_array($payload['rows'] ?? null) ? $payload['rows'] : [];

    if ($format === 'csv') {
        $safeName = preg_replace('/[^a-z0-9_-]+/i', '_', $reportType) ?: 'report';
        reportEmitCsv($safeName . '_' . date('Ymd') . '.csv', $columns, $rows);
    }
    if ($format === 'print') {
        reportEmitPrintHtml($title, $syLabel, $columns, $rows);
    }

    appLogEvent($pdo, 'registrar_reports', 'registrar', 'success', $actorId, 'report', $reportType, [
        'format' => $format,
        'school_year' => $syFilter !== '' ? $syFilter : 'all',
        'rows' => count($rows),
    ]);

    $response = [
        'success' => true,
        'report' => $reportType,
        'title' => $title,
        'schoolYearLabel' => $syLabel,
        'columns' => $columns,
        'rows' => $rows,
        'rowCount' => count($rows),
        'generatedAt' => date('c'),
        'filters' => [
            'school_year_options' => reportSchoolYearOptions($pdo),
            'enrollment_school_year_current' => getEnrollmentSchoolYear($pdo),
        ],
    ];
    if (isset($payload['summary'])) {
        $response['summary'] = $payload['summary'];
    }
    echo json_encode($response);
} catch (Throwable $e) {
    appLogEvent($pdo, 'registrar_reports', 'registrar', 'failed', $actorId, 'report', $reportType, [
        'message' => $e->getMessage(),
    ]);
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to generate report']);
}
