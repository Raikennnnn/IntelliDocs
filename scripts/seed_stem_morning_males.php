<?php
declare(strict_types=1);

/**
 * Seed STEM (or other) morning section with male students to test auto-create capacity.
 *
 * On the droplet:
 *   cd /var/www/intellidocs
 *   php scripts/seed_stem_morning_males.php
 *   php scripts/seed_stem_morning_males.php --count=23
 *   php scripts/seed_stem_morning_males.php --undo
 *
 * Local XAMPP:
 *   php scripts/seed_stem_morning_males.php
 */

$root = dirname(__DIR__);
require_once $root . '/config/database.php';
require_once $root . '/api/school_year_helpers.php';
require_once $root . '/api/section_assignment.php';
require_once $root . '/api/section_grade_helpers.php';

/** @param list<string> $argv */
function seedArgValue(array $argv, string $name, ?string $default = null): ?string
{
    foreach ($argv as $arg) {
        if (str_starts_with($arg, "--{$name}=")) {
            return substr($arg, strlen($name) + 3);
        }
        if ($arg === "--{$name}") {
            return '1';
        }
    }

    return $default;
}

$undo = seedArgValue($argv, 'undo') === '1';
$count = max(1, min(45, (int)(seedArgValue($argv, 'count', '23') ?? '23')));
$strand = trim((string)(seedArgValue($argv, 'strand', 'STEM') ?? 'STEM'));
$sectionName = trim((string)(seedArgValue($argv, 'section', 'A') ?? 'A'));
$shift = normaliseAssignmentShift((string)(seedArgValue($argv, 'shift', 'morning') ?? 'morning'));
$grade = normaliseGradeLevel((string)(seedArgValue($argv, 'grade', '11') ?? '11'));
if ($shift === '') {
    $shift = 'morning';
}

$emailPrefix = 'seed.' . strtolower(preg_replace('/[^a-z0-9]+/i', '', $strand) ?: 'stem')
    . '.' . strtolower($shift) . '.m';

if (!($pdo instanceof PDO)) {
    fwrite(STDERR, "Database connection unavailable.\n");
    exit(1);
}

ensureSectionAssignmentSchema($pdo);

$schoolYear = trim((string)(getEnrollmentSchoolYear($pdo) ?? ''));
if ($schoolYear === '') {
    $schoolYear = date('Y') . '-' . (date('Y') + 1);
}

$hasUserGender = columnExists($pdo, 'users', 'gender');
$hasUserRole = columnExists($pdo, 'users', 'role');
$hasSectionShift = columnExists($pdo, 'students', 'section_shift');
$hasSectionsShift = columnExists($pdo, 'sections', 'shift');
$hasSectionsGrade = columnExists($pdo, 'sections', 'grade_level');

echo "=== Seed STEM morning males ===\n";
echo "strand={$strand} section={$sectionName} shift={$shift} grade={$grade} count={$count}\n";
echo "school_year={$schoolYear}\n";
echo "email_prefix={$emailPrefix}NN@intellidocs.seed\n\n";

if ($undo) {
    $like = $emailPrefix . '%@intellidocs.seed';
    $ids = $pdo->prepare('SELECT id, email FROM users WHERE email LIKE :like ORDER BY id');
    $ids->execute([':like' => $like]);
    $rows = $ids->fetchAll(PDO::FETCH_ASSOC) ?: [];
    if ($rows === []) {
        echo "No seed users found to remove.\n";
        exit(0);
    }
    $pdo->beginTransaction();
    try {
        foreach ($rows as $row) {
            $uid = (int)$row['id'];
            $pdo->prepare('DELETE FROM enrollments WHERE user_id = :uid')->execute([':uid' => $uid]);
            $pdo->prepare('DELETE FROM students WHERE user_id = :uid')->execute([':uid' => $uid]);
            if (tableExists($pdo, 'student_users')) {
                $pdo->prepare('DELETE FROM student_users WHERE user_id = :uid')->execute([':uid' => $uid]);
            }
            $pdo->prepare('DELETE FROM users WHERE id = :uid')->execute([':uid' => $uid]);
            echo "removed {$row['email']}\n";
        }
        $pdo->commit();
        echo "\nRemoved " . count($rows) . " seed male(s).\n";
    } catch (Throwable $e) {
        $pdo->rollBack();
        fwrite(STDERR, 'Undo failed: ' . $e->getMessage() . "\n");
        exit(1);
    }
    exit(0);
}

// Ensure target section exists with real capacities (23 boys / 22 girls for STEM).
$findSql = 'SELECT id, name, max_boys, max_girls FROM sections WHERE strand = :strand AND name = :name';
$findParams = [':strand' => $strand, ':name' => $sectionName];
if ($hasSectionsShift) {
    $findSql .= ' AND shift = :shift';
    $findParams[':shift'] = $shift;
}
if ($hasSectionsGrade) {
    $findSql .= ' AND grade_level = :grade';
    $findParams[':grade'] = $grade;
}
$findSql .= ' LIMIT 1';
$find = $pdo->prepare($findSql);
$find->execute($findParams);
$section = $find->fetch(PDO::FETCH_ASSOC);

if (!$section) {
    $maxBoys = SECTION_AUTO_DEFAULT_BOYS;
    $maxGirls = SECTION_AUTO_DEFAULT_GIRLS;
    if ($hasSectionsShift && $hasSectionsGrade) {
        $ins = $pdo->prepare(
            'INSERT INTO sections (name, strand, shift, grade_level, max_boys, max_girls, boys_first)
             VALUES (:n, :st, :sh, :gr, :mb, :mg, 0)'
        );
        $ins->execute([
            ':n' => $sectionName,
            ':st' => $strand,
            ':sh' => $shift,
            ':gr' => $grade,
            ':mb' => $maxBoys,
            ':mg' => $maxGirls,
        ]);
    } elseif ($hasSectionsShift) {
        $ins = $pdo->prepare(
            'INSERT INTO sections (name, strand, shift, max_boys, max_girls, boys_first)
             VALUES (:n, :st, :sh, :mb, :mg, 0)'
        );
        $ins->execute([
            ':n' => $sectionName,
            ':st' => $strand,
            ':sh' => $shift,
            ':mb' => $maxBoys,
            ':mg' => $maxGirls,
        ]);
    } else {
        $ins = $pdo->prepare(
            'INSERT INTO sections (name, strand, max_boys, max_girls, boys_first)
             VALUES (:n, :st, :mb, :mg, 0)'
        );
        $ins->execute([
            ':n' => $sectionName,
            ':st' => $strand,
            ':mb' => $maxBoys,
            ':mg' => $maxGirls,
        ]);
    }
    echo "Created section {$sectionName} ({$strand} {$shift} G{$grade}) max_boys={$maxBoys} max_girls={$maxGirls}\n";
} else {
    // Force real boy capacity for the test.
    $upd = $pdo->prepare('UPDATE sections SET max_boys = :mb WHERE id = :id');
    $upd->execute([':mb' => SECTION_AUTO_DEFAULT_BOYS, ':id' => (int)$section['id']]);
    echo "Using existing section id=" . (int)$section['id']
        . " max_boys was " . (int)($section['max_boys'] ?? 0)
        . " → set to " . SECTION_AUTO_DEFAULT_BOYS . "\n";
}

$passwordHash = password_hash('SeedTest123!', PASSWORD_BCRYPT);
$created = 0;
$skipped = 0;

$pdo->beginTransaction();
try {
    for ($i = 1; $i <= $count; $i++) {
        $nn = str_pad((string)$i, 2, '0', STR_PAD_LEFT);
        $email = $emailPrefix . $nn . '@intellidocs.seed';
        $username = 'seed_' . strtolower(preg_replace('/[^a-z0-9]+/i', '', $strand) ?: 'stem')
            . '_' . $shift . '_m' . $nn;
        $fullName = 'SEED STEM MALE ' . $nn;

        $exists = $pdo->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
        $exists->execute([':email' => $email]);
        $existingId = (int)($exists->fetchColumn() ?: 0);
        if ($existingId > 0) {
            $skipped++;
            continue;
        }

        $cols = ['username', 'email', 'password', 'full_name'];
        $vals = [':username', ':email', ':password', ':full_name'];
        $params = [
            ':username' => $username,
            ':email' => $email,
            ':password' => $passwordHash,
            ':full_name' => $fullName,
        ];
        if ($hasUserGender) {
            $cols[] = 'gender';
            $vals[] = ':gender';
            $params[':gender'] = 'male';
        }
        if ($hasUserRole) {
            $cols[] = 'role';
            $vals[] = ':role';
            $params[':role'] = 'student';
        }

        $sql = 'INSERT INTO users (' . implode(', ', $cols) . ') VALUES (' . implode(', ', $vals) . ')';
        $pdo->prepare($sql)->execute($params);
        $userId = (int)$pdo->lastInsertId();

        if (tableExists($pdo, 'student_users')) {
            $pdo->prepare(
                'INSERT INTO student_users (user_id, username) VALUES (:uid, :u)
                 ON DUPLICATE KEY UPDATE username = VALUES(username)'
            )->execute([':uid' => $userId, ':u' => $username]);
        }

        // enrollment_steps must NOT contain "Afternoon Shift" so count = morning.
        $steps = [
            'current_step' => 6,
            'form_data' => [
                'givenName' => 'SEED',
                'lastName' => 'MALE' . $nn,
                'gender' => 'Male',
                'gradeLevel' => $grade,
                'strand' => $strand,
                'preferredSchedule' => 'Morning Shift',
                'modeOfPayment' => 'cash',
                'paymentArrangement' => 'full_payment',
                'hasReferralCode' => false,
            ],
        ];

        $pdo->prepare(
            'INSERT INTO enrollments (user_id, grade_level, strand, school_year, status, enrollment_steps)
             VALUES (:uid, :gl, :st, :sy, :status, :steps)'
        )->execute([
            ':uid' => $userId,
            ':gl' => $grade,
            ':st' => $strand,
            ':sy' => $schoolYear,
            ':status' => 'enrolled',
            ':steps' => json_encode($steps, JSON_UNESCAPED_UNICODE),
        ]);

        if ($hasSectionShift) {
            $pdo->prepare(
                'INSERT INTO students (user_id, grade_level, section, section_shift, status)
                 VALUES (:uid, :gl, :sec, :sh, "active")'
            )->execute([
                ':uid' => $userId,
                ':gl' => $grade,
                ':sec' => $sectionName,
                ':sh' => $shift,
            ]);
        } else {
            $pdo->prepare(
                'INSERT INTO students (user_id, grade_level, section, status)
                 VALUES (:uid, :gl, :sec, "active")'
            )->execute([
                ':uid' => $userId,
                ':gl' => $grade,
                ':sec' => $sectionName,
            ]);
        }

        $created++;
        echo "created {$email} → section {$sectionName}\n";
    }
    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    fwrite(STDERR, 'Seed failed: ' . $e->getMessage() . "\n");
    exit(1);
}

// Report boy fill for this section.
$gradeKeyExpr = sqlEnrollmentGradeKey('e2.grade_level');
$countSql = "
    SELECT
        COALESCE(SUM(CASE WHEN LOWER(TRIM(COALESCE(u.gender, ''))) IN ('male','m','boy') THEN 1 ELSE 0 END), 0) AS boys,
        COALESCE(SUM(CASE WHEN LOWER(TRIM(COALESCE(u.gender, ''))) IN ('female','f','girl') THEN 1 ELSE 0 END), 0) AS girls
      FROM students s
INNER JOIN users u ON u.id = s.user_id
 LEFT JOIN enrollments e2 ON e2.user_id = u.id
     WHERE LOWER(TRIM(s.section)) = LOWER(:sec)
       AND LOWER(TRIM(COALESCE(e2.strand, ''))) = LOWER(:strand)
       AND {$gradeKeyExpr} = :grade
       AND (
            CASE
                WHEN e2.enrollment_steps LIKE '%\\\"Afternoon Shift\\\"%' THEN 'afternoon'
                ELSE 'morning'
            END
       ) = :shift
";
$cstmt = $pdo->prepare($countSql);
$cstmt->execute([
    ':sec' => $sectionName,
    ':strand' => $strand,
    ':grade' => $grade,
    ':shift' => $shift,
]);
$fill = $cstmt->fetch(PDO::FETCH_ASSOC) ?: ['boys' => 0, 'girls' => 0];

echo "\nDone. created={$created} skipped_existing={$skipped}\n";
echo "Counted fill for {$strand} {$sectionName} {$shift} G{$grade}: "
    . "boys=" . (int)$fill['boys'] . " girls=" . (int)$fill['girls'] . "\n";
echo "\nNext: approve one more STEM Grade {$grade} male who prefers Morning Shift.\n";
echo "Expect auto-create of the next section letter if boys >= max_boys.\n";
echo "Cleanup later: php scripts/seed_stem_morning_males.php --undo\n";
