class Terminal {
    constructor(terminal, input, output, prefixDiv) {
        this._terminal = terminal;
        this._input = input;
        this._output = output;
        this._prefixDiv = prefixDiv;

        this._user = "felix";
        this._loggedIn = true;

        this._inputHistory = new InputHistory();
        this._fs = new FileSystem();
        this._commands = new Commands(this, this._fs);

        this._terminal.addEventListener("click", this._onclick.bind(this));
        this._terminal.addEventListener("keypress", this._onkeypress.bind(this));
        this._terminal.addEventListener("keydown", this._onkeydown.bind(this));

        this.reset();
        this._input.focus();
    }


    get inputText() {
        return this._input.innerHTML
            .replaceAll(/<br>/, "");
    }

    set inputText(inputText) {
        this._input.innerHTML = inputText;
    }

    get outputText() {
        return this._output.innerHTML;
    }

    set outputText(outputText) {
        this._output.innerHTML = outputText;
    }

    get prefixText() {
        return this._prefixDiv.innerHTML;
    }

    set prefixText(prefixText) {
        this._prefixDiv.innerHTML = prefixText;
    }


    static generateHeader() {
        return "" +
            `<span class="wideScreenOnly">${asciiHeader}</span><span class="smallScreenOnly"><b><u>FWDekker</u></b></span>

            Student MSc Computer Science <span class="smallScreenOnly">
            </span>@ <a href="https://www.tudelft.nl/en/">TU Delft</a>, the Netherlands
            <span class="wideScreenOnly">${(new Date()).toISOString()}
            </span>
            Type "help" for help.

            `.trimLines();
    }

    generatePrefix() {
        if (!this._loggedIn) {
            if (this._user === undefined) {
                return "login as: ";
            } else {
                return `Password for ${this._user}@fwdekker.com: `;
            }
        }

        return `${this._user}@fwdekker.com <span style="color: green;">${this._fs.pwd}</span>&gt; `;
    }


    clear() {
        this.outputText = "";
    }

    reset() {
        this._fs.reset();

        this.outputText = Terminal.generateHeader();
        this.prefixText = this.generatePrefix();
    }


    continueLogin(input) {
        if (this._user === undefined) {
            this.outputText += `${this.prefixText}${input}\n`;

            this._user = input.trim();
            this._input.classList.add("terminalCurrentFocusInputHidden");
        } else {
            this.outputText += `${this.prefixText}\n`;

            if ((this._user === "felix" && input === "hotel123")
                || (this._user === "root" && input === "password")) {
                this._loggedIn = true;
                this.outputText += Terminal.generateHeader();
            } else {
                this._user = undefined;
                this.outputText += "Access denied\n";
            }

            this._input.classList.remove("terminalCurrentFocusInputHidden");
        }
    }

    logOut() {
        this._user = undefined;
        this._loggedIn = false;
        this._inputHistory.clear();
    }

    processInput(input) {
        this.inputText = "";

        if (!this._loggedIn) {
            this.continueLogin(input);
        } else {
            this.outputText += `${this.prefixText}${input}\n`;
            this._inputHistory.addEntry(input);

            const output = this._commands.parse(input.trim());
            if (output !== "") {
                this.outputText += output + `\n`;
            }
        }

        this.prefixText = this.generatePrefix();
    }


    _onclick() {
        this._input.focus();
    }

    _onkeypress(e) {
        switch (e.key.toLowerCase()) {
            case "enter":
                this.processInput(this.inputText.replaceAll(/&nbsp;/, " "));
                break;
        }
    }

    _onkeydown(e) {
        switch (e.key.toLowerCase()) {
            case "arrowup":
                this.inputText = this._inputHistory.previousEntry();
                window.setTimeout(() => moveCaretToEndOf(this._input), 0);
                break;
            case "arrowdown":
                this.inputText = this._inputHistory.nextEntry();
                window.setTimeout(() => moveCaretToEndOf(this._input), 0);
                break;
            case "l":
                if (e.ctrlKey) {
                    this.clear();
                    e.preventDefault();
                }
                break;
        }
    }
}

class InputHistory {
    constructor() {
        this._history = [];
        this._index = -1;
    }


    addEntry(entry) {
        if (entry.trim() !== "") {
            this._history.unshift(entry);
        }
        this._index = -1;
    }

    clear() {
        this._history = [];
        this._index = -1;
    }

    getEntry(index) {
        if (index >= 0) {
            return this._history[index];
        } else {
            return "";
        }
    }

    nextEntry() {
        this._index--;
        if (this._index < -1) {
            this._index = -1;
        }

        return this.getEntry(this._index);
    }

    previousEntry() {
        this._index++;
        if (this._index >= this._history.length) {
            this._index = this._history.length - 1;
        }

        return this.getEntry(this._index);
    }
}


let terminal;

addOnLoad(() => {
    terminal = new Terminal(
        q("#terminal"),
        q("#terminalCurrentFocusInput"),
        q("#terminalOutput"),
        q("#terminalCurrentPrefix")
    );

    terminal.processInput("ls");
});
