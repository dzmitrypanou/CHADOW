<?php
/**
 * Поле «тег клана / название команды» с выбором типа.
 *
 * Expects: $lang, $clanTagValue, $clanTagType, $clanTagInputName, $clanTagTypeName, $clanTagInputId
 * Optional: $clanTagFieldClass, $showClanTagHint (bool), $clanTagAutoType (bool)
 */
$clanTagValue = isset($clanTagValue) ? (string) $clanTagValue : '';
$clanTagType = recruiting_clan_tag_type_normalize((string) ($clanTagType ?? 'clan_tag'));
$clanTagInputName = isset($clanTagInputName) ? (string) $clanTagInputName : 'clan_tag';
$clanTagTypeName = isset($clanTagTypeName) ? (string) $clanTagTypeName : 'clan_tag_type';
$clanTagInputId = isset($clanTagInputId) ? (string) $clanTagInputId : 'recruitingClanTag';
$clanTagFieldClass = isset($clanTagFieldClass) ? trim((string) $clanTagFieldClass) : 'recruiting-form-field';
$showClanTagHint = !isset($showClanTagHint) || $showClanTagHint;
$clanTagAutoType = !empty($clanTagAutoType);
$clanTagMaxLength = recruiting_clan_tag_max_length($clanTagType);
$clanTagOptional = $lang === 'en' ? 'Optional' : 'Необязательно';
$clanTagDefaultLabel = $lang === 'en' ? 'Clan or team' : 'Клан или команда';
?>
                    <div class="<?php echo htmlspecialchars($clanTagFieldClass, ENT_QUOTES, 'UTF-8'); ?> recruiting-clan-tag-field<?php echo $clanTagAutoType ? ' recruiting-clan-tag-field--auto-type' : ''; ?>" data-lang="<?php echo htmlspecialchars($lang, ENT_QUOTES, 'UTF-8'); ?>"<?php echo $clanTagAutoType ? ' data-auto-type="1"' : ''; ?>>
                        <?php if ($clanTagAutoType): ?>
                        <input
                            type="hidden"
                            id="<?php echo htmlspecialchars($clanTagTypeName, ENT_QUOTES, 'UTF-8'); ?>"
                            name="<?php echo htmlspecialchars($clanTagTypeName, ENT_QUOTES, 'UTF-8'); ?>"
                            class="recruiting-clan-tag-type"
                            value="<?php echo htmlspecialchars($clanTagType, ENT_QUOTES, 'UTF-8'); ?>"
                        >
                        <div class="recruiting-clan-tag-field__row recruiting-clan-tag-field__row--auto-type">
                            <label class="recruiting-form-label recruiting-clan-tag-inline-label" for="<?php echo htmlspecialchars($clanTagInputId, ENT_QUOTES, 'UTF-8'); ?>">
                                <span class="recruiting-clan-tag-label-text"><?php echo htmlspecialchars($clanTagDefaultLabel, ENT_QUOTES, 'UTF-8'); ?></span>
                                <span class="recruiting-required recruiting-clan-tag-required hidden" aria-hidden="true">*</span>
                            </label>
                            <input
                                type="text"
                                id="<?php echo htmlspecialchars($clanTagInputId, ENT_QUOTES, 'UTF-8'); ?>"
                                name="<?php echo htmlspecialchars($clanTagInputName, ENT_QUOTES, 'UTF-8'); ?>"
                                class="recruiting-text-input recruiting-clan-tag-value"
                                maxlength="<?php echo (int) $clanTagMaxLength; ?>"
                                value="<?php echo htmlspecialchars($clanTagValue, ENT_QUOTES, 'UTF-8'); ?>"
                                placeholder="<?php echo htmlspecialchars($clanTagOptional, ENT_QUOTES, 'UTF-8'); ?>"
                                aria-label="<?php echo htmlspecialchars(recruiting_clan_tag_type_label($clanTagType, $lang), ENT_QUOTES, 'UTF-8'); ?>"
                            >
                        </div>
                        <?php else: ?>
                        <label class="recruiting-form-label" for="<?php echo htmlspecialchars($clanTagTypeName, ENT_QUOTES, 'UTF-8'); ?>">
                            <span class="recruiting-clan-tag-label-text"><?php echo htmlspecialchars($clanTagDefaultLabel, ENT_QUOTES, 'UTF-8'); ?></span>
                            <span class="recruiting-required recruiting-clan-tag-required hidden" aria-hidden="true">*</span>
                        </label>
                        <div class="recruiting-clan-tag-field__row">
                            <select
                                id="<?php echo htmlspecialchars($clanTagTypeName, ENT_QUOTES, 'UTF-8'); ?>"
                                name="<?php echo htmlspecialchars($clanTagTypeName, ENT_QUOTES, 'UTF-8'); ?>"
                                class="recruiting-select recruiting-clan-tag-type"
                            >
                                <?php foreach (RECRUITING_CLAN_TAG_TYPES as $typeOption): ?>
                                <option value="<?php echo htmlspecialchars($typeOption, ENT_QUOTES, 'UTF-8'); ?>"<?php echo $clanTagType === $typeOption ? ' selected' : ''; ?>>
                                    <?php echo htmlspecialchars(recruiting_clan_tag_type_label($typeOption, $lang), ENT_QUOTES, 'UTF-8'); ?>
                                </option>
                                <?php endforeach; ?>
                            </select>
                            <input
                                type="text"
                                id="<?php echo htmlspecialchars($clanTagInputId, ENT_QUOTES, 'UTF-8'); ?>"
                                name="<?php echo htmlspecialchars($clanTagInputName, ENT_QUOTES, 'UTF-8'); ?>"
                                class="recruiting-text-input recruiting-clan-tag-value"
                                maxlength="<?php echo (int) $clanTagMaxLength; ?>"
                                value="<?php echo htmlspecialchars($clanTagValue, ENT_QUOTES, 'UTF-8'); ?>"
                                placeholder="<?php echo htmlspecialchars($clanTagOptional, ENT_QUOTES, 'UTF-8'); ?>"
                                aria-label="<?php echo htmlspecialchars(recruiting_clan_tag_type_label($clanTagType, $lang), ENT_QUOTES, 'UTF-8'); ?>"
                            >
                        </div>
                        <?php endif; ?>
                        <?php if ($showClanTagHint): ?>
                        <p class="recruiting-form-hint">
                            <?php echo $lang === 'en'
                                ? 'Saved for your next ads. You can also change defaults in your account.'
                                : 'Сохраняется для следующих объявлений. Можно изменить в личном кабинете.'; ?>
                        </p>
                        <?php endif; ?>
                    </div>
