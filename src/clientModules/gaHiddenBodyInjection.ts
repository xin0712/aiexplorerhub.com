const WRAPPER_ID = 'ga-hidden-wrapper';
const GA_SCRIPT_ID = 'ga-loader-script';
const GA_INLINE_ID = 'ga-inline-script';
const GA_MEASUREMENT_ID = 'G-XFZF2S8NM4';

function injectGaScripts() {
  if (typeof document === 'undefined') {
    return;
  }

  if (!document.body || document.getElementById(WRAPPER_ID)) {
    return;
  }

  const wrapper = document.createElement('div');
  wrapper.id = WRAPPER_ID;
  wrapper.style.display = 'none';

  const loader = document.createElement('script');
  loader.id = GA_SCRIPT_ID;
  loader.async = true;
  loader.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;

  const inline = document.createElement('script');
  inline.id = GA_INLINE_ID;
  inline.text = `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_MEASUREMENT_ID}');
`;

  wrapper.append(loader, inline);
  document.body.appendChild(wrapper);
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectGaScripts, {once: true});
  } else {
    injectGaScripts();
  }
}

export {};
