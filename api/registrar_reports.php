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
    if (strtolower($raw) === 'ongoing') {
        $sy = trim((string)(getOngoingSchoolYear($pdo) ?? ''));
        if ($sy === '') {
            $sy = trim((string)(getEnrollmentSchoolYear($pdo) ?? ''));
        }

        return [
            'filter' => $sy,
            'label' => $sy !== '' ? 'Ongoing SY ' . $sy : 'All school years',
        ];
    }
    if ($raw === '' || strtolower($raw) === 'current' || strtolower($raw) === 'enrollment') {
        $sy = trim((string)(getEnrollmentSchoolYear($pdo) ?? ''));

        return [
            'filter' => $sy,
            'label' => $sy !== '' ? 'Enrollment intake SY ' . $sy : 'All school years',
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
    return schoolYearFilterOptions($pdo);
}

function reportPaymentArrangementLabel(array $row): string
{
    $form = enrollmentStepsFormData((string)($row['enrollment_steps'] ?? ''));
    $raw = strtolower(trim((string)($form['paymentArrangement'] ?? '')));

    return match ($raw) {
        'full_payment' => 'Full Payment',
        'installment' => 'Installment',
        default => '',
    };
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

function reportDocumentTypeLabel(string $type): string
{
    $t = strtolower(trim($type));
    return match ($t) {
        'birth_certificate', 'psa' => 'PSA Birth Certificate',
        'sf9', 'report_card', 'tor', 'transcript' => 'Grade 10 Report Card / TOR (SF9)',
        'good_moral', 'goodmoral' => 'Good Moral Certificate',
        'form137', 'sf10' => 'SF10 / Form 137',
        'id_picture', 'id' => '2x2 Picture',
        default => $t !== '' ? ucwords(str_replace('_', ' ', $t)) : 'Document',
    };
}

/** @return array<string, string> canonical key => short column header */
function reportAdmissionDocumentColumns(): array
{
    return [
        'psa' => 'PSA',
        'good_moral' => 'Good Moral',
        'sf10' => 'SF10',
        'sf9' => 'SF9',
        'id_picture' => '2x2',
    ];
}

function reportNormalizeDocumentTypeKey(string $type): string
{
    $t = strtolower(trim($type));
    if (in_array($t, ['birth_certificate', 'birthcert', 'psa'], true)) {
        return 'psa';
    }
    if (in_array($t, ['good_moral', 'goodmoral'], true)) {
        return 'good_moral';
    }
    if (in_array($t, ['sf9', 'report_card', 'tor', 'transcript', 'transcript_of_records'], true)) {
        return 'sf9';
    }
    if (in_array($t, ['form137', 'sf10', 'form_137'], true)) {
        return 'sf10';
    }
    if (in_array($t, ['id_picture', 'id'], true)) {
        return 'id_picture';
    }
    if (str_contains($t, 'transcript') || preg_match('/\btor\b/', $t)) {
        return 'sf9';
    }
    if (str_contains($t, 'sf9') || str_contains($t, 'report card')) {
        return 'sf9';
    }
    if (str_contains($t, 'form 137') || str_contains($t, 'form137') || str_contains($t, 'sf10')) {
        return 'sf10';
    }

    return $t !== '' ? $t : 'other';
}

/**
 * @return array{title: string, layout: string, columns: list<string>, rows: list<array<string, string>>}
 */
function reportStudentDocumentScoreTable(string $title, array $rows, array $docColumns, array $extraColumns = []): array
{
    $columns = array_merge(['Student', 'Strand'], array_values($docColumns), $extraColumns);

    return [
        'title' => $title,
        'layout' => 'table',
        'columns' => $columns,
        'rows' => $rows,
    ];
}

function reportFormatDocCompletionCell(array $doc): string
{
    $score = reportFormatAiScore($doc['ai_score'] ?? null);
    if ($score !== '—') {
        return $score;
    }
    if (documentRegistrarUiStatus($doc) === 'Verified') {
        return '✓';
    }
    $aiSt = strtolower(trim((string)($doc['ai_status'] ?? '')));
    if (str_contains($aiSt, 'verified') || in_array($aiSt, ['approved', 'pass'], true)) {
        return '✓';
    }

    return '—';
}

function reportFormatAiScore(mixed $scoreRaw): string
{
    if ($scoreRaw === null || $scoreRaw === '') {
        return '—';
    }
    $n = (float)$scoreRaw;

    return $n <= 1 ? (string)round($n * 100) . '%' : (string)round($n) . '%';
}

function reportExtractDocAnomalies(array $row): string
{
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
            $anomalies = implode('; ', array_slice(array_unique(array_map('strval', $issues)), 0, 4));
        }
    }
    $aiSt = strtolower(trim((string)($row['ai_status'] ?? '')));
    if ($anomalies === '' && (str_contains($aiSt, 'tamper') || str_contains($aiSt, 'reject'))) {
        $anomalies = (string)($row['ai_status'] ?? '');
    }

    return $anomalies !== '' ? $anomalies : 'None';
}

/**
 * @param list<array{title: string, subtitle?: string, columns: list<string>, rows: list<array<string, string>>}> $groups
 * @return array{title: string, layout: string, groups: list<array>, columns: list<string>, rows: list<array<string, string>>}
 */
function reportGroupedPayload(string $title, array $groups, string $studentColumn = 'Student'): array
{
    $docColumns = $groups[0]['columns'] ?? [];
    $flatCols = $docColumns === [] ? [] : array_merge([$studentColumn], $docColumns);
    $flatRows = [];
    foreach ($groups as $group) {
        foreach ($group['rows'] as $row) {
            $flatRows[] = array_merge([$studentColumn => (string)$group['title']], $row);
        }
    }

    return [
        'title' => $title,
        'layout' => 'grouped',
        'groups' => $groups,
        'columns' => $flatCols,
        'rows' => $flatRows,
    ];
}

/**
 * @param list<array{title: string, subtitle?: string, columns: list<string>, rows: list<array<string, string>>}> $groups
 * @param array<string, int> $index
 */
function reportStudentGroupMeta(array $row): array
{
    $name = reportStudentDisplayName($row);
    $strand = trim((string)($row['strand'] ?? ''));
    $sy = trim((string)($row['school_year'] ?? ''));
    $parts = array_values(array_filter([
        $strand !== '' ? $strand : null,
        $sy !== '' ? 'SY ' . $sy : null,
    ]));

    return [
        'key' => strtolower($name) . "\0" . strtolower(trim((string)($row['email'] ?? ''))),
        'title' => $name,
        'subtitle' => implode(' · ', $parts),
    ];
}

/**
 * @param list<array{title: string, subtitle?: string, columns: list<string>, rows: list<array<string, string>>}> $groups
 * @param array<string, int> $index
 */
function reportEnsureStudentGroup(array &$groups, array &$index, array $row, array $columns): int
{
    $meta = reportStudentGroupMeta($row);
    if (!isset($index[$meta['key']])) {
        $index[$meta['key']] = count($groups);
        $groups[] = [
            'title' => $meta['title'],
            'subtitle' => $meta['subtitle'],
            'columns' => $columns,
            'rows' => [],
        ];
    }

    return $index[$meta['key']];
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
    $columns = ['Application ID', 'Student Name', 'Email', 'Strand', 'Grade Level', 'Payment Arrangement', 'Status', 'School Year', 'Submitted'];
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
            'Payment Arrangement' => reportPaymentArrangementLabel($row) ?: '—',
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
    $title = 'Document Verification Results — ' . $syLabel;
    $docColumns = reportAdmissionDocumentColumns();
    $rows = [];
    $index = [];
    if (!tableExists($pdo, 'documents') || !tableExists($pdo, 'enrollments') || !columnExists($pdo, 'documents', 'enrollment_id')) {
        return reportStudentDocumentScoreTable($title, $rows, $docColumns);
    }

    $sy = reportSchoolYearClause('e', $syFilter);
    $selFirst = columnExists($pdo, 'users', 'first_name') ? 'u.first_name' : "'' AS first_name";
    $selLast = columnExists($pdo, 'users', 'last_name') ? 'u.last_name' : "'' AS last_name";
    $selMiddle = columnExists($pdo, 'users', 'middle_name') ? 'u.middle_name' : "'' AS middle_name";
    $selExt = columnExists($pdo, 'users', 'extension_name') ? 'u.extension_name' : "'' AS extension_name";
    $selType = columnExists($pdo, 'documents', 'type') ? 'd.type' : "'' AS type";
    $selScore = columnExists($pdo, 'documents', 'ai_score') ? 'd.ai_score' : 'NULL AS ai_score';

    $sql = "
        SELECT {$selType}, {$selScore},
               e.strand, e.enrollment_steps,
               u.full_name, u.email, {$selFirst}, {$selMiddle}, {$selLast}, {$selExt}
          FROM documents d
         INNER JOIN enrollments e ON e.id = d.enrollment_id
         INNER JOIN users u ON u.id = e.user_id
         WHERE 1=1 {$sy['sql']}
         ORDER BY u.full_name ASC, d.id ASC
    ";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($sy['params']);
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
        $meta = reportStudentGroupMeta($row);
        if (!isset($index[$meta['key']])) {
            $index[$meta['key']] = count($rows);
            $blank = array_fill_keys(array_values($docColumns), '—');
            $rows[] = array_merge(
                ['Student' => $meta['title'], 'Strand' => trim((string)($row['strand'] ?? ''))],
                $blank,
            );
        }
        $docKey = reportNormalizeDocumentTypeKey((string)($row['type'] ?? ''));
        if (!isset($docColumns[$docKey])) {
            continue;
        }
        $col = $docColumns[$docKey];
        $rows[$index[$meta['key']]][$col] = reportFormatAiScore($row['ai_score'] ?? null);
    }

    return reportStudentDocumentScoreTable($title, $rows, $docColumns);
}

/**
 * @return array{title: string, columns: list<string>, rows: list<array<string, scalar|null>>}
 */
function reportApprovalRecords(PDO $pdo, string $syFilter, string $syLabel): array
{
    $columns = ['Application ID', 'Student Name', 'Email', 'Strand', 'Grade Level', 'Payment Arrangement', 'Status', 'School Year', 'Approved Date', 'Remarks'];
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
            'Payment Arrangement' => reportPaymentArrangementLabel($row) ?: '—',
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
    $docColumns = ['Type', 'Details', 'Score', 'Date'];
    $groups = [];
    $index = [];
    if (!tableExists($pdo, 'enrollments') || !tableExists($pdo, 'users')) {
        return reportGroupedPayload('Rejection Records — ' . $syLabel, $groups);
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
        $gi = reportEnsureStudentGroup($groups, $index, $row, $docColumns);
        $email = trim((string)($row['email'] ?? ''));
        if ($email !== '' && ($groups[$gi]['subtitle'] ?? '') === '') {
            $groups[$gi]['subtitle'] = $email;
        } elseif ($email !== '' && !str_contains((string)$groups[$gi]['subtitle'], $email)) {
            $groups[$gi]['subtitle'] = trim((string)$groups[$gi]['subtitle'] . ' · ' . $email);
        }
        $groups[$gi]['rows'][] = [
            'Type' => 'Application',
            'Details' => (string)($row['registrar_remarks'] ?? ''),
            'Score' => '—',
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
            $gi = reportEnsureStudentGroup($groups, $index, $row, $docColumns);
            $decision = strtolower(trim((string)($row['registrar_doc_decision'] ?? '')));
            $type = $decision === 'reject' ? 'Document (Registrar)' : 'Document (AI)';
            $details = trim((string)($row['registrar_doc_remarks'] ?? ''));
            if ($details === '') {
                $details = (string)($row['ai_status'] ?? '');
            }
            $groups[$gi]['rows'][] = [
                'Type' => $type . ' — ' . reportDocumentTypeLabel((string)($row['type'] ?? '')),
                'Details' => $details,
                'Score' => reportFormatAiScore($row['ai_score'] ?? null),
                'Date' => (string)($row['doc_decided_at'] ?? ''),
            ];
        }
    }

    return reportGroupedPayload('Rejection Records — ' . $syLabel, $groups);
}

/**
 * @return array{title: string, columns: list<string>, rows: list<array<string, scalar|null>>}
 */
function reportAnomalySummary(PDO $pdo, string $syFilter, string $syLabel): array
{
    $title = 'Anomaly Summary — ' . $syLabel;
    $docColumns = reportAdmissionDocumentColumns();
    $rows = [];
    $index = [];

    if (tableExists($pdo, 'documents') && tableExists($pdo, 'enrollments') && columnExists($pdo, 'documents', 'enrollment_id')) {
        $sy = reportSchoolYearClause('e', $syFilter);
        $selFirst = columnExists($pdo, 'users', 'first_name') ? 'u.first_name' : "'' AS first_name";
        $selLast = columnExists($pdo, 'users', 'last_name') ? 'u.last_name' : "'' AS last_name";
        $selMiddle = columnExists($pdo, 'users', 'middle_name') ? 'u.middle_name' : "'' AS middle_name";
        $selExt = columnExists($pdo, 'users', 'extension_name') ? 'u.extension_name' : "'' AS extension_name";
        $selType = columnExists($pdo, 'documents', 'type') ? 'd.type' : "'' AS type";
        $selScore = columnExists($pdo, 'documents', 'ai_score') ? 'd.ai_score' : 'NULL AS ai_score';
        $selSecurity = columnExists($pdo, 'documents', 'ai_security_json') ? 'd.ai_security_json' : 'NULL AS ai_security_json';

        $sql = "
            SELECT {$selType}, {$selScore}, {$selSecurity},
                   e.enrollment_steps, e.strand,
                   u.full_name, u.email, {$selFirst}, {$selMiddle}, {$selLast}, {$selExt}
              FROM documents d
             INNER JOIN enrollments e ON e.id = d.enrollment_id
             INNER JOIN users u ON u.id = e.user_id
             WHERE (
                LOWER(TRIM(COALESCE(d.ai_status, ''))) LIKE '%tamper%'
                OR LOWER(TRIM(COALESCE(d.ai_status, ''))) = 'rejected'
                OR (d.ai_security_json IS NOT NULL AND TRIM(d.ai_security_json) <> '' AND d.ai_security_json <> 'null')
             )
             {$sy['sql']}
             ORDER BY u.full_name ASC, d.id ASC
        ";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($sy['params']);
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
            $meta = reportStudentGroupMeta($row);
            if (!isset($index[$meta['key']])) {
                $blank = array_fill_keys(array_values($docColumns), '—');
                $index[$meta['key']] = count($rows);
                $rows[] = array_merge(
                    ['Student' => $meta['title'], 'Strand' => trim((string)($row['strand'] ?? ''))],
                    $blank,
                );
            }
            $docKey = reportNormalizeDocumentTypeKey((string)($row['type'] ?? ''));
            if (!isset($docColumns[$docKey])) {
                continue;
            }
            $col = $docColumns[$docKey];
            $rows[$index[$meta['key']]][$col] = reportFormatAiScore($row['ai_score'] ?? null);
        }
    }

    return reportStudentDocumentScoreTable($title, $rows, $docColumns);
}

/**
 * @return array{title: string, columns: list<string>, rows: list<array<string, scalar|null>>}
 */
function reportSectionMasterlist(PDO $pdo, string $syFilter, string $syLabel): array
{
    $memberColumns = ['Student Name', 'Email', 'Gender'];
    $groups = [];
    $index = [];
    if (!tableExists($pdo, 'students') || !tableExists($pdo, 'users') || !tableExists($pdo, 'enrollments')) {
        return reportGroupedPayload('Section Masterlist — ' . $syLabel, $groups, 'Section');
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
        $section = (string)($row['section_name'] ?? '');
        $strand = (string)($row['strand_name'] ?? '');
        $shift = ucfirst((string)($row['shift_name'] ?? 'morning'));
        $grade = (string)($row['grade_level'] ?? '');
        $sy = trim((string)($row['school_year'] ?? ''));
        $key = strtolower($section) . "\0" . strtolower($strand) . "\0" . strtolower($shift);
        if (!isset($index[$key])) {
            $subtitleParts = array_values(array_filter([
                $strand !== '' ? $strand : null,
                'Grade ' . $grade,
                $shift . ' shift',
                $sy !== '' ? 'SY ' . $sy : null,
            ]));
            $index[$key] = count($groups);
            $groups[] = [
                'title' => 'Section ' . $section,
                'subtitle' => implode(' · ', $subtitleParts),
                'columns' => $memberColumns,
                'rows' => [],
            ];
        }
        $gi = $index[$key];
        $groups[$gi]['rows'][] = [
            'Student Name' => reportStudentDisplayName($row),
            'Email' => (string)($row['email'] ?? ''),
            'Gender' => (string)($row['gender'] ?? ''),
        ];
    }

    return reportGroupedPayload('Section Masterlist — ' . $syLabel, $groups, 'Section');
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
    $title = 'Document Completion Report — ' . $syLabel;
    $docColumns = reportAdmissionDocumentColumns();
    $rows = [];
    $index = [];
    if (!tableExists($pdo, 'enrollments') || !tableExists($pdo, 'users')) {
        return reportStudentDocumentScoreTable($title, $rows, $docColumns, ['Physical']);
    }

    $sy = reportSchoolYearClause('e', $syFilter);
    $hasDocs = tableExists($pdo, 'documents') && columnExists($pdo, 'documents', 'enrollment_id');
    $hasPhysical = columnExists($pdo, 'enrollments', 'physical_docs_completed_at');
    $selFirst = columnExists($pdo, 'users', 'first_name') ? 'u.first_name' : "'' AS first_name";
    $selLast = columnExists($pdo, 'users', 'last_name') ? 'u.last_name' : "'' AS last_name";
    $selMiddle = columnExists($pdo, 'users', 'middle_name') ? 'u.middle_name' : "'' AS middle_name";
    $selExt = columnExists($pdo, 'users', 'extension_name') ? 'u.extension_name' : "'' AS extension_name";
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

    $docListStmt = null;
    if ($hasDocs) {
        $selType = columnExists($pdo, 'documents', 'type') ? 'd.type' : "'' AS type";
        $selAi = columnExists($pdo, 'documents', 'ai_status') ? 'd.ai_status' : "'' AS ai_status";
        $selScore = columnExists($pdo, 'documents', 'ai_score') ? 'd.ai_score' : 'NULL AS ai_score';
        $selReviewed = columnExists($pdo, 'documents', 'registrar_reviewed') ? 'd.registrar_reviewed' : '0 AS registrar_reviewed';
        $selDecision = columnExists($pdo, 'documents', 'registrar_doc_decision') ? 'd.registrar_doc_decision' : "'' AS registrar_doc_decision";
        $docListStmt = $pdo->prepare("
            SELECT {$selType}, {$selAi}, {$selScore}, {$selReviewed}, {$selDecision}
              FROM documents d
             WHERE d.enrollment_id = :eid
             ORDER BY d.id ASC
        ");
    }

    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
        $meta = reportStudentGroupMeta($row);
        if (!isset($index[$meta['key']])) {
            $blank = array_fill_keys(array_values($docColumns), '—');
            $index[$meta['key']] = count($rows);
            $rows[] = array_merge(
                ['Student' => $meta['title'], 'Strand' => trim((string)($row['strand'] ?? ''))],
                $blank,
                ['Physical' => !empty($row['physical_docs_completed_at']) ? 'Yes' : 'No'],
            );
        }
        if ($docListStmt === null) {
            continue;
        }
        $docListStmt->execute([':eid' => (int)$row['id']]);
        foreach ($docListStmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $doc) {
            $docKey = reportNormalizeDocumentTypeKey((string)($doc['type'] ?? ''));
            if (!isset($docColumns[$docKey])) {
                continue;
            }
            $col = $docColumns[$docKey];
            $rows[$index[$meta['key']]][$col] = reportFormatDocCompletionCell($doc);
        }
    }

    return reportStudentDocumentScoreTable($title, $rows, $docColumns, ['Physical']);
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
    $layout = (string)($payload['layout'] ?? 'table');
    $groups = is_array($payload['groups'] ?? null) ? $payload['groups'] : [];
    $columns = is_array($payload['columns'] ?? null) ? $payload['columns'] : [];
    $rows = is_array($payload['rows'] ?? null) ? $payload['rows'] : [];
    $groupCount = count($groups);

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
        'groups' => $groupCount,
    ]);

    $response = [
        'success' => true,
        'report' => $reportType,
        'title' => $title,
        'layout' => $layout,
        'schoolYearLabel' => $syLabel,
        'columns' => $columns,
        'rows' => $rows,
        'rowCount' => count($rows),
        'groupCount' => $groupCount,
        'generatedAt' => date('c'),
        'filters' => [
            'school_year_options' => reportSchoolYearOptions($pdo),
            'enrollment_school_year_current' => getEnrollmentSchoolYear($pdo),
            'ongoing_school_year_current' => getOngoingSchoolYear($pdo),
        ],
    ];
    if ($groups !== []) {
        $response['groups'] = $groups;
    }
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
