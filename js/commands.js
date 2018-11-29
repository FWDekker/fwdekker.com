class Commands {
    constructor(terminal, fileSystem) {
        this._terminal = terminal;
        this._fs = fileSystem;

        this._list = {
            clear: {
                fun: this.clear,
                summary: `clear terminal output`,
                usage: `clear`,
                desc: `Clears all previous terminal output.`
            },
            cd: {
                fun: this.cd,
                summary: `change directory`,
                usage: `cd [DIRECTORY]`,
                desc: "" +
                    `Changes the current working directory to [DIRECTORY].
                    If [DIRECTORY] is empty, nothing happens.`.trimLines()
            },
            echo: {
                fun: Commands.echo,
                summary: `display text`,
                usage: `echo [TEXT]`,
                desc: `Displays [TEXT].`.trimLines()
            },
            exit: {
                fun: Commands.exit,
                summary: `close session`,
                usage: `exit`,
                desc: `Closes the terminal session.`
            },
            help: {
                fun: this.help,
                summary: `display documentation`,
                usage: `help [COMMAND]`,
                desc: "" +
                    `Displays help documentation for [COMMAND].
                    If [COMMAND] is empty, a list of all commands is shown.`.trimLines()
            },
            ls: {
                fun: this.ls,
                summary: `list directory contents`,
                usage: `ls [DIRECTORY]`,
                desc: "" +
                    `Displays the files and directories in [DIRECTORY].
                    If [DIRECTORY] is empty, the files and directories in the current working directory are shown.`.trimLines()
            },
            mkdir: {
                fun: this.mkdir,
                summary: `make directory`,
                usage: `mkdir DIRECTORY`,
                desc: `Creates a directory with name DIRECTORY.`
            },
            open: {
                fun: this.open,
                summary: `open web page`,
                usage: `open [-b | --blank] FILE`,
                desc: "" +
                    `Opens the web page linked to by FILE in this browser window.
                        
                    If -b or --blank is set, the web page is opened in a new tab.`.trimLines()
            },
            poweroff: {
                fun: Commands.poweroff,
                summary: `close down the system`,
                usage: `poweroff`,
                desc: `Automated shutdown procedure to nicely notify users when the system is shutting down.`
            },
            pwd: {
                fun: this.pwd,
                summary: `print working directory`,
                usage: `pwd`,
                desc: `Displays the current working directory.`
            },
            rm: {
                fun: this.rm,
                summary: `remove file`,
                usage: `rm FILE`,
                desc: `Removes FILE if it is a file.`
            },
            rmdir: {
                fun: this.rmdir,
                summary: `remove directory`,
                usage: `rmdir [-f | --force] DIRECTORY`,
                desc: "" +
                    `Removes DIRECTORY if it is a directory.

                    If -f or --force is set, DIRECTORY is deleted even if it contains files or other directories.`.trimLines()
            }
        };
    }


    parse(input) {
        const args = input.split(" ");
        const command = (args[0] || "").toLowerCase();

        if (Object.keys(this._list).indexOf(command) >= 0) {
            return this._list[command].fun.bind(this)(args);
        } else if (command.trim() === "") {
            return "";
        } else {
            return `Unknown command '${args[0]}'`
        }
    }


    cd(args) {
        return this._fs.cd(args[1]);
    }

    clear() {
        this._terminal.clear();
        return "";
    }

    static echo(args) {
        return args
            .slice(1).join(" ")
            .replace("hunter2", "*******");
    }

    static exit() {
        terminal.reset();
        return "";
    }

    help(args) {
        const command = (args[1] || "").toLowerCase();
        const commandNames = Object.keys(this._list);

        if (commandNames.indexOf(command) >= 0) {
            const info = this._list[command];

            return "" +
                `${command} - ${info.summary}

                <b>Usage</b>
                ${info.usage}

                <b>Description</b>
                ${info.desc}`.trimLines();
        } else {
            const commandWidth = Math.max.apply(null, commandNames.map(it => it.length)) + 4;
            const commandEntries = commandNames.map(
                it => `${it.padEnd(commandWidth, ' ')}${this._list[it].summary}`
            );

            return "" +
                `<b>List of commands</b>
                ${commandEntries.join("\n")}

                Write "help [COMMAND]" for more information on a command.`.trimLines();
        }
    }

    ls(args) {
        return this._fs.ls(args[1]);
    }

    mkdir(args) {
        return this._fs.mkdir(args[1]);
    }

    open(args) {
        let fileName;
        let target;
        if (args[1] === "-t" || args[1] === "--tab") {
            fileName = args[2];
            target = "_blank";
        } else {
            fileName = args[1];
            target = "_self";
        }

        const file = this._fs._getFile(fileName);
        if (file === undefined) {
            return `The file '${fileName}' does not exist`;
        }
        if (!FileSystem.isFile(file)) {
            return `'${fileName} is not a file'`;
        }
        if (file.type !== "link") {
            return `Could not open '${fileName}'`;
        }

        window.open(file.link, target);
        return "";
    }

    static poweroff() {
        const date = new Date();
        date.setSeconds(date.getSeconds() + 30);
        document.cookie = `poweroff=true; expires=${date.toUTCString()}; path=/`;

        setTimeout(() => location.reload(), 2000);
        return "" +
            `Shutdown NOW!
            
            *** FINAL System shutdown message from felix@fwdekker.com ***
            
            System going down IMMEDIATELY
            
            
            System shutdown time has arrived`.trimLines();
    }

    pwd() {
        return this._fs.pwd;
    }

    rm(args) {
        return this._fs.rm(args[1]);
    }

    rmdir(args) {
        let path;
        let force;
        if (args[1] === "-f" || args[1] === "--force") {
            path = args[2];
            force = true;
        } else {
            path = args[1];
            force = false;
        }

        return this._fs.rmdir(path, force);
    }
}
