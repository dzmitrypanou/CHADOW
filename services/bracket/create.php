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

user_require_web();

$pageTitle = $lang === 'en' ? 'Create bracket' : 'Создать сетку';
abs_set_page_titles('Создать сетку', 'Create bracket');
$metaDescription = $lang === 'en'
    ? 'Create a new tournament bracket.'
    : 'Создание новой турнирной сетки.';
$bodyClass = 'page-bracket';
$seoSlug = 'services/bracket/create';
$metaRobots = 'noindex,nofollow';

$listHref = abs_build_lang_href($lang, 'services/bracket');

require __DIR__ . '/../../includes/site_header.php';
?>

        <main class="bracket-service">
            <section class="bracket-panel bracket-form-panel">
                <div class="bracket-section-head">
                    <div>
                        <h2 class="bracket-section-title">
                            <?php echo $lang === 'en' ? 'New bracket' : 'Новая сетка'; ?>
                        </h2>
                        <p class="bracket-section-hint">
                            <?php echo $lang === 'en'
                                ? 'Fill in settings and participant list.'
                                : 'Заполните параметры и список участников.'; ?>
                        </p>
                    </div>
                    <a class="bracket-back-link" href="<?php echo htmlspecialchars($listHref, ENT_QUOTES, 'UTF-8'); ?>">
                        <i class="fas fa-arrow-left" aria-hidden="true"></i>
                        <?php echo $lang === 'en' ? 'Back to brackets' : 'К сеткам'; ?>
                    </a>
                </div>

                <form id="bracketCreateForm" class="bracket-form" novalidate>
                    <div class="bracket-form-group">
                        <label class="bracket-form-label" for="bracketTitle">
                            <?php echo $lang === 'en' ? 'Title' : 'Название'; ?>
                        </label>
                        <input type="text" id="bracketTitle" class="bracket-text-input" maxlength="120" required
                            placeholder="Glads Leagues #1">
                    </div>

                    <div id="bracketGamePicker"></div>

                    <div class="bracket-form-group">
                        <label class="bracket-form-label" for="bracketFormat">
                            <?php echo $lang === 'en' ? 'Bracket type' : 'Тип сетки'; ?>
                        </label>
                        <select id="bracketFormat" class="bracket-select">
                            <?php foreach (BRACKET_FORMATS as $fmt): ?>
                            <option value="<?php echo htmlspecialchars($fmt, ENT_QUOTES, 'UTF-8'); ?>">
                                <?php echo htmlspecialchars(bracket_format_label($fmt, $lang), ENT_QUOTES, 'UTF-8'); ?>
                            </option>
                            <?php endforeach; ?>
                        </select>
                    </div>

                    <div class="bracket-form-group">
                        <label class="bracket-form-label" for="bracketMatchFormat">
                            <?php echo $lang === 'en' ? 'Match format' : 'Формат матчей'; ?>
                        </label>
                        <select id="bracketMatchFormat" class="bracket-select">
                            <?php foreach (BRACKET_MATCH_FORMATS as $mf): ?>
                            <option value="<?php echo htmlspecialchars($mf, ENT_QUOTES, 'UTF-8'); ?>">
                                <?php echo htmlspecialchars(bracket_match_format_label($mf, $lang), ENT_QUOTES, 'UTF-8'); ?>
                            </option>
                            <?php endforeach; ?>
                        </select>
                    </div>

                    <div class="bracket-form-grid bracket-form-grid--triple">
                        <div class="bracket-form-group">
                            <span class="bracket-form-label" id="bracketStartsAt-label">
                                <?php echo $lang === 'en' ? 'Tournament start' : 'Старт турнира'; ?>
                            </span>
                            <input type="hidden" id="bracketStartsAt" class="bracket-datetime-input" value=""
                                aria-labelledby="bracketStartsAt-label">
                        </div>
                        <div class="bracket-form-group" id="bracketSizeField">
                            <label class="bracket-form-label" for="bracketParticipantSize">
                                <?php echo $lang === 'en' ? 'Bracket size' : 'Размер сетки'; ?>
                            </label>
                            <select id="bracketParticipantSize" class="bracket-select">
                                <?php foreach (BRACKET_SIZE_OPTIONS as $size): ?>
                                <option value="<?php echo $size; ?>"<?php echo $size === 8 ? ' selected' : ''; ?>><?php echo $size; ?></option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                        <div class="bracket-form-group">
                            <span class="bracket-form-label" id="bracketVisibility-label">
                                <?php echo $lang === 'en' ? 'Visibility' : 'Видимость'; ?>
                            </span>
                            <div id="bracketVisibilitySwitch" class="bracket-visibility-switch" role="radiogroup" aria-labelledby="bracketVisibility-label">
                                <label class="bracket-visibility-switch__option is-active">
                                    <input type="radio" name="bracket_create_visibility" value="public" checked>
                                    <span class="bracket-visibility-switch__text">
                                        <?php echo $lang === 'en' ? 'Public access' : 'Публичный доступ'; ?>
                                    </span>
                                </label>
                                <label class="bracket-visibility-switch__option">
                                    <input type="radio" name="bracket_create_visibility" value="hidden">
                                    <span class="bracket-visibility-switch__text">
                                        <?php echo $lang === 'en' ? 'Link access' : 'Доступ по ссылке'; ?>
                                    </span>
                                </label>
                            </div>
                            <input type="hidden" id="bracketVisibility" value="public">
                        </div>
                    </div>

                    <div class="bracket-form-desc-prize-row">
                        <div class="bracket-form-group">
                            <label class="bracket-form-label" for="bracketDescription">
                                <?php echo $lang === 'en' ? 'Description' : 'Описание'; ?>
                            </label>
                            <textarea id="bracketDescription" class="bracket-textarea" rows="6" maxlength="2000"
                                placeholder="<?php echo $lang === 'en' ? 'Rules, schedule, contacts…' : 'Правила, расписание, контакты…'; ?>"></textarea>
                        </div>
                        <div id="bracketCreatePrizePool" class="bracket-form-group bracket-create-prize-wrap"></div>
                    </div>

                    <div id="bracketGroupOnly" class="bracket-group-only" hidden>
                        <div id="bracketGroupSettings" class="bracket-form-grid">
                            <div class="bracket-form-group">
                                <label class="bracket-form-label" for="bracketGroupCount">
                                    <?php echo $lang === 'en' ? 'Number of groups' : 'Число групп'; ?>
                                </label>
                                <div class="bracket-combobox" id="bracketGroupCountCombobox">
                                    <input type="text" id="bracketGroupCount" class="bracket-combobox__input bracket-text-input"
                                        value="4" inputmode="numeric" autocomplete="off" spellcheck="false"
                                        role="combobox" aria-autocomplete="list" aria-expanded="false"
                                        aria-controls="bracketGroupCountMenu">
                                    <button type="button" class="bracket-combobox__toggle" tabindex="-1" aria-hidden="true">
                                        <i class="fas fa-chevron-down" aria-hidden="true"></i>
                                    </button>
                                    <div id="bracketGroupCountMenu" class="bracket-combobox__menu" role="listbox" hidden></div>
                                </div>
                            </div>
                            <div class="bracket-form-group" id="bracketAdvancePerGroupField">
                                <label class="bracket-form-label" for="bracketAdvancePerGroup">
                                    <?php echo $lang === 'en' ? 'Advance per group' : 'Проходит из группы'; ?>
                                </label>
                                <input type="number" id="bracketAdvancePerGroup" class="bracket-text-input bracket-number-input" min="1" max="8" value="2">
                            </div>
                        </div>

                        <div id="bracketGroupParticipants" class="bracket-group-participants"></div>
                    </div>

                    <div class="bracket-form-group" id="bracketParticipantsBlock">
                        <label class="bracket-form-label" for="bracketParticipants">
                            <?php echo $lang === 'en' ? 'Participants' : 'Участники'; ?>
                        </label>
                        <textarea id="bracketParticipants" class="bracket-textarea bracket-participants-textarea" rows="8" required
                            placeholder="<?php echo $lang === 'en' ? 'Team A or Player 1' : 'Команда А или Игрок 1'; ?>"></textarea>
                        <p class="bracket-form-hint" id="bracketParticipantsHint">
                            <?php echo $lang === 'en'
                                ? 'Maximum participants. Empty lines become BYE slots.'
                                : 'Максимальное число участников. Пустые строки — слоты под BYE.'; ?>
                        </p>
                    </div>

                    <button type="submit" class="bracket-submit-btn">
                        <i class="fas fa-sitemap" aria-hidden="true"></i>
                        <?php echo $lang === 'en' ? 'Create' : 'Создать'; ?>
                    </button>
                </form>
            </section>
        </main>

<?php
require __DIR__ . '/../../includes/site_footer.php';
?>
    <script>
        window.ABS_BRACKET_LANG = <?php echo json_encode($lang); ?>;
        window.ABS_BRACKET_CSRF = <?php echo json_encode(user_csrf_token()); ?>;
        window.ABS_BRACKET_CREATE_API = <?php echo json_encode(user_api_path('/api/bracket/create.php')); ?>;
    </script>
    <script src="/js/site-toast.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/recruiting/custom-select.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/bracket/i18n.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/bracket/games.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/bracket/datetime-picker.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/bracket/match-format.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/bracket/engine/single.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/bracket/engine/double.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/bracket/engine/group.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/bracket/engine/index.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/bracket/prizes.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/bracket/meta-panel.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/bracket/guest-store.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/bracket/bracket-combobox.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/bracket/editor.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
</body>
</html>
