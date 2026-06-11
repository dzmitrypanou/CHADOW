<?php
/**
 * Отдельные поля тега клана и названия команды в профиле.
 *
 * Expects: $lang, $clanTagValue, $teamNameValue
 * Optional: $clanTagFieldClass
 */
$clanTagValue = isset($clanTagValue) ? (string) $clanTagValue : '';
$teamNameValue = isset($teamNameValue) ? (string) $teamNameValue : '';
$clanTagFieldClass = isset($clanTagFieldClass) ? trim((string) $clanTagFieldClass) : 'auth-form__group';
$clanTagLabel = $lang === 'en' ? 'Clan tag' : 'Тег клана';
$teamNameLabel = $lang === 'en' ? 'Team name' : 'Название команды';
$optional = $lang === 'en' ? 'Optional' : 'Необязательно';
?>
                    <div class="<?php echo htmlspecialchars($clanTagFieldClass, ENT_QUOTES, 'UTF-8'); ?> recruiting-profile-clan-field">
                        <label class="recruiting-form-label" for="recruiting_profile_clan_tag">
                            <span data-profile-i18n="clanTag"><?php echo htmlspecialchars($clanTagLabel, ENT_QUOTES, 'UTF-8'); ?></span>
                        </label>
                        <input
                            type="text"
                            id="recruiting_profile_clan_tag"
                            name="recruiting_clan_tag"
                            class="recruiting-text-input recruiting-profile-clan-tag"
                            maxlength="16"
                            value="<?php echo htmlspecialchars($clanTagValue, ENT_QUOTES, 'UTF-8'); ?>"
                            placeholder="<?php echo htmlspecialchars($optional, ENT_QUOTES, 'UTF-8'); ?>"
                            data-profile-i18n-placeholder="optional"
                            autocomplete="off"
                            autocapitalize="characters"
                            spellcheck="false"
                        >
                    </div>
                    <div class="<?php echo htmlspecialchars($clanTagFieldClass, ENT_QUOTES, 'UTF-8'); ?> recruiting-profile-team-field">
                        <label class="recruiting-form-label" for="recruiting_profile_team_name">
                            <span data-profile-i18n="teamName"><?php echo htmlspecialchars($teamNameLabel, ENT_QUOTES, 'UTF-8'); ?></span>
                        </label>
                        <input
                            type="text"
                            id="recruiting_profile_team_name"
                            name="recruiting_team_name"
                            class="recruiting-text-input recruiting-profile-team-name"
                            maxlength="64"
                            value="<?php echo htmlspecialchars($teamNameValue, ENT_QUOTES, 'UTF-8'); ?>"
                            placeholder="<?php echo htmlspecialchars($optional, ENT_QUOTES, 'UTF-8'); ?>"
                            data-profile-i18n-placeholder="optional"
                            autocomplete="off"
                            spellcheck="false"
                        >
                    </div>
