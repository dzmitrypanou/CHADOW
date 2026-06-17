<?php
/** @var string $lang */
/** @var string|null $installerModId */
$installerModId = isset($installerModId) ? trim((string) $installerModId) : '';
$installerModAttr = $installerModId !== '' ? ' data-wotmods-mod="' . htmlspecialchars($installerModId, ENT_QUOTES, 'UTF-8') . '"' : '';
$isEn = $lang === 'en';
?>
            <section class="checkers-panel wotmods-installer" id="wotmodsInstaller" data-wotmods-installer<?php echo $installerModAttr; ?>>
                <div class="wotmods-installer__layout">
                    <div class="wotmods-installer__main">
                        <span class="wotmods-installer__badge"><?php echo $isEn ? 'Required step' : 'Обязательный шаг'; ?></span>
                        <h2 class="wotmods-installer__title"><?php echo $isEn ? 'Select the game root folder' : 'Выберите корневую папку игры'; ?></h2>
                        <p class="wotmods-installer__desc">
                            <?php if ($isEn): ?>
                                Pick the main client folder that contains <code>game_info.xml</code>.
                                For example: <code>D:\Games\Tanki</code>.
                                Folders like <code>mods</code> and <code>mods\1.43.0.0</code> are not valid — the browser needs access to the game root.
                            <?php else: ?>
                                Выберите основную папку клиента, в которой находится <code>game_info.xml</code>.
                                Например: <code>D:\Games\Tanki</code>.
                                Папки <code>mods</code> и <code>mods\1.43.0.0</code> не подходят: браузеру нужен доступ к корню игры.
                            <?php endif; ?>
                        </p>
                        <ol class="wotmods-installer__steps">
                            <li><?php echo $isEn ? '1. Click “Select game folder”' : '1. Нажмите «Выбрать папку игры»'; ?></li>
                            <li><?php echo $isEn ? '2. Open the folder with Tanki.exe or WorldOfTanks.exe' : '2. Откройте папку с Tanki.exe или WorldOfTanks.exe'; ?></li>
                            <li><?php echo $isEn ? '3. Confirm access and wait for installation' : '3. Подтвердите доступ и дождитесь установки'; ?></li>
                        </ol>
                        <p class="wotmods-installer__status" id="wotmodsInstallerStatus" role="status" aria-live="polite" hidden></p>
                        <p class="wotmods-installer__unsupported" id="wotmodsInstallerUnsupported" hidden>
                            <?php echo $isEn
                                ? 'Auto-install works in desktop Chrome and Edge. Use manual downloads below in other browsers.'
                                : 'Автоустановка работает в Chrome и Edge на компьютере. В других браузерах скачайте файлы вручную ниже.'; ?>
                        </p>
                    </div>
                    <div class="wotmods-installer__actions">
                        <button type="button" class="wotmods-installer__pick" id="wotmodsPickFolderBtn">
                            <?php echo $isEn ? 'Select game folder' : 'Выбрать папку игры'; ?>
                        </button>
                    </div>
                </div>
            </section>
