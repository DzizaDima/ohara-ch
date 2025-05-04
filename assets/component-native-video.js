/******/ (() => { // webpackBootstrap
var __webpack_exports__ = {};
class NativeVideo extends HTMLElement {
  constructor() {
    super();
    
  }

  connectedCallback() {
    this.overlayDesktop = this.querySelector('[data-selector="native-video-overlay"]');
    this.playButtonDesktop = this.querySelector('[data-selector="native-video-play-button"]');
    this.videoDesktop = this.querySelector('[data-selector="native-video"]');

    this.overlayMobile = this.querySelector('[data-selector="native-video-overlay-mobile"]');
    this.playButtonMobile = this.querySelector('[data-selector="native-video-play-button-mobile"]');
    this.videoMobile = this.querySelector('[data-selector="native-video-mobile"]');

    this.coverImage = this.querySelector('.video--video__static-image');

    if (!this.overlayDesktop || !this.playButtonDesktop || !this.videoDesktop) return;
    
    this.attachEvents();
  }

  attachEvents() {
    // Handle play button click
    this.playButtonDesktop.addEventListener('click', this.playVideo.bind(this));
    if (this.playButtonMobile) this.playButtonMobile.addEventListener('click', this.playVideo.bind(this));

    // Handle overlay click
    this.overlayDesktop.addEventListener('click', this.playVideo.bind(this));
    if (this.overlayMobile) this.overlayMobile.addEventListener('click', this.playVideo.bind(this));

    // Handle enter keypress on play button
    this.playButtonDesktop.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') this.playVideo();
    });

    if (this.playButtonMobile) this.playButtonMobile.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') this.playVideo();
    });
  }

  playVideo() {
    if (!this.isMobile) {
      // Desktop - hide overlay and play button, play video
      this.overlayDesktop.style.display = 'none';
      this.playButtonDesktop.style.display = 'none';
      this.videoDesktop.setAttribute('controls', 'true');
      this.videoDesktop.play();
    } else if (this.isMobile && !this.overlayMobile && !this.playButtonMobile && !this.videoMobile) {
      // No mobile video - hide overlay and play button, play desktop video
      this.overlayDesktop.style.display = 'none';
      this.playButtonDesktop.style.display = 'none';
      this.videoDesktop.setAttribute('controls', 'true');
      this.videoDesktop.play();
    } else if (this.isMobile && this.overlayMobile && this.playButtonMobile && this.videoMobile) {
      // Mobile - hide overlay and play button, play video
      this.overlayMobile.style.display = 'none';
      this.playButtonMobile.style.display = 'none';
      this.videoMobile.setAttribute('controls', 'true');
      this.videoMobile.play();
    }

    if (this.coverImage) this.coverImage.style.display = 'none';
  }

  get isMobile() {
    return window.matchMedia('screen and (max-width: 767px)').matches;
  }
}

// Only define the custom element if it doesn't already exist
if (!customElements.get('native-video')) customElements.define('native-video', NativeVideo);

/******/ })()
;