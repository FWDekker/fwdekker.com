const CACHE_NAME = "fwdekker-%%VERSION_NUMBER%%";
const RUNTIME = "runtime";
const CACHE_FILES = [
    "index.html",
    "favicon.ico",
    "favicon.png",
    "bundle.js"
];

self.addEventListener("install", event =>
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(CACHE_FILES))
            .then(self.skipWaiting())
    )
);

self.addEventListener("activate", event =>
    event.waitUntil(
        caches.keys()
            .then(cacheNames => cacheNames.filter(it => ![CACHE_NAME, RUNTIME].includes(it)))
            .then(cachesToDelete => Promise.all(cachesToDelete.map(it => caches.delete(it))))
            .then(() => self.clients.claim())
    )
);

self.addEventListener("fetch", event => {
    if (!event.request.url.startsWith(self.location.origin))
        return;

    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse =>
                cachedResponse
                    ? cachedResponse
                    : caches.open(RUNTIME)
                        .then(cache =>
                            fetch(event.request)
                                .then(response => cache.put(event.request, response.clone()).then(() => response))
                        )
            )
    );
});
