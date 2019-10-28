export const asciiHeader = `&nbsp;________          _______       _    _
|  ____\\ \\        / /  __ \\     | |  | |
| |__   \\ \\  /\\  / /| |  | | ___| | _| | _____ _ __
|  __|   \\ \\/  \\/ / | |  | |/ _ \\ |/ / |/ / _ \\ '__|
| |       \\  /\\  /  | |__| |  __/   <|   <  __/ |
|_|        \\/  \\/   |_____/ \\___|_|\\_\\_|\\_\\___|_|   `;

export const asciiHeaderHtml = `<span class="wideScreenOnly">${asciiHeader}</span><span class="smallScreenOnly"><b><u>FWDekker</u></b></span>`;

export const emptyFunction = () => {};


export function addOnLoad(fun: () => void) {
    const oldOnLoad = window.onload || emptyFunction;

    window.onload = (() => {
        // @ts-ignore: Call works without parameters as well
        oldOnLoad();
        fun();
    });
}

export function moveCaretToEndOf(element: Node) {
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);

    const selection = window.getSelection();
    if (selection !== null) {
        selection.removeAllRanges();
        selection.addRange(range);
    }
}

export function parseCssPixels(string: string | null): number {
    if (string === null || string.trim() === "") {
        return 0;
    } else {
        if (!string.endsWith("px"))
            throw "CSS string is not expressed in pixels.";

        return parseFloat(string);
    }
}

export function q(query: string): HTMLElement {
    const element = document.querySelector(query);
    if (!(element instanceof HTMLElement))
        throw "Could not find element `query`.";

    return element;
}

export function stripHtmlTags(string: string): string {
    const div = document.createElement("div");
    div.innerHTML = string;
    return div.textContent || div.innerText || "";
}
