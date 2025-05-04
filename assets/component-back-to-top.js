/******/ (() => { // webpackBootstrap
var __webpack_exports__ = {};
class BackToTop extends HTMLElement {
  constructor() {
    super();
    this.button = this.querySelector('[data-selector="back-to-top-button"]');
    this.lastScrollPosition = window.pageYOffset;
  }

  connectedCallback() {
    this.attachEvents();
    this.handleDisplay(this.isDesktop());
  }

  attachEvents() {
    window.addEventListener('scroll', this.handleScroll.bind(this));
    this.button.addEventListener('click', this.scrollToTop.bind(this));
    this.button.addEventListener('focus', this.showButton.bind(this));
  }

  scrollToTop() {
    window.scrollTo({ top: 0, behavior: this.scrollBehavior });
    this.button.blur();
  }

  handleScroll() {
    const currentScrollPosition = window.pageYOffset;
    if (currentScrollPosition > this.lastScrollPosition) {
      this.handleDisplay(this.isDesktop());
    } else {
      this.handleDisplay(this.isDesktop(), true);
    }
    this.lastScrollPosition = currentScrollPosition <= 0 ? 0 : currentScrollPosition;
  }

  handleDisplay(isDesktop, scrollingUp = false) {
    // If on desktop, or scrolling up on mobile, show button if page is scrolled beyond the window height
    const showButton = isDesktop || scrollingUp;
    if (window.pageYOffset > window.innerHeight && showButton) {
      this.showButton();
    } else {
      this.hideButton();
    }
  }

  showButton() {
    // If button is already showing, do nothing
    if (this.classList.contains('back-to-top--visible')) return;
    this.classList.add('back-to-top--visible');
  }

  hideButton() {
    // If button is already hidden, do nothing
    if (!this.classList.contains('back-to-top--visible')) return;
    this.classList.remove('back-to-top--visible');
  }

  isDesktop() {
    return !window.matchMedia('screen and (max-width: 767px)').matches;
  }

  get scrollBehavior() {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    return prefersReducedMotion.matches ? 'auto' : 'smooth';
  }
}

customElements.define('back-to-top', BackToTop);

/******/ })()
;