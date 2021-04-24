if (/MSIE|Trident/.test(window.navigator.userAgent)) {
    window.onload = function() {
        document.getElementById("ie-warning").className = "";
    };
}

if ("serviceWorker" in navigator) {
    window.addEventListener("load", function() {
        return navigator.serviceWorker.register("sw.js?v=%%VERSION_NUMBER%%");
    });
}
