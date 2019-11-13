/**
 * The fancy ASCII header that is displayed at the start of a terminal session.
 */
const asciiHeader = `&nbsp;________          _______       _    _
|  ____\\ \\        / /  __ \\     | |  | |
| |__   \\ \\  /\\  / /| |  | | ___| | _| | _____ _ __
|  __|   \\ \\/  \\/ / | |  | |/ _ \\ |/ / |/ / _ \\ '__|
| |       \\  /\\  /  | |__| |  __/   <|   <  __/ |
|_|        \\/  \\/   |_____/ \\___|_|\\_\\_|\\_\\___|_|   `;

/**
 * A responsive version of the header that displays a simple text instead of the ASCII header when the screen is not
 * large enough.
 */
export const asciiHeaderHtml =
    `<span class="wideScreenOnly">${asciiHeader}</span><span class="smallScreenOnly"><b><u>FWDekker</u></b></span>`;

/**
 * A function that does nothing.
 */
export const emptyFunction = () => {};


/**
 * Runs the given function as soon as the page is done loading by "appending" it to the current definition of
 * `window.onload`.
 *
 * @param fun the function to run as soon as the page is done loading
 */
export function addOnLoad(fun: () => void): void {
    const oldOnLoad = window.onload || emptyFunction;

    window.onload = () => {
        // @ts-ignore: Call works without parameters as well
        oldOnLoad();
        fun();
    };
}

/**
 * Replaces all special HTML characters with escaped variants.
 *
 * @param string the string to escape special HTML characters in
 */
export function escapeHtml(string: string): string {
    return string
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * Returns the extension of the given filename, or `""` if it doesn't have one.
 *
 * @param filename the filename to return the extension of
 */
export function getFileExtension(filename: string): string {
    const extension = /^.+\.([^.]+)$/.exec(filename);
    return extension == null ? "" : extension[1];
}

/**
 * Moves the caret to the given position in the given node.
 *
 * @param node the node to move the caret in
 * @param position the position from the left to place the caret at
 */
export function moveCaretTo(node: Node, position: number): void {
    const range = document.createRange();
    range.setStart(node, position);

    const selection = window.getSelection();
    if (selection !== null) {
        selection.removeAllRanges();
        selection.addRange(range);
    }
}

/**
 * Moves the caret to the end of the given node.
 *
 * @param node the node in which to move the caret to the end
 */
export function moveCaretToEndOf(node: Node): void {
    const range = document.createRange();
    range.selectNodeContents(node);
    range.collapse(false);

    const selection = window.getSelection();
    if (selection !== null) {
        selection.removeAllRanges();
        selection.addRange(range);
    }
}

/**
 * Returns the number of pixels in a CSS value that describes a number of pixels, or `0` if the given string is `null`
 * or does not contain a number.
 *
 * For example, if the given string is `"3px"`, this function will return `3`.
 *
 * @param string the CSS value to extract the number of pixels from
 * @throws if the given string does not end with the text `"px"`
 */
export function parseCssPixels(string: string | null): number {
    if (string === null || string.trim() === "") {
        return 0;
    } else {
        if (!string.endsWith("px"))
            throw new IllegalArgumentError("CSS string is not expressed in pixels.");

        const result = parseFloat(string);
        return isNaN(result) ? 0 : result;
    }
}

/**
 * Type-safe shorthand for `document.querySelector(query)`.
 *
 * @param query the query to run
 * @throws if the element could not be found
 */
export function q(query: string): HTMLElement {
    const element = document.querySelector(query);
    if (!(element instanceof HTMLElement))
        throw `Could not find element \`${query}\`.`;

    return element;
}


/**
 * Indicates that an argument is given to a function that should not have been given.
 *
 * The user should not be able to reach this state because user input should have been sanitized.
 */
export class IllegalArgumentError extends Error {
    /**
     * Constructs a new illegal argument error.
     *
     * @param message a message explaining why the error was thrown
     */
    constructor(message: string) {
        super(message);
    }
}

/**
 * Indicates that the program has ended up in a state that it should never end up in.
 *
 * Indicates an error that could not have been caused by the user.
 */
export class IllegalStateError extends Error {
    /**
     * Constructs a new illegal state error.
     *
     * @param message a message explaining why the error was thrown
     */
    constructor(message: string) {
        super(message);
    }
}
