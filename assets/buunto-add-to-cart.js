(function () {
  'use strict';

  var WIDGET_SELECTOR = '#buunto-date-picker';
  var BUTTON_SELECTOR = '#AddToCart';
  var INITIALIZED_ATTR = 'data-buunto-atc-initialized';
  var API_TIMEOUT_MS = 10000;
  var WIDGET_WAIT_MS = 15000;

  // ─── Wait for the widget element to appear in the DOM ──────────────────────
  // The Buunto App Embed injects #buunto-date-picker asynchronously, so it may
  // not exist at DOMContentLoaded time. MutationObserver detects its insertion.
  function waitForWidget(callback) {
    var existing = document.querySelector(WIDGET_SELECTOR);
    if (existing) {
      callback(existing);
      return;
    }

    var deadline = setTimeout(function () {
      observer.disconnect();
    }, WIDGET_WAIT_MS);

    var observer = new MutationObserver(function () {
      var el = document.querySelector(WIDGET_SELECTOR);
      if (!el) return;
      observer.disconnect();
      clearTimeout(deadline);
      callback(el);
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ─── Core logic, runs once the widget element is confirmed in DOM ───────────
  function setup(widget) {
    var button = document.querySelector(BUTTON_SELECTOR);
    if (!button) return;

    var form = button.closest('form[action*="/cart/add"]');
    if (!form) return;

    if (form.hasAttribute(INITIALIZED_ATTR)) return;
    form.setAttribute(INITIALIZED_ATTR, '1');

    var state = {
      date: undefined,
      timeSlot: undefined,
      method: undefined,
      location: undefined
    };
    var failedOpen = false;

    function isValid() {
      if (failedOpen) return true;
      if (!state.date || !state.timeSlot) return false;
      if (state.method === 'STORE_PICKUP' && !state.location) return false;
      return true;
    }

    function applyLock() {
      button.setAttribute('aria-disabled', !isValid() ? 'true' : 'false');
    }

    document.addEventListener('BuuntoDatePicker:selectionChange', function (e) {
      var d = (e && e.detail) || {};
      state.date = d.date;
      state.timeSlot = d.timeSlot;
      state.method = d.method;
      state.location = d.location;
      applyLock();
    });

    // Intercept form submit in capture phase — covers both ATC button and Shop Pay.
    form.addEventListener('submit', function (e) {
      if (isValid()) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      try {
        if (window.Buunto && window.Buunto.datePicker) {
          window.Buunto.datePicker.checkErrors();
        }
      } catch (_) {}
      try {
        widget.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (_) {}

      // Trigger attention glow. Force reflow between remove/add so the animation
      // restarts correctly even on repeated blocked submit attempts.
      widget.classList.remove('buunto-attention');
      void widget.offsetWidth;
      widget.classList.add('buunto-attention');
    }, true);

    // Poll until window.Buunto API is ready. Fail-open after timeout so a CDN
    // failure or ad-blocker never permanently blocks the Add to Cart button.
    var started = Date.now();
    (function waitForApi() {
      if (window.Buunto && window.Buunto.datePicker) return;
      if (Date.now() - started > API_TIMEOUT_MS) {
        failedOpen = true;
        applyLock();
        return;
      }
      setTimeout(waitForApi, 250);
    })();

    applyLock();
  }

  // ─── Entry point ────────────────────────────────────────────────────────────
  function init() {
    waitForWidget(setup);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('shopify:section:load', function () {
    var oldForm = document.querySelector('form[action*="/cart/add"][' + INITIALIZED_ATTR + ']');
    if (oldForm) oldForm.removeAttribute(INITIALIZED_ATTR);
    init();
  });
})();
