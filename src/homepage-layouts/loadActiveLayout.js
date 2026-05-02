const STORAGE_KEY = 'imotive-active-layout';
const PREVIEW_BUTTON_HIDDEN_KEY = 'imotive-layout-preview-button-hidden';

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
    normalizeSignupLinks();

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

function normalizeSignupLinks() {
  document.querySelectorAll('a[href*="signup.html"]').forEach((link) => {
    const href = link.getAttribute('href') || '';
    const url = new URL(href, window.location.href);
    const filename = url.pathname.split('/').pop();
    if (!filename || !filename.endsWith('signup.html')) return;

    const next = new URL('signup.html', window.location.href);
    if (href.includes('#signup')) next.hash = 'signup';
    if (url.searchParams.get('mode') === 'login' || /sign\s*in|log\s*in/i.test(link.textContent || '')) {
      next.searchParams.set('mode', 'login');
    }
    link.href = next.toString();
  });
}

function injectLayoutPreviewButton() {
  const styleId = 'imotive-layout-preview-button-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .imotive-layout-preview-bar {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 9999;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px;
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.18);
        background: rgba(15, 17, 23, 0.86);
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.22);
        backdrop-filter: blur(10px);
      }

      .imotive-layout-preview-button {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        border-radius: 999px;
        color: #fff;
        font: 600 13px/1.2 Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        text-decoration: none;
        transition: background 0.16s ease;
      }

      .imotive-layout-preview-button:hover {
        background: rgba(255, 255, 255, 0.1);
      }

      .imotive-layout-preview-button-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #4F7EFF;
        box-shadow: 0 0 0 4px rgba(79, 126, 255, 0.18);
      }

      .imotive-layout-preview-toggle {
        width: 26px;
        height: 26px;
        border: 0;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.1);
        color: rgba(255, 255, 255, 0.82);
        cursor: pointer;
        font: 700 15px/1 Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        transition: background 0.16s ease, color 0.16s ease;
      }

      .imotive-layout-preview-toggle:hover {
        background: rgba(255, 255, 255, 0.18);
        color: #fff;
      }

      .imotive-layout-preview-restore {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 9999;
        width: 30px;
        height: 30px;
        border: 1px solid rgba(255, 255, 255, 0.18);
        border-radius: 50%;
        background: rgba(15, 17, 23, 0.86);
        box-shadow: 0 10px 26px rgba(0, 0, 0, 0.22);
        backdrop-filter: blur(10px);
        cursor: pointer;
      }

      .imotive-layout-preview-restore::after {
        content: "";
        position: absolute;
        inset: 10px;
        border-radius: 50%;
        background: #4F7EFF;
        box-shadow: 0 0 0 4px rgba(79, 126, 255, 0.18);
      }

      @media (max-width: 640px) {
        .imotive-layout-preview-bar {
          right: 12px;
          bottom: 12px;
        }

        .imotive-layout-preview-button {
          font-size: 12px;
        }

        .imotive-layout-preview-restore {
          right: 12px;
          bottom: 12px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  document.querySelector('.imotive-layout-preview-bar')?.remove();
  document.querySelector('.imotive-layout-preview-restore')?.remove();

  if (localStorage.getItem(PREVIEW_BUTTON_HIDDEN_KEY) === 'true') {
    const restore = document.createElement('button');
    restore.type = 'button';
    restore.className = 'imotive-layout-preview-restore';
    restore.setAttribute('aria-label', 'Show layout preview button');
    restore.addEventListener('click', () => {
      localStorage.removeItem(PREVIEW_BUTTON_HIDDEN_KEY);
      injectLayoutPreviewButton();
    });
    document.body.appendChild(restore);
    return;
  }

  const bar = document.createElement('div');
  bar.className = 'imotive-layout-preview-bar';

  const link = document.createElement('a');
  link.className = 'imotive-layout-preview-button';
  link.href = new URL('layouts-admin.html', window.location.href).toString();
  link.setAttribute('aria-label', 'Open layout preview panel');
  link.innerHTML = '<span class="imotive-layout-preview-button-dot" aria-hidden="true"></span><span>Preview looks</span>';

  const hide = document.createElement('button');
  hide.type = 'button';
  hide.className = 'imotive-layout-preview-toggle';
  hide.textContent = '×';
  hide.setAttribute('aria-label', 'Hide layout preview button');
  hide.addEventListener('click', () => {
    localStorage.setItem(PREVIEW_BUTTON_HIDDEN_KEY, 'true');
    injectLayoutPreviewButton();
  });

  bar.append(link, hide);
  document.body.appendChild(bar);
}

loadActiveLayout();
