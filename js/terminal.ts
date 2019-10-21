import {addOnLoad, asciiHeaderHtml, moveCaretToEndOf, q} from "./shared.js";
import {FileSystem} from "./fs.js";
import {Commands} from "./commands.js";


export class Terminal {
    private readonly terminal: HTMLElement;
    private readonly input: HTMLElement;
    private readonly output: HTMLElement;
    private readonly prefixDiv: HTMLElement;

    private readonly inputHistory: InputHistory;
    private readonly fileSystem: FileSystem;
    private readonly commands: Commands;

    private _currentUser: string;
    private isLoggedIn: boolean;


    constructor(terminal: HTMLElement, input: HTMLElement, output: HTMLElement, prefixDiv: HTMLElement) {
        this.terminal = terminal;
        this.input = input;
        this.output = output;
        this.prefixDiv = prefixDiv;

        this._currentUser = "felix";
        this.isLoggedIn = true;

        this.inputHistory = new InputHistory();
        this.fileSystem = new FileSystem();
        this.commands = new Commands(this, this.fileSystem);

        this.terminal.addEventListener("click", this.onclick.bind(this));
        this.terminal.addEventListener("keypress", this.onkeypress.bind(this));
        this.terminal.addEventListener("keydown", this.onkeydown.bind(this));

        this.reset();
        this.input.focus();
    }


    get inputText(): string {
        return this.input.innerHTML
            .replaceAll(/<br>/, "");
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

    get currentUser(): string {
        return this._currentUser;
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
        if (!this.isLoggedIn) {
            if (this._currentUser === undefined)
                return "login as: ";
            else
                return `Password for ${this._currentUser}@fwdekker.com: `;
        }

        return `${this._currentUser}@fwdekker.com <span style="color: green;">${this.fileSystem.pwd}</span>&gt; `;
    }


    clear() {
        this.outputText = "";
    }

    reset() {
        this.fileSystem.reset();

        this.outputText = Terminal.generateHeader();
        this.prefixText = this.generatePrefix();
    }


    private continueLogin(input: string) {
        if (this._currentUser === undefined) {
            this.outputText += `${this.prefixText}${input}\n`;

            this._currentUser = input.trim();
            this.input.classList.add("terminalCurrentFocusInputHidden");
        } else {
            this.outputText += `${this.prefixText}\n`;

            if ((this._currentUser === "felix" && input === "password")
                || (this._currentUser === "root" && input === "root")) {
                this.isLoggedIn = true;
                this.outputText += Terminal.generateHeader();
            } else {
                this._currentUser = undefined;
                this.outputText += "Access denied\n";
            }

            this.input.classList.remove("terminalCurrentFocusInputHidden");
        }
    }

    logOut() {
        this._currentUser = undefined;
        this.isLoggedIn = false;
        this.inputHistory.clear();
    }

    ignoreInput() {
        this.outputText += `${this.prefixText}${this.inputText}\n`;
        this.prefixText = this.generatePrefix();
        this.inputText = "";
    }

    processInput(input: string) {
        this.inputText = "";

        if (!this.isLoggedIn) {
            this.continueLogin(input);
        } else {
            this.outputText += `${this.prefixText}${input}\n`;
            this.inputHistory.addEntry(input);

            const output = this.commands.parse(input.trim());
            if (output !== "")
                this.outputText += output + `\n`;
        }

        this.prefixText = this.generatePrefix();
    }


    private onclick() {
        this.input.focus();
    }

    private onkeypress(event) {
        switch (event.key.toLowerCase()) {
            case "enter":
                this.processInput(this.inputText.replaceAll(/&nbsp;/, " "));
                event.preventDefault();
                break;
        }
    }

    private onkeydown(event) {
        switch (event.key.toLowerCase()) {
            case "arrowup":
                this.inputText = this.inputHistory.previousEntry();
                window.setTimeout(() => moveCaretToEndOf(this.input), 0);
                break;
            case "arrowdown":
                this.inputText = this.inputHistory.nextEntry();
                window.setTimeout(() => moveCaretToEndOf(this.input), 0);
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

class InputHistory {
    private history: string[];
    private index: number;


    constructor() {
        this.clear();
    }


    addEntry(entry: string) {
        if (entry.trim() !== "")
            this.history.unshift(entry);

        this.index = -1;
    }

    clear() {
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


export let terminal: Terminal;

addOnLoad(() => {
    terminal = new Terminal(
        q("#terminal"),
        q("#terminalCurrentFocusInput"),
        q("#terminalOutput"),
        q("#terminalCurrentPrefix")
    );

    // @ts-ignore: Force definition
    window.relToAbs = (filename: string) => terminal.fileSystem.pwd + filename;
    // @ts-ignore: Force definition
    window.run = (command: string) => terminal.processInput(command);

    terminal.processInput("ls");
});
