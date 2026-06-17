<?php
/** @var string $lang */
/** @var list<array<string, mixed>> $mods */
$isEn = $lang === 'en';
$meta = wotmods_hub_meta($lang);
?>
            <section class="checkers-panel wotmods-workspace" id="wotmodsInstaller" data-wotmods-installer>
                <header class="wotmods-workspace__head">
                    <h2 class="wotmods-workspace__title"><?php echo htmlspecialchars($meta['title'], ENT_QUOTES, 'UTF-8'); ?></h2>
                    <p class="wotmods-workspace__lead"><?php echo htmlspecialchars($meta['desc'], ENT_QUOTES, 'UTF-8'); ?></p>
                </header>

                <p class="wotmods-workspace__unsupported" id="wotmodsInstallerUnsupported" hidden>
                    <?php echo $isEn
                        ? 'Auto-install works in Chrome and Edge on desktop. Use another browser to download mod files manually.'
                        : 'Автоустановка работает в Chrome и Edge на компьютере. В других браузерах скачайте файлы вручную.'; ?>
                </p>

                <div class="wotmods-steps">
                    <section class="wotmods-step" id="wotmodsStepFolder" aria-labelledby="wotmodsStepFolderTitle">
                        <div class="wotmods-step__head">
                            <span class="wotmods-step__num">1</span>
                            <h3 class="wotmods-step__title" id="wotmodsStepFolderTitle">
                                <?php echo $isEn ? 'Game folder' : 'Папка игры'; ?>
                            </h3>
                        </div>

                        <div class="wotmods-step__body">
                            <div class="wotmods-folder-picker" id="wotmodsFolderPicker">
                                <div class="wotmods-folder-picker__bar" id="wotmodsFolderBar">
                                    <div class="wotmods-folder-picker__leading" aria-hidden="true">
                                        <div class="wotmods-folder-picker__icon-slot">
                                            <i class="fas fa-folder-open wotmods-folder-picker__folder-icon is-visible" id="wotmodsFolderIcon"></i>
                                            <img class="wotmods-folder-picker__game-icon" id="wotmodsGameIcon" width="32" height="32" alt="" decoding="async">
                                        </div>
                                    </div>
                                    <div class="wotmods-folder-picker__content" id="wotmodsFolderContent" role="button" tabindex="0">
                                        <p class="wotmods-folder-picker__placeholder" id="wotmodsFolderPlaceholder">
                                            <?php echo $isEn ? 'No game folder selected' : 'Папка игры не выбрана'; ?>
                                        </p>
                                        <div class="wotmods-folder-picker__selected" id="wotmodsFolderSelected">
                                            <div class="wotmods-folder-picker__game-row">
                                                <strong class="wotmods-folder-picker__game" id="wotmodsGameTitle"></strong>
                                                <span class="wotmods-folder-picker__version" id="wotmodsGameVersion"></span>
                                            </div>
                                            <p class="wotmods-folder-picker__path" id="wotmodsFolderPath"></p>
                                        </div>
                                    </div>
                                    <div class="wotmods-folder-picker__actions">
                                        <button
                                            type="button"
                                            class="wotmods-folder-picker__btn wotmods-folder-picker__btn--reset"
                                            id="wotmodsResetFolderBtn"
                                            hidden
                                            aria-label="<?php echo $isEn ? 'Reset folder' : 'Сбросить папку'; ?>"
                                        >
                                            <i class="fas fa-times" aria-hidden="true"></i>
                                        </button>
                                        <button type="button" class="wotmods-folder-picker__btn wotmods-folder-picker__btn--pick" id="wotmodsPickFolderBtn">
                                            <i class="fas fa-folder-open" aria-hidden="true"></i>
                                            <span id="wotmodsPickFolderBtnLabel"><?php echo $isEn ? 'Browse' : 'Выбрать'; ?></span>
                                        </button>
                                    </div>
                                </div>
                                <div class="wotmods-folder-picker__tools is-locked" id="wotmodsFolderTools">
                                    <button type="button" class="wotmods-folder-picker__tool wotmods-folder-picker__tool--warn" id="wotmodsDeleteChadowBtn" disabled>
                                        <i class="fas fa-eraser" aria-hidden="true"></i>
                                        <?php echo $isEn ? 'Remove CHADOW mods' : 'Удалить моды CHADOW'; ?>
                                    </button>
                                    <button type="button" class="wotmods-folder-picker__tool wotmods-folder-picker__tool--danger" id="wotmodsDeleteAllBtn" disabled>
                                        <i class="fas fa-trash-alt" aria-hidden="true"></i>
                                        <?php echo $isEn ? 'Clear all mods' : 'Удалить все моды'; ?>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section class="wotmods-step wotmods-step--mods is-locked" id="wotmodsStepMods" aria-labelledby="wotmodsStepModsTitle">
                        <div class="wotmods-step__head">
                            <span class="wotmods-step__num">2</span>
                            <h3 class="wotmods-step__title" id="wotmodsStepModsTitle">
                                <?php echo $isEn ? 'Select mods' : 'Выберите моды'; ?>
                            </h3>
                        </div>

                        <div class="wotmods-step__body">
                            <p class="wotmods-step__hint" id="wotmodsModsHint">
                                <?php echo $isEn
                                    ? 'First select the game folder above.'
                                    : 'Сначала выберите папку игры выше.'; ?>
                            </p>

                            <div class="wotmods-mod-list" id="wotmodsModList" role="list">
                                <?php foreach ($mods as $mod): ?>
                                    <?php
                                    $modId = htmlspecialchars((string) ($mod['id'] ?? ''), ENT_QUOTES, 'UTF-8');
                                    $icon = htmlspecialchars((string) ($mod['icon'] ?? 'fa-puzzle-piece'), ENT_QUOTES, 'UTF-8');
                                    $title = htmlspecialchars((string) ($mod['title'] ?? ''), ENT_QUOTES, 'UTF-8');
                                    $author = trim((string) ($mod['author'] ?? ''));
                                    $authorUrl = trim((string) ($mod['authorUrl'] ?? ''));
                                    $short = htmlspecialchars((string) ($mod['short'] ?? ''), ENT_QUOTES, 'UTF-8');
                                    $version = htmlspecialchars((string) ($mod['version'] ?? ''), ENT_QUOTES, 'UTF-8');
                                    ?>
                                    <label class="wotmods-mod-item" data-wotmods-mod-id="<?php echo $modId; ?>" role="listitem">
                                        <input type="checkbox" class="wotmods-mod-item__check" name="wotmods_selected[]" value="<?php echo $modId; ?>" disabled>
                                        <span class="wotmods-mod-item__icon" aria-hidden="true"><i class="fas <?php echo $icon; ?>"></i></span>
                                        <span class="wotmods-mod-item__content">
                                            <span class="wotmods-mod-item__title-row">
                                                <span class="wotmods-mod-item__title"><?php echo $title; ?></span>
                                                <?php if ($author !== ''): ?>
                                                    <?php if ($authorUrl !== ''): ?>
                                                        <a
                                                            class="wotmods-mod-item__author wotmods-mod-item__author-link"
                                                            href="<?php echo htmlspecialchars($authorUrl, ENT_QUOTES, 'UTF-8'); ?>"
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            onclick="event.stopPropagation();"
                                                        ><?php echo htmlspecialchars($author, ENT_QUOTES, 'UTF-8'); ?></a>
                                                    <?php else: ?>
                                                        <span class="wotmods-mod-item__author"><?php echo htmlspecialchars($author, ENT_QUOTES, 'UTF-8'); ?></span>
                                                    <?php endif; ?>
                                                <?php endif; ?>
                                            </span>
                                            <span class="wotmods-mod-item__desc"><?php echo $short; ?></span>
                                        </span>
                                        <span class="wotmods-mod-item__meta">
                                            <span class="wotmods-mod-item__version">v<?php echo $version; ?></span>
                                            <span class="wotmods-mod-item__installed" hidden data-wotmods-installed-badge>
                                                <?php echo $isEn ? 'Installed' : 'Установлен'; ?>
                                            </span>
                                            <span class="wotmods-mod-item__update" hidden data-wotmods-update-badge>
                                                <?php echo $isEn ? 'Update available' : 'Доступно обновление'; ?>
                                            </span>
                                        </span>
                                        <span class="wotmods-mod-item__tick" aria-hidden="true"><i class="fas fa-check"></i></span>
                                    </label>
                                <?php endforeach; ?>
                            </div>
                        </div>
                    </section>
                </div>

                <footer class="wotmods-workspace__footer">
                    <button type="button" class="wotmods-btn wotmods-btn--install" id="wotmodsInstallSelectedBtn" disabled>
                        <i class="fas fa-download" aria-hidden="true"></i>
                        <span><?php echo $isEn ? 'Install selected' : 'Установить выбранные'; ?></span>
                    </button>
                </footer>
            </section>
<?php require __DIR__ . '/../tactics/_confirm_modal.php'; ?>
