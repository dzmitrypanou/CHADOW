<?php
$lang = 'ru';
try {
    require_once __DIR__ . '/../../includes/lang.php';
    $lang = abs_detect_lang();
} catch (Throwable $e) {
    $lang = 'ru';
}

require_once __DIR__ . '/../../includes/user_bootstrap.php';
require_once __DIR__ . '/../../config/ensure_brackets.php';
require_once __DIR__ . '/../../includes/user_auth.php';
require_once __DIR__ . '/../../includes/bracket_helpers.php';

ensure_brackets_table($userDb);

$publicId = trim((string) ($_GET['public_id'] ?? ''));
if (!bracket_public_id_valid($publicId)) {
    http_response_code(404);
    require __DIR__ . '/../../includes/site_header.php';
    echo '<main class="bracket-service"><section class="bracket-panel"><p>404</p></section></main>';
    require __DIR__ . '/../../includes/site_footer.php';
    exit();
}

$row = $userDb->fetchOne(
    'SELECT ' . bracket_sql_select_columns('b') . ', b.edit_token FROM tournament_brackets b WHERE b.public_id = ?',
    [$publicId]
);

if (!$row) {
    http_response_code(404);
    require __DIR__ . '/../../includes/site_header.php';
    echo '<main class="bracket-service"><section class="bracket-panel"><p>404</p></section></main>';
    require __DIR__ . '/../../includes/site_footer.php';
    exit();
}

$userId = user_current_id();
$ownerId = bracket_row_owner_id($row);
$isLoggedOwner = $userId !== null && $ownerId !== null && $ownerId === $userId;
$isGuestBracket = bracket_is_guest_owned($row);
$isAdminHidden = (string) ($row['status'] ?? '') === 'hidden';

if ($isAdminHidden && !$isLoggedOwner) {
    http_response_code(404);
    require __DIR__ . '/../../includes/site_header.php';
    echo '<main class="bracket-service"><section class="bracket-panel"><p>404</p></section></main>';
    require __DIR__ . '/../../includes/site_footer.php';
    exit();
}

$canEdit = $isLoggedOwner;
$guestEditToken = bracket_guest_edit_cookie_token($publicId);
if (!$canEdit && $isGuestBracket && bracket_guest_can_edit($row, $guestEditToken)) {
    $canEdit = true;
}
$isGuestEditor = $canEdit && !$isLoggedOwner;

$pageTitle = htmlspecialchars((string) $row['title'], ENT_QUOTES, 'UTF-8');
abs_set_page_titles('Редактирование: ' . (string) $row['title'], 'Edit: ' . (string) $row['title']);
$bodyClass = 'page-bracket page-bracket-edit';
$seoSlug = 'services/bracket/' . $publicId . '/edit';
$metaRobots = 'noindex,nofollow';

$listHref = abs_build_lang_href($lang, 'services/bracket');
$viewHref = abs_build_lang_href($lang, 'services/bracket/' . $publicId);

if (!$canEdit && !$isGuestBracket) {
    header('Location: ' . $viewHref);
    exit;
}

$bracketItem = bracket_format_item($row, $isLoggedOwner, true);

require __DIR__ . '/../../includes/site_header.php';
?>

        <main class="bracket-service" id="bracketEditorRoot">
            <section class="bracket-panel bracket-service-header">
                <div class="bracket-section-head">
                    <div>
                        <h2 class="bracket-section-title">
                            <?php echo $lang === 'en' ? 'Edit bracket' : 'Редактирование'; ?>
                        </h2>
                        <?php if ($isAdminHidden): ?>
                        <p class="bracket-moderation-badge">
                            <?php echo $lang === 'en' ? 'Hidden by moderator' : 'Скрыта модератором'; ?>
                        </p>
                        <?php endif; ?>
                        <p class="bracket-edit-tournament-title"><?php echo htmlspecialchars((string) $row['title'], ENT_QUOTES, 'UTF-8'); ?></p>
                        <div class="bracket-view-header-meta bracket-meta-top" id="bracketHeaderMeta"></div>
                    </div>
                    <div class="bracket-section-actions">
                        <a class="bracket-back-link" href="<?php echo htmlspecialchars($viewHref, ENT_QUOTES, 'UTF-8'); ?>">
                            <i class="fas fa-eye" aria-hidden="true"></i>
                            <?php echo $lang === 'en' ? 'View' : 'Просмотр'; ?>
                        </a>
                        <a class="bracket-back-link bracket-section-actions__back" href="<?php echo htmlspecialchars($listHref, ENT_QUOTES, 'UTF-8'); ?>">
                            <i class="fas fa-arrow-left" aria-hidden="true"></i>
                            <?php echo $lang === 'en' ? 'Back' : 'Назад'; ?>
                        </a>
                    </div>
                </div>
            </section>

            <section class="bracket-panel bracket-edit-panel">
                <div id="bracketEditControls" class="bracket-edit-controls bracket-form"<?php echo $canEdit ? '' : ' hidden'; ?>>
                    <?php
                    $currentFormat = bracket_format_valid((string) ($row['format'] ?? ''))
                        ? (string) $row['format']
                        : 'single';
                    $currentMatchFormat = bracket_match_format_valid((string) ($row['match_format'] ?? ''))
                        ? (string) $row['match_format']
                        : bracket_match_format_default();
                    $editVisibility = ($row['visibility'] ?? '') === 'hidden' ? 'hidden' : 'public';
                    $isGroupFormat = in_array($currentFormat, ['group', 'group_se', 'group_de'], true);
                    ?>
                    <div class="bracket-form-group">
                        <label class="bracket-form-label" for="bracketEditTitle">
                            <?php echo $lang === 'en' ? 'Title' : 'Название'; ?>
                        </label>
                        <input type="text" id="bracketEditTitle" class="bracket-text-input" maxlength="120"
                            value="<?php echo htmlspecialchars((string) $row['title'], ENT_QUOTES, 'UTF-8'); ?>">
                    </div>

                    <div id="bracketEditGamePicker"></div>

                    <div class="bracket-form-group is-locked">
                        <label class="bracket-form-label" for="bracketEditFormat">
                            <?php echo $lang === 'en' ? 'Bracket type' : 'Тип сетки'; ?>
                        </label>
                        <select id="bracketEditFormat" class="bracket-select" disabled aria-disabled="true">
                            <?php foreach (BRACKET_FORMATS as $fmt): ?>
                            <option value="<?php echo htmlspecialchars($fmt, ENT_QUOTES, 'UTF-8'); ?>"<?php echo $currentFormat === $fmt ? ' selected' : ''; ?>>
                                <?php echo htmlspecialchars(bracket_format_label($fmt, $lang), ENT_QUOTES, 'UTF-8'); ?>
                            </option>
                        <?php endforeach; ?>
                        </select>
                    </div>

                    <div class="bracket-form-group">
                        <label class="bracket-form-label" for="bracketEditMatchFormat">
                            <?php echo $lang === 'en' ? 'Match format' : 'Формат матчей'; ?>
                        </label>
                        <select id="bracketEditMatchFormat" class="bracket-select">
                            <?php foreach (BRACKET_MATCH_FORMATS as $mf): ?>
                            <option value="<?php echo htmlspecialchars($mf, ENT_QUOTES, 'UTF-8'); ?>"<?php echo $currentMatchFormat === $mf ? ' selected' : ''; ?>>
                                <?php echo htmlspecialchars(bracket_match_format_label($mf, $lang), ENT_QUOTES, 'UTF-8'); ?>
                            </option>
                            <?php endforeach; ?>
                        </select>
                    </div>

                    <div class="bracket-form-grid bracket-form-grid--triple">
                        <div class="bracket-form-group">
                            <span class="bracket-form-label" id="bracketEditStartsAt-label">
                                <?php echo $lang === 'en' ? 'Tournament start' : 'Старт турнира'; ?>
                            </span>
                            <input type="hidden" id="bracketEditStartsAt" class="bracket-datetime-input" value=""
                                aria-labelledby="bracketEditStartsAt-label">
                        </div>
                        <div class="bracket-form-group" id="bracketEditSizeField">
                            <label class="bracket-form-label" for="bracketEditParticipantSize">
                                <?php echo $lang === 'en' ? 'Bracket size' : 'Размер сетки'; ?>
                            </label>
                            <select id="bracketEditParticipantSize" class="bracket-select">
                                <?php foreach (BRACKET_SIZE_OPTIONS as $size): ?>
                                <option value="<?php echo $size; ?>"><?php echo $size; ?></option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                        <div class="bracket-form-group">
                            <span class="bracket-form-label" id="bracketEditVisibility-label">
                                <?php echo $lang === 'en' ? 'Visibility' : 'Видимость'; ?>
                            </span>
                            <div id="bracketEditVisibilitySwitch" class="bracket-visibility-switch" role="radiogroup" aria-labelledby="bracketEditVisibility-label">
                                <label class="bracket-visibility-switch__option<?php echo $editVisibility === 'public' ? ' is-active' : ''; ?>">
                                    <input type="radio" name="bracket_edit_visibility" value="public"<?php echo $editVisibility === 'public' ? ' checked' : ''; ?>>
                                    <span class="bracket-visibility-switch__text">
                                        <?php echo $lang === 'en' ? 'Public access' : 'Публичный доступ'; ?>
                                    </span>
                                </label>
                                <label class="bracket-visibility-switch__option<?php echo $editVisibility === 'hidden' ? ' is-active' : ''; ?>">
                                    <input type="radio" name="bracket_edit_visibility" value="hidden"<?php echo $editVisibility === 'hidden' ? ' checked' : ''; ?>>
                                    <span class="bracket-visibility-switch__text">
                                        <?php echo $lang === 'en' ? 'Link access' : 'Доступ по ссылке'; ?>
                                    </span>
                                </label>
                            </div>
                            <input type="hidden" id="bracketEditVisibility" value="<?php echo htmlspecialchars($editVisibility, ENT_QUOTES, 'UTF-8'); ?>">
                        </div>
                    </div>

                    <div class="bracket-form-desc-prize-row">
                        <div class="bracket-form-group">
                            <label class="bracket-form-label" for="bracketEditDescription">
                                <?php echo $lang === 'en' ? 'Description' : 'Описание'; ?>
                            </label>
                            <textarea id="bracketEditDescription" class="bracket-textarea" rows="6" maxlength="2000"
                                placeholder="<?php echo $lang === 'en' ? 'Rules, schedule, contacts…' : 'Правила, расписание, контакты…'; ?>"><?php echo htmlspecialchars((string) ($row['description'] ?? ''), ENT_QUOTES, 'UTF-8'); ?></textarea>
                        </div>
                        <div id="bracketEditPrizePool" class="bracket-form-group bracket-create-prize-wrap"></div>
                    </div>

                    <div id="bracketEditGroupOnly" class="bracket-group-only"<?php echo $isGroupFormat ? '' : ' hidden'; ?>>
                        <div id="bracketEditGroupSettings" class="bracket-form-grid">
                            <div class="bracket-form-group">
                                <label class="bracket-form-label" for="bracketEditGroupCount">
                                    <?php echo $lang === 'en' ? 'Number of groups' : 'Число групп'; ?>
                                </label>
                                <div class="bracket-combobox" id="bracketEditGroupCountCombobox">
                                    <input type="text" id="bracketEditGroupCount" class="bracket-combobox__input bracket-text-input"
                                        value="4" inputmode="numeric" autocomplete="off" spellcheck="false"
                                        role="combobox" aria-autocomplete="list" aria-expanded="false"
                                        aria-controls="bracketEditGroupCountMenu">
                                    <button type="button" class="bracket-combobox__toggle" tabindex="-1" aria-hidden="true">
                                        <i class="fas fa-chevron-down" aria-hidden="true"></i>
                                    </button>
                                    <div id="bracketEditGroupCountMenu" class="bracket-combobox__menu" role="listbox" hidden></div>
                                </div>
                            </div>
                            <div class="bracket-form-group" id="bracketEditAdvancePerGroupField">
                                <label class="bracket-form-label" for="bracketEditAdvancePerGroup">
                                    <?php echo $lang === 'en' ? 'Advance per group' : 'Проходит из группы'; ?>
                                </label>
                                <input type="number" id="bracketEditAdvancePerGroup" class="bracket-text-input bracket-number-input" min="1" max="8" value="2">
                            </div>
                        </div>

                        <div id="bracketEditGroupParticipants" class="bracket-group-participants"></div>
                    </div>

                    <div id="bracketEditParticipantsBlock" class="bracket-form-group"<?php echo $isGroupFormat ? ' hidden' : ''; ?>>
                        <label class="bracket-form-label" for="bracketEditParticipants">
                            <?php echo $lang === 'en' ? 'Participants' : 'Участники'; ?>
                        </label>
                        <textarea id="bracketEditParticipants" class="bracket-textarea bracket-participants-textarea" rows="8"
                            placeholder="<?php echo $lang === 'en' ? 'Team A or Player 1' : 'Команда А или Игрок 1'; ?>"></textarea>
                        <p class="bracket-form-hint bracket-participants-edit-hint">
                            <?php echo $lang === 'en'
                                ? 'Changing the roster will reset all match results.'
                                : 'Изменение состава сбросит все результаты матчей.'; ?>
                        </p>
                    </div>

                    <div class="bracket-edit-toolbar">
                        <button type="button" id="bracketSaveBtn" class="bracket-submit-btn">
                            <i class="fas fa-save" aria-hidden="true"></i>
                            <?php echo $lang === 'en' ? 'Save' : 'Сохранить'; ?>
                        </button>
                        <button type="button" id="bracketCopyLinkBtn" class="bracket-back-link">
                            <i class="fas fa-link" aria-hidden="true"></i>
                            <?php echo $lang === 'en' ? 'Copy link' : 'Копировать ссылку'; ?>
                        </button>
                        <button type="button" id="bracketDeleteBtn" class="bracket-delete-btn">
                            <i class="fas fa-trash" aria-hidden="true"></i>
                            <?php echo $lang === 'en' ? 'Delete' : 'Удалить'; ?>
                        </button>
                    </div>
                    <?php if (!$isLoggedOwner): ?>
                    <p class="bracket-guest-hint"><?php echo $lang === 'en'
                        ? 'Without login, editing is only available in this browser.'
                        : 'Без входа редактирование доступно только с этого браузера.'; ?></p>
                    <?php endif; ?>
                </div>

                <p id="bracketNoEditMsg" class="bracket-no-edit-msg"<?php echo $canEdit ? ' hidden' : ''; ?>>
                    <?php echo $lang === 'en' ? 'No edit permissions' : 'Нет прав на редактирование'; ?>
                </p>

                <div id="bracketMetaDisplay" class="bracket-meta-display"></div>
                <div id="bracketGroupActions" class="bracket-group-actions" hidden>
                    <p id="bracketGroupActionsHint" class="bracket-group-actions__hint"></p>
                    <button type="button" id="bracketGeneratePlayoffBtn" class="bracket-submit-btn">
                        <i class="fas fa-sitemap" aria-hidden="true"></i>
                        <?php echo $lang === 'en' ? 'Generate playoff' : 'Сформировать плей-офф'; ?>
                    </button>
                </div>
                <div class="bracket-playoff-section">
                    <div id="bracketRenderTarget" class="bracket-render-target"></div>
                    <div id="bracketTournamentActions" class="bracket-tournament-actions" hidden></div>
                </div>
            </section>
        </main>

<?php
require __DIR__ . '/../../includes/site_footer.php';
?>
    <script>
        window.ABS_BRACKET_LANG = <?php echo json_encode($lang); ?>;
        window.ABS_BRACKET_CSRF = <?php echo json_encode(user_csrf_token()); ?>;
        window.ABS_BRACKET_PUBLIC_ID = <?php echo json_encode($publicId); ?>;
        window.ABS_BRACKET_INITIAL = <?php echo json_encode($bracketItem); ?>;
        window.ABS_BRACKET_CAN_EDIT = <?php echo json_encode($canEdit); ?>;
        window.ABS_BRACKET_IS_LOGGED_OWNER = <?php echo json_encode($isLoggedOwner); ?>;
        window.ABS_BRACKET_IS_GUEST_EDITOR = <?php echo json_encode($isGuestEditor); ?>;
        window.ABS_BRACKET_IS_GUEST = <?php echo json_encode($isGuestBracket); ?>;
        window.ABS_BRACKET_CHECK_ACCESS_API = <?php echo json_encode(user_api_path('/api/bracket/check_access.php')); ?>;
        window.ABS_BRACKET_UPDATE_API = <?php echo json_encode(user_api_path('/api/bracket/update.php')); ?>;
        window.ABS_BRACKET_DELETE_API = <?php echo json_encode(user_api_path('/api/bracket/delete.php')); ?>;
    </script>
    <script src="/js/site-toast.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/recruiting/custom-select.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/bracket/bracket-combobox.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/bracket/i18n.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/bracket/games.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/bracket/datetime-picker.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/bracket/match-format.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/bracket/guest-store.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/bracket/access.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/bracket/prizes.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/bracket/placements.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/bracket/meta-panel.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/bracket/engine/single.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/bracket/engine/double.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/bracket/engine/group.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/bracket/engine/index.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/bracket/renderer.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/bracket/editor.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
</body>
</html>
