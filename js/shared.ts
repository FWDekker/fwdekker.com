export const asciiHeader = `&nbsp;________          _______       _    _
|  ____\\ \\        / /  __ \\     | |  | |
| |__   \\ \\  /\\  / /| |  | | ___| | _| | _____ _ __
|  __|   \\ \\/  \\/ / | |  | |/ _ \\ |/ / |/ / _ \\ '__|
| |       \\  /\\  /  | |__| |  __/   <|   <  __/ |
|_|        \\/  \\/   |_____/ \\___|_|\\_\\_|\\_\\___|_|   `;

export const asciiHeaderHtml = `<span class="wideScreenOnly">${asciiHeader}</span><span class="smallScreenOnly"><b><u>FWDekker</u></b></span>`;

export const emptyFunction = () => {};


export function addOnLoad(fun: () => void) {
    const oldOnLoad = window.onload || (() => {
    });

    window.onload = (() => {
        // @ts-ignore TODO Find out how to resolve this
        oldOnLoad();
        fun();
    });
}

export function moveCaretToEndOf(element: Node) {
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);

    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
}

export function q(query: string) {
    return document.querySelector(query);
}
