/******/ (() => { // webpackBootstrap
var __webpack_exports__ = {};
/* Scripts that aren't compiled to theme.js don't execute unless changes are saved
in the theme editor, this aims to resolve the issue by finding and adding them
once a section/block is added */

window.addEventListener('shopify:section:load', () => {
  const scopedScripts = document.querySelectorAll('script[data-internal-script]');

  scopedScripts.forEach(script => {
    const {src, defer, async, type} = script;
    const postLoadedScript = document.createElement('script');
    postLoadedScript.src = src;
    postLoadedScript.defer = defer;
    postLoadedScript.async = async;
    postLoadedScript.type = type;

    script.parentElement.appendChild(postLoadedScript);
    script.remove();
  });
});

/******/ })()
;