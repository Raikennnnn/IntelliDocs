<?php
declare(strict_types=1);

/**
 * Canonical SHS strand codes and display names.
 * Mirrors frontend/src/app/lib/strands.ts
 */

const STRAND_CODES = [
    'ASSH',
    'BAE',
    'STEM',
    'TECHPRO - CP',
    'TECHPRO - IT',
    'TECHPRO - HT',
];

/** @var array<string, string> legacy value => canonical code */
const STRAND_LEGACY_ALIASES = [
    'HUMSS' => 'ASSH',
    'ABM' => 'BAE',
    'STEM' => 'STEM',
    'TVL - ICT' => 'TECHPRO - CP',
    'TVL-ICT' => 'TECHPRO - CP',
    'ICT' => 'TECHPRO - CP',
    'TVL - EIM' => 'TECHPRO - IT',
    'TVL-EIM' => 'TECHPRO - IT',
    'EIM' => 'TECHPRO - IT',
    'TVL - BPP/FBS' => 'TECHPRO - HT',
    'TVL-BPP/FBS' => 'TECHPRO - HT',
    'BPP/FBS' => 'TECHPRO - HT',
    'BPP / FBS' => 'TECHPRO - HT',
];

/** Strands that default to boys-first section rosters. */
const STRAND_BOYS_FIRST_CODES = ['TECHPRO - IT'];

function normalizeStrandCode(string $raw): string
{
    $trimmed = trim($raw);
    if ($trimmed === '') {
        return '';
    }
    if (in_array($trimmed, STRAND_CODES, true)) {
        return $trimmed;
    }
    $upper = strtoupper(preg_replace('/\s+/', ' ', $trimmed) ?? $trimmed);
    if (isset(STRAND_LEGACY_ALIASES[$upper])) {
        return STRAND_LEGACY_ALIASES[$upper];
    }
    if (isset(STRAND_LEGACY_ALIASES[$trimmed])) {
        return STRAND_LEGACY_ALIASES[$trimmed];
    }

    return $trimmed;
}

function isBoysFirstStrandCode(string $raw): bool
{
    $code = normalizeStrandCode($raw);

    return in_array($code, STRAND_BOYS_FIRST_CODES, true);
}

/** @return array<string, string> code => full name */
function strandFullNameMap(): array
{
    return [
        'ASSH' => 'Arts, Social Sciences, and Humanities',
        'BAE' => 'Business and Entrepreneurship',
        'STEM' => 'Science, Technology, Engineering, and Mathematics (STEM)',
        'TECHPRO - CP' => 'Computer Programming',
        'TECHPRO - IT' => 'Industrial Technologies',
        'TECHPRO - HT' => 'Hospitality and Tourism',
    ];
}

function formatStrandLabel(string $raw): string
{
    $code = normalizeStrandCode($raw);
    if ($code === '') {
        return '';
    }
    $short = [
        'ASSH' => 'ASSH',
        'BAE' => 'BAE',
        'STEM' => 'STEM',
        'TECHPRO - CP' => 'CP',
        'TECHPRO - IT' => 'IT',
        'TECHPRO - HT' => 'HT',
    ];

    return $short[$code] ?? $code;
}

function formatStrandFullName(string $raw): string
{
    $code = normalizeStrandCode($raw);
    $map = strandFullNameMap();

    return $map[$code] ?? $code;
}
