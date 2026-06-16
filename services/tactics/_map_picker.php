<?php

$mapPickerId = $mapPickerId ?? 'tacticsMapPicker';
$mapSelectId = $mapSelectId ?? 'tacticsMapSelect';
?>
<div class="tactics-map-picker" id="<?php echo htmlspecialchars($mapPickerId, ENT_QUOTES, 'UTF-8'); ?>">
    <div class="tactics-field" data-tactics-game-field>
        <span class="tactics-field-label" data-tactics-i18n="fieldGame"><?php echo $lang === 'en' ? 'Game' : 'Игра'; ?></span>
        <div class="tactics-map-picker-tabs recruiting-realm-tabs tactics-map-picker-tabs--game" data-tactics-game-tabs role="tablist"></div>
    </div>
    <div class="tactics-field" data-tactics-mode-field>
        <span class="tactics-field-label" data-tactics-mode-field-label data-tactics-i18n="fieldBattleMode"><?php echo $lang === 'en' ? 'Battle mode' : 'Режим боя'; ?></span>
        <div class="tactics-mode-switch tactics-mode-switch--vertical" data-tactics-mode-tabs role="tablist"></div>
    </div>
    <label class="tactics-field" data-tactics-map-field>
        <span class="tactics-field-label" data-tactics-i18n="fieldMap"><?php echo $lang === 'en' ? 'Map' : 'Карта'; ?></span>
        <select id="<?php echo htmlspecialchars($mapSelectId, ENT_QUOTES, 'UTF-8'); ?>" class="recruiting-select" data-tactics-map-select>
            <option value="" disabled selected data-tactics-i18n="loadingMaps"><?php echo $lang === 'en' ? 'Loading maps…' : 'Загрузка карт…'; ?></option>
        </select>
    </label>
</div>
