import {InputHistory} from "./InputHistory";
import {Persistence} from "./Persistence";
import {
    escapeHtml,
    extractWordBefore,
    findLongestCommonPrefix,
    isStandalone,
    moveCaretTo,
    moveCaretToEndOf,
    parseCssPixels
} from "./Shared";
import {Shell} from "./Shell";
import {Buffer, StreamSet} from "./Stream";


/**
 * A terminal session that has input and output.
 */
export class Terminal {
    /**
     * The height of a single line in the output.
     */
    private readonly lineHeight: number = 21; // TODO Calculate this dynamically

    /**
     * The HTML element of the terminal.
     */
    private readonly terminal: HTMLElement;
    /**
     * The HTML element where the user types.
     */
    private readonly input: HTMLElement;
    /**
     * The HTML element where the output is displayed.
     */
    private readonly output: HTMLElement;
    /**
     * The HTML element where the current prefix displayed.
     */
    private readonly prefixDiv: HTMLElement;
    /**
     * The HTML element where auto-completion suggestions are displayed.
     */
    private readonly suggestions: HTMLElement;

    /**
     * The history of the user's inputs.
     */
    private readonly inputHistory: InputHistory;
    /**
     * The shell that handles input.
     */
    private readonly shell: Shell;

    /**
     * The standard input stream.
     */
    private readonly standardInput = new Buffer();
    /**
     * The standard output stream.
     */
    private readonly standardOutput = new Buffer();
    /**
     * The standard error stream, actually just a wrapper around the standard output stream.
     */
    private readonly standardError = new class extends Buffer {
        private wrappedBuffer: Buffer;


        constructor(wrappedBuffer: Buffer) {
            super();

            this.wrappedBuffer = wrappedBuffer;
        }

        read(count: number | undefined = undefined): string {
            return this.wrappedBuffer.read(count);
        }

        write(string: string) {
            this.wrappedBuffer.write(`<span class="errorMessage">${string}</span>`);
        }
    }(this.standardOutput);


    /**
     * Constructs a new terminal.
     *
     * @param terminal the HTML element of the terminal
     * @param input the HTML element where the user types
     * @param output the HTML element where the output is displayed
     * @param prefixDiv the HTML element where the current prefix is displayed
     * @param suggestions the HTML element where auto-completion suggestions are displayed
     */
    constructor(terminal: HTMLElement, input: HTMLElement, output: HTMLElement, prefixDiv: HTMLElement,
                suggestions: HTMLElement) {
        this.terminal = terminal;
        this.input = input;
        this.output = output;
        this.prefixDiv = prefixDiv;
        this.suggestions = suggestions;

        this.inputHistory = Persistence.getHistory();
        this.shell = new Shell(this.inputHistory);

        document.addEventListener("click", this.onclick.bind(this));
        document.addEventListener("keypress", this.onkeypress.bind(this));
        document.addEventListener("keydown", this.onkeydown.bind(this));
        this.input.addEventListener("input", () => this.suggestionsText = "");

        let scrollStartPosition: number = 0;
        this.terminal.addEventListener("wheel", (event: WheelEvent) => {
            this.scroll -= Math.sign(event.deltaY);
        }, {passive: true});
        this.terminal.addEventListener("touchstart", (event: TouchEvent) => {
            scrollStartPosition = event.changedTouches[0].clientY;
        }, {passive: true});
        this.terminal.addEventListener("touchmove", (event: TouchEvent) => {
            const newPosition = event.changedTouches[0].clientY;
            const diff = scrollStartPosition - newPosition;

            this.scroll -= diff / this.lineHeight;
            scrollStartPosition = newPosition;
        }, {passive: true});

        this.outputText += this.shell.generateHeader();
        this.prefixText += this.shell.generatePrefix();
        this.input.focus();
    }


    /**
     * Returns the input the user has entered in the HTML element.
     */
    private get inputText(): string {
        return this.input.innerText.replace(/<\/?br>/g, "");
    }

    /**
     * Sets the given text as the text of the input HTML element.
     *
     * @param inputText the text to set as the text of the input HTML element
     */
    private set inputText(inputText: string) {
        this.input.innerText = inputText;
        this.suggestionsText = "";
    }

    /**
     * Returns the terminal output that is being displayed.
     */
    private get outputText(): string {
        return this.output.innerHTML;
    }

    /**
     * Sets the terminal output that is being displayed.
     *
     * @param outputText the terminal output that is being displayed
     */
    private set outputText(outputText: string) {
        this.output.innerHTML = outputText;
    }

    /**
     * Returns the current prefix text.
     */
    private get prefixText(): string {
        return this.prefixDiv.innerHTML;
    }

    /**
     * Sets the prefix text.
     *
     * @param prefixText the prefix text to set
     */
    private set prefixText(prefixText: string) {
        this.prefixDiv.innerHTML = prefixText;
    }

    /**
     * Sets the suggestions text.
     *
     * @param suggestionsText the suggestions text to set
     */
    private set suggestionsText(suggestionsText: string) {
        this.suggestions.innerHTML = suggestionsText;
    }

    /**
     * Returns how many lines the user has scrolled up in the terminal.
     */
    private get scroll(): number {
        return -parseCssPixels(this.terminal.style.marginBottom) / this.lineHeight;
    }

    /**
     * Sets the absolute number of lines to scroll up in the terminal relative to the bottom of the terminal.
     *
     * @param lines the absolute number of lines to scroll up in the terminal relative to the bottom of the terminal
     */
    private set scroll(lines: number) {
        const screenHeight = document.documentElement.clientHeight
            - 2 * parseCssPixels(getComputedStyle(this.terminal).paddingTop); // top and bottom padding
        const linesFitOnScreen = Math.round(screenHeight / this.lineHeight);
        const linesInHistory = Math.round(this.output.offsetHeight / this.lineHeight) + 1; // +1 for input line

        if (lines < 0)
            lines = 0;
        else if (linesInHistory <= linesFitOnScreen)
            lines = 0;
        else if (lines > linesInHistory - linesFitOnScreen)
            lines = linesInHistory - linesFitOnScreen;

        this.terminal.style.marginBottom = (-lines * this.lineHeight) + "px";
    }

    /**
     * Returns `true` if and only if the input field does not display the user's input.
     */
    private get isInputHidden(): boolean {
        return this.input.classList.contains("terminalInputFieldHidden");
    }

    /**
     * Sets whether the input field should display the user's input.
     *
     * @param isInputHidden whether the input field should display the user's input
     */
    private set isInputHidden(isInputHidden: boolean) {
        if (isInputHidden)
            this.input.classList.add("terminalInputFieldHidden");
        else
            this.input.classList.remove("terminalInputFieldHidden");
    }


    /**
     * Moves to the next input line without processing the current input line.
     */
    private ignoreInput(): void {
        this.outputText += `${this.prefixText}${escapeHtml(this.inputText)}\n`;
        this.prefixText = this.shell.generatePrefix();
        this.inputText = "";
        this.inputHistory.resetIndex();
    }

    /**
     * Processes a user's input.
     *
     * @param input the input to process
     */
    processInput(input: string): void {
        this.inputText = "";
        this.outputText += `${this.prefixText}${this.isInputHidden ? "" : escapeHtml(input)}\n`;

        this.standardInput.writeLine(input);
        this.shell.execute(new StreamSet(this.standardInput, this.standardOutput, this.standardError));

        let buffer = "";
        while (this.standardOutput.has(1)) {
            if (this.standardOutput.peek(1) === EscapeCharacters.Escape && !this.standardOutput.has(2))
                break;

            const char = this.standardOutput.read(1);
            if (char !== EscapeCharacters.Escape) {
                buffer += char;
                continue;
            }

            const nextChar = this.standardOutput.read(1);
            switch (nextChar) {
                case EscapeCharacters.Clear:
                    buffer = "";
                    this.outputText = "";
                    break;
                case EscapeCharacters.HideInput:
                    this.isInputHidden = true;
                    break;
                case EscapeCharacters.ShowInput:
                    this.isInputHidden = false;
                    break;
                default:
                    buffer += nextChar;
                    break;
            }
        }
        this.outputText += buffer;

        this.prefixText = this.shell.generatePrefix();
        this.scroll = 0;
    }


    /**
     * Handles click events of the document.
     */
    private onclick(event: MouseEvent): void {
        // Do not focus on input if user clicked a link
        const target = event.target;
        if (target instanceof HTMLElement && target.nodeName.toLowerCase() === "a")
            return;

        // Do not focus on input if user has text selected; this allows user to copy text
        if ((document.getSelection() ?? "").toString() !== "")
            return;

        // Do not focus if user clicks in input
        if (target === this.input)
            return;

        this.input.focus();
        if (target !== this.prefixDiv) // `focus` moved to start; move to end unless prefix was clicked
            setTimeout(() => moveCaretToEndOf(this.input.firstChild), 0);
    }

    /**
     * Handles key press events of the document.
     *
     * @param event the event to handle
     */
    private onkeypress(event: KeyboardEvent): void {
        // If user types anywhere, move caret to end of input, unless user was already focused on input
        if (this.input !== document.activeElement) {
            this.inputText += event.key; // Append to input because event was not executed on input

            const inputChild = this.input.firstChild;
            if (inputChild !== null)
                setTimeout(() => moveCaretToEndOf(inputChild), 0);
        }

        switch (event.key.toLowerCase()) {
            case "enter":
                this.processInput(this.inputText.replace(/&nbsp;/g, " "));
                event.preventDefault();
                break;
        }
    }

    /**
     * Handles key down events of the document.
     *
     * @param event the event to handle
     */
    private onkeydown(event: KeyboardEvent): void {
        switch (event.key.toLowerCase()) {
            case "alt":
            case "altgraph":
            case "control":
            case "meta":
            case "os":
            case "shift":
                // Do nothing
                return; // Return without scrolling to 0
            case "arrowup": {
                // Display previous entry from history
                this.inputText = this.inputHistory.previous();

                const inputChild = this.input.firstChild;
                if (inputChild !== null)
                    setTimeout(() => moveCaretToEndOf(inputChild), 0);
                break;
            }
            case "arrowdown": {
                // Display next entry in history
                this.inputText = this.inputHistory.next();

                const inputChild = this.input.firstChild;
                if (inputChild !== null)
                    setTimeout(() => moveCaretToEndOf(inputChild), 0);
                break;
            }
            case "tab": {
                // Auto complete, with auto fill
                this.autoComplete(true);
                event.preventDefault();
                break;
            }
            case "i":
                // Auto complete, without auto fill
                if (event.ctrlKey) {
                    this.autoComplete(false);
                    event.preventDefault();
                }
                break;
            case "c":
                // Only if focused on the input as to not prevent copying of selected text
                if (event.ctrlKey) {
                    if (this.input !== document.activeElement)
                        return; // Return without scrolling to 0

                    this.ignoreInput();
                    event.preventDefault();
                }
                break;
            case "l":
                // Clear screen
                if (event.ctrlKey) {
                    this.outputText = "";

                    if (isStandalone())
                        event.preventDefault();
                }
                break;
            case "w":
            case "backspace":
                this.suggestionsText = "";

                // Remove word before caret
                if (event.ctrlKey) {
                    let offset = this.inputText.length;
                    if (this.input === document.activeElement)
                        offset = document.getSelection()?.anchorOffset ?? offset;

                    const [newLeft, word, right] = extractWordBefore(this.inputText, offset);
                    this.inputText = newLeft + right;
                    window.setTimeout(() => moveCaretTo(this.input.firstChild, offset - word.length), 0);

                    event.preventDefault();
                }
                break;
        }

        this.scroll = 0;
    }


    /**
     * Invokes the auto-completion functionality of this terminal's shell and uses it to inform the user.
     *
     * @param autoFill `false` if the terminal should only provide the user with suggestions; `true` if the input should
     * be altered if there is only one suggestion available
     */
    private autoComplete(autoFill: boolean): void {
        let offset = this.inputText.length;
        if (this.input === document.activeElement)
            offset = document.getSelection()?.anchorOffset ?? offset;

        const [left, word, right] = extractWordBefore(this.inputText, offset, " ");
        const suggestions = this.shell.autoComplete(word);
        const commonPrefix = findLongestCommonPrefix(suggestions);

        if (autoFill && commonPrefix !== undefined && commonPrefix !== word) {
            const newOffset = offset + (commonPrefix.length - word.length);
            this.inputText = left + commonPrefix + right;
            setTimeout(() => moveCaretTo(this.input.firstChild, newOffset), 0);
        } else if (!autoFill || suggestions.length > 1) {
            this.suggestionsText = suggestions
                .map((it) => it.slice(it.trimRightChar("/").lastIndexOf("/") + 1))
                .join(" ");
        }
    }
}

/**
 * Valid escape characters accepted by the terminal.
 *
 * These escape characters are interpreted by the terminal when they are written to its output stream.
 */
export enum EscapeCharacters {
    /**
     * The prefix used in all escape characters.
     */
    Escape = "\u001b",
    /**
     * Clears the terminal's output.
     */
    Clear = "\u0001",
    /**
     * Hides the input the user is currently typing.
     */
    HideInput = "\u0002",
    /**
     * Shows the input the user is currently typing.
     */
    ShowInput = "\u0003"
}
