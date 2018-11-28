function addOnLoad(fun) {
    const oldOnLoad = window.onload || (() => {
    });

    window.onload = (() => {
        oldOnLoad();
        fun();
    });
}

String.prototype.replaceAll = function(regex, replacement) {
    let string = this;

    while (regex.test(string)) {
        string = string.replace(regex, replacement);
    }

    return string;
};

function trim(string) {
    return `${string}`.split("\n").map(it => it.trim()).join("\n");
}

function q(query) {
    return document.querySelector(query);
}
