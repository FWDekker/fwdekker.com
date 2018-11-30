const asciiHeader = `&nbsp;________          _______       _    _
|  ____\\ \\        / /  __ \\     | |  | |
| |__   \\ \\  /\\  / /| |  | | ___| | _| | _____ _ __
|  __|   \\ \\/  \\/ / | |  | |/ _ \\ |/ / |/ / _ \\ '__|
| |       \\  /\\  /  | |__| |  __/   <|   <  __/ |
|_|        \\/  \\/   |_____/ \\___|_|\\_\\_|\\_\\___|_|   `;

const asciiHeaderHtml = `<span class="wideScreenOnly">${asciiHeader}</span><span class="smallScreenOnly"><b><u>FWDekker</u></b></span>`;

const emptyFunction = () => {};

const identityFunction = (x) => x;


Array.prototype.sortAlphabetically = function(transform = identityFunction) {
    return this.sort((a, b) => {
        const aName = transform(a).toLowerCase();
        const bName = transform(b).toLowerCase();

        if (aName < bName) {
            return -1;
        } else if (aName > bName) {
            return 1;
        } else {
            return 0;
        }
    });
};


String.prototype.replaceAll = function (regex, replacement) {
    let string = this;

    while (regex.test(string)) {
        string = string.replace(regex, replacement);
    }

    return "" + string;
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

function moveCaretToEndOf(element) {
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);

    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
}

function q(query) {
    return document.querySelector(query);
}
