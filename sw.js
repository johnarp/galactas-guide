// Minimal service worker. Browsers want one before they offer "Install app".
// It deliberately caches nothing, so you always get the latest files and never a stale copy after an update.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});   // requests go to the network as usual