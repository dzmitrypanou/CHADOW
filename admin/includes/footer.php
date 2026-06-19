<?php

if (!isset($appVersion)) {
    $_fvRaw = @file_get_contents(__DIR__ . '/../../config/version.json');
    $_fvData = $_fvRaw ? json_decode($_fvRaw, true) : null;
    $appVersion = (is_array($_fvData) && !empty($_fvData['version'])) ? $_fvData['version'] : '3.4.4';
}
?>
    <div class="container admin-footer-wrap">
    <footer>
        <div class="footer-links">
            <a href="https://twitch.tv/chadowfriend" target="_blank" rel="noopener noreferrer" class="social-link"><i class="fab fa-twitch"></i> Twitch</a>
            <span class="separator">•</span>
            <a href="https://vk.com/chadowfriend" target="_blank" rel="noopener noreferrer" class="social-link"><i class="fab fa-vk"></i> VK</a>
            <span class="separator">•</span>
            <a href="https://www.donationalerts.com/r/chadowfriend" target="_blank" rel="noopener noreferrer" class="social-link"><i class="fas fa-university"></i> Donation</a>
        </div>
        <div class="footer-text">
            Copyright (c) 2026 CHADOW <span class="version">ver. <?php echo htmlspecialchars($appVersion); ?></span> Oleg Olegovich by <a href="https://tanki.su/ru/community/accounts/282194247" target="_blank" rel="noopener noreferrer" class="version footer-author-link">Immortal_Emperor</a>.
        </div>
        <div class="footer-text">
            As smoke is driven away, So drive them away; As wax melts before the fire,
        </div>
        <div class="footer-text">
            So let the wicked perish at the presence of God. Psalms 67:2 (NKJV)
        </div>
    </footer>
    </div>
    <div class="admin-page-bottom-spacer" aria-hidden="true"></div>
