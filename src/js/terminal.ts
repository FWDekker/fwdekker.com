import {asciiHeaderHtml, moveCaretToEndOf, parseCssPixels} from "./shared.js";
import {FileSystem} from "./fs.js";
import {Commands} from "./commands.js";
import {System} from "./system.js";


export class Terminal {
    private readonly lineHeight: number = 21;

    private readonly terminal: HTMLElement;
    private readonly input: HTMLElement;
    private readonly output: HTMLElement;
    private readonly prefixDiv: HTMLElement;

    private readonly system: System;
    private readonly inputHistory: InputHistory;
    private readonly fileSystem: FileSystem;
    private readonly commands: Commands;

    private attemptUser: string | undefined;


    constructor(terminal: HTMLElement, input: HTMLElement, output: HTMLElement, prefixDiv: HTMLElement) {
        this.terminal = terminal;
        this.input = input;
        this.output = output;
        this.prefixDiv = prefixDiv;

        this.system = new System();
        this.inputHistory = new InputHistory();
        this.fileSystem = new FileSystem();
        this.commands = new Commands(this.system, this.fileSystem);

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
            const newPosition = event.changedTouches[0].clientY;
            const diff = scrollStartPosition - newPosition;
            if (Math.abs(diff) < this.lineHeight)
                return;

            this.scroll -= Math.floor(diff / this.lineHeight); // -= because swipe down => increase scroll
            scrollStartPosition = newPosition - (newPosition % this.lineHeight);
        });

        this.reset();
        this.input.focus();
    }


    get inputText(): string {
        return this.input.innerHTML.replaceAll(/<br>/, "");
    }

    set inputText(inputText: string) {
        this.input.innerHTML = inputText;
    }

    get outputText(): string {
        return this.output.innerHTML;
    }

    set outputText(outputText: string) {
        this.output.innerHTML = outputText;
    }

    get prefixText(): string {
        return this.prefixDiv.innerHTML;
    }

    set prefixText(prefixText: string) {
        this.prefixDiv.innerHTML = prefixText;
    }

    get scroll(): number {
        return -Math.round(parseCssPixels(this.terminal.style.marginBottom) / this.lineHeight);
    }

    set scroll(lines: number) {
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

    generatePrefix(): string {
        if (!this.system.isLoggedIn) {
            if (this.attemptUser === undefined)
                return "login as: ";
            else
                return `Password for ${this.attemptUser}@fwdekker.com: `;
        } else {
            if (this.system.currentUser === undefined)
                throw "User is logged in as undefined.";

            return `${this.system.currentUser.name}@fwdekker.com <span style="color: green;">${this.fileSystem.pwd}</span>&gt; `;
        }
    }


    private reset(): void {
        this.fileSystem.reset();

        this.outputText = Terminal.generateHeader();
        this.prefixText = this.generatePrefix();
    }


    private continueLogin(input: string): void {
        if (this.system.isLoggedIn)
            throw "`continueLogin` is called while user is already logged in.";

        if (this.attemptUser === undefined) {
            this.outputText += `${this.prefixText}${input.trim()}\n`;

            this.attemptUser = input.trim();

            this.input.classList.add("terminalCurrentFocusInputHidden");
        } else {
            this.outputText += `${this.prefixText}\n`;

            if (this.system.tryLogIn(this.attemptUser, input))
                this.outputText += Terminal.generateHeader();
            else
                this.outputText += "Access denied\n";

            this.attemptUser = undefined;
            this.input.classList.remove("terminalCurrentFocusInputHidden");
        }
    }

    ignoreInput(): void {
        this.outputText += `${this.prefixText}${this.inputText}\n`;
        this.prefixText = this.generatePrefix();
        this.inputText = "";
    }

    processInput(input: string): void {
        this.inputText = "";

        if (!this.system.isLoggedIn) {
            this.continueLogin(input);
        } else {
            this.outputText += `${this.prefixText}${input}\n`;
            this.inputHistory.addEntry(input);

            const output = this.commands.execute(input.trim());
            switch (output[0]) {
                case "append":
                    if (output[1] !== "")
                        this.outputText += output[1] + `\n`;
                    break;
                case "clear":
                    this.outputText = "";
                    break;
            }

            if (!this.system.isLoggedIn) {
                this.inputHistory.clear();
                this.fileSystem.reset();
            }
        }

        this.prefixText = this.generatePrefix();
        this.scroll = 0;
    }


    private onclick(): void {
        this.input.focus();
    }

    private onkeypress(event: KeyboardEvent): void {
        this.scroll = 0;
        switch (event.key.toLowerCase()) {
            case "enter":
                this.processInput(this.inputText.replaceAll(/&nbsp;/, " "));
                event.preventDefault();
                break;
        }
    }

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

export type OutputAction = ["nothing"] | ["clear"] | ["append", string]

class InputHistory {
    private history: string[];
    private index: number;


    constructor() {
        this.history = [];
        this.index = -1;
    }


    addEntry(entry: string): void {
        if (entry.trim() !== "")
            this.history.unshift(entry);

        this.index = -1;
    }

    clear(): void {
        this.history = [];
        this.index = -1;
    }

    getEntry(index: number): string {
        if (index >= 0)
            return this.history[index];
        else
            return "";
    }

    nextEntry(): string {
        this.index--;
        if (this.index < -1)
            this.index = -1;

        return this.getEntry(this.index);
    }

    previousEntry(): string {
        this.index++;
        if (this.index >= this.history.length)
            this.index = this.history.length - 1;

        return this.getEntry(this.index);
    }
}
