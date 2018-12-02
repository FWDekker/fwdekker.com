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
            cp: {
                fun: this.cp,
                summary: `copy file`,
                usage: `cp SOURCE DESTINATION`,
                desc: "" +
                    `Copies SOURCE to DESTINATION.
                    SOURCE must be a file.
                    If DESTINATION exists and is a directory, SOURCE is copied into the directory.`.trimLines()
            },
            echo: {
                fun: Commands.echo,
                summary: `display text`,
                usage: `echo [TEXT]`,
                desc: `Displays [TEXT].`.trimLines()
            },
            exit: {
                fun: this.exit,
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
            man: {
                fun: this.man,
                summary: `display manual documentation pages`,
                usage: `man PAGE`,
                desc: `Displays the manual page with the name PAGE.`
            },
            mkdir: {
                fun: this.mkdir,
                summary: `make directories`,
                usage: `mkdir DIRECTORY...`,
                desc: "" +
                    `Creates the directories given by DIRECTORY.
                    
                    If more than one directory is given, the directories are created in the order they are given in`.trimLines()
            },
            mv: {
                fun: this.mv,
                summary: `move file`,
                usage: `mv SOURCE DESTINATION`,
                desc: `Renames SOURCE to DESTINATION.`
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
                fun: this.poweroff,
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
                usage: `rm [-f | --force] [-r | -R | --recursive] [--no-preserve-root] FILE...`,
                desc:
                    `Removes the files given by FILE.
                    
                    If more than one file is given, the files are removed in the order they are given in.
                    
                    If -f or --force is set, no warning is given if a file could not be removed.
                    
                    If -r, -R, or --recursive is set, files and directories are removed recursively.
                    
                    Unless --no-preserve-root is set, the root directory cannot be removed.`.trimLines()
            },
            rmdir: {
                fun: this.rmdir,
                summary: `remove directories`,
                usage: `rmdir DIRECTORY...`,
                desc: "" +
                    `Removes the directories given by DIRECTORY.
                    
                    If more than one directory is given, the directories are removed in the order they are given in.`.trimLines()
            },
            touch: {
                fun: this.touch,
                summary: `change file timestamps`,
                usage: `touch FILE...`,
                desc: "" +
                    `Update the access and modification times of each FILE to the current time.
                    
                    If a file does not exist, it is created.`.trimLines()
            }
        };
    }


    parse(input) {
        const args = new InputArgs(input);

        if (Object.keys(this._list).indexOf(args.getCommand()) >= 0) {
            return this._list[args.getCommand()].fun.bind(this)(args);
        } else if (args.getCommand().trim() === "") {
            return "";
        } else {
            return `Unknown command '${args.getCommand()}'`
        }
    }


    cd(args) {
        return this._fs.cd(args.getArg(0));
    }

    cp(args) {
        return this._fs.cp(args.getArg(0), args.getArg(1));
    }

    clear() {
        this._terminal.clear();
        return "";
    }

    static echo(args) {
        return args.getArgs()
            .join(" ")
            .replace("hunter2", "*******");
    }

    exit() {
        this._terminal.logOut();
        return "";
    }

    help(args) {
        const command = args.getArg(0, "").toLowerCase();
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
        return this._fs.ls(args.getArg(0));
    }

    man(args) {
        if (args.getArgs().length === 0) {
            return "What manual page do you want?";
        } else if (Object.keys(this._list).indexOf(args.getArg(0)) < 0) {
            return `No manual entry for ${args.getArg(0)}`;
        } else {
            return this.help(args);
        }
    }

    mkdir(args) {
        return this._fs.mkdirs(args.getArgs());
    }

    mv(args) {
        return this._fs.mv(args.getArg(0), args.getArg(1));
    }

    open(args) {
        const fileName = args.getArg(0);
        const target = args.hasAnyOption(["b", "blank"]) ? "_blank" : "_self";

        const file = this._fs._getFile(fileName);
        if (file === undefined) {
            return `The file '${fileName}' does not exist`;
        }
        if (!FileSystem.isFile(file)) {
            return `'${fileName}' is not a file`;
        }
        if (!(file instanceof UrlFile)) {
            return `Could not open '${fileName}'`;
        }

        window.open(file.url, target);
        return "";
    }

    poweroff() {
        const date = new Date();
        date.setSeconds(date.getSeconds() + 30);
        document.cookie = `poweroff=true; expires=${date.toUTCString()}; path=/`;

        setTimeout(() => location.reload(), 2000);
        return "" +
            `Shutdown NOW!
            
            *** FINAL System shutdown message from ${terminal._user}@fwdekker.com ***
            
            System going down IMMEDIATELY
            
            
            System shutdown time has arrived`.trimLines();
    }

    pwd() {
        return this._fs.pwd;
    }

    rm(args) {
        return this._fs.rms(
            args.getArgs(),
            args.hasAnyOption(["f", "force"]),
            args.hasAnyOption(["r", "R", "recursive"]),
            args.hasOption("no-preserve-root")
        );
    }

    rmdir(args) {
        return this._fs.rmdirs(args.getArgs());
    }

    touch(args) {
        return this._fs.createFiles(args.getArgs());
    }
}

class InputArgs {
    constructor(input) {
        const inputParts = (input.match(/("[^"]+"|[^"\s]+)/g) || [])
            .map(it => it.replace(/^"/, "").replace(/"$/, ""));

        this._command = (inputParts[0] || "").toLowerCase();

        this._options = {};
        let i;
        for (i = 1; i < inputParts.length; i++) {
            const arg = inputParts[i];
            const argParts = arg.split("=");

            if (arg.startsWith("--")) {
                // --option, --option=value
                const argName = argParts[0].substr(2);
                this._options[argName] = (argParts[1] || "");
            } else if (arg.startsWith("-")) {
                // -o, -o=value, -opq
                if (argParts[0].length === 2) {
                    // -o, -o=value
                    const argName = argParts[0].substr(1);

                    this._options[argName] = (argParts[1] || "");
                } else if (argParts.length === 1) {
                    // -opq
                    const argNames = argParts[0].substr(1).split("");

                    argNames.forEach(argName => {
                        this._options[argName] = "";
                    });
                } else {
                    // Invalid
                    throw "Cannot assign value to multiple options!";
                }
            } else {
                // Not an option
                break;
            }

            this._options[argParts[0]] = (argParts[1] || "");
        }

        this._args = inputParts.slice(i);
    }


    getArgs() {
        return this._args.slice();
    }

    getArg(index, def) {
        return (def === undefined)
            ? this._args[index]
            : this._args[index] || def;
    }

    hasArg(index) {
        return (this._args[index] !== undefined);
    }

    getCommand() {
        return this._command;
    }

    getOption(key, def) {
        return (def === undefined)
            ? this._options[key]
            : this._options[key] || def;
    }

    hasOption(key) {
        return (this.getOption(key) !== undefined);
    }

    hasAnyOption(keys) {
        for (let i = 0; i < keys.length; i++) {
            if (this.hasOption(keys[i])) {
                return true;
            }
        }

        return false;
    }
}
