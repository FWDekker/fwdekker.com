const asciiHeader = `&nbsp;________          _______       _    _
|  ____\\ \\        / /  __ \\     | |  | |
| |__   \\ \\  /\\  / /| |  | | ___| | _| | _____ _ __
|  __|   \\ \\/  \\/ / | |  | |/ _ \\ |/ / |/ / _ \\ '__|
| |       \\  /\\  /  | |__| |  __/   <|   <  __/ |
|_|        \\/  \\/   |_____/ \\___|_|\\_\\_|\\_\\___|_|   `;


String.prototype.replaceAll = function (regex, replacement) {
    let string = this;

    while (regex.test(string)) {
        string = string.replace(regex, replacement);
    }

    return string;
};

String.prototype.trimLines = function () {
    return this.split("\n").map(it => it.trim()).join("\n");
};

function addOnLoad(fun) {
    const oldOnLoad = window.onload || (() => {
    });

    window.onload = (() => {
        oldOnLoad();
        fun();
    });
}

function q(query) {
    return document.querySelector(query);
}
