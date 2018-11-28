//////
///
/// Terminal
///
//////

const terminal = {};


// Variables
// Constants
terminal.asciiHeader = `&nbsp;________          _______       _    _
|  ____\\ \\        / /  __ \\     | |  | |
| |__   \\ \\  /\\  / /| |  | | ___| | _| | _____ _ __
|  __|   \\ \\/  \\/ / | |  | |/ _ \\ |/ / |/ / _ \\ '__|
| |       \\  /\\  /  | |__| |  __/   <|   <  __/ |
|_|        \\/  \\/   |_____/ \\___|_|\\_\\_|\\_\\___|_|   `;

// Elements
terminal.terminal = q(`#terminal`);
terminal.prefixDiv = q(`#terminalCurrentPrefix`);
terminal.input = q(`#terminalCurrentFocusInput`);
terminal.output = q(`#terminalOutput`);

// State
terminal.history = [];
terminal.historyIndex = 0;


// Functions
terminal.getInputText = function () {
    return terminal.input.innerHTML.replace(/(<br>)+$/g, ``);
};

terminal.setInputText = function (input) {
    terminal.input.innerHTML = input.replaceAll(/\s/, `&nbsp;`);
};

terminal.getPrefix = function () {
    return terminal.prefixDiv.innerHTML;
};

terminal.setPrefix = function (prefix) {
    terminal.prefixDiv.innerHTML = prefix;
};

terminal.addHistory = function (input) {
    if (input.trim() !== ``) {
        terminal.history.unshift(input);
        terminal.historyIndex = -1;
    }
};


terminal.clear = function () {
    terminal.output.innerHTML = ``;
};

terminal.generateHeader = function () {
    return trim(
        `${terminal.asciiHeader}

				Student MSc Computer Science @ <a href="https://www.tudelft.nl/en/">TU Delft</a>, the Netherlands
				${(new Date()).toISOString()}

				Type "help" for help.

				`
    );
};

terminal.generatePrefix = function () {
    return `felix@fwdekker.com <span style="color: green;">${fs.pwd}</span>&gt; `;
};

terminal.processInput = function (input) {
    input = input.replaceAll(/&nbsp;/, ` `);

    terminal.input.innerHTML = ``;
    terminal.addHistory(input);
    terminal.writeLine(`${terminal.prefixDiv.innerHTML}${input}`);

    const output = commands.parse(input.trim());
    if (output !== ``) {
        terminal.writeLine(output);
    }

    terminal.setPrefix(terminal.generatePrefix());
};

terminal.reset = function () {
    fs.reset();
    terminal.clear();
    terminal.write(terminal.generateHeader());
    terminal.setPrefix(terminal.generatePrefix());
};

terminal.write = function (text) {
    terminal.output.innerHTML += text;
};

terminal.writeLine = function (line) {
    terminal.write(`${line}\n`);
};


// Handlers
terminal.terminal.addEventListener(`click`, () => {
    terminal.input.focus();
});

terminal.input.addEventListener(`keypress`, e => {
    switch (e.key.toLowerCase()) {
        case `enter`:
            terminal.processInput(terminal.getInputText());
            break;
    }
});

terminal.input.addEventListener(`keydown`, e => {
    switch (e.key.toLowerCase()) {
        case `arrowup`:
            terminal.historyIndex++;
            if (terminal.historyIndex >= terminal.history.length) {
                terminal.historyIndex = terminal.history.length - 1;
            }
            terminal.setInputText(terminal.history[terminal.historyIndex]);
            break;
        case `arrowdown`:
            terminal.historyIndex--;
            if (terminal.historyIndex < -1) {
                terminal.historyIndex = -1;
            }
            if (terminal.historyIndex === -1) {
                terminal.setInputText(``);
            } else {
                terminal.setInputText(terminal.history[terminal.historyIndex]);
            }
            break;
    }
});
