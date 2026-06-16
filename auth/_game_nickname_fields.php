<?php

$gameNicknames = is_array($gameNicknames ?? null) ? $gameNicknames : [];
$isEn = ($lang ?? 'ru') === 'en';
$realmLabels = [
    'ru' => 'RU',
    'eu' => 'EU',
    'na' => 'NA',
    'asia' => 'ASIA',
];
?>
<form class="auth-form auth-form--profile-game-nicks" id="profileGameNicksForm" method="post" action="#" novalidate>
    <div class="profile-game-nicks__grid">
        <?php foreach (user_game_nickname_realms() as $realm): ?>
        <?php
        $field = $gameNicknames[$realm] ?? ['value' => '', 'locked' => false];
        $value = (string) ($field['value'] ?? '');
        $locked = !empty($field['locked']);
        $inputId = 'profile_game_nickname_' . $realm;
        ?>
        <div class="auth-form__group profile-game-nick-field<?php echo $locked ? ' profile-game-nick-field--locked' : ''; ?>" data-realm="<?php echo htmlspecialchars($realm, ENT_QUOTES, 'UTF-8'); ?>">
            <label class="recruiting-form-label profile-game-nick-field__label" for="<?php echo htmlspecialchars($inputId, ENT_QUOTES, 'UTF-8'); ?>">
                <span class="profile-game-nick-field__realm"><?php echo htmlspecialchars($realmLabels[$realm] ?? strtoupper($realm), ENT_QUOTES, 'UTF-8'); ?></span>
                <?php if ($locked): ?>
                <span class="profile-game-nick-field__badge"><?php echo $realm === 'ru' ? 'Lesta API' : 'WG API'; ?></span>
                <?php endif; ?>
            </label>
            <input
                type="text"
                id="<?php echo htmlspecialchars($inputId, ENT_QUOTES, 'UTF-8'); ?>"
                name="game_nickname_<?php echo htmlspecialchars($realm, ENT_QUOTES, 'UTF-8'); ?>"
                class="recruiting-text-input<?php echo $locked ? ' recruiting-text-input--readonly' : ''; ?>"
                maxlength="24"
                autocomplete="off"
                autocapitalize="off"
                spellcheck="false"
                value="<?php echo htmlspecialchars($value, ENT_QUOTES, 'UTF-8'); ?>"
                <?php if ($locked): ?>
                readonly
                aria-readonly="true"
                title="<?php echo $isEn ? 'Filled from linked game account' : 'Заполнено из привязанного игрового аккаунта'; ?>"
                data-profile-i18n-title="nicknameLockedTitle"
                <?php else: ?>
                placeholder="<?php echo $isEn ? 'Nickname' : 'Никнейм'; ?>"
                data-profile-i18n-placeholder="nicknamePh"
                title="<?php echo $isEn ? 'Up to 24 characters: Latin letters, digits, _ -' : 'До 24 символов: латиница, цифры, _ -'; ?>"
                data-profile-i18n-title="nicknameTitle"
                <?php endif; ?>
            >
        </div>
        <?php endforeach; ?>
    </div>
</form>
