import "./extensions.js"
import {File, FileSystem, UrlFile} from "./fs.js"
import {OutputAction, Terminal} from "./terminal.js";
import {stripHtmlTags} from "./shared.js";
import {System} from "./system.js";


export class Commands {
    private readonly system: System;
    private readonly fileSystem: FileSystem;
    private readonly commands: { [key: string]: Command };


    constructor(system: System, fileSystem: FileSystem) {
        this.system = system;
        this.fileSystem = fileSystem;
        this.commands = {
            clear: new Command(
                this.clear,
                `clear terminal output`,
                `clear`,
                `Clears all previous terminal output.`.trimLines()
            ),
            cd: new Command(
                this.cd,
                `change directory`,
                `cd [DIRECTORY]`,
                `Changes the current working directory to [DIRECTORY].
                If [DIRECTORY] is empty, nothing happens.`.trimLines()
            ),
            cp: new Command(
                this.cp,
                `copy file`,
                `cp SOURCE DESTINATION`,
                `Copies SOURCE to DESTINATION.
                SOURCE must be a file.
                If DESTINATION exists and is a directory, SOURCE is copied into the directory.`.trimLines()
            ),
            echo: new Command(
                this.echo,
                `display text`,
                `echo [TEXT]`,
                `Displays [TEXT].`.trimLines()
            ),
            exit: new Command(
                this.exit,
                `close session`,
                `exit`,
                `Closes the terminal session.`.trimLines()
            ),
            help: new Command(
                this.help,
                `display documentation`,
                `help [COMMAND]`,
                `Displays help documentation for [COMMAND].
                If [COMMAND] is empty, a list of all commands is shown.`.trimLines()
            ),
            ls: new Command(
                this.ls,
                `list directory contents`,
                `ls [DIRECTORY]`,
                `Displays the files and directories in [DIRECTORY].
                If [DIRECTORY] is empty, the files and directories in the current working directory are shown.`.trimLines()
            ),
            man: new Command(
                this.man,
                `display manual documentation pages`,
                `man PAGE`,
                `Displays the manual page with the name PAGE.`.trimLines()
            ),
            mkdir: new Command(
                this.mkdir,
                `make directories`,
                `mkdir DIRECTORY...`,
                `Creates the directories given by DIRECTORY.
                    
                If more than one directory is given, the directories are created in the order they are given in`.trimLines()
            ),
            mv: new Command(
                this.mv,
                `move file`,
                `mv SOURCE DESTINATION`,
                `Renames SOURCE to DESTINATION.`.trimLines()
            ),
            open: new Command(
                this.open,
                `open web page`,
                `open [-b | --blank] FILE`,
                `Opens the web page linked to by FILE in this browser window.
                        
                If -b or --blank is set, the web page is opened in a new tab.`.trimLines()
            ),
            poweroff: new Command(
                this.poweroff,
                `close down the system`,
                `poweroff`,
                `Automated shutdown procedure to nicely notify users when the system is shutting down.`.trimLines()
            ),
            pwd: new Command(
                this.pwd,
                `print working directory`,
                `pwd`,
                `Displays the current working directory.`.trimLines()
            ),
            rm: new Command(
                this.rm,
                `remove file`,
                `rm [-f | --force] [-r | -R | --recursive] [--no-preserve-root] FILE...`,
                `Removes the files given by FILE.
                
                If more than one file is given, the files are removed in the order they are given in.
                
                If -f or --force is set, no warning is given if a file could not be removed.
                
                If -r, -R, or --recursive is set, files and directories are removed recursively.
                
                Unless --no-preserve-root is set, the root directory cannot be removed.`.trimLines()
            ),
            rmdir: new Command(
                this.rmdir,
                `remove directories`,
                `rmdir DIRECTORY...`,
                `Removes the directories given by DIRECTORY.
                    
                If more than one directory is given, the directories are removed in the order they are given in.`.trimLines()
            ),
            touch: new Command(
                this.touch,
                `change file timestamps`,
                `touch FILE...`,
                `Update the access and modification times of each FILE to the current time.
                    
                If a file does not exist, it is created.`.trimLines()
            ),
            whoami: new Command(
                this.whoami,
                `print short description of user`,
                `whoami`,
                `Print a description of the user associated with the current effective user ID.`
            )
        };
    }


    execute(input: string): OutputAction {
        const args = new InputArgs(stripHtmlTags(input));

        if (args.command === "")
            return ["nothing"];
        else if (this.commands.hasOwnProperty(args.command))
            return this.commands[args.command].fun.bind(this)(args);
        else
            return ["append", `Unknown command '${args.command}'`];
    }


    private cd(input: InputArgs): OutputAction {
        return ["append", this.fileSystem.cd(input.getArg(0))];
    }

    private cp(input: InputArgs): OutputAction {
        return ["append", this.fileSystem.cp(input.getArg(0), input.getArg(1))];
    }

    private clear(): OutputAction {
        return ["clear"];
    }

    private echo(input: InputArgs): OutputAction {
        return [
            "append",
            input.args
                .join(" ")
                .replace("hunter2", "*******")
        ];
    }

    private exit(): OutputAction {
        this.system.logOut();
        return ["nothing"];
    }

    private help(input: InputArgs): OutputAction {
        const command = input.getArg(0, "").toLowerCase();
        const commandNames = Object.keys(this.commands);

        if (commandNames.indexOf(command) >= 0) {
            const info = this.commands[command];

            return ["append",
                `${command} - ${info.summary}

                <b>Usage</b>
                ${info.usage}

                <b>Description</b>
                ${info.desc}`.trimLines()];
        } else {
            const commandWidth = Math.max.apply(null, commandNames.map(it => it.length)) + 4;
            const commandEntries = commandNames.map(
                it => `${it.padEnd(commandWidth, ' ')}${this.commands[it].summary}`
            );

            return ["append",
                `The source code of this website is <a href="https://git.fwdekker.com/FWDekker/fwdekker.com">available on git</a>.

                <b>List of commands</b>
                ${commandEntries.join("\n")}

                Write "help [COMMAND]" for more information on a command.`.trimLines()];
        }
    }

    private ls(input: InputArgs): OutputAction {
        return ["append", this.fileSystem.ls(input.getArg(0))];
    }

    private man(args: InputArgs): OutputAction {
        if (args.args.length === 0)
            return ["append", "What manual page do you want?"];
        else if (Object.keys(this.commands).indexOf(args.getArg(0)) < 0)
            return ["append", `No manual entry for ${args.getArg(0)}`];
        else
            return this.help(args);
    }

    private mkdir(args: InputArgs): OutputAction {
        return ["append", this.fileSystem.mkdirs(args.args)];
    }

    private mv(args: InputArgs): OutputAction {
        return ["append", this.fileSystem.mv(args.getArg(0), args.getArg(1))];
    }

    private open(args: InputArgs): OutputAction {
        const fileName = args.getArg(0);
        const target = args.hasAnyOption(["b", "blank"]) ? "_blank" : "_self";

        const node = this.fileSystem.getNode(fileName);
        if (node === undefined)
            return ["append", `The file '${fileName}' does not exist`];
        if (!(node instanceof File))
            return ["append", `'${fileName}' is not a file`];
        if (!(node instanceof UrlFile))
            return ["append", `Could not open '${fileName}'`];

        // @ts-ignore: False positive
        window.open(node.url, target);
        return ["nothing"];
    }

    private poweroff(): OutputAction {
        const date = new Date();
        date.setSeconds(date.getSeconds() + 30);
        document.cookie = `poweroff=true; expires=${date.toUTCString()}; path=/`;

        setTimeout(() => location.reload(), 2000);
        return ["append",
            `Shutdown NOW!
            
            *** FINAL System shutdown message from ${this.system.currentUser}@fwdekker.com ***
            
            System going down IMMEDIATELY
            
            
            System shutdown time has arrived`.trimLines()];
    }

    private pwd(): OutputAction {
        return ["append", this.fileSystem.pwd];
    }

    private rm(args: InputArgs): OutputAction {
        return [
            "append",
            this.fileSystem.rms(
                args.args,
                args.hasAnyOption(["f", "force"]),
                args.hasAnyOption(["r", "R", "recursive"]),
                args.hasOption("no-preserve-root")
            )
        ];
    }

    private rmdir(args: InputArgs): OutputAction {
        return ["append", this.fileSystem.rmdirs(args.args)];
    }

    private touch(args: InputArgs): OutputAction {
        return ["append", this.fileSystem.createFiles(args.args)];
    }

    private whoami(): OutputAction {
        const user = this.system.currentUser;
        if (user === undefined)
            throw "Cannot execute `whoami` while not logged in.";

        return ["append", user.description];
    }
}


class Command {
    readonly fun: (args: InputArgs) => OutputAction;
    readonly summary: string;
    readonly usage: string;
    readonly desc: string;


    constructor(fun: (args: InputArgs) => OutputAction, summary: string, usage: string, desc: string) {
        this.fun = fun;
        this.summary = summary;
        this.usage = usage;
        this.desc = desc;
    }
}

class InputArgs {
    readonly command: string;
    private readonly _options: { [key: string]: string };
    private readonly _args: string[];


    constructor(input: string) {
        const inputParts = (input.match(/("[^"]+"|[^"\s]+)/g) || [])
            .map(it => it.replace(/^"/, "").replace(/"$/, ""));

        this.command = (inputParts[0] || "").toLowerCase().trim();

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

                    argNames.forEach(argName => this._options[argName] = "");
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


    get options(): object {
        return Object.assign({}, this._options);
    }

    get args(): string[] {
        return this._args.slice();
    }


    getArg(index: number, def: string | undefined = undefined): string {
        return (def === undefined)
            ? this._args[index]
            : (this.hasArg(index) ? this._args[index] : def);
    }

    hasArg(index: number): boolean {
        return index >= 0 && index < this._args.length;
    }


    getOption(key: string, def: string | undefined = undefined) {
        return (def === undefined)
            ? this._options[key]
            : (this.hasOption(key) ? this._options[key] : def);
    }

    hasOption(key: string): boolean {
        return this._options.hasOwnProperty(key);
    }

    hasAnyOption(keys: string[]): boolean {
        for (let i = 0; i < keys.length; i++)
            if (this.hasOption(keys[i]))
                return true;

        return false;
    }
}