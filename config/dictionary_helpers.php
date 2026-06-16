<?php

function nation_label_map($db) {
    $rows = $db->fetchAll('SELECT nation_code, display_name_ru FROM nation_labels');
    $m = [];
    foreach ($rows as $r) {
        $m[$r['nation_code']] = $r['display_name_ru'];
    }
    return $m;
}

function nation_label_map_en($db): array
{
    $rows = $db->fetchAll('SELECT nation_code, display_name_ru, display_name_en FROM nation_labels');
    $m = [];
    foreach ($rows as $r) {
        $m[$r['nation_code']] = !empty($r['display_name_en']) ? $r['display_name_en'] : (string)$r['display_name_ru'];
    }
    return $m;
}

function tank_type_label_map($db) {
    $rows = $db->fetchAll('SELECT type_code, display_name_ru FROM tank_type_labels');
    $m = [];
    foreach ($rows as $r) {
        $m[$r['type_code']] = $r['display_name_ru'];
    }
    return $m;
}

function tank_type_label_map_en($db): array
{
    $rows = $db->fetchAll('SELECT type_code, display_name_ru, display_name_en FROM tank_type_labels');
    $m = [];
    foreach ($rows as $r) {
        $m[$r['type_code']] = !empty($r['display_name_en']) ? $r['display_name_en'] : (string)$r['display_name_ru'];
    }
    return $m;
}

function resolve_dict_label(array $map, $code) {
    if ($code === null || $code === '') {
        return '';
    }
    return isset($map[$code]) ? $map[$code] : (string) $code;
}

function ensure_nation_label($db, $nationCode, $displayNameRu = null, $displayNameEn = null) {
    $nationCode = strtolower(trim((string) $nationCode));
    if ($nationCode === '' || $nationCode === 'unknown') {
        return;
    }
    if (!preg_match('/^[a-z][a-z0-9_]{0,39}$/', $nationCode)) {
        return;
    }
    if ($displayNameRu === null || $displayNameRu === '') {
        $displayNameRu = $nationCode;
    }

    if ($displayNameEn === null || $displayNameEn === '') {
        $displayNameEn = $displayNameRu;
    }

    $db->query(
        'INSERT IGNORE INTO nation_labels (nation_code, display_name_ru, display_name_en) VALUES (?, ?, ?)',
        [$nationCode, $displayNameRu, $displayNameEn]
    );
}
