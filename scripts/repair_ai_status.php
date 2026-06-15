<?php
require __DIR__ . '/../config/database.php';
require __DIR__ . '/../api/ai_persist.php';

ensureDocumentAiPersistenceSchema($pdo);

$col = $pdo->query(
    "SELECT COLUMN_TYPE FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'documents' AND column_name = 'ai_status'"
)->fetchColumn();
echo "ai_status type after migrate: {$col}\n";

$stmt = $pdo->query(
    "SELECT id, ai_status, ai_score, CHAR_LENGTH(COALESCE(ai_security_json, '')) AS json_len
     FROM documents
     WHERE (ai_status IS NULL OR TRIM(ai_status) = '')
       AND ai_score IS NOT NULL
     ORDER BY id DESC LIMIT 10"
);
foreach ($stmt as $row) {
    $repaired = documentRepairAiStatusFromArtifacts(
        $pdo,
        (int)$row['id'],
        (string)($row['ai_status'] ?? ''),
        null,
        $row['ai_score']
    );
    echo "doc {$row['id']}: repaired status => {$repaired}\n";
}

$check = $pdo->query('SELECT id, ai_status, ai_score FROM documents WHERE id IN (121,124,125)');
foreach ($check as $row) {
    echo json_encode($row) . PHP_EOL;
}
