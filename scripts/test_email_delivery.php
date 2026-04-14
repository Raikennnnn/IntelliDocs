<?php
declare(strict_types=1);

if ($argc < 2) {
    echo "Usage: php scripts/test_email_delivery.php recipient@example.com\n";
    exit(1);
}

$recipient = (string)$argv[1];

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../api/mailer.php';

$subject = 'IntelliDocs Email Delivery Test';
$body = "This is a test email from IntelliDocs.\nIf you received this, SMTP/API delivery is working.";

$queueId = queueEmail($pdo, $recipient, $subject, $body);
$sent = processSingleQueuedEmail($pdo, $queueId);

echo $sent
    ? "Email sent successfully. Queue ID: {$queueId}\n"
    : "Email send failed. Check email_queue.last_error for queue ID {$queueId}\n";
