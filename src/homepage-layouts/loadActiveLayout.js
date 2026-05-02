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

    injectLayoutPreviewButton();
  } catch (err) {
    console.error('[iMotive] Layout load failed:', err);
    // Hard fallback: navigate directly to the layout file
    window.location.href = entry.htmlPath;
  }
}

function injectLayoutPreviewButton() {
  const styleId = 'imotive-layout-preview-button-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .imotive-layout-preview-button {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 9999;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 10px 14px;
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.18);
        background: rgba(15, 17, 23, 0.86);
        color: #fff;
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.22);
        backdrop-filter: blur(10px);
        font: 600 13px/1.2 Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        text-decoration: none;
        transition: transform 0.16s ease, background 0.16s ease, box-shadow 0.16s ease;
      }

      .imotive-layout-preview-button:hover {
        transform: translateY(-1px);
        background: rgba(15, 17, 23, 0.94);
        box-shadow: 0 16px 38px rgba(0, 0, 0, 0.26);
      }

      .imotive-layout-preview-button-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #4F7EFF;
        box-shadow: 0 0 0 4px rgba(79, 126, 255, 0.18);
      }

      @media (max-width: 640px) {
        .imotive-layout-preview-button {
          right: 12px;
          bottom: 12px;
          padding: 9px 12px;
          font-size: 12px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  const existing = document.querySelector('.imotive-layout-preview-button');
  if (existing) existing.remove();

  const button = document.createElement('a');
  button.className = 'imotive-layout-preview-button';
  button.href = new URL('layouts-admin.html', window.location.href).toString();
  button.setAttribute('aria-label', 'Open layout preview panel');
  button.innerHTML = '<span class="imotive-layout-preview-button-dot" aria-hidden="true"></span><span>Preview looks</span>';
  document.body.appendChild(button);
}

loadActiveLayout();
