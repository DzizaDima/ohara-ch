(function () {
  'use strict';

  // Guards every path into the cart against a missing Buunto delivery-date
  // selection. Loaded synchronously from the <head> so the fetch/XHR patches are
  // installed before theme.min.js, the cross-sell components or any app script
  // gets a chance to add a line item.
  //
  // Source of truth is the set of properties[...] inputs Buunto injects into the
  // add-to-cart form — not the app's JS events — so the guard keeps working even
  // if the app's JS API never becomes available. See
  // https://buunto.helpscoutdocs.com/article/70-how-to-integreate-buunto-and-product-options-apps

  var WIDGET_SELECTOR = '#buunto-date-picker';
  var FORM_SELECTOR = 'form[action*="/cart/add"]';
  var CART_ADD_RE = /\/cart\/add(\.js)?($|\?)/;
  var LOCKED_CLASS = 'buunto-locked';
  var ATTENTION_CLASS = 'buunto-attention';

  // How long the widget may sit in the DOM without Buunto ever producing a
  // usable selection before we stop blocking. A dead CDN or an ad-blocker must
  // never permanently break the store; checkout-side validation is the backstop.
  var FAIL_OPEN_MS = 20000;

  // Line item properties this theme renders itself. They are never evidence of a
  // Buunto selection, so they are excluded when deciding whether a delivery date
  // has been chosen. See snippets/gift-card-recipient-form.liquid and the
  // commented-out legacy air-datepicker input in sections/template--product.liquid.
  //
  // An explicit list is used rather than a "properties present before the widget
  // loaded" baseline on purpose: Buunto injects its inputs asynchronously, and a
  // timing-based rule silently flips to blocking every add-to-cart on the fast
  // path where the app wins the race.
  var THEME_OWNED_PROPS = [
    '__shopify_send_gift_card_to_recipient',
    'Recipient email',
    'Recipient name',
    'Message'
  ];

  var MESSAGES = {
    en: 'Please choose a delivery date and time slot before adding items to your cart.',
    de: 'Bitte wählen Sie ein Lieferdatum und ein Zeitfenster, bevor Sie Artikel in den Warenkorb legen.',
    ru: 'Пожалуйста, выберите дату и время доставки, прежде чем добавлять товары в корзину.'
  };

  // ─── Shared state ───────────────────────────────────────────────────────────

  // Last selection reported by the app. Only used for the STORE_PICKUP location
  // rule and as a fallback when Buunto is configured to write cart attributes
  // instead of line item properties.
  var selection = { date: undefined, timeSlot: undefined, method: undefined, location: undefined };

  var widgetSeenAt = 0;
  var cartPropsCache = null;
  var cartPropsPending = null;
  var refreshQueued = false;

  // ─── Small helpers ──────────────────────────────────────────────────────────

  function forms() {
    return Array.prototype.slice.call(document.querySelectorAll(FORM_SELECTOR));
  }

  function widget() {
    return document.querySelector(WIDGET_SELECTOR);
  }

  function message() {
    var lang = (document.documentElement.lang || 'en').slice(0, 2).toLowerCase();
    return MESSAGES[lang] || MESSAGES.en;
  }

  function isThemeOwned(name) {
    return THEME_OWNED_PROPS.indexOf(name) !== -1;
  }

  function propertyName(inputName) {
    var match = /^properties\[(.+)\]$/.exec(inputName || '');
    return match ? match[1] : null;
  }

  // Every properties[...] field currently carrying a value, as {name: value}.
  function readFormProperties(form) {
    var out = {};
    var elements = form.elements ? Array.prototype.slice.call(form.elements) : [];

    elements.forEach(function (el) {
      var name = propertyName(el.name);
      if (!name || el.disabled) return;
      if ((el.type === 'checkbox' || el.type === 'radio') && !el.checked) return;
      if (typeof el.value !== 'string' || !el.value.trim()) return;
      out[name] = el.value;
    });

    return out;
  }

  // The subset of a form's properties that stands for a delivery selection:
  // everything the theme does not render itself.
  function readBuuntoProperties(form) {
    var all = readFormProperties(form);
    var out = {};

    Object.keys(all).forEach(function (name) {
      if (isThemeOwned(name)) return;
      out[name] = all[name];
    });

    return out;
  }

  function isEmpty(obj) {
    return !obj || Object.keys(obj).length === 0;
  }

  // True when the form carries a Buunto property input that exists but is still
  // blank. Buunto pre-fills some fields with defaults (e.g. Method = "Shipping",
  // a first time slot) while leaving the actual date input empty, so "at least
  // one non-empty Buunto property" is not proof of a finished selection — an
  // empty one that is present is proof it is NOT finished. Checkboxes/radios are
  // skipped: an unchecked optional property is not an incomplete selection.
  function hasBlankBuuntoProperty(form) {
    var elements = form && form.elements ? Array.prototype.slice.call(form.elements) : [];
    return elements.some(function (el) {
      var name = propertyName(el.name);
      if (!name || el.disabled || isThemeOwned(name)) return false;
      if (el.type === 'checkbox' || el.type === 'radio') return false;
      return typeof el.value !== 'string' || !el.value.trim();
    });
  }

  // ─── Validity ───────────────────────────────────────────────────────────────

  function methodSatisfied() {
    return !(selection.method === 'STORE_PICKUP' && !selection.location);
  }

  // Buunto's own JS API, once it is up, is authoritative about whether the
  // current selection satisfies this shop's rules (required date, time slot,
  // pickup location, postcode). See
  // https://buunto.helpscoutdocs.com/article/35-javascript-api
  function apiReportsErrors() {
    var dp = window.Buunto && window.Buunto.datePicker;
    // appStarted guards the race between the API object appearing and the widget
    // actually evaluating the current selection — hasErrors() can briefly read
    // false before that.
    if (!dp || !dp.appStarted || typeof dp.hasErrors !== 'function') return null;
    try {
      return dp.hasErrors() === true;
    } catch (_) {
      return null;
    }
  }

  // True once Buunto has clearly given up: the widget is on the page but its JS
  // API never arrived and it never injected anything.
  function failedOpen() {
    if (!widgetSeenAt) return false;
    var dp = window.Buunto && window.Buunto.datePicker;
    if (dp && dp.appStarted) return false;
    return Date.now() - widgetSeenAt > FAIL_OPEN_MS;
  }

  function isValid(form) {
    // No widget on this page or this product — nothing to enforce. This is also
    // the fail-open path for a widget that never loads at all, and it heals
    // itself the moment the widget does appear.
    if (!widget()) return true;
    if (failedOpen()) return true;

    // When Buunto's API is up it is the source of truth: it knows exactly which
    // fields this shop requires. Trust it in both directions — a pending error
    // means the selection is incomplete; no error means it is complete, even if
    // some optional property input is still blank.
    var apiErrors = apiReportsErrors();
    if (apiErrors === true) return false;
    if (apiErrors === false) return true;

    // Below here the API is not available (apiErrors === null) — fall back to
    // the DOM and to what selectionChange reported.
    if (form && selectionUsesProperties()) {
      // Properties mode: the selection lives in the form as properties[...]
      // inputs. Any Buunto input that is present but blank (the date, typically,
      // while Method/Time sit pre-filled) means the customer has not finished.
      if (hasBlankBuuntoProperty(form)) return false;
      if (!isEmpty(readBuuntoProperties(form))) return methodSatisfied();
      return false;
    }

    // Buunto can instead be configured to store the selection as cart
    // attributes. In that mode — and when there is no product form at all —
    // there is nothing in the DOM to inspect, so fall back to what the app
    // reported through selectionChange.
    return Boolean(selection.date && selection.timeSlot) && methodSatisfied();
  }

  // Whether Buunto writes line item properties in this shop's configuration.
  // Determined by observing at least one Buunto property anywhere on the page.
  var propertiesModeSeen = false;
  function selectionUsesProperties() {
    if (propertiesModeSeen) return true;
    propertiesModeSeen = forms().some(function (form) {
      return !isEmpty(readBuuntoProperties(form));
    });
    return propertiesModeSeen;
  }

  // ─── Locking the UI ─────────────────────────────────────────────────────────

  function applyLock() {
    forms().forEach(function (form) {
      var locked = !isValid(form);
      form.classList.toggle(LOCKED_CLASS, locked);

      var buttons = form.querySelectorAll('button[name="add"], input[type="submit"][name="add"]');
      Array.prototype.forEach.call(buttons, function (button) {
        button.setAttribute('aria-disabled', locked ? 'true' : 'false');
      });
    });
  }

  // Scroll to the widget, ask Buunto to render its own errors and replay the
  // attention glow. Forcing a reflow restarts the animation on repeat attempts.
  function nudge() {
    var el = widget();
    if (!el) return;

    try {
      if (window.Buunto && window.Buunto.datePicker && window.Buunto.datePicker.checkErrors) {
        window.Buunto.datePicker.checkErrors();
      }
    } catch (_) {}

    try {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (_) {}

    el.classList.remove(ATTENTION_CLASS);
    void el.offsetWidth;
    el.classList.add(ATTENTION_CLASS);
  }

  // ─── Properties to attach to an add that carries none ───────────────────────

  // Buunto's selection as it stands on this page, if any form carries a
  // *complete* one. A form whose selection is unfinished (isValid false) is
  // skipped: propagating its half-filled properties — Method/Time without a
  // date — is exactly the bug this guard exists to prevent.
  function currentPageProperties() {
    var found = null;
    forms().some(function (form) {
      if (!isValid(form)) return false;
      var props = readBuuntoProperties(form);
      if (isEmpty(props)) return false;
      found = props;
      return true;
    });
    return found;
  }

  // The delivery properties already carried by the cart, so an upsell added
  // without its own widget inherits the date the customer picked earlier.
  function cartProperties(nativeFetch) {
    if (cartPropsCache !== null) return Promise.resolve(cartPropsCache);
    if (cartPropsPending) return cartPropsPending;

    cartPropsPending = nativeFetch('/cart.js', { credentials: 'same-origin' })
      .then(function (res) {
        return res.ok ? res.json() : null;
      })
      .then(function (cart) {
        var found = null;

        (((cart && cart.items) || [])).some(function (item) {
          var props = {};
          Object.keys(item.properties || {}).forEach(function (name) {
            var value = item.properties[name];
            if (isThemeOwned(name) || name.charAt(0) === '_') return;
            if (typeof value !== 'string' || !value.trim()) return;
            props[name] = value;
          });
          if (isEmpty(props)) return false;
          found = props;
          return true;
        });

        cartPropsCache = found;
        return found;
      })
      .catch(function () {
        cartPropsCache = null;
        return null;
      })
      .then(function (result) {
        cartPropsPending = null;
        return result;
      });

    return cartPropsPending;
  }

  function invalidateCartProperties() {
    cartPropsCache = null;
  }

  // ─── Cart payload parsing ───────────────────────────────────────────────────

  function parsePayload(body) {
    if (typeof FormData !== 'undefined' && body instanceof FormData) {
      return { kind: 'formdata', value: body };
    }

    if (typeof body === 'string') {
      var trimmed = body.trim();
      if (trimmed.charAt(0) === '{' || trimmed.charAt(0) === '[') {
        try {
          return { kind: 'json', value: JSON.parse(trimmed) };
        } catch (_) {}
      }
      return { kind: 'urlencoded', value: new URLSearchParams(body) };
    }

    return { kind: 'unknown', value: body };
  }

  function payloadItems(parsed) {
    if (parsed.kind !== 'json') return [];
    var value = parsed.value;
    if (value && Array.isArray(value.items)) return value.items;
    if (value && typeof value === 'object') return [value];
    return [];
  }

  function payloadHasProperties(parsed) {
    if (parsed.kind === 'json') {
      return payloadItems(parsed).some(function (item) {
        return !isEmpty(item && item.properties);
      });
    }

    if (parsed.kind === 'urlencoded' || parsed.kind === 'formdata') {
      var names = [];
      parsed.value.forEach(function (value, key) {
        var name = propertyName(key);
        if (name && !isThemeOwned(name) && String(value).trim()) names.push(name);
      });
      return names.length > 0;
    }

    return false;
  }

  function injectProperties(parsed, props) {
    if (parsed.kind === 'json') {
      payloadItems(parsed).forEach(function (item) {
        if (!isEmpty(item.properties)) return;
        item.properties = Object.assign({}, props);
      });
      return true;
    }

    if (parsed.kind === 'urlencoded') {
      Object.keys(props).forEach(function (name) {
        parsed.value.set('properties[' + name + ']', props[name]);
      });
      return true;
    }

    if (parsed.kind === 'formdata') {
      Object.keys(props).forEach(function (name) {
        parsed.value.append('properties[' + name + ']', props[name]);
      });
      return true;
    }

    return false;
  }

  function serializePayload(parsed) {
    if (parsed.kind === 'json') return JSON.stringify(parsed.value);
    if (parsed.kind === 'urlencoded') return parsed.value.toString();
    return parsed.value;
  }

  function blockedResponse() {
    var body = JSON.stringify({
      status: 422,
      message: 'Cart Error',
      description: message()
    });
    return new Response(body, {
      status: 422,
      statusText: 'Unprocessable Entity',
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // ─── fetch patch ────────────────────────────────────────────────────────────

  function patchFetch() {
    var original = window.fetch;
    if (typeof original !== 'function' || original.__buuntoPatched) return;

    // fetch must be invoked with `this` bound to the global object.
    var nativeFetch = original.bind(window);

    var patched = function (input, init) {
      var url;
      var method;

      try {
        url = typeof input === 'string' ? input : (input && input.url) || '';
        method = (init && init.method) || (input && input.method) || 'GET';
      } catch (_) {
        return nativeFetch(input, init);
      }

      if (!CART_ADD_RE.test(url) || String(method).toUpperCase() !== 'POST') {
        return nativeFetch(input, init);
      }

      return guardCartAdd(input, init, nativeFetch);
    };

    patched.__buuntoPatched = true;
    window.fetch = patched;
  }

  // Decides what to do with a cart add without dispatching anything, so a
  // failure while inspecting the payload can never result in a double send.
  async function decideCartAdd(input, init, nativeFetch) {
    var isRequest = typeof Request !== 'undefined' && input instanceof Request;
    var rawBody = init && init.body != null ? init.body : null;

    if (rawBody == null && isRequest) {
      rawBody = await input.clone().text();
    }

    var parsed = rawBody == null ? { kind: 'unknown', value: null } : parsePayload(rawBody);

    // The add already carries delivery properties — let it through untouched. A
    // third-party app that copies only Buunto's pre-seeded Method/Time into its
    // own payload (no date) is out of scope; checkout-side validation is the
    // backstop there.
    if (payloadHasProperties(parsed)) return { action: 'pass' };

    // A finished selection to fall back on: from a valid form on this page
    // (currentPageProperties skips forms whose selection is unfinished), or from
    // what the cart already carries.
    var props = currentPageProperties();
    if (isEmpty(props)) {
      props = await cartProperties(nativeFetch);
    }

    if (!isEmpty(props) && injectProperties(parsed, props)) {
      return { action: 'rewrite', parsed: parsed, isRequest: isRequest };
    }

    // Nothing to inherit. Block only where we can prove a date is required,
    // i.e. the widget is on the page and still unsatisfied. Off-PDP adds with an
    // empty cart are allowed through — blocking them would leave the customer
    // with no way to pick a date at all. Checkout-side validation covers those.
    if (widget() && !isValid(widgetForm())) {
      return { action: 'block' };
    }

    return { action: 'pass' };
  }

  // The add-to-cart form the Buunto widget belongs to, for validity checks.
  function widgetForm() {
    var el = widget();
    var owned = el && typeof el.closest === 'function' ? el.closest(FORM_SELECTOR) : null;
    return owned || document.querySelector(FORM_SELECTOR);
  }

  async function guardCartAdd(input, init, nativeFetch) {
    var decision;

    try {
      decision = await decideCartAdd(input, init, nativeFetch);
    } catch (_) {
      decision = { action: 'pass' };
    }

    if (decision.action === 'block') {
      nudge();
      return blockedResponse();
    }

    invalidateCartProperties();

    if (decision.action === 'rewrite') {
      return sendWithBody(input, init, decision.parsed, decision.isRequest, nativeFetch);
    }

    return nativeFetch(input, init);
  }

  function sendWithBody(input, init, parsed, isRequest, nativeFetch) {
    var body = serializePayload(parsed);

    if (!isRequest) {
      return nativeFetch(input, Object.assign({}, init, { body: body }));
    }

    return nativeFetch(input.url, {
      method: input.method,
      headers: input.headers,
      credentials: input.credentials,
      mode: input.mode,
      body: body
    });
  }

  // ─── XMLHttpRequest patch ───────────────────────────────────────────────────
  // Best-effort only: injects known properties into legacy XHR adds (some apps
  // still use them). It never blocks, because send() cannot wait on /cart.js.

  function patchXhr() {
    if (typeof XMLHttpRequest === 'undefined') return;

    var proto = XMLHttpRequest.prototype;
    if (proto.send.__buuntoPatched) return;

    var nativeOpen = proto.open;
    var nativeSend = proto.send;

    proto.open = function (method, url) {
      this.__buuntoCartAdd =
        String(method || '').toUpperCase() === 'POST' && CART_ADD_RE.test(String(url || ''));
      return nativeOpen.apply(this, arguments);
    };

    proto.send = function (body) {
      if (this.__buuntoCartAdd && body != null) {
        try {
          var parsed = parsePayload(body);
          if (!payloadHasProperties(parsed)) {
            var props = currentPageProperties();
            if (!isEmpty(props) && injectProperties(parsed, props)) {
              invalidateCartProperties();
              return nativeSend.call(this, serializePayload(parsed));
            }
          }
          invalidateCartProperties();
        } catch (_) {}
      }
      return nativeSend.apply(this, arguments);
    };

    proto.send.__buuntoPatched = true;
  }

  // ─── Event interception ─────────────────────────────────────────────────────
  // Both listeners sit on `document` in the capture phase, which always runs
  // before listeners bound to the form itself. The theme binds its own AJAX
  // submit handler on #AddToCartForm (assets/theme.js), and listeners on the
  // target element fire in registration order regardless of the capture flag —
  // so a listener on the form could never reliably pre-empt it.

  function onSubmitCapture(event) {
    var form = event.target;
    if (!form || typeof form.matches !== 'function' || !form.matches(FORM_SELECTOR)) return;
    if (isValid(form)) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    nudge();
  }

  function onClickCapture(event) {
    var target = event.target;
    if (!target || typeof target.closest !== 'function') return;

    var trigger = target.closest(
      'button[name="add"], input[type="submit"][name="add"], .quick-add-button, ' +
        '.paymentButtonsWrapper, .shopify-payment-button, [data-shopify="payment-button"]'
    );
    if (!trigger) return;

    var form = trigger.closest(FORM_SELECTOR);
    if (!form || isValid(form)) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    nudge();
  }

  // ─── Wiring ─────────────────────────────────────────────────────────────────

  function refresh() {
    if (!widgetSeenAt && widget()) widgetSeenAt = Date.now();
    applyLock();
  }

  function queueRefresh() {
    if (refreshQueued) return;
    refreshQueued = true;
    window.requestAnimationFrame(function () {
      refreshQueued = false;
      refresh();
    });
  }

  function observe() {
    // Kept running for the lifetime of the page: the widget is injected
    // asynchronously, quick view swaps in a whole new product form, and the
    // theme editor reloads sections.
    new MutationObserver(queueRefresh).observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function start() {
    refresh();
    observe();

    document.addEventListener('BuuntoDatePicker:selectionChange', function (e) {
      var detail = (e && e.detail) || {};
      selection.date = detail.date;
      selection.timeSlot = detail.timeSlot;
      selection.method = detail.method;
      selection.location = detail.location;
      refresh();
    });

    document.addEventListener('BuuntoDatePicker:cartAttributesUpdated', function () {
      invalidateCartProperties();
      refresh();
    });

    document.addEventListener('product-form:ready', refresh);
    document.addEventListener('shopify:section:load', refresh);
    document.documentElement.addEventListener('wetheme-cart-update', invalidateCartProperties);

    // Re-evaluate periodically so a late-loading Buunto API lifts the fail-open
    // state, and so a stale lock cannot outlive the reason for it.
    window.setInterval(applyLock, 2000);
  }

  // Patches go in immediately, at <head> parse time, before anything else can
  // touch the cart. DOM wiring waits for a body to attach to.
  patchFetch();
  patchXhr();
  document.addEventListener('submit', onSubmitCapture, true);
  document.addEventListener('click', onClickCapture, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
