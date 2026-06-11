(() => {
    const clanInput = document.getElementById('recruiting_profile_clan_tag');
    if (!clanInput) return;

    clanInput.classList.add('recruiting-clan-tag-value--caps');

    clanInput.addEventListener('input', () => {
        const upper = clanInput.value.toUpperCase();
        if (upper === clanInput.value) return;
        const start = clanInput.selectionStart;
        const end = clanInput.selectionEnd;
        clanInput.value = upper;
        if (start !== null && end !== null) {
            clanInput.setSelectionRange(start, end);
        }
    });
})();
