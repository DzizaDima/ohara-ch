(function () {
  'use strict';

  // Required Terms & Conditions agreement in the cart page and the cart drawer.
  // Markup lives in snippets/terms-checkbox.liquid.
  //
  // - The checkbox is `required`, so the native cart form cannot reach checkout
  //   without it; here we only replace the browser bubble with an inline error.
  // - The agreement (time + terms version) is written to cart attributes, which
  //   Shopify copies onto the order. It is sent both with the checkout form post
  //   and via /cart/update.js, because express buttons (Shop Pay, Apple Pay,
  //   Google Pay, PayPal) start checkout from the cart without posting the form.
  // - Express buttons are inert until the box is ticked and the agreement saved.
  //
  // Listeners are delegated from document because the drawer is a Vue template
  // that recreates its DOM every time it opens.

  if (window.oharaTermsConsent) return;
  window.oharaTermsConsent = true;

  var CHECKBOX = '[data-terms-checkbox]';
  var EXPRESS = '[data-terms-express]';
  var LOCKED_CLASS = 'is-terms-locked';

  var ATTR_ACCEPTED = 'Terms accepted';
  var ATTR_ACCEPTED_AT = 'Terms accepted at';
  var ATTR_VERSION = 'Terms version';

  function scopeOf(el) {
    return el.closest('form') || document;
  }

  function find(scope, selector) {
    return scope.querySelector(selector);
  }

  function setExpressLocked(scope, locked) {
    var wrappers = scope.querySelectorAll(EXPRESS);
    for (var i = 0; i < wrappers.length; i++) {
      wrappers[i].classList.toggle(LOCKED_CLASS, locked);
      var inner = wrappers[i].querySelector('[data-terms-express-inner]');
      if (inner) {
        if (locked) inner.setAttribute('inert', '');
        else inner.removeAttribute('inert');
      }
    }
  }

  function showError(checkbox, visible) {
    var consent = checkbox.closest('[data-terms-consent]');
    var error = consent && find(consent, '[data-terms-error]');
    if (!consent || !error) return;
    error.hidden = !visible;
    consent.classList.toggle('terms-consent--invalid', visible);
    checkbox.setAttribute('aria-invalid', visible ? 'true' : 'false');
  }

  function requireAgreement(checkbox) {
    showError(checkbox, true);
    checkbox.focus({ preventScroll: true });
    checkbox.closest('[data-terms-consent]').scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function saveAgreement(checkbox) {
    var consent = checkbox.closest('[data-terms-consent]');
    var acceptedAt = find(consent, '[data-terms-accepted-at]');
    var version = find(consent, '[data-terms-version]');
    var attributes = {};

    if (checkbox.checked) {
      acceptedAt.value = new Date().toISOString();
      attributes[ATTR_ACCEPTED] = 'Yes';
      attributes[ATTR_ACCEPTED_AT] = acceptedAt.value;
      attributes[ATTR_VERSION] = version.value;
    } else {
      // Empty values remove the attributes from the cart.
      acceptedAt.value = '';
      attributes[ATTR_ACCEPTED] = '';
      attributes[ATTR_ACCEPTED_AT] = '';
      attributes[ATTR_VERSION] = '';
    }

    return window.fetch((window.Shopify && window.Shopify.routes ? window.Shopify.routes.root : '/') + 'cart/update.js', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ attributes: attributes })
    });
  }

  document.addEventListener('change', function (event) {
    var checkbox = event.target;
    if (!checkbox.matches || !checkbox.matches(CHECKBOX)) return;

    var scope = scopeOf(checkbox);
    setExpressLocked(scope, true);
    if (checkbox.checked) showError(checkbox, false);

    saveAgreement(checkbox)
      .catch(function (error) {
        // The checkout form still posts the attributes itself, so a failed save
        // must not keep express checkout locked.
        console.warn('[terms-consent] Could not save agreement to cart', error);
      })
      .then(function () {
        setExpressLocked(scope, !checkbox.checked);
      });
  });

  // The browser fires `invalid` instead of `submit` when the required box is
  // unticked; swap its bubble for the inline message.
  document.addEventListener('invalid', function (event) {
    var checkbox = event.target;
    if (!checkbox.matches || !checkbox.matches(CHECKBOX)) return;
    event.preventDefault();
    requireAgreement(checkbox);
  }, true);

  document.addEventListener('submit', function (event) {
    var checkbox = find(event.target, CHECKBOX);
    if (!checkbox) return;

    var submitter = event.submitter;
    if (submitter && submitter.name !== 'checkout') return;

    // Backstop for forms with `novalidate` or browsers without constraint validation.
    if (!checkbox.checked) {
      event.preventDefault();
      requireAgreement(checkbox);
      return;
    }

    var acceptedAt = find(event.target, '[data-terms-accepted-at]');
    if (acceptedAt && !acceptedAt.value) acceptedAt.value = new Date().toISOString();
  }, true);

  // Browsers restore checkbox state on back/forward navigation; resync the
  // express lock and the saved agreement for boxes that come back ticked.
  window.addEventListener('pageshow', function () {
    var checkboxes = document.querySelectorAll(CHECKBOX);
    for (var i = 0; i < checkboxes.length; i++) {
      if (checkboxes[i].checked) {
        checkboxes[i].dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  });

  // Inert buttons let the click fall through to the wrapper.
  document.addEventListener('click', function (event) {
    var wrapper = event.target.closest && event.target.closest(EXPRESS);
    if (!wrapper || !wrapper.classList.contains(LOCKED_CLASS)) return;

    var checkbox = find(scopeOf(wrapper), CHECKBOX);
    if (checkbox && !checkbox.checked) requireAgreement(checkbox);
  });
})();
