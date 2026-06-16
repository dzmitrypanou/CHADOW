<?php

$formPost = isset($formPost) && is_array($formPost) ? $formPost : [];
$isEdit = !empty($isEdit);
$val = static function (string $key) use ($formPost): string {
    return htmlspecialchars((string) ($formPost[$key] ?? ''), ENT_QUOTES, 'UTF-8');
};
?>
                <div class="recruiting-form-grid">
                    <div class="recruiting-form-field">
                        <label class="recruiting-form-label" for="recruitingPostType">
                            <?php echo $lang === 'en' ? 'Ad type' : 'Тип объявления'; ?>
                            <span class="recruiting-required">*</span>
                        </label>
                        <select id="recruitingPostType" name="post_type" class="recruiting-select" required>
                            <option value="" disabled<?php echo empty($formPost['post_type']) ? ' selected' : ''; ?>>
                                <?php echo $lang === 'en' ? 'Select type…' : 'Выберите тип…'; ?>
                            </option>
                            <?php foreach (RECRUITING_POST_TYPES as $type): ?>
                            <option value="<?php echo htmlspecialchars($type, ENT_QUOTES, 'UTF-8'); ?>"<?php echo ($formPost['post_type'] ?? '') === $type ? ' selected' : ''; ?>>
                                <?php echo htmlspecialchars(recruiting_post_type_label($type, $lang), ENT_QUOTES, 'UTF-8'); ?>
                            </option>
                            <?php endforeach; ?>
                        </select>
                    </div>

                    <div class="recruiting-form-field">
                        <label class="recruiting-form-label" for="recruitingRealm">
                            <?php echo $lang === 'en' ? 'Region' : 'Регион'; ?>
                            <span class="recruiting-required">*</span>
                        </label>
                        <select id="recruitingRealm" name="realm" class="recruiting-select" required>
                            <option value="" disabled<?php echo empty($formPost['realm']) ? ' selected' : ''; ?>>
                                <?php echo $lang === 'en' ? 'Select region…' : 'Выберите регион…'; ?>
                            </option>
                            <?php foreach (RECRUITING_REALMS as $realm): ?>
                            <option value="<?php echo htmlspecialchars($realm, ENT_QUOTES, 'UTF-8'); ?>"<?php echo ($formPost['realm'] ?? '') === $realm ? ' selected' : ''; ?>>
                                <?php echo htmlspecialchars(recruiting_realm_label($realm, $lang), ENT_QUOTES, 'UTF-8'); ?>
                            </option>
                            <?php endforeach; ?>
                        </select>
                    </div>

                    <div class="recruiting-form-field recruiting-form-field--full">
                        <label class="recruiting-form-label" for="recruitingGameNickname">
                            <?php echo $lang === 'en' ? 'Game nickname' : 'Игровой ник'; ?>
                            <span class="recruiting-required">*</span>
                        </label>
                        <input
                            type="text"
                            id="recruitingGameNickname"
                            name="game_nickname"
                            class="recruiting-text-input"
                            maxlength="24"
                            autocomplete="off"
                            autocapitalize="off"
                            spellcheck="false"
                            required
                            value="<?php echo $val('game_nickname'); ?>"
                            placeholder="<?php echo $lang === 'en' ? 'Nickname on selected region' : 'Ник на выбранном регионе'; ?>"
                            title="<?php echo $lang === 'en' ? 'Up to 24 characters: Latin letters, digits, _ -' : 'До 24 символов: латиница, цифры, _ -'; ?>"
                        >
                        <p class="recruiting-form-hint" id="recruitingGameNicknameHint">
                            <?php echo $lang === 'en'
                                ? 'A nickname already linked to another site account cannot be used.'
                                : 'Ник, уже привязанный к другому аккаунту на сайте, использовать нельзя.'; ?>
                        </p>
                        <p class="recruiting-form-hint recruiting-form-hint--warn hidden" id="recruitingGameNicknameError" role="alert"></p>
                    </div>

                    <div class="recruiting-form-field recruiting-form-field--full">
                        <label class="recruiting-form-label" for="recruitingBody">
                            <?php echo $lang === 'en' ? 'Description' : 'Описание'; ?>
                            <span class="recruiting-required">*</span>
                        </label>
                        <textarea
                            id="recruitingBody"
                            name="body"
                            class="recruiting-textarea"
                            rows="8"
                            minlength="10"
                            maxlength="5000"
                            required
                            autocomplete="off"
                            placeholder="<?php echo $lang === 'en' ? 'Requirements, schedule, contacts in-game…' : 'Требования, расписание, контакты в игре…'; ?>"
                        ><?php echo $val('body'); ?></textarea>
                    </div>

                    <?php
                    $contacts = isset($formPost['contacts']) && is_array($formPost['contacts'])
                        ? $formPost['contacts']
                        : recruiting_contacts_parse($formPost['contact'] ?? null);
                    require __DIR__ . '/_contacts_editor.php';
                    ?>

                    <?php
                    $clanTagValue = (string) ($formPost['clan_tag'] ?? '');
                    $clanTagType = (string) ($formPost['clan_tag_type'] ?? 'clan_tag');
                    $clanTagInputName = 'clan_tag';
                    $clanTagTypeName = 'clan_tag_type';
                    $clanTagInputId = 'recruitingClanTag';
                    $clanTagAutoType = true;
                    require __DIR__ . '/_clan_tag_field.php';
                    ?>
                </div>

                <?php if ($isEdit && !empty($formPost['status'])): ?>
                <p class="recruiting-form-status-note">
                    <?php echo $lang === 'en' ? 'Status' : 'Статус'; ?>:
                    <span class="recruiting-status-badge recruiting-status-badge--<?php echo htmlspecialchars((string) $formPost['status'], ENT_QUOTES, 'UTF-8'); ?>">
                        <?php echo htmlspecialchars(recruiting_status_label((string) $formPost['status'], $lang), ENT_QUOTES, 'UTF-8'); ?>
                    </span>
                    <?php if (!empty($formPost['moderation_note'])): ?>
                    <span class="recruiting-moderation-note">
                        — <?php echo htmlspecialchars((string) $formPost['moderation_note'], ENT_QUOTES, 'UTF-8'); ?>
                    </span>
                    <?php endif; ?>
                </p>
                <?php if (($formPost['status'] ?? '') === 'approved'): ?>
                <p class="recruiting-form-hint recruiting-form-hint--warn">
                    <?php echo $lang === 'en'
                        ? 'Saving changes to a published ad sends it back for moderation.'
                        : 'Сохранение изменений опубликованного объявления отправит его на повторную модерацию.'; ?>
                </p>
                <?php endif; ?>
                <?php endif; ?>
