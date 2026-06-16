<?php

?>
    <meta name="csrf-token" content="<?php echo htmlspecialchars(admin_csrf_token(), ENT_QUOTES, 'UTF-8'); ?>">
    <script>
(function() {
  var m = document.querySelector('meta[name="csrf-token"]');
  window.__csrfToken = m ? m.getAttribute('content') : '';
  var of = window.fetch;
  window.fetch = function(input, init) {
    init = init || {};
    var method = String(init.method || 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS' && window.__csrfToken) {
      var h = init.headers;
      var headers = h instanceof Headers ? h : new Headers(h || undefined);
      if (!headers.has('X-CSRF-Token')) headers.set('X-CSRF-Token', window.__csrfToken);
      init.headers = headers;
    }
    return of.call(this, input, init);
  };
})();
    </script>
