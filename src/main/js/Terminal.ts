import {InputHistory} from "./InputHistory";
import {Persistence} from "./Persistence";
import {escapeHtml, moveCaretTo, moveCaretToEndOf, parseCssPixels} from "./Shared";
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
     * Constructs a new terminal.
     *
     * @param terminal the HTML element of the terminal
     * @param input the HTML element where the user types
     * @param output the HTML element where the output is displayed
     * @param prefixDiv the HTML element where the current prefix is displayed
     */
    constructor(terminal: HTMLElement, input: HTMLElement, output: HTMLElement, prefixDiv: HTMLElement) {
        this.terminal = terminal;
        this.input = input;
        this.output = output;
        this.prefixDiv = prefixDiv;

        this.inputHistory = Persistence.getHistory();
        this.shell = new Shell(this.inputHistory);

        document.addEventListener("click", this.onclick.bind(this));
        document.addEventListener("keypress", this.onkeypress.bind(this));
        document.addEventListener("keydown", this.onkeydown.bind(this));

        let scrollStartPosition: number = 0;
        this.terminal.addEventListener("wheel", (event: WheelEvent) => {
            this.scroll += -event.deltaY / 100;
        }, {passive: true});
        this.terminal.addEventListener("touchstart", (event: TouchEvent) => {
            scrollStartPosition = event.changedTouches[0].clientY;
        }, {passive: true});
        this.terminal.addEventListener("touchmove", (event: TouchEvent) => {
            const newPosition = event.changedTouches[0].clientY;
            const diff = scrollStartPosition - newPosition;
            if (Math.abs(diff) < this.lineHeight)
                return;

            this.scroll -= Math.trunc(diff / this.lineHeight); // -= because swipe down => increase scroll
            scrollStartPosition = newPosition;
        }, {passive: true});

        this.outputText = this.shell.generateHeader();
        this.prefixText = this.shell.generatePrefix();
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
     * Returns how many lines the user has scrolled up in the terminal.
     */
    private get scroll(): number {
        return -Math.round(parseCssPixels(this.terminal.style.marginBottom) / this.lineHeight);
    }

    /**
     * Sets the absolute number of lines to scroll up in the terminal relative to the bottom of the terminal.
     *
     * @param lines the absolute number of lines to scroll up in the terminal relative to the bottom of the terminal
     */
    private set scroll(lines: number) {
        lines = Math.round(lines); // input must be whole number

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
        return this.input.classList.contains("terminalCurrentFocusInputHidden");
    }

    /**
     * Sets whether the input field should display the user's input.
     *
     * @param isInputHidden whether the input field should display the user's input
     */
    private set isInputHidden(isInputHidden: boolean) {
        if (isInputHidden)
            this.input.classList.add("terminalCurrentFocusInputHidden");
        else
            this.input.classList.remove("terminalCurrentFocusInputHidden");
    }


    /**
     * Moves to the next input line without processing the current input line.
     */
    private ignoreInput(): void {
        this.outputText += `${this.prefixText}${this.inputText}\n`;
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
        this.shell.execute(new StreamSet(this.standardInput, this.standardOutput, this.standardOutput));

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
     * Handles click events.
     */
    private onclick(): void {
        // Focus on input unless user has text selected. This allows user to copy text
        if ((document.getSelection() ?? "").toString() === "")
            this.input.focus();
    }

    /**
     * Handles key press events.
     *
     * @param event the event to handle
     */
    private onkeypress(event: KeyboardEvent): void {
        this.scroll = 0;
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
     * Handles key down events.
     *
     * @param event the event to handle
     */
    private onkeydown(event: KeyboardEvent): void {
        this.scroll = 0;

        switch (event.key.toLowerCase()) {
            case "arrowup": {
                this.inputText = this.inputHistory.previous();

                const inputChild = this.input.firstChild;
                if (inputChild !== null)
                    setTimeout(() => moveCaretToEndOf(inputChild), 0);
                break;
            }
            case "arrowdown": {
                this.inputText = this.inputHistory.next();

                const inputChild = this.input.firstChild;
                if (inputChild !== null)
                    setTimeout(() => moveCaretToEndOf(inputChild), 0);
                break;
            }
            case "tab":
                event.preventDefault();
                break;
            case "c":
                // Only if focused on the input as to not prevent copying of selected text
                if (event.ctrlKey && this.input === document.activeElement) {
                    this.ignoreInput();
                    event.preventDefault();
                }
                break;
            case "w":
            case "backspace":
                if (event.ctrlKey) {
                    let offset = this.inputText.length;
                    if (this.input === document.activeElement)
                        offset = document.getSelection()?.anchorOffset ?? offset;

                    const left = this.inputText.slice(0, offset);
                    const right = this.inputText.slice(offset);

                    const delimiterIndex = Math.max(
                        left.trimRightChar(" ").lastIndexOf(" "),
                        left.trimRightChar("/").lastIndexOf("/")
                    );
                    const newLeft = delimiterIndex >= 0
                        ? left.slice(0, delimiterIndex + 1)
                        : "";
                    const newOffset = offset - (left.length - newLeft.length);

                    this.inputText = newLeft + right;

                    const element = this.input.firstChild;
                    if (element !== null)
                        window.setTimeout(() => moveCaretTo(element, newOffset), 0);

                    event.preventDefault();
                }
                break;
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
