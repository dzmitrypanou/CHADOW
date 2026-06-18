<?php

$reservesLinkedProvider = isset($reservesLinkedProvider) ? (string) $reservesLinkedProvider : 'wg';
$reservesLinkedInfo = is_array($reservesLinkedInfo ?? null) ? $reservesLinkedInfo : [];
$reservesClanProfile = is_array($reservesClanProfile ?? null) ? $reservesClanProfile : null;
$reservesCardIsEn = ($lang ?? 'ru') === 'en';

$nick = trim((string) ($reservesLinkedInfo['nickname'] ?? ''));
if ($nick !== '' && preg_match('/^#\d+$/', $nick)) {
    $nick = '';
}
$clanTag = trim((string) ($reservesClanProfile['tag'] ?? ''));
$clanName = trim((string) ($reservesClanProfile['name'] ?? ''));
$clanEmblem = trim((string) ($reservesClanProfile['emblem_url'] ?? ''));
$clanNoClan = !empty($reservesClanProfile['no_clan']);
$hasClan = !$clanNoClan && ($clanTag !== '' || $clanName !== '' || $clanEmblem !== '');
$reservesClanLoading = !empty($reservesClanLoading);
$reservesIsSelected = !empty($reservesIsSelected);
$cardLinkId = (int) ($reservesLinkedLinkId ?? 0);
$cardIsUsable = !empty($reservesCardUsable);
$reserveClanRow = $reservesClanLoading || $hasClan || $clanNoClan;
$reserveNickRow = !empty($reservesReserveNickRow);
$selectedBadgeText = $reservesCardIsEn ? 'Selected / managing' : 'Выбран/настраивается';
$clanNameTitle = $clanName !== '' ? $clanName : '';
?>
<div class="auth-provider-form reserves-linked-card-wrap">
    <div class="reserves-linked-card<?php echo $reservesClanLoading ? ' reserves-linked-card--clan-loading' : ''; ?><?php echo $reservesIsSelected ? ' reserves-linked-card--selected' : ''; ?><?php echo $cardIsUsable ? ' reserves-linked-card--selectable' : ''; ?>" data-reserve-link-id="<?php echo $cardLinkId; ?>">
        <div class="reserves-linked-card__main">
            <div class="reserves-linked-card__emblem-slot" data-reserves-clan-emblem>
            <?php if ($clanEmblem !== ''): ?>
            <img
                class="reserves-linked-card__emblem"
                src="<?php echo htmlspecialchars($clanEmblem, ENT_QUOTES, 'UTF-8'); ?>"
                alt=""
                loading="lazy"
                width="52"
                height="52"
            >
            <?php else: ?>
            <div class="reserves-linked-card__emblem reserves-linked-card__emblem--placeholder" aria-hidden="true">
                <i class="fas fa-shield-alt"></i>
            </div>
            <?php endif; ?>
            </div>

            <div class="reserves-linked-card__content">
                <?php if ($reserveClanRow): ?>
                <div class="reserves-linked-card__clan reserves-linked-card__clan--reserved<?php echo $clanNoClan ? ' reserves-linked-card__clan--no-clan reserves-linked-card__clan--loaded' : ''; ?>" data-reserves-clan-info>
                    <span class="reserves-linked-card__tag" data-reserves-clan-tag><?php
                        echo $clanTag !== '' ? '[' . htmlspecialchars($clanTag, ENT_QUOTES, 'UTF-8') . ']' : '';
                    ?></span>
                    <span class="reserves-linked-card__clan-name<?php echo $clanNoClan ? ' reserves-linked-card__clan-name--no-clan' : ''; ?>" data-reserves-clan-name<?php
                        if ($clanNoClan) {
                            echo ' data-reserves-i18n="noClan"';
                        } elseif ($clanNameTitle !== '') {
                            echo ' title="' . htmlspecialchars($clanNameTitle, ENT_QUOTES, 'UTF-8') . '"';
                        }
                    ?>><?php
                        if ($clanNoClan) {
                            echo htmlspecialchars($reservesCardIsEn ? 'Player not in a clan' : 'Игрок не в клане', ENT_QUOTES, 'UTF-8');
                        } elseif ($clanName !== '') {
                            echo htmlspecialchars($clanName, ENT_QUOTES, 'UTF-8');
                        }
                    ?></span>
                </div>
                <?php endif; ?>

                <?php if ($reserveNickRow): ?>
                <div class="reserves-linked-card__player reserves-linked-card__player--reserved">
                    <strong class="reserves-linked-card__nick"><?php echo $nick !== '' ? htmlspecialchars($nick, ENT_QUOTES, 'UTF-8') : ''; ?></strong>
                </div>
                <?php endif; ?>
            </div>
        </div>

        <?php if ($cardIsUsable): ?>
        <div class="reserves-linked-card__foot">
            <span class="reserves-linked-card__selected-badge<?php echo $reservesIsSelected ? '' : ' reserves-linked-card__selected-badge--hidden'; ?>" data-reserves-i18n="selectedBadge"><?php echo htmlspecialchars($selectedBadgeText, ENT_QUOTES, 'UTF-8'); ?></span>
        </div>
        <?php endif; ?>

        <?php if ($reservesShowUnlink ?? true): ?>
        <button
            type="button"
            class="reserves-linked-card__unlink reserves-linking__unlink"
            data-game-api-provider="<?php echo htmlspecialchars($reservesLinkedProvider, ENT_QUOTES, 'UTF-8'); ?>"
            data-reserve-realm="<?php echo htmlspecialchars((string) ($reservesLinkedRealm ?? ''), ENT_QUOTES, 'UTF-8'); ?>"
            data-reserve-link-id="<?php echo (int) ($reservesLinkedLinkId ?? 0); ?>"
            data-reserves-i18n-title="unlink"
            title="<?php echo $reservesCardIsEn ? 'Unlink' : 'Отвязать'; ?>"
            aria-label="<?php echo $reservesCardIsEn ? 'Unlink' : 'Отвязать'; ?>"
        >
            <i class="fas fa-times" aria-hidden="true"></i>
        </button>
        <?php endif; ?>
    </div>
</div>
