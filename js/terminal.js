const asciiHeader = `&nbsp;________          _______       _    _
|  ____\\ \\        / /  __ \\     | |  | |
| |__   \\ \\  /\\  / /| |  | | ___| | _| | _____ _ __
|  __|   \\ \\/  \\/ / | |  | |/ _ \\ |/ / |/ / _ \\ '__|
| |       \\  /\\  /  | |__| |  __/   <|   <  __/ |
|_|        \\/  \\/   |_____/ \\___|_|\\_\\_|\\_\\___|_|   `;


class InputHistory {
    constructor() {
        this._history = [];
        this._index = -1;
    }


    addEntry(entry) {
        if (entry.trim() !== ``) {
            this._history.unshift(entry);
        }
        this._index = -1;
    }

    getEntry(index) {
        if (index >= 0) {
            return this._history[index];
        } else {
            return ``;
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


class Terminal {
    constructor(terminal, input, output, prefixDiv) {
        this._terminal = terminal;
        this._input = input;
        this._output = output;
        this._prefixDiv = prefixDiv;
        this._inputHistory = new InputHistory();

        this._terminal.addEventListener("click", this._onclick.bind(this));
        this._terminal.addEventListener("keypress", this._onkeypress.bind(this));
        this._input.addEventListener("keydown", this._onkeydown.bind(this));

        this.reset();
        this._input.focus();
    }


    get inputText() {
        return this._input.innerHTML
            .replaceAll(/<br>/, ``);
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
        return trim(
            `${asciiHeader}

				Student MSc Computer Science @ <a href="https://www.tudelft.nl/en/">TU Delft</a>, the Netherlands
				${(new Date()).toISOString()}

				Type "help" for help.

				`
        );
    }

    static generatePrefix() {
        return `felix@fwdekker.com <span style="color: green;">${fs.pwd}</span>&gt; `;
    }

    processInput(input) {
        this._inputHistory.addEntry(input);
        this.inputText = ``;
        this.outputText += `${this.prefixText}${input}\n`;

        const output = commands.parse(input.trim());
        if (output !== ``) {
            this.outputText += output + `\n`;
        }

        this.prefixText = Terminal.generatePrefix();
    }

    reset() {
        fs.reset();

        this.outputText = Terminal.generateHeader();
        this.prefixText = Terminal.generatePrefix();
    }


    _onclick() {
        console.log(this);
        this._input.focus();
    }

    _onkeypress(e) {
        switch (e.key.toLowerCase()) {
            case `enter`:
                this.processInput(this.inputText.replaceAll(/&nbsp;/, ` `));
                break;
        }
    }

    _onkeydown(e) {
        switch (e.key.toLowerCase()) {
            case `arrowup`:
                this.inputText = this._inputHistory.previousEntry();
                break;
            case `arrowdown`:
                this.inputText = this._inputHistory.nextEntry();
        }
    }
}



let terminal;

addOnLoad(() => {
    terminal = new Terminal(
        q(`#terminal`),
        q(`#terminalCurrentFocusInput`),
        q(`#terminalOutput`),
        q(`#terminalCurrentPrefix`)
    );

    terminal.processInput(`ls`);
});
