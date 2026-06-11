<?php

function chadow_http_json_cache_headers(string $etag, int $maxAge): void
{
    if (headers_sent()) {
        return;
    }

    header('Cache-Control: public, max-age=' . max(0, $maxAge));
    header('ETag: "' . $etag . '"');
}

function chadow_http_json_revalidate_headers(string $etag): void
{
    if (headers_sent()) {
        return;
    }

    header('Cache-Control: private, no-cache, must-revalidate');
    header('ETag: "' . $etag . '"');
}

function chadow_http_if_none_match_matches(string $etag): bool
{
    $ifNoneMatch = $_SERVER['HTTP_IF_NONE_MATCH'] ?? '';
    if (!is_string($ifNoneMatch) || trim($ifNoneMatch) === '') {
        return false;
    }

    $normalized = trim($ifNoneMatch, " \t\n\r\0\x0B\"");
    return hash_equals($etag, $normalized);
}

function chadow_emit_not_modified(): void
{
    http_response_code(304);
    exit();
}
