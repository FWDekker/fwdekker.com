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

    private readonly users: User[];
    private _currentUser: User | undefined;
    private isLoggedIn: boolean;


    constructor(terminal: HTMLElement, input: HTMLElement, output: HTMLElement, prefixDiv: HTMLElement) {
        this.terminal = terminal;
        this.input = input;
        this.output = output;
        this.prefixDiv = prefixDiv;

        this.users = [
            new User("felix", "password", "Why are you logged in on <i>my</i> account?"),
            new User("root", "root", "Wait how did you get here?")
        ];
        this._currentUser = this.users.find(it => it.name === "felix");
        if (this._currentUser === undefined)
            throw "Could not find user `felix`.";
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

    get currentUser(): User | undefined {
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
                return `Password for ${this._currentUser.name}@fwdekker.com: `;
        }

        if (this._currentUser === undefined)
            throw "User is logged in as undefined.";

        return `${this._currentUser.name}@fwdekker.com <span style="color: green;">${this.fileSystem.pwd}</span>&gt; `;
    }


    clear() {
        this.outputText = "";
    }

    private reset() {
        this.fileSystem.reset();

        this.outputText = Terminal.generateHeader();
        this.prefixText = this.generatePrefix();
    }


    private continueLogin(input: string) {
        if (this.isLoggedIn)
            throw "`continueLogin` is called while user is already logged in.";

        const user = this._currentUser;
        if (user === undefined) {
            this.outputText += `${this.prefixText}${input.trim()}\n`;

            this._currentUser = this.users.find(it => it.name === input.trim());
            if (this._currentUser === undefined)
                this._currentUser = new User(input.trim(), "temp", "temp");

            this.input.classList.add("terminalCurrentFocusInputHidden");
        } else {
            this.outputText += `${this.prefixText}\n`;

            if (this.users.find(it => it.name === user.name) && input === user.password) {
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
        this.fileSystem.reset();
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

            const output = this.commands.execute(input.trim());
            if (output !== "")
                this.outputText += output + `\n`;
        }

        this.prefixText = this.generatePrefix();
    }


    private onclick() {
        this.input.focus();
    }

    private onkeypress(event: KeyboardEvent) {
        switch (event.key.toLowerCase()) {
            case "enter":
                this.processInput(this.inputText.replaceAll(/&nbsp;/, " "));
                event.preventDefault();
                break;
        }
    }

    private onkeydown(event: KeyboardEvent) {
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

class InputHistory {
    private history: string[];
    private index: number;


    constructor() {
        this.history = [];
        this.index = -1;
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

class User {
    readonly name: string;
    readonly password: string;
    readonly description: string;


    constructor(name: string, password: string, description: string) {
        this.name = name;
        this.password = password;
        this.description = description;
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
