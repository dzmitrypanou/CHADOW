(() => {
    'use strict';

    const form = document.getElementById('profileGameNicksForm');
    if (!form) return;

    form.querySelectorAll(
        '[data-profile-stats-link], .profile-game-nick-field__stats-sep, .profile-game-nick-field__stats'
    ).forEach((el) => el.remove());
})();
