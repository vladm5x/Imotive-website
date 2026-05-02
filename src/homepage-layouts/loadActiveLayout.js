const STORAGE_KEY = 'imotive-active-layout';

async function loadActiveLayout() {
  const activeId = localStorage.getItem(STORAGE_KEY) || 'original';

  const { layoutRegistry } = await import('./layoutRegistry.js');
  const entry = layoutRegistry.find(l => l.id === activeId) || layoutRegistry[0];

  try {
    const res = await fetch(entry.htmlPath);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Copy stylesheets and preconnect links from layout head
    doc.head.querySelectorAll('link, style').forEach(el => {
      // Skip base tag duplicates and already-loaded hrefs
      if (el.tagName === 'BASE') return;
      const href = el.getAttribute('href');
      if (href && document.head.querySelector(`link[href="${href}"]`)) return;
      document.head.appendChild(el.cloneNode(true));
    });

    // Update title and meta description
    if (doc.title) document.title = doc.title;
    const layoutMeta = doc.querySelector('meta[name="description"]');
    const pageMeta = document.querySelector('meta[name="description"]');
    if (layoutMeta && pageMeta) pageMeta.setAttribute('content', layoutMeta.getAttribute('content'));

    // Replace body content
    document.body.innerHTML = doc.body.innerHTML;

    // Re-execute scripts (innerHTML does not run scripts automatically)
    for (const old of Array.from(document.body.querySelectorAll('script'))) {
      const fresh = document.createElement('script');
      if (old.type) fresh.type = old.type;
      if (old.src) {
        fresh.src = old.src;
      } else {
        fresh.textContent = old.textContent;
      }
      old.parentNode.replaceChild(fresh, old);
    }
  } catch (err) {
    console.error('[iMotive] Layout load failed:', err);
    // Hard fallback: navigate directly to the layout file
    window.location.href = entry.htmlPath;
  }
}

loadActiveLayout();
