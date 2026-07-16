<?php
declare(strict_types=1);

/**
 * Registrar Bring a Friend referral ledger.
 *
 * GET  /api/registrar/referral-ledger?school_year=&search=&freebie_status=&incentive_status=
 * POST /api/registrar/referral-ledger  { action, ... }
 */

if (!isset($pdo) || !($pdo instanceof PDO)) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'Database connection unavailable']);
    exit;
}

require_once __DIR__ . '/logging.php';
require_once __DIR__ . '/api_auth.php';
require_once __DIR__ . '/permission_guard.php';
require_once __DIR__ . '/school_year_helpers.php';
require_once __DIR__ . '/referral_promo_helpers.php';

header('Content-Type: application/json');

$actor = apiRequireActor($pdo, 'registrar/referral-ledger');
$actorId = (int)$actor['id'];
$actorRole = (string)$actor['role'];

if (!in_array($actorRole, ['registrar', 'admin'], true)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Access denied']);
    exit;
}

requireActorPermission($pdo, $actor, 'viewApplications');

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $schoolYear = trim((string)($_GET['school_year'] ?? ''));
    if ($schoolYear === '') {
        $schoolYear = trim((string)(getEnrollmentSchoolYear($pdo) ?? ''));
    }
    if ($schoolYear === '') {
        http_response_code(503);
        echo json_encode(['success' => false, 'error' => 'No active enrollment school year configured.']);
        exit;
    }

    $search = trim((string)($_GET['search'] ?? ''));
    $freebieStatus = trim((string)($_GET['freebie_status'] ?? ''));
    $incentiveStatus = trim((string)($_GET['incentive_status'] ?? ''));
    $limit = (int)($_GET['limit'] ?? 50);
    $offset = (int)($_GET['offset'] ?? 0);
    $page = (int)($_GET['page'] ?? 0);
    if ($page > 0) {
        $limit = max(1, min(500, $limit));
        $offset = ($page - 1) * $limit;
    }

    try {
        $result = listReferralPromoClaims(
            $pdo,
            $schoolYear,
            $search,
            $freebieStatus,
            $incentiveStatus,
            $limit,
            $offset
        );
        appLogEvent($pdo, 'referral_ledger_list', 'registrar', 'success', $actorId, 'school_year', $schoolYear);
        echo json_encode([
            'success' => true,
            'schoolYear' => $result['school_year'],
            'claims' => $result['claims'],
            'stats' => $result['stats'],
            'matched' => $result['matched'],
            'limit' => $result['limit'],
            'offset' => $result['offset'],
            'page' => $result['limit'] > 0 ? (int)floor($result['offset'] / $result['limit']) + 1 : 1,
            'totalPages' => $result['limit'] > 0 ? (int)max(1, (int)ceil($result['matched'] / $result['limit'])) : 1,
        ]);
    } catch (Throwable $e) {
        appLogEvent($pdo, 'referral_ledger_list', 'registrar', 'failed', $actorId, 'school_year', $schoolYear, [
            'message' => $e->getMessage(),
        ]);
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to load referral ledger']);
    }
    exit;
}

if ($method === 'POST') {
    $payload = json_decode(file_get_contents('php://input') ?: '{}', true);
    if (!is_array($payload)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid JSON payload']);
        exit;
    }

    $action = strtolower(trim((string)($payload['action'] ?? '')));
    $schoolYear = trim((string)($payload['school_year'] ?? ''));
    if ($schoolYear === '') {
        $schoolYear = trim((string)(getEnrollmentSchoolYear($pdo) ?? ''));
    }

    try {
        if ($action === 'preissue') {
            if ($schoolYear === '') {
                http_response_code(503);
                echo json_encode(['success' => false, 'error' => 'School year is required.']);
                exit;
            }
            $count = (int)($payload['count'] ?? 1);
            $startControl = isset($payload['start_control']) ? (string)$payload['start_control'] : null;
            $result = preissueReferralControlNumbers($pdo, $schoolYear, $count, $startControl);
            if (($result['ok'] ?? false) !== true) {
                http_response_code(409);
                echo json_encode([
                    'success' => false,
                    'error' => (string)($result['error'] ?? 'Failed to pre-issue control numbers.'),
                    'code' => (string)($result['code'] ?? 'preissue_failed'),
                ]);
                exit;
            }
            appLogEvent($pdo, 'referral_ledger_preissue', 'registrar', 'success', $actorId, 'school_year', $schoolYear, [
                'count' => count($result['control_numbers'] ?? []),
                'control_numbers' => $result['control_numbers'] ?? [],
            ]);
            echo json_encode([
                'success' => true,
                'message' => 'Control numbers pre-issued.',
                'controlNumbers' => $result['control_numbers'] ?? [],
            ]);
            exit;
        }

        $claimId = (int)($payload['claim_id'] ?? 0);
        $voidReason = trim((string)($payload['void_reason'] ?? ''));
        $allowedActions = [
            'mark_freebie_given',
            'mark_first_semester_complete',
            'mark_incentive_paid',
            'void',
            'resend_referrer_enrolled_email',
        ];
        if (!in_array($action, $allowedActions, true)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Invalid action.']);
            exit;
        }

        if ($action === 'resend_referrer_enrolled_email') {
            require_once __DIR__ . '/referral_enrolled_email.php';
            ensureReferralPromoSchema($pdo);
            $claimStmt = $pdo->prepare('SELECT * FROM referral_promo_claims WHERE id = :id LIMIT 1');
            $claimStmt->execute([':id' => $claimId]);
            $claimRow = $claimStmt->fetch(PDO::FETCH_ASSOC);
            if (!$claimRow) {
                http_response_code(404);
                echo json_encode(['success' => false, 'error' => 'Referral claim not found.']);
                exit;
            }
            if (empty($claimRow['enrollment_id'])) {
                http_response_code(409);
                echo json_encode(['success' => false, 'error' => 'Claim is not linked to an enrolled student yet.']);
                exit;
            }
            $result = notifyReferrerAfterReferralClaim($pdo, $claimId, [], true);
            if (($result['ok'] ?? false) !== true || empty($result['sent'])) {
                $skip = (string)($result['skipped'] ?? '');
                $err = match ($skip) {
                    'no_email' => 'Referrer has no valid email address.',
                    default => (string)($result['error'] ?? 'Failed to send referrer email.'),
                };
                http_response_code(409);
                echo json_encode(['success' => false, 'error' => $err, 'code' => $skip !== '' ? $skip : 'send_failed']);
                exit;
            }
            $fresh = $pdo->prepare('SELECT c.*, u.full_name AS referred_student_name
                FROM referral_promo_claims c
                LEFT JOIN enrollments e ON e.id = c.enrollment_id
                LEFT JOIN users u ON u.id = e.user_id
               WHERE c.id = :id LIMIT 1');
            $fresh->execute([':id' => $claimId]);
            $freshRow = $fresh->fetch(PDO::FETCH_ASSOC) ?: $claimRow;
            appLogEvent($pdo, 'referral_ledger_update', 'registrar', 'success', $actorId, 'referral_claim', (string)$claimId, [
                'action' => $action,
            ]);
            echo json_encode([
                'success' => true,
                'message' => 'Referrer enrollment email sent.',
                'claim' => referralPromoClaimToApiPayload($freshRow),
            ]);
            exit;
        }

        $result = updateReferralPromoClaimStatus($pdo, $claimId, $action, $voidReason);
        if (($result['ok'] ?? false) !== true) {
            http_response_code(409);
            echo json_encode([
                'success' => false,
                'error' => (string)($result['error'] ?? 'Update failed.'),
                'code' => (string)($result['code'] ?? 'update_failed'),
            ]);
            exit;
        }

        appLogEvent($pdo, 'referral_ledger_update', 'registrar', 'success', $actorId, 'referral_claim', (string)$claimId, [
            'action' => $action,
        ]);
        echo json_encode([
            'success' => true,
            'message' => 'Referral claim updated.',
            'claim' => $result['claim'] ?? [],
        ]);
    } catch (Throwable $e) {
        appLogEvent($pdo, 'referral_ledger_update', 'registrar', 'failed', $actorId, 'referral_claim', (string)($payload['claim_id'] ?? ''), [
            'action' => $action,
            'message' => $e->getMessage(),
        ]);
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to update referral claim']);
    }
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'error' => 'Method not allowed']);
