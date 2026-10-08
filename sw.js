/* Bank Prep Tracker – service worker.
   Only caches the app's own files so the app opens like a real app.
   Your progress is NOT stored here – it lives in Firebase (Firestore). */
const VERSION = 'v1';
const SHELL = 'bpt-shell-' + VERSION;
const LIBS = 'bpt-libs-v1';
const FILES = ['./', 'index.html', 'manifest.json', 'firebase-config.js',
  'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(SHELL).then(c => Promise.allSettled(FILES.map(f => c.add(f)))).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== SHELL && k !== LIBS).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Firebase SDK files (versioned, never change) + fonts: cache-first
  if (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/') ||
      url.hostname === 'fonts.gstatic.com' || url.hostname === 'fonts.googleapis.com') {
    e.respondWith(
      caches.open(LIBS).then(c => c.match(req).then(hit => hit || fetch(req).then(res => {
        if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone());
        return res;
      })))
    );
    return;
  }

  // Everything else from other sites (Firestore, Google sign-in, etc.): do not touch
  if (url.origin !== location.origin) return;
  // Firebase Hosting reserved auth URLs: do not touch
  if (url.pathname.startsWith('/__/')) return;

  // The app's own files: network first (so updates arrive), cache as fallback when offline
  e.respondWith(
    fetch(req).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(SHELL).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(hit => hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});
