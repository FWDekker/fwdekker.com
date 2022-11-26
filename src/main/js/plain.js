if ("serviceWorker" in navigator) {
    window.addEventListener("load", function() {
        return navigator.serviceWorker.register("sw.js?v=%%VERSION_NUMBER%%");
    });
}
