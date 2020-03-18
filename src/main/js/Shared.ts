import "./Extensions";


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
    const oldOnLoad = window.onload ?? emptyFunction;

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
 * Given an input string, finds the word that ends at the indicated offset, and returns the string before the word, the
 * word itself, and the string after the word.
 *
 * The word is preceded by a whitespace or forward slash, and ends at the indicated offset. Whitespace and forward
 * slashes at the end of the word are ignored.
 *
 * @param input the input string to find the word in
 * @param offset the right-most position of the word
 * @param delimiters the delimiters to consider
 * @return the string before the word, the word itself, and the string after the word
 */
export function extractWordBefore(input: string, offset: number, delimiters: string = " /"): [string, string, string] {
    const right = input.slice(offset);

    const leftPlusWord = input.slice(0, offset);
    const trimmedLeftPlusWord =
        delimiters.split("").reduce((acc, delimiter) => acc.trimRightChar(delimiter), leftPlusWord);

    const wordStart = Math.max.apply(null, delimiters.split("").map((it) => trimmedLeftPlusWord.lastIndexOf(it)));
    return [leftPlusWord.slice(0, wordStart + 1), leftPlusWord.slice(wordStart + 1, leftPlusWord.length), right];
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
 * Returns `true` if and only if the website is currently running in a standalone app on the user's phone.
 */
export function isStandalone(): boolean {
    return window.matchMedia("(display-mode: standalone)").matches;
}

/**
 * Moves the caret to the given position in the given node.
 *
 * @param node the node to move the caret in; if `null`, nothing happens
 * @param position the position from the left to place the caret at
 */
export function moveCaretTo(node: Node | null, position: number): void {
    if (node === null)
        return;

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
 * @param node the node in which to move the caret to the end; if `null`, nothing happens
 */
export function moveCaretToEndOf(node: Node | null): void {
    moveCaretTo(node, (node?.textContent ?? "").length);
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
 * Returns the longest common prefix of the given strings, or `undefined` if an empty array is given.
 *
 * Taken from https://stackoverflow.com/a/1917041/.
 *
 * @param strings the string to find the longest common prefix of
 * @return the longest common prefix of the given strings, or `undefined` if an empty array is given
 */
export function findLongestCommonPrefix(strings: string[]): string | undefined {
    if (strings.length === 0) return undefined;

    const A = strings.concat().sort();
    const a1 = A[0];
    const a2 = A[A.length - 1];
    const L = a1.length;

    let i = 0;
    while (i < L && a1.charAt(i) === a2.charAt(i)) i++;

    return a1.substring(0, i);
}


/**
 * Indicates that the application will exit under normal circumstances.
 *
 * That is, this is not actually an error. This "error" is thrown when the normal flow of execution should be
 * interrupted right away so that the application can exit.
 */
export class ExpectedGoodbyeError extends Error {
    constructor(message: string) {
        super(message);
    }
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
