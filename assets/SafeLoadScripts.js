class SafeLoadScripts extends HTMLElement {
  constructor() {
    super();
  }


  connectedCallback() {
    const scripts = this.querySelectorAll('safe-load-scripts > script');

    scripts.forEach((script) => {
      const key = script.dataset.flowLoadKey;

      const scriptLoaded = window.wetheme.webcomponentRegistry.checkScriptLoaded(key);
      if(!scriptLoaded) {
        const postLoadedScript = document.createElement('script');
        const {src, defer, async, type} = script;
        postLoadedScript.src = src;
        postLoadedScript.defer = defer;
        postLoadedScript.async = async;
        postLoadedScript.type = type;


        this.parentElement.appendChild(postLoadedScript);

      }
    })

  }
}
  
customElements.define('safe-load-scripts', SafeLoadScripts);