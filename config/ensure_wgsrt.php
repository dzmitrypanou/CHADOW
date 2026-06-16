<?php
require_once __DIR__ . '/runtime_flags.php';

function ensure_wgsrt_grades_lang_columns($db): void
{
    static $ensured = false;
    if ($ensured) {
        return;
    }
    $ensured = true;
    if (!chadow_runtime_schema_checks_enabled()) {
        return;
    }

    try {
        $db->query("ALTER TABLE wgsrt_grades ADD COLUMN grade_name_en VARCHAR(255) NULL AFTER grade_name");
    } catch (Throwable $e) {

    }

    try {
        $db->query("ALTER TABLE wgsrt_grades ADD COLUMN description_en TEXT NULL AFTER description");
    } catch (Throwable $e) {

    }
}

