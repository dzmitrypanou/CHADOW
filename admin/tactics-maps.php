<?php
require_once __DIR__ . '/includes/bootstrap.php';
require_once __DIR__ . '/../config/ensure_map_dictionary.php';
require_once __DIR__ . '/../config/tactics_map_catalog.php';
require_once __DIR__ . '/../includes/tactics_helpers.php';
$_versionRaw = @file_get_contents(__DIR__ . '/../config/version.json');
$_versionData = $_versionRaw ? json_decode($_versionRaw, true) : null;
$appVersion = (is_array($_versionData) && !empty($_versionData['version'])) ? $_versionData['version'] : '3.4.4';

admin_require_web();

$db_error = null;

try {
    ensure_map_dictionary_table($db);
} catch (Exception $e) {
    $db_error = $e->getMessage();
}
?>
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Тактика: карты | Анализ АБС реплеев</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
    <link rel="stylesheet" href="/admin/css/admin.css?v=<?php echo htmlspecialchars($appVersion); ?>">
    <style>
        .tactics-upload-panel {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 0;
            padding: 20px;
            margin-bottom: 24px;
        }
        .tactics-upload-panel h2 {
            margin: 0 0 16px;
            font-size: 1.1rem;
            color: #ffd966;
        }
        .tactics-upload-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 12px;
            align-items: end;
        }
        .tactics-upload-grid .tactics-upload-field--wide {
            grid-column: span 2;
        }
        .tactics-upload-grid .tactics-upload-actions {
            grid-column: 1 / -1;
            display: flex;
            justify-content: flex-start;
        }
        @media (max-width: 992px) {
            .tactics-upload-grid { grid-template-columns: 1fr 1fr; }
            .tactics-upload-grid .tactics-upload-field--wide { grid-column: span 2; }
        }
        @media (max-width: 576px) {
            .tactics-upload-grid { grid-template-columns: 1fr; }
            .tactics-upload-grid .tactics-upload-field--wide { grid-column: span 1; }
        }
        .tactics-upload-field label {
            display: block;
            margin-bottom: 6px;
            font-size: 0.82rem;
            color: #ffd966;
        }
        .tactics-upload-field-hint {
            display: block;
            margin-top: 2px;
            margin-bottom: 6px;
            font-size: 0.76rem;
            line-height: 1.4;
            color: rgba(154, 165, 177, 0.85);
        }
        .tactics-upload-field input[type="number"],
        .tactics-upload-field input[type="text"] {
            width: 100%;
            box-sizing: border-box;
            min-height: 42px;
            padding: 8px 12px;
            border-radius: 0;
            font-size: 0.88rem;
            -moz-appearance: textfield;
            appearance: textfield;
        }
        .tactics-upload-field input[type="number"]::-webkit-outer-spin-button,
        .tactics-upload-field input[type="number"]::-webkit-inner-spin-button {
            -webkit-appearance: none;
            margin: 0;
        }
        .tactics-side-length-input {
            width: 72px;
            min-height: 32px;
            padding: 4px 8px;
            border-radius: 0;
            font-size: 0.82rem;
            -moz-appearance: textfield;
            appearance: textfield;
        }
        .tactics-side-length-input::-webkit-outer-spin-button,
        .tactics-side-length-input::-webkit-inner-spin-button {
            -webkit-appearance: none;
            margin: 0;
        }
        .tactics-maps-page .custom-select select {
            border-radius: 0;
        }
        .tactics-file-field {
            display: flex;
            align-items: center;
            gap: 10px;
            min-height: 42px;
            padding: 6px 12px;
            background: #1a1f24;
            border: 1px solid #2a3138;
            border-radius: 0;
            transition: border-color 0.2s;
        }
        .tactics-file-field:focus-within {
            border-color: #ffd966;
        }
        .tactics-file-field .tactics-file-btn {
            flex: none;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            background: rgba(255, 217, 102, 0.12);
            border: 1px solid rgba(255, 217, 102, 0.35);
            border-radius: 0;
            color: #ffd966;
            font-size: 0.82rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            white-space: nowrap;
        }
        .tactics-file-field .tactics-file-btn:hover {
            background: rgba(255, 217, 102, 0.2);
            border-color: #ffd966;
        }
        .tactics-file-field .tactics-file-input {
            position: absolute;
            width: 0.1px;
            height: 0.1px;
            opacity: 0;
            overflow: hidden;
            z-index: -1;
        }
        .tactics-file-field .tactics-file-name {
            flex: 1;
            min-width: 0;
            font-size: 0.82rem;
            color: #9aa7b2;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .tactics-maps-page .tactics-upload-submit {
            min-width: auto;
            min-height: 42px;
            padding: 10px 20px;
            border-radius: 0;
            font-weight: 600;
            white-space: nowrap;
            align-self: end;
        }
        .tactics-maps-page .tactics-upload-submit:disabled {
            opacity: 0.55;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }
        .tactics-maps-page .tactics-filter-reset {
            min-width: auto;
            min-height: 42px;
            padding: 10px 16px;
            border-radius: 0;
            background: transparent;
        }
        .tactics-maps-page .tactics-filter-reset:hover {
            background: rgba(255, 138, 138, 0.1);
            color: #ff8a8a;
            transform: none;
            box-shadow: none;
        }
        .tactics-maps-page .table-wrapper {
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
        }
        .tactics-maps-page #tactics-maps-table {
            table-layout: fixed;
            min-width: 1020px;
        }
        .tactics-maps-page #tactics-maps-table th:nth-child(1),
        .tactics-maps-page #tactics-maps-table td:nth-child(1) {
            width: 84px;
            min-width: 84px;
        }
        .tactics-maps-page #tactics-maps-table th:nth-child(2),
        .tactics-maps-page #tactics-maps-table td:nth-child(2) {
            width: 11%;
        }
        .tactics-maps-page #tactics-maps-table th:nth-child(3),
        .tactics-maps-page #tactics-maps-table td:nth-child(3) {
            width: 11%;
        }
        .tactics-maps-page #tactics-maps-table th:nth-child(4),
        .tactics-maps-page #tactics-maps-table td:nth-child(4) {
            width: 12%;
        }
        .tactics-maps-page #tactics-maps-table th:nth-child(5),
        .tactics-maps-page #tactics-maps-table td:nth-child(5) {
            width: 14%;
        }
        .tactics-maps-page #tactics-maps-table th:nth-child(6),
        .tactics-maps-page #tactics-maps-table td:nth-child(6) {
            width: 96px;
            min-width: 96px;
            overflow: visible;
            text-overflow: clip;
        }
        .tactics-maps-page #tactics-maps-table th:nth-child(7),
        .tactics-maps-page #tactics-maps-table td:nth-child(7) {
            width: 8%;
        }
        .tactics-maps-page #tactics-maps-table th:nth-child(8),
        .tactics-maps-page #tactics-maps-table td:nth-child(8) {
            width: 180px;
            min-width: 180px;
            overflow: visible;
            text-overflow: clip;
            position: sticky;
            right: 0;
            z-index: 2;
            background: #14181c;
            box-shadow: -6px 0 10px rgba(0, 0, 0, 0.28);
        }
        .tactics-maps-page #tactics-maps-table th:nth-child(8) {
            background: #1a1f24;
            z-index: 3;
        }
        .tactics-maps-page #tactics-maps-table tr:hover td:nth-child(8) {
            background: #1f262c;
        }
        .tactics-maps-page #tactics-maps-table .action-buttons {
            display: flex;
            flex-wrap: nowrap;
            justify-content: flex-start;
            gap: 4px;
        }
        .tactics-maps-page #tactics-maps-table .action-btn {
            min-width: 32px;
            height: 32px;
            padding: 5px 6px;
            flex-shrink: 0;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border-radius: 0;
            text-decoration: none;
        }
        .tactics-maps-page #tactics-maps-table .action-btn.delete:hover {
            background: rgba(255, 138, 138, 0.1);
        }
        .tactics-map-thumb {
            width: 72px;
            height: 72px;
            object-fit: cover;
            border-radius: 0;
            border: 1px solid rgba(255, 255, 255, 0.12);
            background: #1a1f24;
        }

        .tactics-edit-preview {
            display: flex;
            gap: 16px;
            align-items: flex-start;
            margin-bottom: 16px;
        }
        .tactics-edit-preview img {
            width: 120px;
            height: 120px;
            object-fit: cover;
            border: 1px solid rgba(255, 255, 255, 0.12);
            background: #1a1f24;
        }
        .tactics-edit-meta {
            flex: 1;
            min-width: 0;
            font-size: 0.84rem;
            color: #9aa7b2;
            line-height: 1.5;
        }
        .tactics-edit-meta code {
            color: #ffd966;
        }
        .tactics-edit-file-field {
            margin-top: 4px;
        }
        .tactics-edit-map-modal .modal-content {
            max-height: none;
            overflow: visible;
        }
        @media (max-height: 720px) {
            .tactics-edit-map-modal .modal-content {
                max-height: calc(100vh - 32px);
                overflow-y: auto;
            }
        }
        .tactics-spawn-editor-modal .modal-content {
            max-width: 1180px;
            width: min(96vw, 1180px);
            max-height: 92vh;
            padding: 20px 22px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        }
        .tactics-spawn-editor-modal .modal-content h2 {
            margin-bottom: 8px;
            flex: 0 0 auto;
        }
        .tactics-spawn-editor-modal #tacticsSpawnEditorMeta {
            margin-bottom: 12px;
            flex: 0 0 auto;
        }
        .tactics-spawn-editor-layout {
            display: grid;
            grid-template-columns: auto minmax(380px, 1fr);
            gap: 14px;
            align-items: stretch;
            flex: 1 1 auto;
            min-height: 0;
            overflow: hidden;
        }
        @media (max-width: 900px) {
            .tactics-spawn-editor-layout {
                grid-template-columns: 1fr;
                overflow: visible;
            }
        }
        .tactics-spawn-editor-map-col {
            display: flex;
            justify-content: flex-start;
            align-items: flex-start;
            min-width: 0;
            min-height: 0;
        }
        .tactics-spawn-editor-preview {
            position: relative;
            width: min(58vh, 500px);
            max-width: 100%;
            aspect-ratio: 1 / 1;
            flex: 0 0 auto;
            background: #10161d;
            border: 1px solid rgba(255, 255, 255, 0.12);
            overflow: hidden;
            touch-action: none;
        }
        .tactics-spawn-editor-map {
            display: block;
            width: 100%;
            height: 100%;
            object-fit: contain;
            pointer-events: none;
            user-select: none;
        }
        .tactics-spawn-editor-overlay {
            position: absolute;
            inset: 0;
            z-index: 2;
            touch-action: none;
            --spawn-marker-scale: 1;
        }
        .tactics-spawn-editor-point {
            position: absolute;
            width: calc(44px * var(--spawn-marker-scale));
            height: calc(44px * var(--spawn-marker-scale));
            transform: translate(-50%, -50%);
            border-radius: 50%;
            border: 3px solid rgba(255, 255, 255, 0.95);
            box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.35);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            font-weight: 700;
            color: #fff;
            cursor: grab;
            user-select: none;
            box-sizing: border-box;
            padding: 0;
            z-index: 1;
        }
        .tactics-spawn-editor-point.is-base {
            width: calc(56px * var(--spawn-marker-scale));
            height: calc(56px * var(--spawn-marker-scale));
        }
        .tactics-spawn-editor-point.is-encounter-cap {
            width: calc(56px * var(--spawn-marker-scale));
            height: calc(56px * var(--spawn-marker-scale));
            background: rgba(18, 18, 20, 0.92);
            border-color: #c8ced8;
            box-shadow: 0 0 8px rgba(200, 206, 216, 0.35), 0 0 0 1px rgba(0, 0, 0, 0.35);
        }
        .tactics-spawn-editor-point.is-neutral {
            border-radius: 4px;
            transform: translate(-50%, -50%) rotate(45deg);
            width: calc(48px * var(--spawn-marker-scale));
            height: calc(48px * var(--spawn-marker-scale));
        }
        .tactics-spawn-editor-point.is-green:not(.is-base) { background: #36c736; }
        .tactics-spawn-editor-point.is-red:not(.is-base) { background: #e03c3c; }
        .tactics-spawn-editor-point.is-base.is-green {
            background: rgba(18, 18, 20, 0.92);
            border-color: #29d500;
            box-shadow: 0 0 8px rgba(41, 213, 0, 0.42), 0 0 0 1px rgba(0, 0, 0, 0.35);
        }
        .tactics-spawn-editor-point.is-base.is-red {
            background: rgba(18, 18, 20, 0.92);
            border-color: #e03c3c;
            box-shadow: 0 0 8px rgba(224, 60, 60, 0.42), 0 0 0 1px rgba(0, 0, 0, 0.35);
        }
        .tactics-spawn-flag {
            display: block;
            width: 41.6%;
            height: 41.6%;
            flex-shrink: 0;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cpath fill='%23fff' d='M7.85 4.9m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0M7.25 6.1h1.2v21.9H7.25zM8.75 7.6L24.75 7.6 19.25 11.1 24.75 14.6 8.75 14.6z'/%3E%3C/svg%3E");
            background-size: contain;
            background-repeat: no-repeat;
            background-position: center;
            filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.45));
            pointer-events: none;
        }
        .tactics-spawn-base-number {
            font-size: clamp(14px, 42%, 28px);
            font-weight: 700;
            line-height: 1;
            color: #fff;
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.55);
            pointer-events: none;
        }
        .tactics-spawn-editor-props {
            display: none;
        }
        .tactics-spawn-editor-props[hidden] {
            display: none !important;
        }
        .tactics-spawn-editor-point.is-neutral-color { background: #8b93a7; }
        .tactics-spawn-editor-point.is-selected {
            z-index: 3;
            box-shadow: 0 0 0 2px #ffd966, 0 0 0 5px rgba(0, 0, 0, 0.35);
        }
        .tactics-spawn-editor-point.is-dragging { cursor: grabbing; z-index: 4; }
        .tactics-spawn-editor-side {
            display: flex;
            flex-direction: column;
            gap: 10px;
            min-height: 0;
            min-width: 0;
            overflow: hidden;
        }
        .tactics-spawn-editor-toolbar {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 6px;
            flex: 0 0 auto;
        }
        .tactics-spawn-editor-toolbar--compact {
            grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .tactics-spawn-editor-point-props {
            --spawn-props-h: 26px;
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 8px 10px;
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid rgba(255, 255, 255, 0.08);
            flex: 0 0 auto;
            min-width: 0;
        }
        .tactics-spawn-editor-point-props[hidden] {
            display: none !important;
        }
        .tactics-spawn-editor-point-props__group {
            display: flex;
            align-items: center;
            gap: 4px;
            min-width: 0;
            flex: 1 1 0;
        }
        .tactics-spawn-editor-point-props__group--base {
            flex: 0 0 76px;
        }
        .tactics-spawn-editor-point-props__group--base.is-disabled .tactics-spawn-editor-point-props__label {
            opacity: 0.45;
        }
        .tactics-spawn-editor-point-props__label {
            font-size: 11px;
            font-weight: 600;
            color: #9aa7b2;
            white-space: nowrap;
            flex-shrink: 0;
        }
        .tactics-spawn-editor-point-props__slider-wrap {
            flex: 1 1 auto;
            min-width: 42px;
            height: var(--spawn-props-h);
            display: flex;
            align-items: center;
        }
        .tactics-spawn-editor-point-props__slider {
            -webkit-appearance: none;
            appearance: none;
            width: 100%;
            height: var(--spawn-props-h);
            margin: 0;
            padding: 0;
            border: none;
            background: transparent;
            cursor: pointer;
            outline: none;
        }
        .tactics-spawn-editor-point-props__slider::-webkit-slider-runnable-track {
            height: 4px;
            border-radius: 2px;
            background: linear-gradient(
                to right,
                #ffd966 0%,
                #ffd966 var(--range-pct, 50%),
                #2a3138 var(--range-pct, 50%),
                #2a3138 100%
            );
        }
        .tactics-spawn-editor-point-props__slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            box-sizing: border-box;
            width: 14px;
            height: 14px;
            margin-top: -5px;
            border-radius: 50%;
            background: #ffd966;
            border: 2px solid #14181c;
            box-shadow: 0 0 0 1px rgba(255, 217, 102, 0.4);
            cursor: grab;
            transition: box-shadow 0.15s ease;
        }
        .tactics-spawn-editor-point-props__slider:active::-webkit-slider-thumb {
            cursor: grabbing;
            box-shadow: 0 0 0 3px rgba(255, 217, 102, 0.22);
        }
        .tactics-spawn-editor-point-props__slider:focus-visible::-webkit-slider-thumb {
            box-shadow: 0 0 0 3px rgba(255, 217, 102, 0.28);
        }
        .tactics-spawn-editor-point-props__slider::-moz-range-track {
            height: 4px;
            border-radius: 2px;
            background: #2a3138;
            border: none;
        }
        .tactics-spawn-editor-point-props__slider::-moz-range-progress {
            height: 4px;
            border-radius: 2px 0 0 2px;
            background: #ffd966;
            border: none;
        }
        .tactics-spawn-editor-point-props__slider::-moz-range-thumb {
            box-sizing: border-box;
            width: 14px;
            height: 14px;
            border: 2px solid #14181c;
            border-radius: 50%;
            background: #ffd966;
            box-shadow: 0 0 0 1px rgba(255, 217, 102, 0.4);
            cursor: grab;
        }
        .tactics-spawn-editor-point-props__slider:active::-moz-range-thumb {
            cursor: grabbing;
        }
        .tactics-spawn-editor-point-props__value {
            min-width: 30px;
            height: var(--spawn-props-h);
            display: inline-flex;
            align-items: center;
            justify-content: flex-end;
            font-size: 11px;
            font-weight: 600;
            color: #c8d0d8;
            font-variant-numeric: tabular-nums;
            flex-shrink: 0;
        }
        .tactics-spawn-editor-point-props__reset {
            box-sizing: border-box;
            width: var(--spawn-props-h);
            min-width: var(--spawn-props-h);
            max-width: var(--spawn-props-h);
            height: var(--spawn-props-h);
            padding: 0;
            margin: 0;
            flex: 0 0 var(--spawn-props-h);
            border: 1px solid #2a3138;
            border-radius: 6px;
            background: #1a1f24;
            color: #9aa7b2;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            line-height: 1;
            transition: border-color 0.15s, color 0.15s, background 0.15s;
        }
        .tactics-spawn-editor-point-props__reset:hover {
            border-color: #ffd966;
            color: #ffd966;
            background: #22282e;
            transform: none;
            box-shadow: none;
        }
        .tactics-spawn-editor-point-props__reset:focus {
            outline: none;
        }
        .tactics-spawn-editor-point-props__reset:focus-visible {
            outline: none;
            border-color: #ffd966;
            box-shadow: 0 0 0 2px rgba(255, 217, 102, 0.28);
        }
        .tactics-spawn-editor-point-props__reset i {
            font-size: 10px;
            pointer-events: none;
        }
        .tactics-spawn-editor-point-props__group--base input[type="text"] {
            width: 100%;
            min-width: 0;
            box-sizing: border-box;
            height: var(--spawn-props-h);
            min-height: var(--spawn-props-h);
            padding: 0 6px;
            border: 1px solid #2a3138;
            border-radius: 6px;
            background: #1a1f24;
            color: #e8eef2;
            font-size: 0.82rem;
            line-height: 1;
        }
        .tactics-spawn-editor-point-props__group--base input[type="text"]:focus {
            outline: none;
            border-color: #ffd966;
        }
        .tactics-spawn-editor-point-props__group--base input[type="text"]:disabled {
            opacity: 0.45;
            cursor: not-allowed;
            background: #15191d;
            border-color: #22282e;
        }
        .tactics-spawn-editor-point-props__group--base input[type="text"]:disabled:focus {
            border-color: #22282e;
        }
        .tactics-spawn-editor-toolbar .btn {
            padding: 8px 10px;
            font-size: 0.8rem;
            white-space: nowrap;
        }
        .tactics-spawn-editor-list {
            flex: 1 1 0;
            min-height: 0;
            overflow-x: hidden;
            overflow-y: auto;
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.02);
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 1px;
            padding: 1px;
            align-content: start;
            scrollbar-width: thin;
            scrollbar-color: #ffd966 rgba(255, 255, 255, 0.06);
        }
        .tactics-spawn-editor-list::-webkit-scrollbar {
            width: 8px;
        }
        .tactics-spawn-editor-list::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.04);
            border-radius: 4px;
        }
        .tactics-spawn-editor-list::-webkit-scrollbar-thumb {
            background: linear-gradient(180deg, #ffd966 0%, #e6b800 100%);
            border-radius: 4px;
            border: 1px solid rgba(0, 0, 0, 0.18);
        }
        .tactics-spawn-editor-list::-webkit-scrollbar-thumb:hover {
            background: linear-gradient(180deg, #ffe699 0%, #ffd966 100%);
        }
        .tactics-spawn-editor-list button {
            display: block;
            width: 100%;
            text-align: left;
            padding: 7px 9px;
            border: none;
            background: rgba(12, 16, 20, 0.72);
            color: #d5dde5;
            font-size: 0.76rem;
            line-height: 1.25;
            cursor: pointer;
        }
        .tactics-spawn-editor-list button.is-active {
            background: rgba(255, 217, 102, 0.16);
            color: #ffd966;
        }
        @media (max-width: 1050px) {
            .tactics-spawn-editor-list {
                grid-template-columns: 1fr;
            }
        }
        .tactics-spawn-editor-hint {
            font-size: 0.72rem;
            color: #9aa7b2;
            line-height: 1.35;
            flex: 0 0 auto;
            margin: 0;
        }
        .tactics-spawn-editor-point-props,
        .tactics-spawn-editor-toolbar,
        .tactics-spawn-editor-toolbar--compact {
            flex-shrink: 0;
        }
        .tactics-spawn-editor-actions {
            display: flex;
            gap: 10px;
            flex: 0 0 auto;
            margin-top: auto;
        }
    </style>
    <?php require __DIR__ . '/includes/csrf_head.php'; ?>
</head>
<body class="tactics-maps-page">
    <div class="container">
        <div class="header">
            <h1>
                <i class="fas fa-map-marked-alt" style="color: #ffd966;"></i>
                Тактический планшет — карты
            </h1>
            <?php $navCurrent = 'tactics-maps'; include __DIR__ . '/includes/header_nav.php'; ?>
        </div>

        <?php if ($db_error !== null): ?>
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle"></i>
                Ошибка: <?php echo htmlspecialchars($db_error); ?>
            </div>
        <?php else: ?>
            <div class="tactics-upload-panel">
                <h2><i class="fas fa-plus-circle"></i> Добавить карту</h2>
                <form id="tacticsMapUploadForm" class="tactics-upload-grid" novalidate>
                    <div class="tactics-upload-field">
                        <label for="tacticsUploadGame">Игра</label>
                        <div class="custom-select">
                            <select id="tacticsUploadGame" name="game" required>
                                <?php foreach (TACTICS_GAMES as $game): ?>
                                    <option value="<?php echo htmlspecialchars($game, ENT_QUOTES, 'UTF-8'); ?>">
                                        <?php echo htmlspecialchars(tactics_game_label($game), ENT_QUOTES, 'UTF-8'); ?>
                                    </option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                    </div>
                    <div class="tactics-upload-field">
                        <label for="tacticsUploadMode" id="tacticsUploadModeLabel">Режим боя</label>
                        <div class="custom-select">
                            <select id="tacticsUploadMode" name="battle_mode" required>
                                <?php foreach (tactics_game_modes('wot') as $mode): ?>
                                    <option value="<?php echo htmlspecialchars($mode, ENT_QUOTES, 'UTF-8'); ?>">
                                        <?php echo htmlspecialchars(tactics_battle_mode_label($mode, 'ru', 'wot'), ENT_QUOTES, 'UTF-8'); ?>
                                    </option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                    </div>
                    <div class="tactics-upload-field">
                        <label for="tacticsUploadSideLength" id="tacticsUploadSideLengthLabel">Размер поля (м)</label>
                        <span class="tactics-upload-field-hint" id="tacticsUploadSideLengthHint"></span>
                        <input type="number" id="tacticsUploadSideLength" name="side_length" min="100" max="20000" step="1" value="1000" required>
                    </div>
                    <div class="tactics-upload-field tactics-upload-field--wide">
                        <label for="tacticsUploadName">Название карты</label>
                        <input type="text" id="tacticsUploadName" name="display_name_ru" maxlength="255" autocomplete="off" placeholder="Например: Вестфилд">
                    </div>
                    <div class="tactics-upload-field">
                        <label for="tacticsUploadNameEn">Название (EN)</label>
                        <input type="text" id="tacticsUploadNameEn" name="display_name_en" maxlength="255" autocomplete="off" placeholder="Необязательно">
                    </div>
                    <div class="tactics-upload-field tactics-upload-field--wide">
                        <label for="tacticsUploadCode">Код карты</label>
                        <input type="text" id="tacticsUploadCode" name="map_code" maxlength="64" pattern="[a-zA-Z0-9_\-]{0,64}" placeholder="Сгенерируется автоматически (латиница, цифры, _)">
                    </div>
                    <div class="tactics-upload-field tactics-upload-field--wide">
                        <label for="tacticsUploadFile">Изображение (WebP, PNG, JPEG)</label>
                        <div class="tactics-file-field">
                            <label for="tacticsUploadFile" class="tactics-file-btn">
                                <i class="fas fa-folder-open" aria-hidden="true"></i>
                                Выбрать файл
                            </label>
                            <input type="file" id="tacticsUploadFile" class="tactics-file-input" name="image" accept="image/webp,image/png,image/jpeg" required>
                            <span class="tactics-file-name" id="tacticsUploadFileName">Файл не выбран</span>
                        </div>
                    </div>
                    <div class="tactics-upload-actions">
                        <button type="submit" class="btn btn-primary tactics-upload-submit" id="tacticsUploadBtn">
                            <i class="fas fa-plus" aria-hidden="true"></i>
                            Добавить
                        </button>
                    </div>
                </form>
                <p style="margin: 12px 0 0; font-size: 0.82rem; color: #9aa5b1;">
                    Карта появится в тактике только в выбранном режиме и игре. Одинаковые названия допустимы — для каждой версии создаётся свой код.
                    Файл: <code>assets/tactics/maps/{игра}/{режим}/{код}.webp</code>.
                    PNG и JPEG автоматически конвертируются в WebP. Макс. <?php echo tactics_map_upload_max_mb(); ?> МБ.
                </p>
            </div>

            <div class="search-section">
                <div class="filters-group">
                    <input type="text" id="tacticsMapsSearch" class="search-input" placeholder="Поиск по коду или названию...">
                    <div class="custom-select">
                        <select id="tacticsMapsGameFilter" title="Игра">
                            <option value="">Все игры</option>
                            <?php foreach (TACTICS_GAMES as $game): ?>
                                <option value="<?php echo htmlspecialchars($game, ENT_QUOTES, 'UTF-8'); ?>">
                                    <?php echo htmlspecialchars(tactics_game_label($game), ENT_QUOTES, 'UTF-8'); ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <div class="custom-select">
                        <select id="tacticsMapsModeFilter" title="Режим">
                            <option value="">Все режимы</option>
                        </select>
                    </div>
                    <button type="button" class="btn btn-danger tactics-filter-reset" id="tacticsMapsResetFilters" title="Сбросить фильтры">
                        <i class="fas fa-times" aria-hidden="true"></i>
                        Сбросить
                    </button>
                </div>
            </div>

            <div class="table-wrapper">
                <table id="tactics-maps-table">
                    <thead>
                        <tr>
                            <th>Превью</th>
                            <th>Игра</th>
                            <th>Режим</th>
                            <th>Код</th>
                            <th>Название</th>
                            <th>Размер поля</th>
                            <th>Файл</th>
                            <th>Действия</th>
                        </tr>
                    </thead>
                    <tbody id="tacticsMapsTableBody">
                        <tr><td colspan="8" style="text-align: center;">Загрузка...</td></tr>
                    </tbody>
                </table>
            </div>

            <div class="modal tactics-edit-map-modal" id="tacticsEditMapModal">
                <div class="modal-content">
                    <h2><i class="fas fa-edit"></i> Редактировать карту</h2>
                    <form id="tacticsEditMapForm">
                        <input type="hidden" name="map_code" id="tacticsEditMapCode">
                        <input type="hidden" name="game" id="tacticsEditMapGame">
                        <input type="hidden" name="battle_mode" id="tacticsEditMapMode">
                        <div class="tactics-edit-preview">
                            <img id="tacticsEditMapPreview" src="" alt="" width="120" height="120">
                            <div class="tactics-edit-meta">
                                <div>Код: <code id="tacticsEditMapCodeLabel"></code></div>
                                <div>Игра: <span id="tacticsEditMapGameLabel"></span></div>
                                <div>Режим: <span id="tacticsEditMapModeLabel"></span></div>
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="tacticsEditMapNameRu">Название карты</label>
                            <input type="text" name="display_name_ru" id="tacticsEditMapNameRu" maxlength="255" required autocomplete="off">
                        </div>
                        <div class="form-group">
                            <label for="tacticsEditMapNameEn">Название (EN)</label>
                            <input type="text" name="display_name_en" id="tacticsEditMapNameEn" maxlength="255" autocomplete="off">
                        </div>
                        <div class="form-group">
                            <label for="tacticsEditMapSideLength" id="tacticsEditMapSideLengthLabel">Размер поля (м)</label>
                            <span class="tactics-upload-field-hint" id="tacticsEditMapSideLengthHint"></span>
                            <input type="number" name="side_length" id="tacticsEditMapSideLength" min="100" max="20000" step="1" required>
                        </div>
                        <div class="form-group tactics-edit-file-field">
                            <label for="tacticsEditMapFile">Новое изображение (необязательно)</label>
                            <div class="tactics-file-field">
                                <label for="tacticsEditMapFile" class="tactics-file-btn">
                                    <i class="fas fa-folder-open" aria-hidden="true"></i>
                                    Выбрать файл
                                </label>
                                <input type="file" id="tacticsEditMapFile" class="tactics-file-input" name="image" accept="image/webp,image/png,image/jpeg">
                                <span class="tactics-file-name" id="tacticsEditMapFileName">Файл не выбран</span>
                            </div>
                        </div>
                        <div style="display: flex; gap: 10px; margin-top: 20px;">
                            <button type="submit" class="btn btn-primary" id="tacticsEditMapSubmit" style="flex: 1;">
                                <i class="fas fa-save"></i> Сохранить
                            </button>
                            <button type="button" class="btn" id="tacticsEditMapCancel">
                                <i class="fas fa-times"></i> Отмена
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <div class="modal tactics-spawn-editor-modal" id="tacticsSpawnEditorModal">
                <div class="modal-content">
                    <h2><i class="fas fa-map-pin"></i> Респы и базы</h2>
                    <p class="tactics-spawn-editor-hint" id="tacticsSpawnEditorMeta"></p>
                    <div class="tactics-spawn-editor-layout">
                        <div class="tactics-spawn-editor-map-col">
                            <div class="tactics-spawn-editor-preview" id="tacticsSpawnEditorPreview">
                                <img id="tacticsSpawnEditorMap" class="tactics-spawn-editor-map" src="" alt="">
                                <div class="tactics-spawn-editor-overlay" id="tacticsSpawnEditorOverlay"></div>
                            </div>
                        </div>
                        <div class="tactics-spawn-editor-side">
                            <div class="tactics-spawn-editor-toolbar">
                                <button type="button" class="btn" data-spawn-add="base" data-spawn-team="team1">+ База 1</button>
                                <button type="button" class="btn" data-spawn-add="base" data-spawn-team="team2">+ База 2</button>
                                <button type="button" class="btn" data-spawn-add="spawn" data-spawn-team="team1">+ Респ 1</button>
                                <button type="button" class="btn" data-spawn-add="spawn" data-spawn-team="team2">+ Респ 2</button>
                                <button type="button" class="btn" data-spawn-add="control_point">+ База встречки</button>
                            </div>
                            <div class="tactics-spawn-editor-toolbar tactics-spawn-editor-toolbar--compact">
                                <button type="button" class="btn" id="tacticsSpawnEditorDelete" title="Удалить выбранную"><i class="fas fa-trash-alt"></i> Удалить</button>
                                <button type="button" class="btn" id="tacticsSpawnEditorReset">Сброс точек</button>
                            </div>
                            <div class="tactics-spawn-editor-point-props" id="tacticsSpawnEditorSizeBlock" hidden>
                                <div class="tactics-spawn-editor-point-props__group" title="Размер маркера">
                                    <span class="tactics-spawn-editor-point-props__label">Разм.</span>
                                    <span class="tactics-spawn-editor-point-props__slider-wrap">
                                        <input type="range" id="tacticsSpawnEditorSize" class="tactics-spawn-editor-point-props__slider" min="50" max="200" step="5" value="100" aria-label="Размер маркера">
                                    </span>
                                    <span class="tactics-spawn-editor-point-props__value" id="tacticsSpawnEditorSizeValue">100%</span>
                                    <button type="button" class="tactics-spawn-editor-point-props__reset" id="tacticsSpawnEditorSizeReset" title="Сбросить размер" aria-label="Сбросить размер"><i class="fas fa-undo" aria-hidden="true"></i></button>
                                </div>
                                <div class="tactics-spawn-editor-point-props__group" title="Прозрачность маркера">
                                    <span class="tactics-spawn-editor-point-props__label">Прозр.</span>
                                    <span class="tactics-spawn-editor-point-props__slider-wrap">
                                        <input type="range" id="tacticsSpawnEditorOpacity" class="tactics-spawn-editor-point-props__slider" min="20" max="100" step="5" value="80" aria-label="Прозрачность маркера">
                                    </span>
                                    <span class="tactics-spawn-editor-point-props__value" id="tacticsSpawnEditorOpacityValue">80%</span>
                                    <button type="button" class="tactics-spawn-editor-point-props__reset" id="tacticsSpawnEditorOpacityReset" title="Сбросить прозрачность" aria-label="Сбросить прозрачность"><i class="fas fa-undo" aria-hidden="true"></i></button>
                                </div>
                                <div class="tactics-spawn-editor-point-props__group tactics-spawn-editor-point-props__group--base is-disabled" id="tacticsSpawnEditorProps" title="Номер базы">
                                    <span class="tactics-spawn-editor-point-props__label">№</span>
                                    <input type="text" id="tacticsSpawnEditorBaseNumber" maxlength="3" inputmode="numeric" pattern="[0-9]*" placeholder="1" autocomplete="off" aria-label="Номер базы">
                                </div>
                            </div>
                            <div class="tactics-spawn-editor-list" id="tacticsSpawnEditorList"></div>
                            <p class="tactics-spawn-editor-hint">Перетаскивайте точки на карте. Сохранение — для всех комнат.</p>
                            <div class="tactics-spawn-editor-actions">
                                <button type="button" class="btn btn-primary" id="tacticsSpawnEditorSave" style="flex:1;"><i class="fas fa-save"></i> Сохранить</button>
                                <button type="button" class="btn" id="tacticsSpawnEditorCancel"><i class="fas fa-times"></i></button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        <?php endif; ?>
    </div>
    <?php include __DIR__ . '/includes/footer.php'; ?>
    <?php if ($db_error === null): ?>
        <script>window.TACTICS_MAP_UPLOAD_MAX_BYTES = <?php echo (int) TACTICS_MAP_UPLOAD_MAX_BYTES; ?>;</script>
        <script src="/admin/js/tactics-maps.js?v=<?php echo htmlspecialchars($appVersion); ?>"></script>
    <?php endif; ?>
</body>
</html>
