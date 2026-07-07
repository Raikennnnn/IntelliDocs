<?php
declare(strict_types=1);

/**
 * Post-process AI verify payloads without modifying the Python AI service.
 * - Different school layouts: mark unreadable OCR as uncertain (not false mismatch).
 * - Good moral signatures: tighten false positives and add a GD fallback scan.
 */

function aiRefineNormalizeDocType(string $docType): string
{
    $t = strtolower(trim($docType));
    if (in_array($t, ['goodmoral', 'good-moral'], true)) {
        return 'good_moral';
    }
    if ($t === 'sf10' || $t === 'form157') {
        return 'form137';
    }
    if ($t === 'report_card') {
        return 'sf9';
    }
    if ($t === 'birthcert') {
        return 'birth_certificate';
    }

    return $t !== '' ? $t : 'other';
}

/**
 * @return list<string>
 */
function aiRefineTokenize(string $value): array
{
    $s = strtoupper(trim($value));
    $s = preg_replace('/[^A-Z0-9\s,.\'-]/', ' ', $s) ?? $s;
    $parts = preg_split('/[\s,]+/', $s, -1, PREG_SPLIT_NO_EMPTY);
    if (!is_array($parts)) {
        return [];
    }

    return array_values(array_filter($parts, static fn (string $p): bool => strlen($p) >= 2));
}

function aiRefineTextLooksLikeOcrGarbage(string $detected): bool
{
    $d = trim($detected);
    if ($d === '' || $d === '—' || strcasecmp($d, 'not found') === 0 || strcasecmp($d, 'n/a') === 0) {
        return true;
    }

    $tokens = aiRefineTokenize($d);
    if ($tokens === []) {
        return true;
    }

    $suspicious = 0;
    foreach ($tokens as $token) {
        if (preg_match('/^\d+$/', $token)) {
            continue;
        }
        $len = strlen($token);
        if ($len <= 2) {
            $suspicious++;
            continue;
        }
        $vowels = preg_match_all('/[AEIOU]/', $token) ?: 0;
        $ratio = $len > 0 ? $vowels / $len : 0.0;
        if ($ratio < 0.12) {
            $suspicious++;
        }
        if ($len <= 4 && $ratio <= 0.25 && !preg_match('/^(JR|SR|III|IV)$/i', $token)) {
            $suspicious++;
        }
    }

    return $suspicious >= 2
        || ($suspicious >= 1 && count($tokens) <= 3 && strlen(implode('', $tokens)) <= 14);
}

function aiRefineEnrollmentTokenOverlap(string $expected, string $detected): float
{
    $exp = aiRefineTokenize($expected);
    $det = aiRefineTokenize($detected);
    if ($exp === [] || $det === []) {
        return 0.0;
    }

    $hit = 0;
    foreach ($exp as $expectedToken) {
        foreach ($det as $detectedToken) {
            if ($expectedToken === $detectedToken || str_contains($detectedToken, $expectedToken) || str_contains($expectedToken, $detectedToken)) {
                $hit++;
                break;
            }
            $pct = 0.0;
            similar_text($expectedToken, $detectedToken, $pct);
            if ($pct >= 72.0) {
                $hit++;
                break;
            }
        }
    }

    return $hit / max(1, count($exp));
}

/**
 * @param list<array<string, mixed>> $fieldChecks
 * @param array<string, string> $expectedByField
 * @return array{0: list<array<string, mixed>>, 1: int}
 */
function aiRefineFieldChecksForTemplate(array $fieldChecks, float $ocrConfidence, array $expectedByField = []): array
{
    $refined = [];
    $uncertainCount = 0;

    foreach ($fieldChecks as $check) {
        if (!is_array($check)) {
            continue;
        }

        $field = trim((string)($check['field'] ?? ''));
        $fieldKey = strtolower($field);
        $detected = trim((string)($check['detected'] ?? ''));
        $expected = trim((string)($check['expected'] ?? ($expectedByField[$fieldKey] ?? '')));
        $ok = $check['ok'] ?? null;
        $row = $check;

        if ($field !== '' && $fieldKey !== 'signature' && $expected !== '' && $detected !== '') {
            $overlap = aiRefineEnrollmentTokenOverlap($expected, $detected);
            if ($overlap >= 0.5) {
                $row['ok'] = true;
                $row['match_ratio'] = max((float)($row['match_ratio'] ?? 0.0), $overlap);
                $row['refined_reason'] = 'enrollment_token_rematch';
                unset($row['note'], $row['concern_pct']);
                $refined[] = $row;
                continue;
            }
        }

        if ($field !== '' && $fieldKey !== 'signature' && $ok === false) {
            $overlap = ($expected !== '' && $detected !== '')
                ? aiRefineEnrollmentTokenOverlap($expected, $detected)
                : 0.0;
            $garbage = aiRefineTextLooksLikeOcrGarbage($detected);
            $lowRead = $ocrConfidence > 0.0 && $ocrConfidence < 0.68;

            if (($garbage && $overlap < 0.35) || ($overlap < 0.2 && $lowRead)) {
                $row['ok'] = null;
                $row['detected'] = $detected !== '' ? $detected : 'Unreadable on this layout';
                $row['note'] = match ($fieldKey) {
                    'name', 'sex', 'date of birth', 'place of birth' => 'Unclear scan — identity field not readable enough to compare.',
                    default => 'Different school form layout or unclear scan — compare the preview manually.',
                };
                $row['refined_reason'] = 'template_unreadable';
                unset($row['x'], $row['y'], $row['w'], $row['h'], $row['concern_pct']);
                $uncertainCount++;
            }
        }

        $refined[] = $row;
    }

    return [$refined, $uncertainCount];
}

/**
 * @param array<string, mixed> $sig
 * @param array<string, mixed>|null $phpScan
 * @return array<string, mixed>
 */
function aiRefineSignatureScan(array $sig, ?array $phpScan = null): array
{
    $detected = !empty($sig['detected']);
    $conf = (float)($sig['confidence'] ?? 0.0);
    $ink = (float)($sig['ink_ratio'] ?? 0.0);
    $strokes = (int)($sig['stroke_components'] ?? 0);

    if ($detected) {
        if ($conf < 0.52) {
            $detected = false;
        } elseif ($strokes >= 8 && $ink >= 0.014) {
            $detected = false;
        } elseif ($conf < 0.58 && $strokes < 3 && $ink < 0.032) {
            $detected = false;
        } elseif ($ink > 0.11 && $strokes >= 6) {
            $detected = false;
        }
    } elseif (is_array($phpScan) && !empty($phpScan['detected'])) {
        $phpConf = (float)($phpScan['confidence'] ?? 0.0);
        $phpInk = (float)($phpScan['ink_ratio'] ?? 0.0);
        $phpStrokes = (int)($phpScan['stroke_components'] ?? 0);
        if ($phpConf >= 0.46 && $phpInk >= 0.024 && $phpStrokes >= 2 && $phpStrokes <= 12) {
            $detected = true;
            $conf = max($conf, $phpConf);
            if (empty($sig['bbox']) && !empty($phpScan['bbox']) && is_array($phpScan['bbox'])) {
                $sig['bbox'] = $phpScan['bbox'];
            }
            $sig['note'] = 'Handwriting detected (secondary image scan)';
        }
    }

    $sig['detected'] = $detected;
    $sig['confidence'] = round($conf, 2);
    $sig['refined'] = true;
    $sig['scan_method'] = 'visual';

    return $sig;
}

/**
 * Lightweight signature ink scan using PHP GD (good moral certificates).
 *
 * @return array<string, mixed>|null
 */
function aiPhpVisualSignatureScan(?string $fullPath): ?array
{
    if ($fullPath === null || !is_file($fullPath) || !extension_loaded('gd')) {
        return null;
    }

    $ext = strtolower(pathinfo($fullPath, PATHINFO_EXTENSION));
    $img = match ($ext) {
        'jpg', 'jpeg' => @imagecreatefromjpeg($fullPath),
        'png' => @imagecreatefrompng($fullPath),
        'webp' => function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($fullPath) : false,
        default => false,
    };
    if ($img === false) {
        return null;
    }

    $w = imagesx($img);
    $h = imagesy($img);
    if ($w < 40 || $h < 40) {
        imagedestroy($img);
        return null;
    }

    $best = [
        'detected' => false,
        'confidence' => 0.0,
        'ink_ratio' => 0.0,
        'stroke_components' => 0,
        'bbox' => null,
    ];

    $bandTop = (int)round($h * 0.42);
    $bandBottom = (int)round($h * 0.82);
    $winW = max(48, (int)round($w * 0.34));
    $winH = max(28, (int)round($h * 0.10));
    $xFracs = [0.30, 0.42, 0.54, 0.66];

    foreach ($xFracs as $frac) {
        $x = max(0, min((int)round($w * $frac), $w - $winW));
        $y = max($bandTop, min($bandBottom - $winH, (int)round(($bandTop + $bandBottom - $winH) / 2)));
        $stats = aiRefineRoiInkStats($img, $x, $y, $winW, $winH);
        if ($stats === null) {
            continue;
        }

        $score = 0.0;
        if ($stats['ink_ratio'] >= 0.024) {
            $score += 0.24;
        }
        if ($stats['ink_ratio'] >= 0.032) {
            $score += 0.16;
        }
        if ($stats['components'] >= 2) {
            $score += 0.22;
        }
        if ($stats['components'] >= 4) {
            $score += 0.10;
        }
        if ($stats['variance'] >= 120.0) {
            $score += 0.12;
        }
        if ($stats['wide_rows'] >= 2 && $stats['components'] >= 6) {
            $score -= 0.35;
        }

        $confidence = max(0.0, min(1.0, $score));
        $detected = $confidence >= 0.48
            && $stats['ink_ratio'] >= 0.024
            && $stats['ink_ratio'] <= 0.10
            && $stats['components'] >= 2
            && $stats['components'] <= 14
            && !($stats['wide_rows'] >= 2 && $stats['components'] >= 6);

        if ($confidence > (float)$best['confidence'] || ($detected && empty($best['detected']))) {
            $best = [
                'detected' => $detected,
                'confidence' => round($confidence, 2),
                'ink_ratio' => round($stats['ink_ratio'], 4),
                'stroke_components' => $stats['components'],
                'bbox' => ['x' => (float)$x, 'y' => (float)$y, 'w' => (float)$winW, 'h' => (float)$winH],
            ];
        }
    }

    imagedestroy($img);

    if ((float)$best['confidence'] <= 0.0) {
        return null;
    }

    $best['scan_method'] = 'php_gd';
    return $best;
}

/**
 * @return array{ink_ratio: float, components: int, variance: float, wide_rows: int}|null
 */
function aiRefineRoiInkStats(\GdImage $img, int $x, int $y, int $w, int $h): ?array
{
    $roi = @imagecrop($img, ['x' => $x, 'y' => $y, 'width' => $w, 'height' => $h]);
    if ($roi === false) {
        return null;
    }

    $pixels = [];
    $dark = 0;
    $total = max(1, $w * $h);
    $rowDark = array_fill(0, $h, 0);

    for ($row = 0; $row < $h; $row++) {
        for ($col = 0; $col < $w; $col++) {
            $rgb = imagecolorat($roi, $col, $row);
            $r = ($rgb >> 16) & 0xFF;
            $g = ($rgb >> 8) & 0xFF;
            $b = $rgb & 0xFF;
            $lum = (0.299 * $r) + (0.587 * $g) + (0.114 * $b);
            $pixels[] = $lum;
            if ($lum < 145) {
                $dark++;
                $rowDark[$row]++;
            }
        }
    }
    imagedestroy($roi);

    if ($pixels === []) {
        return null;
    }

    $mean = array_sum($pixels) / count($pixels);
    $variance = 0.0;
    foreach ($pixels as $lum) {
        $variance += ($lum - $mean) ** 2;
    }
    $variance /= max(1, count($pixels));

    $inkRatio = $dark / $total;
    $wideRows = 0;
    foreach ($rowDark as $count) {
        if ($count >= max(8, (int)round($w * 0.35))) {
            $wideRows++;
        }
    }

    $grid = 8;
    $cellW = max(1, (int)floor($w / $grid));
    $cellH = max(1, (int)floor($h / $grid));
    $components = 0;
    for ($gy = 0; $gy < $grid; $gy++) {
        for ($gx = 0; $gx < $grid; $gx++) {
            $cx = $gx * $cellW;
            $cy = $gy * $cellH;
            $cw = min($cellW, $w - $cx);
            $ch = min($cellH, $h - $cy);
            $cellDark = 0;
            $cellTotal = max(1, $cw * $ch);
            for ($row = $cy; $row < $cy + $ch; $row++) {
                for ($col = $cx; $col < $cx + $cw; $col++) {
                    $rgb = imagecolorat($img, $x + $col, $y + $row);
                    $r = ($rgb >> 16) & 0xFF;
                    $g = ($rgb >> 8) & 0xFF;
                    $b = $rgb & 0xFF;
                    $lum = (0.299 * $r) + (0.587 * $g) + (0.114 * $b);
                    if ($lum < 145) {
                        $cellDark++;
                    }
                }
            }
            if (($cellDark / $cellTotal) >= 0.08) {
                $components++;
            }
        }
    }

    return [
        'ink_ratio' => $inkRatio,
        'components' => $components,
        'variance' => $variance,
        'wide_rows' => $wideRows,
    ];
}

/**
 * @param array<string, mixed> $result
 * @param array<string, string> $expectedContext
 * @return array<string, mixed>
 */
function refineAiVerifyResult(array $result, string $docType, ?string $imagePath = null, array $expectedContext = []): array
{
    $dt = aiRefineNormalizeDocType((string)($result['resolved_doc_type'] ?? $docType));
    if ($dt === 'other') {
        $dt = aiRefineNormalizeDocType($docType);
    }

    $ocr = (float)($result['ocr_confidence'] ?? 0.0);
    $expectedByField = [];
    foreach ($expectedContext as $key => $value) {
        $val = trim((string)$value);
        if ($val === '') {
            continue;
        }
        $expectedByField[strtolower(str_replace('_', ' ', preg_replace('/^expected_/', '', (string)$key) ?? ''))] = $val;
    }

    if (in_array($dt, ['sf9', 'form137', 'good_moral', 'birth_certificate'], true)) {
        $checks = is_array($result['field_checks'] ?? null) ? $result['field_checks'] : [];
        [$checks, $uncertainCount] = aiRefineFieldChecksForTemplate($checks, $ocr, $expectedByField);
        $result['field_checks'] = $checks;

        if ($uncertainCount > 0) {
            $note = match ($dt) {
                'birth_certificate' => 'Some identity fields could not be read on this scan (OCR readability is low). Compare the preview manually or ask for a clearer photo.',
                'good_moral' => 'Some certificate fields could not be read on this school\'s layout or scan. Compare the preview manually or request a clearer upload.',
                default => 'Some fields could not be read on this school\'s form layout. Compare the preview manually or request a clearer upload.',
            };
            $result['layout_recognition_warning'] = true;
            $result['layout_recognition_note'] = $note;
            $issues = is_array($result['issues'] ?? null) ? $result['issues'] : [];
            if (!in_array($note, $issues, true)) {
                $issues[] = $note;
            }
            $result['issues'] = $issues;
        }
    }

    if ($dt === 'good_moral') {
        $phpScan = aiPhpVisualSignatureScan($imagePath);
        $sig = is_array($result['signature_scan'] ?? null) ? $result['signature_scan'] : [];
        $sig = aiRefineSignatureScan($sig, $phpScan);
        $result['signature_scan'] = $sig;

        $checks = is_array($result['field_checks'] ?? null) ? $result['field_checks'] : [];
        $updated = false;
        foreach ($checks as $i => $check) {
            if (!is_array($check)) {
                continue;
            }
            if (strtolower(trim((string)($check['field'] ?? ''))) !== 'signature') {
                continue;
            }
            $checks[$i]['ok'] = !empty($sig['detected']);
            $checks[$i]['detected'] = !empty($sig['detected']) ? 'Found' : 'Not detected';
            $checks[$i]['match_ratio'] = !empty($sig['detected']) ? (float)($sig['confidence'] ?? 0.0) : 0.0;
            $checks[$i]['scan_method'] = 'visual';
            $checks[$i]['refined'] = true;
            if (!empty($sig['bbox']) && is_array($sig['bbox'])) {
                foreach (['x', 'y', 'w', 'h'] as $k) {
                    if (isset($sig['bbox'][$k])) {
                        $checks[$i][$k] = $sig['bbox'][$k];
                    }
                }
            }
            $updated = true;
            break;
        }

        if (!$updated) {
            $row = [
                'field' => 'Signature',
                'expected' => 'Handwritten signature present',
                'detected' => !empty($sig['detected']) ? 'Found' : 'Not detected',
                'ok' => !empty($sig['detected']),
                'match_ratio' => !empty($sig['detected']) ? (float)($sig['confidence'] ?? 0.0) : 0.0,
                'scan_method' => 'visual',
                'refined' => true,
            ];
            if (!empty($sig['bbox']) && is_array($sig['bbox'])) {
                foreach (['x', 'y', 'w', 'h'] as $k) {
                    if (isset($sig['bbox'][$k])) {
                        $row[$k] = $sig['bbox'][$k];
                    }
                }
            }
            $checks[] = $row;
        }

        $result['field_checks'] = $checks;

        $issues = is_array($result['issues'] ?? null) ? $result['issues'] : [];
        $issues = array_values(array_filter(
            $issues,
            static fn ($issue): bool => !is_string($issue) || stripos($issue, 'signature scan:') === false
        ));
        if (empty($sig['detected'])) {
            $issues[] = 'Signature scan: no handwritten signature detected in the signature area.';
        }
        $result['issues'] = $issues;
    }

    $expectedSchoolYear = trim((string)($expectedContext['expected_school_year'] ?? ($expectedByField['school year'] ?? '')));
    if ($expectedSchoolYear !== '' && in_array($dt, ['sf9', 'form137', 'good_moral', 'sf10', 'report_card', 'form157'], true)) {
        $checks = is_array($result['field_checks'] ?? null) ? $result['field_checks'] : [];
        $result['field_checks'] = aiRefineSchoolYearFieldChecks($checks, $expectedSchoolYear);
    }

    $result['refine_v'] = 1;
    return $result;
}

/**
 * @param array<string, mixed> $autoExpected
 * @return array<string, string>
 */
function aiRefineSchoolYearMatch(string $expected, string $detected): ?bool
{
    $exp = trim($expected);
    $det = trim($detected);
    if ($exp === '' || $det === '') {
        return null;
    }
    if (strcasecmp($exp, $det) === 0) {
        return true;
    }
    if (
        preg_match('/^(\d{4})-(\d{4})$/', $exp, $em) === 1
        && preg_match('/^(\d{4})-(\d{4})$/', $det, $dm) === 1
    ) {
        return $em[1] === $dm[1] && $em[2] === $dm[2];
    }

    return null;
}

/**
 * Reconcile cached school-year checks with the current enrollment form (no AI rerun).
 *
 * @param list<array<string, mixed>> $fieldChecks
 * @return list<array<string, mixed>>
 */
function aiRefineSchoolYearFieldChecks(array $fieldChecks, string $expectedSchoolYear): array
{
    $expectedSchoolYear = trim($expectedSchoolYear);
    if ($expectedSchoolYear === '') {
        return $fieldChecks;
    }

    foreach ($fieldChecks as $i => $check) {
        if (!is_array($check)) {
            continue;
        }
        if (strtolower(trim((string)($check['field'] ?? ''))) !== 'school year') {
            continue;
        }
        $detected = trim((string)($check['detected'] ?? ''));
        $fieldChecks[$i]['expected'] = $expectedSchoolYear;
        $rematch = aiRefineSchoolYearMatch($expectedSchoolYear, $detected);
        if ($rematch !== null) {
            $fieldChecks[$i]['ok'] = $rematch;
            $fieldChecks[$i]['match_ratio'] = $rematch ? 1.0 : 0.0;
            $fieldChecks[$i]['refined'] = true;
        }
        break;
    }

    return $fieldChecks;
}

/**
 * @param array<string, mixed> $autoExpected
 * @return array<string, string>
 */
function aiRefineExpectedContextFromAuto(array $autoExpected): array
{
    $out = [];
    foreach ($autoExpected as $key => $value) {
        if (is_string($value) || is_numeric($value)) {
            $out[(string)$key] = trim((string)$value);
        }
    }

    return $out;
}

function aiRefineResolveDocumentPath(string $relative): ?string
{
    $relative = trim(str_replace('\\', '/', $relative));
    if ($relative === '' || str_contains($relative, '..')) {
        return null;
    }

    $projectRoot = realpath(dirname(__DIR__));
    if ($projectRoot === false) {
        return null;
    }

    $fullPath = realpath($projectRoot . '/' . $relative);
    $allowedBase = realpath($projectRoot . '/uploads/documents');
    $normFull = $fullPath !== false ? strtolower(str_replace('\\', '/', $fullPath)) : '';
    $normAllowed = $allowedBase !== false ? strtolower(str_replace('\\', '/', $allowedBase)) : '';
    $underUploads = $normFull !== '' && $normAllowed !== ''
        && str_starts_with($normFull, rtrim($normAllowed, '/') . '/');
    if (!$underUploads && $normFull !== '') {
        $prefix = strtolower(str_replace('\\', '/', $projectRoot . '/uploads/documents/'));
        $underUploads = str_starts_with($normFull, $prefix);
    }

    if ($fullPath === false || !$underUploads || !is_file($fullPath)) {
        return null;
    }

    return $fullPath;
}
