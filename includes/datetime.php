<?php

function abs_utc_offset_label(int $offsetSeconds): string
{
    if ($offsetSeconds === 0) {
        return 'UTC+0';
    }

    $sign = $offsetSeconds > 0 ? '+' : '-';
    $abs = abs($offsetSeconds);
    $hours = intdiv($abs, 3600);
    $minutes = intdiv($abs % 3600, 60);

    if ($minutes === 0) {
        return 'UTC' . $sign . $hours;
    }

    return sprintf('UTC%s%d:%02d', $sign, $hours, $minutes);
}

function abs_format_utc_local(?string $utc, ?string $timezone = null): ?string
{
    $utc = is_string($utc) ? trim($utc) : '';
    if ($utc === '') {
        return null;
    }

    $tzName = $timezone ?: 'Europe/Moscow';

    try {
        $dt = new DateTimeImmutable($utc, new DateTimeZone('UTC'));
        $local = $dt->setTimezone(new DateTimeZone($tzName));
    } catch (Exception $e) {
        return null;
    }

    return $local->format('Y-m-d H:i:s') . ' ' . abs_utc_offset_label($local->getOffset());
}
