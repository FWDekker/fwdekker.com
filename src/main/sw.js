const CACHE_NAME = "fwdekker-%%VERSION_NUMBER%%";
const CACHE_FILES = [
    "bundle.js",
    "favicon.ico",
    "favicon.png",
    "favicon.svg",
    "icon_128x128.png",
    "icon_144x144.png",
    "icon_152x152.png",
    "icon_192x192.png",
    "icon_512x512.png",
    "icon_ios.png",
    "index.html",
    "main.css",
    "manifest.json",
    "plain.js",
];

self.addEventListener("install", event =>
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(CACHE_FILES))
            .then(self.skipWaiting())
            .catch(error => console.error(error))
    )
);

self.addEventListener("activate", event =>
    event.waitUntil(
        caches.keys()
            .then(cacheNames => cacheNames.filter(it => ![CACHE_NAME].includes(it)))
            .then(cachesToDelete => Promise.all(cachesToDelete.map(it => caches.delete(it))))
            .then(() => self.clients.claim())
            .catch(error => console.error(error))
    )
);
