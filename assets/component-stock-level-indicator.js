/******/ (() => { // webpackBootstrap
var __webpack_exports__ = {};

class StockLevelIndicator extends HTMLElement {
  constructor() {
    super();
  }

  static get observedAttributes() {
    return ['data-flow-variant-id'];
  }

  attributeChangedCallback(attribute, oldVal, newVal) {
    if(!oldVal || oldVal === newVal) return;
    this.setActiveIndicator(newVal);
  }

  connectedCallback() {
    this.init();
  }

  init() {
    const observer = new IntersectionObserver(this.intersected, { threshold: 1 });
    observer.observe(this);
  }

  intersected(entry, observer) {
    if (entry[0].isIntersecting) {
      entry[0].target.classList.add('animate-bar');
      observer.unobserve(entry[0].target);
    }
  }

  setActiveIndicator(variantId) {
    const indicators = this.querySelectorAll('[data-flow-selector="stock-level-indicator"]');
    indicators.forEach(indicator => {
      if (variantId == indicator.dataset.variantId) {
        indicator.classList.remove('hidden');
      } else {
        indicator.classList.add('hidden');
      }
    });
  }
}

customElements.define('stock-level-indicator', StockLevelIndicator);

/******/ })()
;