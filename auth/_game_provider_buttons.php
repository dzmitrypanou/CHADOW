<?php

$wgOAuthAction = ($wgOAuthAction ?? 'link') === 'login' ? 'login' : 'link';
$providersWrapperClass = trim((string) ($providersWrapperClass ?? 'auth-providers auth-providers--row'));
$wgOAuthReturn = isset($wgOAuthReturn) ? (string) $wgOAuthReturn : '';
$wgActionUrl = user_auth_path('/auth/wg');
$isProfileNickname = in_array(
    (string) ($wgProviderButtonsContext ?? ''),
    ['profile-nickname', 'reserves-account'],
    true
);
$linkState = is_array($wgProviderLinkState ?? null) ? $wgProviderLinkState : [];
$configuredState = is_array($wgProviderConfigured ?? null) ? $wgProviderConfigured : [];
$providerProfile = is_array($wgProviderProfile ?? null) ? $wgProviderProfile : [];
$wgLinked = !empty($linkState['wg']);
$lestaLinked = !empty($linkState['lesta']);
if ($configuredState === [] && !function_exists('game_api_wg_application_id')) {
    require_once __DIR__ . '/../includes/game_api.php';
}
$wgConfigured = array_key_exists('wg', $configuredState)
    ? !empty($configuredState['wg'])
    : (!empty($wgAppConfigured) || game_api_wg_application_id() !== '');
$lestaConfigured = array_key_exists('lesta', $configuredState)
    ? !empty($configuredState['lesta'])
    : game_api_lesta_application_id() !== '';
$isEn = ($lang ?? abs_detect_lang()) === 'en';
$wgProviderShowWgRealms = ($wgProviderButtonsContext ?? '') === 'reserves-account';
$wgProviderReservesLayout = ($wgProviderButtonsContext ?? '') === 'reserves-account';
$wgProviderClanInfo = is_array($wgProviderClanInfo ?? null) ? $wgProviderClanInfo : null;

function wg_provider_realm_label(string $realm): string {
    $realm = user_normalize_wg_realm($realm);
    $labels = [
        'ru' => 'RU',
        'eu' => 'EU',
        'na' => 'NA',
        'asia' => 'ASIA',
    ];

    return $labels[$realm] ?? strtoupper($realm);
}

function wg_provider_linked_info(string $provider, array $profile): array {
    if ($provider === 'lesta') {
        $nickname = trim((string) ($profile['lesta_nickname'] ?? ''));
        if ($nickname === '') {
            $wgNick = trim((string) ($profile['wg_nickname'] ?? ''));
            if ($wgNick !== '' && user_normalize_wg_realm((string) ($profile['wg_realm'] ?? '')) === 'ru') {
                $nickname = $wgNick;
            }
        }
        if ($nickname === '') {
            $accountId = (int) ($profile['lesta_account_id'] ?? 0);
            if ($accountId <= 0 && user_normalize_wg_realm((string) ($profile['wg_realm'] ?? '')) === 'ru') {
                $accountId = (int) ($profile['wg_account_id'] ?? 0);
            }
            if ($accountId > 0) {
                $nickname = '#' . $accountId;
            }
        }

        return [
            'nickname' => $nickname,
            'realm' => 'RU',
        ];
    }

    $realm = user_normalize_wg_realm((string) ($profile['wg_realm'] ?? 'eu'));
    $nickname = trim((string) ($profile['wg_nickname'] ?? ''));
    if ($nickname === '') {
        $accountId = (int) ($profile['wg_account_id'] ?? 0);
        if ($accountId > 0) {
            $nickname = '#' . $accountId;
        }
    }

    return [
        'nickname' => $nickname,
        'realm' => wg_provider_realm_label($realm),
    ];
}

function wg_provider_wg_realms_subtitle(array $profile): string {
    if (!function_exists('user_game_nicknames_state')) {
        require_once __DIR__ . '/../includes/user_auth.php';
    }

    $gameNicknames = user_game_nicknames_state($profile);
    $realmLabels = [
        'eu' => 'EU',
        'na' => 'NA',
        'asia' => 'ASIA',
    ];
    $parts = [];

    foreach (['eu', 'na', 'asia'] as $realm) {
        $value = trim((string) ($gameNicknames[$realm]['value'] ?? ''));
        if ($value === '') {
            continue;
        }
        $parts[] = $value . ' (' . ($realmLabels[$realm] ?? strtoupper($realm)) . ')';
    }

    return implode(' · ', $parts);
}

function wg_provider_button_label(
    string $provider,
    bool $isProfileNickname,
    bool $isEn,
    bool $linked = false,
    array $linkedInfo = [],
    array $profile = [],
    bool $showWgRealms = false
): array {
    $icon = $provider === 'lesta' ? 'fa-shield-alt' : 'fa-gamepad';
    $apiName = $provider === 'lesta' ? game_api_ru_api_label($isEn ? 'en' : 'ru') : 'WG API';

    if ($isProfileNickname) {
        if ($linked) {
            if ($provider === 'wg' && $showWgRealms && $profile !== []) {
                $subtitle = wg_provider_wg_realms_subtitle($profile);
                if ($subtitle === '') {
                    $nickname = trim((string) ($linkedInfo['nickname'] ?? ''));
                    $realm = trim((string) ($linkedInfo['realm'] ?? ''));
                    $subtitle = $nickname !== '' && $realm !== ''
                        ? $nickname . ' (' . $realm . ')'
                        : $nickname;
                }
            } else {
                $nickname = trim((string) ($linkedInfo['nickname'] ?? ''));
                $realm = trim((string) ($linkedInfo['realm'] ?? ''));
                $subtitle = $nickname !== '' && $realm !== ''
                    ? $nickname . ' (' . $realm . ')'
                    : $nickname;
            }

            return [
                'title' => $isEn ? ($apiName . ' linked') : ($apiName . ' привязан'),
                'api' => $subtitle,
                'icon' => $icon,
            ];
        }

        if ($provider === 'lesta') {
            return [
                'title' => $isEn ? ('Link ' . $apiName) : ('Привязать ' . $apiName),
                'api' => '',
                'icon' => $icon,
            ];
        }

        return [
            'title' => $isEn ? ('Link ' . $apiName) : ('Привязать ' . $apiName),
            'api' => '',
            'icon' => $icon,
        ];
    }

    return [
        'title' => $provider === 'lesta' ? game_api_ru_api_label($isEn ? 'en' : 'ru') : 'Wargaming API',
        'api' => '',
        'icon' => $icon,
    ];
}
?>
<div class="<?php echo htmlspecialchars($providersWrapperClass, ENT_QUOTES, 'UTF-8'); ?>">
    <?php
    $providers = [
        [
            'provider' => 'wg',
            'realm' => 'eu',
            'linked' => $wgLinked,
            'configured' => $wgConfigured,
        ],
        [
            'provider' => 'lesta',
            'realm' => 'ru',
            'linked' => $lestaLinked,
            'configured' => $lestaConfigured,
        ],
    ];
    foreach ($providers as $item):
        $linkedInfo = $item['linked'] ? wg_provider_linked_info($item['provider'], $providerProfile) : [];
        $label = wg_provider_button_label(
            $item['provider'],
            $isProfileNickname,
            $isEn,
            $item['linked'],
            $linkedInfo,
            $providerProfile,
            $wgProviderShowWgRealms
        );
        $unconfiguredClass = !$item['configured'] ? ' auth-provider-btn--unconfigured' : '';
        if (!$item['configured'] && !$item['linked'] && ($wgProviderButtonsContext ?? '') === 'reserves-account') {
            continue;
        }
    ?>
    <?php if ($item['configured'] && !$item['linked']): ?>
    <form class="auth-provider-form" method="get" action="<?php echo htmlspecialchars($wgActionUrl, ENT_QUOTES, 'UTF-8'); ?>">
        <input type="hidden" name="action" value="<?php echo htmlspecialchars($wgOAuthAction, ENT_QUOTES, 'UTF-8'); ?>">
        <input type="hidden" name="provider" value="<?php echo htmlspecialchars($item['provider'], ENT_QUOTES, 'UTF-8'); ?>">
        <input type="hidden" name="realm" value="<?php echo htmlspecialchars($item['realm'], ENT_QUOTES, 'UTF-8'); ?>">
        <?php if ($wgOAuthReturn !== ''): ?>
        <input type="hidden" name="return" value="<?php echo htmlspecialchars($wgOAuthReturn, ENT_QUOTES, 'UTF-8'); ?>">
        <?php endif; ?>
        <div class="auth-provider-actions">
            <button type="submit" class="auth-provider-btn auth-provider-btn--wg reserves-action-btn<?php echo $isProfileNickname ? ' auth-provider-btn--nickname' : ''; ?><?php echo $wgProviderReservesLayout ? ' auth-provider-btn--reserves' : ''; ?>">
                <i class="fas <?php echo htmlspecialchars($label['icon'], ENT_QUOTES, 'UTF-8'); ?>" aria-hidden="true"></i>
                <span class="auth-provider-btn__text">
                    <span class="auth-provider-btn__label"><?php echo htmlspecialchars($label['title'], ENT_QUOTES, 'UTF-8'); ?></span>
                    <?php if ($label['api'] !== ''): ?>
                    <span class="auth-provider-btn__api"><?php echo htmlspecialchars($label['api'], ENT_QUOTES, 'UTF-8'); ?></span>
                    <?php endif; ?>
                </span>
            </button>
        </div>
    </form>
    <?php elseif ($item['linked'] && $isProfileNickname && $wgProviderReservesLayout): ?>
    <?php
        $reservesLinkedProvider = $item['provider'];
        $reservesLinkedLabel = $label;
        $reservesLinkedInfo = $linkedInfo;
        $reservesClanProfile = $wgProviderClanInfo;
        require __DIR__ . '/_reserves_linked_account_card.php';
    ?>
    <?php elseif ($item['linked'] && $isProfileNickname): ?>
    <div class="auth-provider-form">
        <div class="auth-provider-actions">
            <div class="auth-provider-btn auth-provider-btn--wg auth-provider-btn--nickname auth-provider-btn--linked">
                <i class="fas <?php echo htmlspecialchars($label['icon'], ENT_QUOTES, 'UTF-8'); ?>" aria-hidden="true"></i>
                <span class="auth-provider-btn__text">
                    <span class="auth-provider-btn__label"><?php echo htmlspecialchars($label['title'], ENT_QUOTES, 'UTF-8'); ?></span>
                    <?php if ($label['api'] !== ''): ?>
                    <span class="auth-provider-btn__api"><?php echo htmlspecialchars($label['api'], ENT_QUOTES, 'UTF-8'); ?></span>
                    <?php endif; ?>
                </span>
                <button
                    type="button"
                    class="auth-provider-btn__unlink profile-linking__unlink"
                    data-game-api-provider="<?php echo htmlspecialchars($item['provider'], ENT_QUOTES, 'UTF-8'); ?>"
                    title="<?php echo $isEn ? 'Unlink' : 'Отвязать'; ?>"
                    aria-label="<?php echo $isEn ? 'Unlink' : 'Отвязать'; ?>"
                    data-profile-i18n-title="unlink"
                >
                    <i class="fas fa-times" aria-hidden="true"></i>
                </button>
            </div>
        </div>
    </div>
    <?php else: ?>
    <div class="auth-provider-form">
        <div class="auth-provider-actions">
            <button type="button" class="auth-provider-btn auth-provider-btn--wg<?php echo $isProfileNickname ? ' auth-provider-btn--nickname' : ''; ?><?php echo $unconfiguredClass; ?>" disabled>
                <i class="fas <?php echo htmlspecialchars($label['icon'], ENT_QUOTES, 'UTF-8'); ?>" aria-hidden="true"></i>
                <span class="auth-provider-btn__text">
                    <span class="auth-provider-btn__label"><?php echo htmlspecialchars($label['title'], ENT_QUOTES, 'UTF-8'); ?></span>
                    <?php if ($label['api'] !== ''): ?>
                    <span class="auth-provider-btn__api"><?php echo htmlspecialchars($label['api'], ENT_QUOTES, 'UTF-8'); ?></span>
                    <?php endif; ?>
                </span>
            </button>
        </div>
    </div>
    <?php endif; ?>
    <?php endforeach; ?>
</div>
