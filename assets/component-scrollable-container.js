/******/ (() => { // webpackBootstrap
var __webpack_exports__ = {};
class ScrollableContainer extends HTMLElement {
  constructor() {
    super();
    let throttleTimer;
  }

  connectedCallback() {
    this.init();
  }

  init() {
    window.wetheme.webcomponentRegistry.register({key: 'scrollable-container'});
    this.addEventListener('scroll', this.onScrollHandling);
  }

  onScroll() {
    let scrollTop = this.scrollTop;
    let threshold = 5;
    if (scrollTop + this.clientHeight + threshold >= this.scrollHeight) {
      this.classList.add('bottom');
    } else if (scrollTop - threshold <= 0) {
      this.classList.add('top');
    } else {
      this.classList.remove('top');
      this.classList.remove('bottom');
    }
  }

  onScrollHandling() {
    this.throttle(this.onScroll, 100)
  }

  throttle (callback, time) {
    if (this.throttleTimer) return;
    this.throttleTimer = true;
    setTimeout(() => {
      callback.call(this);
      this.throttleTimer = false;
    }, time);
  }
}

// Only define the custom element if it doesn't already exist
if (!customElements.get('scrollable-container')) customElements.define('scrollable-container', ScrollableContainer);
  
/******/ })()
;