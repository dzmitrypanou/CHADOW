<?php

$passwordShowToggle = !isset($passwordShowToggle) || $passwordShowToggle;
$passwordToggleLabel = $isEn ? 'Show password' : 'Показать пароль';
?>
<?php if ($passwordShowToggle): ?>
<div class="auth-password-wrap">
    <input
        type="password"
        id="<?php echo htmlspecialchars($passwordInputId, ENT_QUOTES, 'UTF-8'); ?>"
        name="<?php echo htmlspecialchars($passwordInputName, ENT_QUOTES, 'UTF-8'); ?>"
        <?php echo $passwordInputExtra ?? ''; ?>
    >
    <button
        type="button"
        class="auth-password-toggle"
        aria-label="<?php echo htmlspecialchars($passwordToggleLabel, ENT_QUOTES, 'UTF-8'); ?>"
        aria-pressed="false"
    >
        <i class="fas fa-eye" aria-hidden="true"></i>
    </button>
</div>
<?php else: ?>
<input
    type="password"
    id="<?php echo htmlspecialchars($passwordInputId, ENT_QUOTES, 'UTF-8'); ?>"
    name="<?php echo htmlspecialchars($passwordInputName, ENT_QUOTES, 'UTF-8'); ?>"
    <?php echo $passwordInputExtra ?? ''; ?>
>
<?php endif; ?>
