/******/ (() => { // webpackBootstrap
var __webpack_exports__ = {};
class CollapsibleButton extends HTMLElement {
  constructor() {
    super();
    this.THROTTLE_INTERVAL = 100;
    this.bottomGapHeight = 15;
    this.contentBlockheight = () => this.nextElementSibling.querySelector('.content').offsetHeight + this.bottomGapHeight + 'px';
  }

  connectedCallback() {
    this.init();
  }

  init() {
    window.wetheme.webcomponentRegistry.register({key: 'collapsible-button'});
    this.collapsibleContent = this.parentElement.querySelector('.collapsible-content');
    if(this.nextElementSibling.classList.contains('collapsible-content') && this.parentElement.classList.contains('collapsible-tab')) {

      // Set initial height based on state
      this.parentElement.classList.contains('open') ? this.nextElementSibling.style.height = this.contentBlockheight() : this.nextElementSibling.style.height = '0px';

      // Handle click
      this.addEventListener('click', this.toggle);

      // Handle enter key
      this.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          this.toggle();
        }
      });

      // Handle window resize
      window.addEventListener('resize', this.handleResize.bind(this));

      // Handle collapsible tab content size change
      this.nextElementSibling.addEventListener('click', this.resetHeight.bind(this));
    }
  }

  handleResize() {
    this.throttle(this.resetHeight, this.THROTTLE_INTERVAL);
  }

  resetHeight() {
    if(!this.parentElement.classList.contains('open')) return;
    this.setTransitionHeight(this.nextElementSibling, false);
  }

  toggle() {
    this.parentElement.classList.contains('open') ? this.hideDetails() : this.showDetails();
  }

  showDetails() {
    this.setTransitionHeight(this.nextElementSibling, false)
    this.parentElement.classList.add('open');

    if (this.collapsibleContent) {
      this.collapsibleContent.addEventListener('transitionend', this.transitionEndHandler.bind(this), {once: true});
    }
  }

  hideDetails() {
    this.setTransitionHeight(this.nextElementSibling, true)
    this.parentElement.classList.remove('open');

    if (this.collapsibleContent) {
      this.collapsibleContent.style.overflow = 'hidden';
    }
  }

  setTransitionHeight(container, isOpen) {
    if(isOpen) {
      container.style.height = '0px';
    } else {
      container.style.height = this.contentBlockheight();
    }
  }

  transitionEndHandler(event) {
    // Check if the transitionend event is for the height property
    if (event.propertyName === 'height') {
      this.collapsibleContent.style.overflow = 'visible';
    }
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
if (!customElements.get('collapsible-button')) customElements.define('collapsible-button', CollapsibleButton);

/******/ })()
;