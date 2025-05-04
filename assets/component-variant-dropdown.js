/******/ (() => { // webpackBootstrap
var __webpack_exports__ = {};
class VariantDropdown extends HTMLElement {
  constructor() {
    super();

    // Bind the this context to the class methods
    ['onDocumentClick', 'onProductFormReady', 'handleOptionKeyDown', 'closeDropdownOnFocusOut'].forEach((fn) => {
      this[fn] = this[fn].bind(this);
    });
  }

  connectedCallback() {
    this.cacheDOMElements();
    this.addEventListeners();
  }

  cacheDOMElements() {
    this.optionIndex = this.dataset.optionIndex;
    this.dropdownButton = this.querySelector('[data-dropdown-button]');
    this.dropdownList = this.querySelector('[data-dropdown-list]');
    this.selectedOptionDisplay = this.querySelector('[data-selected-option]');
    this.options = this.dropdownList.querySelectorAll('li');
  }

  addEventListeners() {
    this.dropdownButton.addEventListener('click', () => this.toggleDropdown());
    this.options.forEach(option => {
      option.addEventListener('click', () => this.handleOptionClick(option));
      option.addEventListener('keydown', this.handleOptionKeyDown);
    });
    this.dropdownList.addEventListener('focusout', this.closeDropdownOnFocusOut);
    document.addEventListener('click', this.onDocumentClick);
    document.addEventListener('product-form:ready', this.onProductFormReady);
  }

  onProductFormReady() {
    this.productForm = this.closest('.product-single-wrapper') || this.closest('#product-box');
    // When the product form is ready, listen for the variant:changed event
    this.productForm.addEventListener('variant:changed', this.updateOptionAvailability.bind(this));
    // When 'change variant based on thumbnail' is enabled, listen for the variant:changed event
    this.productForm.addEventListener('variant:media:changed', this.updateOptionOnMediaChange.bind(this));
  }

  handleOptionKeyDown(event) {
    if (event.key === 'Enter') {
      this.handleOptionClick(event.target);
    }
  }

  closeDropdownOnFocusOut() {
    // Use setTimeout to delay the check because the new focus target is not yet focused
    setTimeout(() => {
      if (!this.contains(document.activeElement)) {
        this.updateButtonStates();
        this.updateDropdownClasses(true);
        this.closeDropdown();
      }
    }, 0);
  }

  handleOptionClick(option) {
    this.updateOptionLabel(this.selectedOptionDisplay, option); // Update the display area with this option's text
    this.markOptionAsSelected(option); // Update the 'selected' state 
    this.toggleDropdown(); // Close the dropdown
    this.dispatchEventOnChange(option); // Dispatch a custom event to notify the parent component that the selected option has changed
  }

  toggleDropdown() {
    const isOpen = this.dropdownList.style.display === 'block';
    this.updateButtonStates();
    
    if (isOpen) {
      this.dropdownButton.focus();
      this.updateDropdownClasses(isOpen);
      this.closeDropdown(); 
    } else {
      this.dropdownList.querySelector('li').focus();
      this.dropdownList.style.display = 'block';
      setTimeout(() => this.updateDropdownClasses(isOpen), 50); // Toggle the open state classes with a short delay to allow the dropdown to animate
    }
  }

  dispatchEventOnChange(option) {
    const detail = {
      optionValue: option.getAttribute('data-option-value'),
      optionName: option.getAttribute('data-option-name')
    };
    this.dispatchEvent(new CustomEvent('variant:dropdown:change', { detail, bubbles: true }));
  }

  updateOptionLabel(currentLabelElement, newLabelElement) {
    const newLabel = newLabelElement.querySelector('.option-label').textContent;
    currentLabelElement.textContent = newLabel;
  }

  updateDropdownClasses(isOpen) {
    const action = isOpen ? 'remove' : 'add';
    this.classList[action]('variant-dropdown--open');
    this.dropdownList.classList[action]('variant-dropdown-fade-enter-active', 'variant-dropdown-fade-enter-to', 'variant-dropdown-fade-enter');
    this.dropdownList.classList[action === 'add' ? 'remove' : 'add']('variant-dropdown-fade-leave-active', 'variant-dropdown-fade-leave-to', 'variant-dropdown-fade-enter');
  }

  updateButtonStates() {
    const isOpen = this.dropdownList.style.display === 'block';
    const ariaExpanded = isOpen ? 'false' : 'true';
    this.dropdownButton.setAttribute('aria-expanded', ariaExpanded);
  }

  markOptionAsSelected(option) {
    this.options.forEach(opt => {
      opt.removeAttribute('selected');
      opt.classList.remove('selected');
    });
    option.setAttribute('selected', '');
    option.classList.add('selected');
  }

  updateOptionAvailability(event) {
    const { variant, product } = event.detail;
    if (product.options.length <= 1) return;

    fetch(`${this.dataset.url}?variant=${variant.id}&section_id=${this.dataset.sectionId}`)
      .then(response => response.text())
      .then(this.processFetchedOptions.bind(this))
      .catch(error => console.error('Error updating option availability:', error));
  }

  processFetchedOptions(responseText) {
    const html = new DOMParser().parseFromString(responseText, 'text/html');
    const newListItems = html.querySelectorAll(`[data-option-index="${this.optionIndex}"] ul[data-dropdown-list] li[data-dropdown-option]`);

    newListItems.forEach(item => {
      const optionValue = item.getAttribute('data-option-value');
      const existingOption = this.dropdownList.querySelector(`[data-option-value="${optionValue}"]`);
      if (existingOption) {
        existingOption.innerHTML = item.innerHTML;
        existingOption.classList.toggle('sold-out', !!item.querySelector('[data-status-text]'));
      }
    });
  }

  updateOptionOnMediaChange(event) {
    const variantOptions = event.detail.variant.options;
    const selectedOption = variantOptions[this.optionIndex];
    
    const optionElement = this.dropdownList.querySelector(`[data-option-value="${selectedOption}"]`);
    this.markOptionAsSelected(optionElement);
    this.updateOptionLabel(this.selectedOptionDisplay, optionElement);
    this.updateOptionAvailability(event);
  }

  onDocumentClick(event) {
    // Close the dropdown if the click is outside of this component
    if (!this.contains(event.target)) {
      this.updateButtonStates();
      this.updateDropdownClasses(true);
      this.closeDropdown();
    }
  }

  closeDropdown() {
    setTimeout(() => {this.dropdownList.style.display = 'none'}, 150);
  }

  disconnectedCallback() {
    // Clean up: Remove the global event listener when the element is removed from the document
    document.removeEventListener('click', this.onDocumentClick);
    document.removeEventListener('product-form:ready', this.onProductFormReady);
  }
}

customElements.define('variant-dropdown', VariantDropdown);

/******/ })()
;