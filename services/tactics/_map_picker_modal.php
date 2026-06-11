<?php
/** @var string $lang */
/** @var string $mapSelectId */
/** @var string $mapPickerModalId */
$mapSelectId = $mapSelectId ?? 'tacticsAddSlideMap';
$mapPickerModalId = $mapPickerModalId ?? 'tacticsMapPickerModal';
?>
<div class="tactics-map-modal" id="<?php echo htmlspecialchars($mapPickerModalId, ENT_QUOTES, 'UTF-8'); ?>" hidden>
    <div class="tactics-map-modal__backdrop" data-tactics-map-modal-close tabindex="-1" aria-hidden="true"></div>
    <div class="tactics-map-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="<?php echo htmlspecialchars($mapPickerModalId, ENT_QUOTES, 'UTF-8'); ?>Title">
        <header class="tactics-map-modal__header">
            <div class="tactics-map-modal__header-text">
                <h2 class="tactics-map-modal__title" id="<?php echo htmlspecialchars($mapPickerModalId, ENT_QUOTES, 'UTF-8'); ?>Title" data-tactics-i18n="changeMap"><?php echo $lang === 'en' ? 'Change map' : 'Сменить карту'; ?></h2>
                <p class="tactics-map-modal__subtitle" data-tactics-i18n="changeMapHint"><?php echo $lang === 'en' ? 'Choose a map type and preview before applying' : 'Выберите тип карты и проверьте превью перед применением'; ?></p>
            </div>
            <button type="button" class="tactics-map-modal__close" data-tactics-map-modal-close aria-label="<?php echo $lang === 'en' ? 'Close' : 'Закрыть'; ?>"><i class="fas fa-times" aria-hidden="true"></i></button>
        </header>
        <div class="tactics-map-modal__body">
            <div class="tactics-map-modal__left">
                <div class="tactics-map-modal__preview-card">
                    <div class="tactics-map-modal__preview-label" data-tactics-i18n="mapPreviewLabel"><?php echo $lang === 'en' ? 'Preview' : 'Превью'; ?></div>
                    <div class="tactics-map-modal__preview-wrap">
                        <div class="tactics-map-modal__preview-placeholder" data-tactics-map-modal-preview-placeholder>
                            <i class="fas fa-map" aria-hidden="true"></i>
                            <span data-tactics-i18n="mapPreviewPlaceholder"><?php echo $lang === 'en' ? 'No preview' : 'Нет превью'; ?></span>
                        </div>
                        <img class="tactics-map-modal__preview" data-tactics-map-modal-preview alt="" width="320" height="320" decoding="async" hidden>
                    </div>
                </div>
                <div class="tactics-map-modal__game" data-tactics-map-modal-game-field data-tactics-game-field hidden>
                    <div class="tactics-map-picker-tabs recruiting-realm-tabs tactics-map-picker-tabs--game" data-tactics-game-tabs role="tablist"></div>
                </div>
            </div>
            <div class="tactics-map-modal__right">
                <div class="tactics-map-modal__controls">
                    <div class="tactics-map-modal__section">
                        <div class="tactics-map-modal__section-head" data-tactics-i18n="changeMapSettings"><?php echo $lang === 'en' ? 'Map settings' : 'Настройки карты'; ?></div>
                        <label class="tactics-map-modal__field">
                            <span class="tactics-map-modal__field-label" data-tactics-map-modal-mode-label data-tactics-i18n="fieldBattleMode"><?php echo $lang === 'en' ? 'Battle mode' : 'Режим боя'; ?></span>
                            <select class="recruiting-select tactics-map-modal__mode-select" data-tactics-map-modal-mode aria-label="<?php echo $lang === 'en' ? 'Battle mode' : 'Режим боя'; ?>"></select>
                        </label>
                        <label class="tactics-map-modal__field" data-tactics-map-modal-map-field data-tactics-map-field>
                            <span class="tactics-map-modal__field-label" data-tactics-i18n="fieldMap"><?php echo $lang === 'en' ? 'Map' : 'Карта'; ?></span>
                            <select id="<?php echo htmlspecialchars($mapSelectId, ENT_QUOTES, 'UTF-8'); ?>" class="recruiting-select" data-tactics-map-select>
                                <option value="" disabled selected data-tactics-i18n="loadingMaps"><?php echo $lang === 'en' ? 'Loading maps…' : 'Загрузка карт…'; ?></option>
                            </select>
                        </label>
                    </div>
                    <div class="tactics-map-modal__section tactics-map-modal__section--custom" id="tacticsCustomMapPanel" hidden>
                        <div class="tactics-map-modal__section-head" data-tactics-i18n="customMapScaleTitle"><?php echo $lang === 'en' ? 'Map scale' : 'Масштаб карты'; ?></div>
                        <p class="tactics-map-modal__section-hint" data-tactics-i18n="customMapScaleHint"><?php echo $lang === 'en' ? 'Real-world size in meters for ruler and measurements' : 'Реальный размер в метрах для линейки и измерений'; ?></p>
                        <div class="tactics-map-modal__scale-grid">
                            <label class="tactics-map-modal__scale-field">
                                <span class="tactics-map-modal__field-label" data-tactics-i18n="customMapWidth"><?php echo $lang === 'en' ? 'Width, m' : 'Ширина, м'; ?></span>
                                <input type="number" class="tactics-map-modal__scale-input" data-tactics-map-modal-scale-width min="100" max="20000" step="1" value="1000" inputmode="numeric">
                            </label>
                            <label class="tactics-map-modal__scale-field">
                                <span class="tactics-map-modal__field-label" data-tactics-i18n="customMapHeight"><?php echo $lang === 'en' ? 'Height, m' : 'Высота, м'; ?></span>
                                <input type="number" class="tactics-map-modal__scale-input" data-tactics-map-modal-scale-height min="100" max="20000" step="1" value="1000" inputmode="numeric">
                            </label>
                        </div>
                        <button type="button" class="tactics-map-modal__upload" id="tacticsCustomMapUpload" hidden>
                            <span class="tactics-custom-map-upload__icon" aria-hidden="true"><i class="fas fa-cloud-upload-alt"></i></span>
                            <span class="tactics-custom-map-upload__text">
                                <span class="tactics-custom-map-upload__title" data-tactics-i18n="uploadCustomMap"><?php echo $lang === 'en' ? 'Upload map' : 'Загрузить карту'; ?></span>
                                <span class="tactics-custom-map-upload__hint" data-tactics-i18n="uploadCustomMapHint"><?php echo $lang === 'en' ? 'PNG, JPEG or WebP, max 8 MB' : 'PNG, JPEG или WebP, макс. 8 МБ'; ?></span>
                            </span>
                        </button>
                        <input type="file" id="tacticsCustomMapFile" accept="image/webp,image/png,image/jpeg" hidden>
                    </div>
                </div>
            </div>
        </div>
        <footer class="tactics-map-modal__footer">
            <button type="button" class="tactics-map-modal__confirm" data-tactics-map-modal-confirm>
                <span data-tactics-i18n="changeMapConfirm"><?php echo $lang === 'en' ? 'Change map' : 'Сменить карту'; ?></span>
                <i class="fas fa-arrow-right" aria-hidden="true"></i>
            </button>
        </footer>
    </div>
</div>
