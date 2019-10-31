import {asciiHeaderHtml, moveCaretToEndOf, parseCssPixels} from "./shared.js";
import {FileSystem} from "./fs.js";
import {Commands} from "./commands.js";
import {UserSession} from "./user-session.js";


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
     * The user session describing the user that interacts with the terminal.
     */
    private readonly userSession: UserSession;
    /**
     * The history of the user's inputs.
     */
    private readonly inputHistory: InputHistory;
    /**
     * The file system.
     */
    private readonly fileSystem: FileSystem;
    /**
     * The set of commands that can be executed.
     */
    private readonly commands: Commands;

    /**
     * The name of the user that the user is currently trying to log in as, or `undefined` if the user is not currently
     * trying to log in.
     */
    private attemptUser: string | undefined;


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

        this.userSession = new UserSession("felix");
        this.inputHistory = new InputHistory();
        // @ts-ignore
        this.fileSystem = new FileSystem(Cookies.get("files"), Cookies.get("cwd"));
        this.commands = new Commands(this.userSession, this.fileSystem);

        this.terminal.addEventListener("click", this.onclick.bind(this));
        this.terminal.addEventListener("keypress", this.onkeypress.bind(this));
        this.terminal.addEventListener("keydown", this.onkeydown.bind(this));

        let scrollStartPosition: number = 0;
        this.terminal.addEventListener("wheel", (event: WheelEvent) => {
            this.scroll += -event.deltaY / 100;
        });
        this.terminal.addEventListener("touchstart", (event: TouchEvent) => {
            scrollStartPosition = event.changedTouches[0].clientY;
        });
        this.terminal.addEventListener("touchmove", (event: TouchEvent) => {
            event.preventDefault();

            const newPosition = event.changedTouches[0].clientY;
            const diff = scrollStartPosition - newPosition;
            if (Math.abs(diff) < this.lineHeight)
                return;

            this.scroll -= Math.floor(diff / this.lineHeight); // -= because swipe down => increase scroll
            scrollStartPosition = newPosition - (newPosition % this.lineHeight);
        });

        this.outputText = Terminal.generateHeader();
        this.prefixText = this.generatePrefix();
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
     * Generates the header that is displayed when a user logs in.
     *
     * @return the header that is displayed when a user logs in
     */
    static generateHeader(): string {
        return "" +
            `${asciiHeaderHtml}

            Student MSc Computer Science <span class="smallScreenOnly">
            </span>@ <a href="https://www.tudelft.nl/en/">TU Delft</a>, the Netherlands
            <span class="wideScreenOnly">${(new Date()).toISOString()}
            </span>
            Type "<a href="#" onclick="run('help');">help</a>" for help.

            `.trimLines();
    }

    /**
     * Generates the prefix based on the current state of the terminal.
     *
     * @return  the prefix based on the current state of the terminal
     */
    private generatePrefix(): string {
        if (!this.userSession.isLoggedIn) {
            if (this.attemptUser === undefined)
                return "login as: ";
            else
                return `Password for ${this.attemptUser}@fwdekker.com: `;
        } else {
            if (this.userSession.currentUser === undefined)
                throw "User is logged in as undefined.";

            return `${this.userSession.currentUser.name}@fwdekker.com <span style="color: green;">${this.fileSystem.cwd}</span>&gt; `;
        }
    }


    /**
     * Moves to the next input line without processing the current input line.
     */
    private ignoreInput(): void {
        this.outputText += `${this.prefixText}${this.inputText}\n`;
        this.prefixText = this.generatePrefix();
        this.inputText = "";
    }

    /**
     * Continues a login attempt where the user has entered the given input.
     *
     * The input is either a username if `this.attemptUser` is `undefined`, or a password otherwise.
     *
     * @param input the user's input.
     * @throws if the user is already logged in
     */
    private continueLogin(input: string): void {
        if (this.userSession.isLoggedIn)
            throw "`continueLogin` is called while user is already logged in.";

        if (this.attemptUser === undefined) {
            this.outputText += `${this.prefixText}${input.trim()}\n`;

            this.attemptUser = input.trim();

            this.input.classList.add("terminalCurrentFocusInputHidden");
        } else {
            this.outputText += `${this.prefixText}\n`;

            if (this.userSession.tryLogIn(this.attemptUser, input))
                this.outputText += Terminal.generateHeader();
            else
                this.outputText += "Access denied\n";

            this.attemptUser = undefined;
            this.input.classList.remove("terminalCurrentFocusInputHidden");
        }
    }

    /**
     * Processes a user's input.
     *
     * @param input the input to process
     */
    processInput(input: string): void {
        this.inputText = "";

        if (!this.userSession.isLoggedIn) {
            this.continueLogin(input);
        } else {
            this.outputText += `${this.prefixText}${input}\n`;
            this.inputHistory.addEntry(input);

            const output = this.commands.execute(input.trim());
            switch (output[0]) {
                case "append":
                    if (output[1] !== "")
                        this.outputText += output[1] + (output[1].endsWith("\n") ? "" : "\n");
                    break;
                case "clear":
                    this.outputText = "";
                    break;
                case "nothing":
                    break;
            }

            if (!this.userSession.isLoggedIn) {
                // If the user is no longer logged in
                this.inputHistory.clear();
                this.fileSystem.cwd = "/";
            }
        }

        this.prefixText = this.generatePrefix();
        this.scroll = 0;

        // @ts-ignore
        Cookies.set("files", this.fileSystem.serializedRoot, {
            "expires": new Date(new Date().setFullYear(new Date().getFullYear() + 25)),
            "path": "/"
        });
        // @ts-ignore
        Cookies.set("cwd", this.fileSystem.cwd, {"path": "/"});
    }


    /**
     * Handles click events.
     */
    private onclick(): void {
        this.input.focus();
    }

    /**
     * Handles key press events.
     *
     * @param event the event to handle
     */
    private onkeypress(event: KeyboardEvent): void {
        this.scroll = 0;
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
                if (event.ctrlKey) {
                    this.ignoreInput();
                    event.preventDefault();
                }
                break;
        }
    }
}

/**
 * Communicates to the terminal what kind of output should be displayed after executing a command.
 *
 * <ul>
 *     <li>`["nothing"]` means that no output is to be displayed. Equivalent to `["append", ""]`.</li>
 *     <li>`["clear"]` means that the terminal's history should be cleared.</li>
 *     <li>`["append", string]` means that the given string should be displayed as output.</li>
 * </ul>
 */
export type OutputAction = ["nothing"] | ["clear"] | ["append", string]


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
class InputHistory {
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
}
