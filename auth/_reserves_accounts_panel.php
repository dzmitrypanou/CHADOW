<?php

$reservesPanelRegions = is_array($reservesPanelRegions ?? null) ? $reservesPanelRegions : [];
$reservesPanelReturn = isset($reservesPanelReturn) ? (string) $reservesPanelReturn : '';
$reservesPanelIsEn = ($lang ?? 'ru') === 'en';
$reservesPanelActiveLinkId = (int) ($reservesPanelActiveLinkId ?? 0);
$reservesPanelUserId = (int) ($reservesPanelUserId ?? 0);
$wgActionBase = user_auth_path('/auth/wg');
?>
<div class="reserves-accounts-panel" id="reservesAccountsPanel">
    <div class="reserves-regions-grid">
        <?php foreach ($reservesPanelRegions as $region):
            $provider = (string) ($region['provider'] ?? 'wg');
            $realm = (string) ($region['realm'] ?? 'eu');
            $slotLabel = (string) ($region['slot_label'] ?? strtoupper($realm));
            $configured = !empty($region['configured']);
            $accounts = is_array($region['accounts'] ?? null) ? $region['accounts'] : [];
            $linkHref = $wgActionBase . '?' . http_build_query([
                'action' => 'reserve_link',
                'provider' => $provider,
                'realm' => $realm,
                'return' => $reservesPanelReturn,
            ]);
            $showEmptyAccounts = $accounts === [] && ($configured || $provider === 'lesta');
            $regionDisabledText = $reservesPanelIsEn ? 'API not configured' : 'API не настроен';
        ?>
        <section class="reserves-region-column<?php echo $configured ? '' : ' reserves-region-column--disabled'; ?>" data-reserve-provider="<?php echo htmlspecialchars($provider, ENT_QUOTES, 'UTF-8'); ?>" data-reserve-realm="<?php echo htmlspecialchars($realm, ENT_QUOTES, 'UTF-8'); ?>">
            <header class="reserves-region-column__head">
                <span class="reserves-region-column__badge recruiting-realm-badge"><?php echo htmlspecialchars($slotLabel, ENT_QUOTES, 'UTF-8'); ?></span>
                <?php if (!$configured && $provider !== 'lesta'): ?>
                <span class="reserves-region-column__status" data-reserves-i18n="apiRegionDisabled"><?php echo htmlspecialchars($regionDisabledText, ENT_QUOTES, 'UTF-8'); ?></span>
                <?php endif; ?>
            </header>

            <div class="reserves-region-column__accounts">
                <?php if ($showEmptyAccounts): ?>
                <p class="reserves-region-column__empty" data-reserves-i18n="slotEmpty">
                    <?php echo $reservesPanelIsEn ? 'No accounts linked yet.' : 'Аккаунты не привязаны.'; ?>
                </p>
                <?php endif; ?>

                <?php foreach ($accounts as $account):
                    $linkId = (int) ($account['link_id'] ?? 0);
                    $hasToken = !empty($account['has_token']);
                    $needsRelink = !empty($account['needs_relink']);
                    $clanLoad = $hasToken && !empty($account['token_ok']) && $linkId > 0;
                    $isUsable = !empty($account['usable']);
                    $isSelected = $isUsable && $linkId > 0 && $linkId === $reservesPanelActiveLinkId;
                    $clanCache = ($clanLoad && $reservesPanelUserId > 0)
                        ? clan_reserve_get_clan_cache($userDb, $reservesPanelUserId, $linkId)
                        : null;
                    $needsClanFetch = false;
                    $needsClanRefresh = false;
                    $reservesClanProfile = null;
                    $reservesClanLoading = $clanLoad;
                    if ($clanCache !== null) {
                        if (!empty($clanCache['no_clan'])) {
                            $needsClanFetch = true;
                            $reservesClanLoading = true;
                        } elseif ($clanCache['tag'] !== '' || $clanCache['name'] !== '' || $clanCache['emblem_url'] !== '') {
                            $reservesClanProfile = [
                                'tag' => $clanCache['tag'],
                                'name' => $clanCache['name'],
                                'emblem_url' => $clanCache['emblem_url'],
                            ];
                            $reservesClanLoading = false;
                        }
                        if (clan_reserve_clan_cache_is_stale($clanCache)) {
                            if ($reservesClanProfile !== null) {
                                $needsClanRefresh = true;
                            } elseif (empty($clanCache['no_clan'])) {
                                $needsClanFetch = true;
                            }
                        }
                    } elseif ($clanLoad) {
                        $needsClanFetch = true;
                    }
                    $refreshHref = $wgActionBase . '?' . http_build_query([
                        'action' => 'reserve_refresh',
                        'link_id' => $linkId,
                        'return' => $reservesPanelReturn,
                    ]);
                ?>
                <div class="reserves-region-account<?php echo $isSelected ? ' reserves-region-account--selected' : ''; ?>" data-reserve-link-id="<?php echo $linkId; ?>" data-reserves-clan-load="<?php echo $needsClanFetch ? '1' : '0'; ?>" data-reserves-clan-refresh="<?php echo $needsClanRefresh ? '1' : '0'; ?>" data-reserves-usable="<?php echo $isUsable ? '1' : '0'; ?>"<?php echo $isUsable ? ' role="button" tabindex="0"' : ''; ?>>
                    <?php
                        $reservesLinkedProvider = $provider;
                        $reservesLinkedRealm = $realm;
                        $reservesLinkedLinkId = $linkId;
                        $reservesLinkedInfo = [
                            'nickname' => (string) ($account['nickname'] ?? ''),
                        ];
                        $reservesIsSelected = $isSelected;
                        $reservesCardUsable = $isUsable;
                        $reservesReserveNickRow = $hasToken || $isUsable;
                        $reservesShowUnlink = $hasToken && $linkId > 0;
                        require __DIR__ . '/_reserves_linked_account_card.php';
                    ?>
                    <?php if ($needsRelink && $configured && $linkId > 0): ?>
                    <a class="tactics-icon-btn reserves-action-btn reserves-region-account__refresh" href="<?php echo htmlspecialchars($refreshHref, ENT_QUOTES, 'UTF-8'); ?>" data-reserves-i18n="relinkAccount">
                        <?php echo $reservesPanelIsEn ? 'Refresh access' : 'Обновить доступ'; ?>
                    </a>
                    <?php endif; ?>
                </div>
                <?php endforeach; ?>
            </div>

            <?php if ($configured): ?>
            <footer class="reserves-region-column__foot">
                <a class="reserves-region-column__add reserves-action-btn" href="<?php echo htmlspecialchars($linkHref, ENT_QUOTES, 'UTF-8'); ?>">
                    <i class="fas fa-plus" aria-hidden="true"></i>
                    <span data-reserves-link-slot="<?php echo htmlspecialchars($slotLabel, ENT_QUOTES, 'UTF-8'); ?>">
                        <?php echo $reservesPanelIsEn
                            ? ('Add ' . $slotLabel . ' account')
                            : ('Добавить аккаунт ' . $slotLabel); ?>
                    </span>
                </a>
            </footer>
            <?php elseif ($provider === 'lesta'): ?>
            <footer class="reserves-region-column__foot reserves-region-column__foot--disabled">
                <span class="reserves-region-column__add reserves-region-column__add--disabled" aria-disabled="true">
                    <i class="fas fa-plus" aria-hidden="true"></i>
                    <span data-reserves-link-slot="<?php echo htmlspecialchars($slotLabel, ENT_QUOTES, 'UTF-8'); ?>">
                        <?php echo $reservesPanelIsEn
                            ? ('Add ' . $slotLabel . ' account')
                            : ('Добавить аккаунт ' . $slotLabel); ?>
                    </span>
                </span>
            </footer>
            <?php else: ?>
            <footer class="reserves-region-column__foot reserves-region-column__foot--disabled">
                <span class="reserves-region-column__add reserves-region-column__add--disabled" aria-disabled="true">
                    <i class="fas fa-plus" aria-hidden="true"></i>
                    <span data-reserves-i18n="apiRegionDisabled"><?php echo htmlspecialchars($regionDisabledText, ENT_QUOTES, 'UTF-8'); ?></span>
                </span>
            </footer>
            <?php endif; ?>
        </section>
        <?php endforeach; ?>
    </div>
</div>
