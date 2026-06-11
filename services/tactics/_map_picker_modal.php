<?php
/** @var string $lang */
/** @var string $mapPickerId */
/** @var string $mapSelectId */
/** @var string $mapPickerModalId */
$mapPickerId = $mapPickerId ?? 'tacticsAddMapPicker';
$mapSelectId = $mapSelectId ?? 'tacticsAddSlideMap';
$mapPickerModalId = $mapPickerModalId ?? 'tacticsMapPickerModal';
?>
<div class="tactics-map-modal" id="<?php echo htmlspecialchars($mapPickerModalId, ENT_QUOTES, 'UTF-8'); ?>" hidden>
    <div class="tactics-map-modal__backdrop" data-tactics-map-modal-close tabindex="-1" aria-hidden="true"></div>
    <div class="tactics-map-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="<?php echo htmlspecialchars($mapPickerModalId, ENT_QUOTES, 'UTF-8'); ?>Title">
        <header class="tactics-map-modal__header">
            <h2 class="tactics-map-modal__title" id="<?php echo htmlspecialchars($mapPickerModalId, ENT_QUOTES, 'UTF-8'); ?>Title" data-tactics-i18n="changeMap"><?php echo $lang === 'en' ? 'CHANGE MAP' : 'СМЕНИТЬ КАРТУ'; ?></h2>
            <button type="button" class="tactics-map-modal__close" data-tactics-map-modal-close aria-label="<?php echo $lang === 'en' ? 'Close' : 'Закрыть'; ?>"><i class="fas fa-times" aria-hidden="true"></i></button>
        </header>
        <div class="tactics-map-modal__body">
            <div class="tactics-map-modal__left">
                <div class="tactics-map-modal__preview-wrap">
                    <div class="tactics-map-modal__preview-placeholder" data-tactics-map-modal-preview-placeholder>
                        <i class="fas fa-map" aria-hidden="true"></i>
                        <span data-tactics-i18n="mapPreviewPlaceholder"><?php echo $lang === 'en' ? 'No preview' : 'Нет превью'; ?></span>
                    </div>
                    <img class="tactics-map-modal__preview" data-tactics-map-modal-preview alt="" width="320" height="320" decoding="async" hidden>
                </div>
                <div class="tactics-map-modal__game" data-tactics-map-modal-game-field data-tactics-game-field hidden>
                    <div class="tactics-map-picker-tabs recruiting-realm-tabs tactics-map-picker-tabs--game" data-tactics-game-tabs role="tablist"></div>
                </div>
                <label class="tactics-map-modal__mode">
                    <select class="tactics-map-modal__mode-select" data-tactics-map-modal-mode aria-label="<?php echo $lang === 'en' ? 'Battle mode' : 'Режим боя'; ?>"></select>
                </label>
                <div id="tacticsCustomMapUpload" class="tactics-custom-map-upload tactics-map-modal__upload" hidden>
                    <button type="button" class="tactics-custom-map-upload__btn" id="tacticsCustomMapUploadBtn">
                        <i class="fas fa-cloud-upload-alt" aria-hidden="true"></i>
                        <span data-tactics-i18n="uploadCustomMap"><?php echo $lang === 'en' ? 'Upload map' : 'Загрузить карту'; ?></span>
                    </button>
                    <input type="file" id="tacticsCustomMapFile" accept="image/webp,image/png,image/jpeg" hidden>
                    <p class="tactics-custom-map-upload__hint" data-tactics-i18n="uploadCustomMapHint"><?php echo $lang === 'en' ? 'PNG, JPEG or WebP, max 8 MB' : 'PNG, JPEG или WebP, макс. 8 МБ'; ?></p>
                </div>
            </div>
            <div class="tactics-map-modal__right" data-tactics-map-modal-maps-col>
                <input type="search" class="tactics-map-modal__search" data-tactics-map-modal-search autocomplete="off" placeholder="<?php echo $lang === 'en' ? 'Search…' : 'Поиск…'; ?>" data-tactics-i18n-placeholder="searchMaps">
                <div class="tactics-map-modal__list-wrap">
                    <ul class="tactics-map-modal__list" data-tactics-map-modal-list role="listbox" aria-label="<?php echo $lang === 'en' ? 'Maps' : 'Карты'; ?>"></ul>
                </div>
            </div>
        </div>
        <footer class="tactics-map-modal__footer">
            <button type="button" class="tactics-map-modal__confirm" data-tactics-map-modal-confirm>
                <span data-tactics-i18n="changeMapConfirm"><?php echo $lang === 'en' ? 'Change Map' : 'Сменить карту'; ?></span>
                <i class="fas fa-arrow-right" aria-hidden="true"></i>
            </button>
        </footer>
        <div class="tactics-map-picker tactics-map-picker--modal-host" id="<?php echo htmlspecialchars($mapPickerId, ENT_QUOTES, 'UTF-8'); ?>" hidden>
            <label class="tactics-field" data-tactics-map-field hidden>
                <select id="<?php echo htmlspecialchars($mapSelectId, ENT_QUOTES, 'UTF-8'); ?>" class="recruiting-select" data-tactics-map-select>
                    <option value="" disabled selected data-tactics-i18n="loadingMaps"><?php echo $lang === 'en' ? 'Loading maps…' : 'Загрузка карт…'; ?></option>
                </select>
            </label>
        </div>
    </div>
</div>
