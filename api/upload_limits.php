<?php
declare(strict_types=1);

/** Max bytes per student enrollment document upload. */
const MAX_DOCUMENT_UPLOAD_BYTES = 10 * 1024 * 1024;

function maxDocumentUploadLabel(): string
{
    return '10MB';
}

function maxDocumentUploadBytes(): int
{
    return MAX_DOCUMENT_UPLOAD_BYTES;
}

function documentUploadTooLarge(int $sizeBytes): bool
{
    return $sizeBytes <= 0 || $sizeBytes > MAX_DOCUMENT_UPLOAD_BYTES;
}

function documentUploadSizeErrorMessage(): string
{
    return 'File size must be between 1 byte and ' . maxDocumentUploadLabel();
}

function documentUploadTooLargeErrorMessage(): string
{
    return 'File is too large. Maximum size is ' . maxDocumentUploadLabel()
        . ' — try compressing the image or saving as JPG.';
}
