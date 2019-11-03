import {moveCaretToEndOf, parseCssPixels} from "./Shared";
import {Shell} from "./Shell";


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

        this.inputHistory = new InputHistory();
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

            this.scroll -= Math.floor(diff / this.lineHeight); // -= because swipe down => increase scroll
            scrollStartPosition = newPosition - (newPosition % this.lineHeight);
        }, {passive: true});

        this.outputText = this.shell.generateHeader();
        this.prefixText = this.shell.generatePrefix();
        this.input.focus();
    }


    /**
     * Returns the input the user has entered in the HTML element.
     *
     * @return the input the user has entered in the HTML element
     */
    private get inputText(): string {
        return this.input.innerHTML.replaceAll(/<br>/, "");
    }

    /**
     * Sets the given text as the text of the input HTML element.
     *
     * @param inputText the text to set as the text of the input HTML element
     */
    private set inputText(inputText: string) {
        this.input.innerHTML = inputText;
    }

    /**
     * Returns the terminal output that is being displayed.
     *
     * @return the terminal output that is being displayed
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
     *
     * @return the current prefix text
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
     *
     * @return how many lines the user has scrolled up in the terminal
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
     *
     * @return `true` if and only if the input field does not display the user's input
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
        this.outputText += `${this.prefixText}${this.isInputHidden ? "" : input.trim()}\n`;

        const output = this.shell.execute(input);
        let buffer = "";
        for (let i = 0; i < output.length; i++) {
            if (output.charAt(i) != EscapeCharacters.Escape) {
                buffer += output.charAt(i);
                continue;
            }

            switch (output.charAt(i + 1)) {
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
                    buffer += output.charAt(i) + output.charAt(i + 1);
                    break;
            }
            i++;
        }
        if (buffer !== "")
            this.outputText += buffer + (buffer.endsWith("\n") ? "" : "\n");

        this.prefixText = this.shell.generatePrefix();
        this.scroll = 0;
    }


    /**
     * Handles click events.
     */
    private onclick(): void {
        // Focus on input unless user has text selected. This allows user to copy text
        if ((document.getSelection() || "").toString() === "")
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
            setTimeout(() => moveCaretToEndOf(this.input), 0);
        }

        switch (event.key.toLowerCase()) {
            case "enter":
                this.processInput(this.inputText.replaceAll(/&nbsp;/, " "));
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
            case "arrowup":
                this.inputText = this.inputHistory.previousEntry();
                window.setTimeout(() => moveCaretToEndOf(this.input), 0);
                break;
            case "arrowdown":
                this.inputText = this.inputHistory.nextEntry();
                window.setTimeout(() => moveCaretToEndOf(this.input), 0);
                break;
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


/**
 * A history of inputs that grows downwards and can be accessed in sequence relative to the newest entry.
 *
 * An input history keeps a "read index" that starts at `-1`. After entries have been added, calling `previousEntry`
 * will increase the read index to `0` and return the newest entry. Calling `previousEntry` again will increase the read
 * index to `1` and return the first-to-last entry. Calling `nextEntry` at this point will decrease the read index to
 * `0` and will return the last entry again. Adding a new entry to the history resets the read index to `-1`. Calling
 * `nextEntry` while the read index is at `-1` will return an empty string without decrementing the read index further.
 * Calling `previousEntry` at the highest possible index will return the first entry without incrementing the read index
 * further.
 */
export class InputHistory {
    /**
     * The list of previous input.
     */
    private history: string[] = [];
    /**
     * The current index that the history is being read from.
     */
    private index: number = -1;


    /**
     * Adds a new input to the bottom of the history and resets the read index.
     *
     * @param entry the entry to add
     */
    addEntry(entry: string): void {
        if (entry.trim() !== "")
            this.history.unshift(entry);

        this.index = -1;
    }

    /**
     * Removes all entries from the history and resets the read index.
     */
    clear(): void {
        this.history = [];
        this.index = -1;
    }

    /**
     * Returns the entry at the given index, or an empty string if the index is negative.
     *
     * @param index the index to return the entry of, where `0` is the newest entry and `-1` returns an empty string
     * @return the entry at the given index, or an empty string if the index is `-1`
     * @throws if the index is out of bounds and not `-1`
     */
    getEntry(index: number): string {
        if (index === -1)
            return "";

        return this.history[index];
    }

    /**
     * Returns the next (newer) entry in the history, or an empty string if the read index has gone past the newest
     * entry.
     *
     * The read counter is decremented if possible.
     *
     * @return the next (newer) entry in the history, or an empty string if the read index has gone past the newest
     * entry
     */
    nextEntry(): string {
        this.index--;
        if (this.index < -1)
            this.index = -1;

        return this.getEntry(this.index);
    }

    /**
     * Returns the previous (older) entry in the history, or the oldest entry if the read index is already at the oldest
     * entry.
     *
     * The read counter is incremented if possible.
     *
     * @return the previous (older) entry in the history, or the oldest entry if the read index is already at the oldest
     * entry
     */
    previousEntry(): string {
        this.index++;
        if (this.index >= this.history.length)
            this.index = this.history.length - 1;

        return this.getEntry(this.index);
    }

    /**
     * Resets the read index without changing any entries.
     */
    resetIndex(): void {
        this.index = -1;
    }
}
