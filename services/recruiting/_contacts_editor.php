<?php
/**
 * Редактор контактов (тип + значение, несколько строк).
 *
 * Expects: $lang, $contacts (list), optional $contactsInputName, $contactsEditorId, $showContactsHint
 */
$contacts = isset($contacts) && is_array($contacts) ? $contacts : [];
$contactsInputName = isset($contactsInputName) ? (string) $contactsInputName : 'contacts_json';
$contactsEditorId = isset($contactsEditorId) ? (string) $contactsEditorId : 'recruitingContactsEditor';
$showContactsHint = !isset($showContactsHint) || $showContactsHint;
$contactsJson = json_encode($contacts, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
if ($contactsJson === false) {
    $contactsJson = '[]';
}
?>
                    <div class="recruiting-form-field recruiting-form-field--full">
                        <span class="recruiting-form-label" data-profile-i18n="contacts"><?php echo $lang === 'en' ? 'Contacts' : 'Контакты'; ?></span>
                        <div
                            class="recruiting-contacts-editor"
                            id="<?php echo htmlspecialchars($contactsEditorId, ENT_QUOTES, 'UTF-8'); ?>"
                            data-lang="<?php echo htmlspecialchars($lang, ENT_QUOTES, 'UTF-8'); ?>"
                        ></div>
                        <input
                            type="hidden"
                            name="<?php echo htmlspecialchars($contactsInputName, ENT_QUOTES, 'UTF-8'); ?>"
                            id="<?php echo htmlspecialchars($contactsEditorId, ENT_QUOTES, 'UTF-8'); ?>Input"
                            value="<?php echo htmlspecialchars($contactsJson, ENT_QUOTES, 'UTF-8'); ?>"
                        >
                        <?php if ($showContactsHint): ?>
                        <p class="recruiting-form-hint">
                            <?php echo $lang === 'en'
                                ? 'Saved for your next ads. You can also change defaults in your account.'
                                : 'Сохраняются для следующих объявлений. Можно изменить в личном кабинете.'; ?>
                        </p>
                        <?php endif; ?>
                    </div>
