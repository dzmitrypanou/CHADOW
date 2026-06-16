<?php

?>
<div class="tactics-confirm" id="tacticsConfirmModal" hidden>
    <div class="tactics-confirm__backdrop" data-tactics-confirm-backdrop tabindex="-1" aria-hidden="true"></div>
    <div class="tactics-confirm__dialog" role="alertdialog" aria-modal="true" aria-labelledby="tacticsConfirmTitle" aria-describedby="tacticsConfirmMessage">
        <h2 class="tactics-confirm__title" id="tacticsConfirmTitle" data-tactics-confirm-title><?php echo $lang === 'en' ? 'Confirm action' : 'Подтвердите действие'; ?></h2>
        <p class="tactics-confirm__message" id="tacticsConfirmMessage" data-tactics-confirm-message></p>
        <div class="tactics-confirm__actions" data-tactics-confirm-actions>
            <button type="button" class="tactics-confirm__btn tactics-confirm__btn--ghost" data-tactics-confirm-cancel><?php echo $lang === 'en' ? 'Cancel' : 'Отмена'; ?></button>
            <button type="button" class="tactics-confirm__btn tactics-confirm__btn--primary" data-tactics-confirm-ok><?php echo $lang === 'en' ? 'Confirm' : 'Подтвердить'; ?></button>
        </div>
        <div class="tactics-confirm__actions" data-tactics-confirm-actions-alert hidden>
            <button type="button" class="tactics-confirm__btn tactics-confirm__btn--primary" data-tactics-confirm-alert-ok><?php echo $lang === 'en' ? 'OK' : 'OK'; ?></button>
        </div>
    </div>
</div>
