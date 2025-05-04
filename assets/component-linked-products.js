/******/ (() => { // webpackBootstrap
var __webpack_exports__ = {};
class LinkedProducts extends HTMLElement {
  constructor() {
    super();

    this.onImageSwatchMouseEnterBound = this.onImageSwatchMouseEnter.bind(this);
    this.onImageSwatchMouseLeaveBound = this.onImageSwatchMouseLeave.bind(this);
  }

  connectedCallback() {
    this.imageSwatchLabel = this.querySelector('.linked-products--title-wrapper .linked-option-product-title');
    this.imageSwatches = this.querySelectorAll('.swatch-element.image-swatch');
    this.setEventListeners();
    this.setActiveImageSwatchLabel();
  }

  setActiveImageSwatchLabel() {
    const selectedImageSwatch = this.querySelector('.swatch-element.image-swatch.active');
    if (!selectedImageSwatch) return;

    this.updateSwatchLabel(selectedImageSwatch);
  }

  updateSwatchLabel = (swatch) => {
    if (!swatch) return;
    const label = swatch.getAttribute('data-value');

    if (!label || !this.imageSwatchLabel) return;
    this.imageSwatchLabel.textContent = label;
  }

  setEventListeners() {
    if (!this.imageSwatches.length) return;

    this.imageSwatches.forEach(swatch => {
      swatch.addEventListener('mouseenter', this.onImageSwatchMouseEnterBound);
      swatch.addEventListener('mouseleave', this.onImageSwatchMouseLeaveBound);
    });
  }

  onImageSwatchMouseEnter(event) {
    const imageSwatchElement = event.currentTarget;
    this.updateSwatchLabel(imageSwatchElement);
  }

  onImageSwatchMouseLeave() {
    const activeImageSwatch = this.querySelector('.swatch-element.image-swatch.active');

    if (activeImageSwatch) {
      this.updateSwatchLabel(activeImageSwatch);
    } else {
      this.imageSwatchLabel.innerText = '';
    }
  }

  removeEventListeners() {
    this.imageSwatches.forEach(swatch => {
      swatch.removeEventListener('mouseenter', this.onImageSwatchMouseEnterBound);
      swatch.removeEventListener('mouseleave', this.onImageSwatchMouseLeaveBound);
    });
  }

  disconnectedCallback() {
    this.removeEventListeners();
  }
}

if (!window.customElements.get('linked-products')) {
  window.customElements.define('linked-products', LinkedProducts);
}

/******/ })()
;