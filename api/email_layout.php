<?php
declare(strict_types=1);

/**
 * Shared branded HTML layout for NSDGA transactional emails.
 * Matches the OTP verification email styling (maroon header, green accent).
 */

function emailLayoutEscape(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function emailLayoutParagraph(string $text): string
{
    $safe = emailLayoutEscape($text);

    return '<p style="margin:0 0 14px 0;font-size:15px;line-height:1.65;color:#4a5565;">' . $safe . '</p>';
}

/**
 * @param array<int, string> $items
 */
function emailLayoutBulletList(array $items): string
{
    if ($items === []) {
        return '';
    }
    $lis = '';
    foreach ($items as $item) {
        $item = trim((string)$item);
        if ($item === '') {
            continue;
        }
        $lis .= '<li style="margin:0 0 8px 0;font-size:15px;line-height:1.55;color:#4a5565;">'
            . emailLayoutEscape($item) . '</li>';
    }
    if ($lis === '') {
        return '';
    }

    return '<ul style="margin:0 0 16px 0;padding:0 0 0 20px;">' . $lis . '</ul>';
}

/**
 * @param array<int, array{label: string, value: string}> $rows
 */
function emailLayoutCredentialBox(array $rows): string
{
    if ($rows === []) {
        return '';
    }
    $cells = '';
    foreach ($rows as $row) {
        $label = emailLayoutEscape((string)($row['label'] ?? ''));
        $value = emailLayoutEscape((string)($row['value'] ?? ''));
        if ($label === '' && $value === '') {
            continue;
        }
        $cells .=
            '<tr>'
            . '<td style="padding:10px 14px;font-size:13px;font-weight:600;color:#4a5565;width:42%;border-bottom:1px solid #eef0f2;">'
            . $label
            . '</td>'
            . '<td style="padding:10px 14px;font-size:14px;font-weight:700;color:#101828;border-bottom:1px solid #eef0f2;font-family:\'Courier New\',Consolas,monospace;">'
            . $value
            . '</td>'
            . '</tr>';
    }
    if ($cells === '') {
        return '';
    }

    return
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        . 'style="margin:0 0 18px 0;background:#f9fafb;border:1px solid #e7eaee;border-radius:12px;overflow:hidden;">'
        . $cells
        . '</table>';
}

function emailLayoutSectionTitle(string $title): string
{
    return '<p style="margin:18px 0 8px 0;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#2d5016;">'
        . emailLayoutEscape($title) . '</p>';
}

function emailLayoutCallout(string $htmlContent): string
{
    return
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        . 'style="margin:0 0 16px 0;background:#fbfaf5;border:1px solid #efe9d8;border-radius:12px;">'
        . '<tr><td style="padding:14px 16px;font-size:13px;line-height:1.65;color:#4a5565;">'
        . $htmlContent
        . '</td></tr></table>';
}

function emailLayoutButton(string $url, string $label): string
{
    $safeUrl = emailLayoutEscape($url);
    $safeLabel = emailLayoutEscape($label);

    return
        '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 18px 0;">'
        . '<tr><td style="border-radius:10px;background:#8b1538;">'
        . '<a href="' . $safeUrl . '" '
        . 'style="display:inline-block;padding:12px 22px;font-family:Arial,Helvetica,sans-serif;'
        . 'font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">'
        . $safeLabel
        . '</a></td></tr></table>';
}

/**
 * @param string $contentHtml Inner HTML for the main body (paragraphs, lists, boxes).
 */
function renderBrandedEmailHtml(string $eyebrow, string $headline, string $contentHtml, ?string $footerNote = null): string
{
    $maroon = '#8b1538';
    $maroonDark = '#7a1231';
    $green = '#2d5016';
    $ink = '#101828';
    $year = date('Y');
    $safeEyebrow = emailLayoutEscape($eyebrow);
    $safeHeadline = emailLayoutEscape($headline);
    $footer = $footerNote !== null && trim($footerNote) !== ''
        ? emailLayoutParagraph(trim($footerNote))
        : emailLayoutParagraph('This is an automated message from the NSDGA enrollment portal. Please do not reply.');

    return <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light only">
<title>{$safeHeadline}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px;">
<tr>
<td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 6px 24px rgba(16,24,40,0.08);">
<tr>
<td style="height:6px;background:{$green};font-size:0;line-height:0;">&nbsp;</td>
</tr>
<tr>
<td style="background:linear-gradient(135deg,{$maroon} 0%,{$maroonDark} 100%);padding:28px 32px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr>
<td style="font-family:Arial,Helvetica,sans-serif;color:#ffffff;font-size:18px;font-weight:700;line-height:1.3;">
Nuestra Señora De Guia Academy
<div style="font-size:12px;font-weight:600;color:#f4dbe3;letter-spacing:0.06em;text-transform:uppercase;margin-top:4px;">NSDGA Enrollment Portal</div>
</td>
</tr>
</table>
</td>
</tr>
<tr>
<td style="padding:36px 32px 8px 32px;font-family:Arial,Helvetica,sans-serif;">
<p style="margin:0 0 6px 0;font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:{$green};">{$safeEyebrow}</p>
<h1 style="margin:0 0 16px 0;font-size:24px;line-height:1.25;color:{$ink};">{$safeHeadline}</h1>
</td>
</tr>
<tr>
<td style="padding:0 32px 8px 32px;font-family:Arial,Helvetica,sans-serif;">
{$contentHtml}
</td>
</tr>
<tr>
<td style="padding:8px 32px 32px 32px;font-family:Arial,Helvetica,sans-serif;border-top:1px solid #eef0f2;">
{$footer}
<p style="margin:6px 0 0 0;font-size:12px;line-height:1.6;color:#8a94a3;">&copy; {$year} Nuestra Señora De Guia Academy of Marikina. All rights reserved.</p>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>
HTML;
}

/**
 * Build plain-text body from structured parts (used when HTML is primary).
 *
 * @param array<int, string> $paragraphs
 * @param array<int, string> $bullets
 */
function buildPlainEmailBody(array $paragraphs, array $bullets = [], string $signoff = '— Nuestra Señora De Guia Academy'): string
{
    $body = '';
    foreach ($paragraphs as $p) {
        $p = trim((string)$p);
        if ($p !== '') {
            $body .= $p . "\n\n";
        }
    }
    foreach ($bullets as $item) {
        $item = trim((string)$item);
        if ($item !== '') {
            $body .= '  • ' . $item . "\n";
        }
    }
    if ($bullets !== []) {
        $body .= "\n";
    }
    if ($signoff !== '') {
        $body .= $signoff . "\n";
    }

    return trim($body);
}
