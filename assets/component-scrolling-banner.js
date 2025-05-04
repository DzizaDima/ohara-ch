/******/ (() => { // webpackBootstrap
var __webpack_exports__ = {};
class ScrollingBanner extends HTMLElement {
  constructor() {
    super();
    this.duplicatedLinks = this.querySelectorAll('ol[data-duplicated] a');
  }

  connectedCallback() {
    this.init();
  }

  init() {
    this.duplicatedLinks.forEach(link => {
      link.setAttribute('tabindex', '-1'); //prevents focusing on a duplicated link on keyboard nav
    });
  }

}

// Only define the custom element if it doesn't already exist
if (!customElements.get('scrolling-banner')) customElements.define('scrolling-banner', ScrollingBanner);

/******/ })()
;