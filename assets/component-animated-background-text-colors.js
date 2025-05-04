/******/ (() => { // webpackBootstrap
var __webpack_exports__ = {};
class animatedBackgroundTextColors extends HTMLElement {
  constructor() {
    super();

    this.blocks = this.querySelectorAll('[data-announcement-block]');
    this.index = 1;
    this.interval;
  }

  connectedCallback() {
    this.init();

    // Editor events
    if (window.Shopify.designMode) {
      document.addEventListener('shopify:block:select', this.handleBlockSelect.bind(this));
      document.addEventListener('shopify:block:deselect', this.handleBlockDeselect.bind(this));
    }
  }

  init() {
    this.interval = setInterval(this.changeColors.bind(this), 7000);
  }

  changeColors() {
    // Get the new active block
    const activeBlock = this.blocks[this.index];
    
    // Get colors from the active block
    const backgroundColor = activeBlock.getAttribute('data-background-color-block');
    const frontColor = activeBlock.getAttribute('data-front-color-block');
    
    // Update component colors with active block colors
    setTimeout(() => {
      this.style.backgroundColor = backgroundColor;
      this.style.color = frontColor;
    }, 350);
    
    // Remove the 'active' class from the previous active block
    const prevActiveBlock = this.querySelector('[data-announcement-block].active');
    if (prevActiveBlock) prevActiveBlock.classList.remove('active');
    
    // Add the 'active' class to the new active block
    activeBlock.classList.add('active');

    // Update index
    this.index = (this.index + 1) % this.blocks.length;
  }

  handleBlockSelect(e) {
    const blockIndex = e.target.dataset.announcementBlockIndex;
    if (!blockIndex) return;

    this.blocks.forEach(block => block.classList.remove('active'));

    e.target.classList.add('active');
    
    e.target.style.backgroundColor = e.target.getAttribute('data-background-color-block');
    e.target.style.color = e.target.getAttribute('data-front-color-block');
    e.target.style.transition = 'none';

    this.style.transition = 'none';
    this.style.backgroundColor = e.target.getAttribute('data-background-color-block');
    this.style.color = e.target.getAttribute('data-front-color-block');

    clearInterval(this.interval);
    this.index = parseInt(blockIndex);
  }

  handleBlockDeselect(e) {
    const blockIndex = e.target.dataset.announcementBlockIndex;
    if (!blockIndex) return;

    e.target.style.backgroundColor = '';
    e.target.style.color = '';
    e.target.style.transition = '';

    this.style.transition = '';

    // Update index
    this.index = (parseInt(blockIndex) + 1) % this.blocks.length;
    this.init();
  }

}

customElements.define('animated-background-text-colors', animatedBackgroundTextColors);

/******/ })()
;