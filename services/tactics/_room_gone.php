<?php

$asOverlay = !empty($asOverlay);
$createHref = rtrim($lobbyHref, '/') . '#tactics-create';
$roomsHref = $roomsHref ?? $lobbyHref;
$isEn = $lang === 'en';
?>
<div class="tactics-room-gone<?php echo $asOverlay ? ' tactics-room-gone--overlay' : ''; ?>"<?php echo $asOverlay ? ' id="tacticsRoomGone" hidden' : ''; ?> role="alertdialog" aria-modal="true" aria-labelledby="tacticsRoomGoneTitle">
    <div class="tactics-room-gone__card">
        <div class="tactics-room-gone__icon" aria-hidden="true">
            <i class="fas fa-map-marked-alt"></i>
        </div>
        <h2 class="tactics-room-gone__title" id="tacticsRoomGoneTitle" data-tactics-i18n="roomGoneTitle">
            <?php echo $isEn ? 'Room unavailable' : 'Комната недоступна'; ?>
        </h2>
        <p class="tactics-room-gone__text" data-tactics-i18n="roomGoneText">
            <?php echo $isEn
                ? 'This room was deleted or the link is no longer valid. You can return to open rooms or create a new one.'
                : 'Эта комната была удалена или ссылка больше не действует. Вернитесь к открытым комнатам или создайте новую.'; ?>
        </p>
        <div class="tactics-room-gone__actions">
            <a class="tactics-submit-btn tactics-room-gone__btn" href="<?php echo htmlspecialchars($roomsHref, ENT_QUOTES, 'UTF-8'); ?>">
                <i class="fas fa-th-list" aria-hidden="true"></i>
                <span data-tactics-i18n="roomGoneToLobby"><?php echo $isEn ? 'Open rooms' : 'К открытым комнатам'; ?></span>
            </a>
            <a class="tactics-back-link tactics-room-gone__btn-secondary" href="<?php echo htmlspecialchars($createHref, ENT_QUOTES, 'UTF-8'); ?>">
                <i class="fas fa-plus" aria-hidden="true"></i>
                <span data-tactics-i18n="roomGoneCreate"><?php echo $isEn ? 'Create room' : 'Создать комнату'; ?></span>
            </a>
        </div>
    </div>
</div>
