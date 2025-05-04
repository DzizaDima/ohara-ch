/******/ (() => { // webpackBootstrap
var __webpack_exports__ = {};
class ProductSwatch extends HTMLElement {
  constructor() {
    super();

    this.onColorSwatchClickBound = this.onColorSwatchClick.bind(this);
    this.onColorSwatchMouseEnterBound = this.onColorSwatchMouseEnter.bind(this);
    this.onSwatchMouseLeaveBound = this.onSwatchMouseLeave.bind(this);
    this.onVariantChangedBound = this.onVariantChanged.bind(this);
  }

  connectedCallback() {
    this.colorLabel = this.querySelector('[data-color-swatch-name]');
    this.colorLabelState = this.querySelector('[data-color-swatch-state]');
    this.soldOutString = this.getAttribute('data-swatch-sold-out-string');
    this.productForm = this.closest('.product-single-wrapper') || this.closest('#product-box');
    this.colorSwatches = this.querySelectorAll('.swatch-element.color');
    this.textSwatches = this.querySelectorAll('.swatch-element:not(.color)');
    this.setEventListeners();
    this.setColorLabelState();
  }

  setEventListeners() {
    this.colorSwatches.forEach(swatch => {
      swatch.addEventListener('click', this.onColorSwatchClickBound);
      swatch.addEventListener('mouseenter', this.onColorSwatchMouseEnterBound);
      swatch.addEventListener('mouseleave', this.onSwatchMouseLeaveBound);
    });

    if (this.productForm) this.productForm.addEventListener('variant:changed', this.onVariantChangedBound);
    if (this.productForm) this.productForm.addEventListener('variant:media:changed', this.onVariantChangedBound);
  }

  setColorLabelState() {
    const activeSwatch = this.querySelector('.swatch-element.color.active');
    if (!activeSwatch) return;

    const activeSwatchAvailable = activeSwatch.getAttribute('data-swatch-option-available');
    if (!this.soldOutString || !this.colorLabelState) return;

    this.colorLabelState.innerText = activeSwatchAvailable == 'false' ? `(${this.soldOutString})` : '';
  }

  onColorSwatchClick(event) {
    this.updateColorLabel(event.currentTarget);
  }

  onColorSwatchMouseEnter(event) {
    // Update color label
    this.updateColorLabel(event.currentTarget);
    
    const activeSwatch = this.querySelector('.swatch-element.color.active');
    if (activeSwatch && !event.currentTarget.classList.contains('active')) activeSwatch.classList.add('sibling-hover-active');
  }

  onSwatchMouseLeave() {
    const siblingHoverActiveSwatch = this.querySelector('.swatch-element.sibling-hover-active');
    if (siblingHoverActiveSwatch) siblingHoverActiveSwatch.classList.remove('sibling-hover-active');

    // Reset color label
    this.resetColorLabel();
  }

  updateColorLabel = (swatch) => {
    if (!swatch) return;
    const label = swatch.getAttribute('data-value');
    const swatchAvailable = swatch.getAttribute('data-swatch-option-available');

    if (!label || !this.colorLabel) return;
    this.colorLabel.textContent = label;
    if (this.colorLabelState) this.colorLabelState.innerText = swatchAvailable == 'false' ? `(${this.soldOutString})` : '';
  }

  resetColorLabel = () => {
    const activeSwatch = this.querySelector('.swatch-element.color.active');
    if (!activeSwatch || !this.colorLabel) return;

    const activeSwatchValue = activeSwatch.getAttribute('data-value');
    const swatchAvailable = activeSwatch.getAttribute('data-swatch-option-available');
    if (!activeSwatchValue) return;

    this.colorLabel.textContent = activeSwatchValue;
    if (this.colorLabelState) this.colorLabelState.innerText = swatchAvailable == 'false' ? `(${this.soldOutString})` : '';
  }

  setActiveClass = (swatch) => {
    if (!swatch) return;
    swatch.classList.add('active');
  }

  removeActiveClass = (swatch) => {
    if (!swatch) return;
    swatch.classList.remove('active');
  }

  onVariantChanged(event) {
    const product = event.detail.product;
    if (!product) return;

    const variant = event.detail.variant;
    if (!variant) return;

    // Set active swatches based on the selected variant
    product.options.forEach((option, index) => {
      // Remove active class from all swatches
      const swatches = this.querySelectorAll(`.swatch-element[data-option="${option}"]`);
      swatches.forEach(swatch => this.removeActiveClass(swatch));

      // Set active class on the swatch that matches the selected variant
      const swatch = this.querySelector(`.swatch-element[data-option="${option}"][data-value="${variant[`option${index + 1}`]}"]`);
      if (swatch) this.setActiveClass(swatch);
    });

    const activeSwatches = Array.from(this.productForm.querySelectorAll('.swatch-element.variant-swatch.active'))
      .map(swatch => swatch.getAttribute('data-value'))
      .filter(Boolean);

    if (activeSwatches.length < product.options.length) return;

    const selectedVariantTitle = activeSwatches.join(' / ');
    const selectedVariant = product.variants.find(variant => variant.title === selectedVariantTitle);
    if (!selectedVariant) return;

    product.options.forEach((option, index) => {
      const optionValues = product.variants.map(variant => variant[`option${index + 1}`]);
      optionValues.forEach(value => {
        this.updateSwatchStates(product, value, index + 1, selectedVariant, option);
      });
    });
  }		

  updateSwatchStates(product, value, optionIndex, currentVariant, option) {
    const availability = product.variants.map(variant => variant.available);
    const optionValues = [
      product.variants.map(variant => variant.option1),
      product.variants.map(variant => variant.option2),
      product.variants.map(variant => variant.option3),
    ];

    const isOptionAvailable = optionValues[optionIndex - 1].some((optionValue, i) => {
      switch (optionIndex) {
        case 1:
          return optionValue === value && availability[i];
        case 2:
          return optionValue === value && optionValues[0][i] === currentVariant.option1 && availability[i];
        case 3:
          return optionValue === value && optionValues[0][i] === currentVariant.option1 &&
          optionValues[1][i] === currentVariant.option2 && availability[i];
        default:
          return false;
      }
    });

    const swatches = this.productForm.querySelectorAll(`.swatch-element.variant-swatch[data-option="${option}"][data-value="${value}"]`);
    swatches.forEach(swatch => {
      if (isOptionAvailable) {
        swatch.classList.remove('soldout');
        swatch.setAttribute('data-swatch-option-available', true);
      } else {
        swatch.classList.add('soldout');
        swatch.setAttribute('data-swatch-option-available', false);
      }
    });

    const activeSwatch = this.querySelector('.swatch-element.color.active');
    if (activeSwatch) this.updateColorLabel(activeSwatch);
  }		

  removeEventListeners() {
    this.colorSwatches.forEach(swatch => {
      swatch.removeEventListener('click', this.onColorSwatchClickBound);
      swatch.removeEventListener('mouseenter', this.onColorSwatchMouseEnterBound);
      swatch.removeEventListener('mouseleave', this.onSwatchMouseLeaveBound);
    });
    
    if (this.productForm) this.productForm.removeEventListener('variant:changed', this.onVariantChangedBound);
  }

  disconnectedCallback() {
    this.removeEventListeners();
  }
}

if (!window.customElements.get('product-swatch')) {
  window.customElements.define('product-swatch', ProductSwatch);
}

/******/ })()
;