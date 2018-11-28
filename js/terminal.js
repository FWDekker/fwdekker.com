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


class Terminal {
    constructor(terminal, input, output, prefixDiv) {
        this._terminal = terminal;
        this._input = input;
        this._output = output;
        this._prefixDiv = prefixDiv;
        this._inputHistory = new InputHistory();

        this._fs = new FileSystem();
        this._commands = new Commands(this, this._fs);

        this._terminal.addEventListener("click", this._onclick.bind(this));
        this._terminal.addEventListener("keypress", this._onkeypress.bind(this));
        this._input.addEventListener("keydown", this._onkeydown.bind(this));

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


    clear() {
        this.outputText = "";
    }

    static generateHeader() {
        return "" +
            `${asciiHeader}

			Student MSc Computer Science @ <a href="https://www.tudelft.nl/en/">TU Delft</a>, the Netherlands
			${(new Date()).toISOString()}

			Type "help" for help.

			`.trimLines();
    }

    generatePrefix() {
        return `felix@fwdekker.com <span style="color: green;">${this._fs.pwd}</span>&gt; `;
    }

    processInput(input) {
        this._inputHistory.addEntry(input);
        this.inputText = "";
        this.outputText += `${this.prefixText}${input}\n`;

        const output = this._commands.parse(input.trim());
        if (output !== "") {
            this.outputText += output + `\n`;
        }

        this.prefixText = this.generatePrefix();
    }

    reset() {
        this._fs.reset();

        this.outputText = Terminal.generateHeader();
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
                break;
            case "arrowdown":
                this.inputText = this._inputHistory.nextEntry();
        }
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
