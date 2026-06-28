<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/api/ai_verify_refine.php';

$payload = [
    'field_checks' => [
        ['field' => 'Name', 'expected' => 'LEA JOY LABWAN-NA JOSE', 'detected' => 'IF IS CY CD', 'ok' => false, 'x' => 10, 'y' => 10, 'w' => 50, 'h' => 20],
        ['field' => 'LRN', 'expected' => '136466130796', 'detected' => '406452150179', 'ok' => false],
        ['field' => 'Sex', 'expected' => 'FEMALE', 'detected' => 'FEMALE', 'ok' => true],
    ],
    'ocr_confidence' => 0.60,
    'resolved_doc_type' => 'sf9',
    'issues' => [],
];

$out = refineAiVerifyResult($payload, 'sf9', null, [
    'expected_name' => 'LEA JOY LABWAN-NA JOSE',
    'expected_lrn' => '136466130796',
]);

foreach ($out['field_checks'] as $check) {
    echo $check['field'], ' ok=', var_export($check['ok'], true), ' detected=', $check['detected'], PHP_EOL;
}
echo 'layout_warning=', var_export($out['layout_recognition_warning'] ?? false, true), PHP_EOL;

$gmPath = dirname(__DIR__) . '/public/admission-samples/good-moral-certificate.jpg';
if (is_file($gmPath)) {
    $gm = [
        'field_checks' => [
            ['field' => 'Signature', 'expected' => 'Handwritten signature present', 'detected' => 'Found', 'ok' => true, 'match_ratio' => 0.44],
        ],
        'signature_scan' => ['detected' => true, 'confidence' => 0.44, 'stroke_components' => 2, 'ink_ratio' => 0.03],
        'ocr_confidence' => 0.8,
        'resolved_doc_type' => 'good_moral',
        'issues' => [],
    ];
    $gmOut = refineAiVerifyResult($gm, 'good_moral', $gmPath, []);
    $sig = null;
    foreach ($gmOut['field_checks'] as $check) {
        if (strtolower((string)($check['field'] ?? '')) === 'signature') {
            $sig = $check;
        }
    }
    echo 'unsigned_sample_sig_ok=', var_export($sig['ok'] ?? null, true), PHP_EOL;
}

$uploadGm = glob(dirname(__DIR__) . '/uploads/documents/**/*goodmoral*.jpg');
if (is_array($uploadGm)) {
    foreach (array_slice($uploadGm, 0, 5) as $path) {
        $phpScan = aiPhpVisualSignatureScan($path);
        echo basename($path), ' php_gd=', var_export($phpScan['detected'] ?? false, true), ' conf=', ($phpScan['confidence'] ?? 0), PHP_EOL;
    }
}
