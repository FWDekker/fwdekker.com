import "./extensions.js"
import {File, FileSystem, UrlFile} from "./fs.js"
import {OutputAction} from "./terminal.js";
import {stripHtmlTags} from "./shared.js";
import {UserSession} from "./user-session.js";


/**
 * A collection of commands executed within a particular user session.
 */
export class Commands {
    /**
     * The user session describing the user that executes commands.
     */
    private readonly userSession: UserSession;
    /**
     * The file system to interact with.
     */
    private readonly fileSystem: FileSystem;
    /**
     * The list of all available commands.
     */
    private readonly commands: { [key: string]: Command };


    /**
     * Constructs a new collection of commands executed within the given user session.
     *
     * @param userSession the user session describing the user that executes commands
     * @param fileSystem the file system to interact with
     */
    constructor(userSession: UserSession, fileSystem: FileSystem) {
        this.userSession = userSession;
        this.fileSystem = fileSystem;
        this.commands = {
            "clear": new Command(
                this.clear,
                `clear terminal output`,
                `clear`,
                `Clears all previous terminal output.`.trimLines()
            ),
            "cd": new Command(
                this.cd,
                `change directory`,
                `cd [DIRECTORY]`,
                `Changes the current working directory to [DIRECTORY].
                If [DIRECTORY] is empty, nothing happens.`.trimLines()
            ),
            "cp": new Command(
                this.cp,
                `copy file`,
                `cp SOURCE DESTINATION`,
                `Copies SOURCE to DESTINATION.
                SOURCE must be a file.
                If DESTINATION exists and is a directory, SOURCE is copied into the directory.`.trimLines()
            ),
            "echo": new Command(
                this.echo,
                `display text`,
                `echo [TEXT]`,
                `Displays [TEXT].`.trimLines()
            ),
            "exit": new Command(
                this.exit,
                `close session`,
                `exit`,
                `Closes the terminal session.`.trimLines()
            ),
            "help": new Command(
                this.help,
                `display documentation`,
                `help [COMMAND]`,
                `Displays help documentation for [COMMAND].
                If [COMMAND] is empty, a list of all commands is shown.`.trimLines()
            ),
            "ls": new Command(
                this.ls,
                `list directory contents`,
                `ls [DIRECTORY]`,
                `Displays the files and directories in [DIRECTORY].
                If [DIRECTORY] is empty, the files and directories in the current working directory are shown.`.trimLines()
            ),
            "man": new Command(
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


    /**
     * Parses and executes the given input string and returns the output generated by that command.
     *
     * @param input the input string to parse and execute
     * @return the output generated by that command
     */
    execute(input: string): OutputAction {
        if (input === "factory-reset") {
            // @ts-ignore
            Cookies.remove("files");
            // @ts-ignore
            Cookies.remove("cwd");
            location.reload();
            throw "Goodbye";
        }

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
        return ["append", input.args.join(" ").replace("hunter2", "*******")];
    }

    private exit(): OutputAction {
        this.userSession.logOut();
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
        const user = this.userSession.currentUser;
        if (user === undefined)
            throw "Cannot execute `poweroff` while not logged in.";

        // @ts-ignore
        Cookies.set("poweroff", "true", {
            "expires": new Date().setSeconds(new Date().getSeconds() + 30),
            "path": "/"
        });

        setTimeout(() => location.reload(), 2000);
        return ["append",
            `Shutdown NOW!
            
            *** FINAL System shutdown message from ${user.name}@fwdekker.com ***
            
            System going down IMMEDIATELY
            
            
            System shutdown time has arrived`.trimLines()];
    }

    private pwd(): OutputAction {
        return ["append", this.fileSystem.cwd];
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
        const user = this.userSession.currentUser;
        if (user === undefined)
            throw "Cannot execute `whoami` while not logged in.";

        return ["append", user.description];
    }
}


/**
 * A command that can be executed.
 */
class Command {
    /**
     * The function to execute with the command is executed.
     */
    readonly fun: (args: InputArgs) => OutputAction;
    /**
     * A short summary of what the command does.
     */
    readonly summary: string;
    /**
     * A string describing how the command is to be used.
     */
    readonly usage: string;
    /**
     * A longer description of what the command does and how its parameters work.
     */
    readonly desc: string;


    /**
     * Constructs a new command.
     *
     * @param fun the function to execute with the command is executed
     * @param summary a short summary of what the command does
     * @param usage a string describing how the command is to be used
     * @param desc a longer description of what the command does and how its parameters work
     */
    constructor(fun: (args: InputArgs) => OutputAction, summary: string, usage: string, desc: string) {
        this.fun = fun;
        this.summary = summary;
        this.usage = usage;
        this.desc = desc;
    }
}

/**
 * A set of parsed command-line arguments.
 */
class InputArgs {
    /**
     * The name of the command, i.e. the first word in the input string.
     */
    readonly command: string;
    /**
     * The set of options and the corresponding values that the user has given.
     */
    private readonly _options: { [key: string]: string };
    /**
     * The remaining non-option arguments that the user has given.
     */
    private readonly _args: string[];


    /**
     * Parses an input string into a set of command-line arguments.
     *
     * @param input the input string to parse
     */
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


    /**
     * Returns a copy of the options the user has given.
     *
     * @return a copy of the options the user has given
     */
    get options(): { [key: string]: string } {
        return Object.assign({}, this._options);
    }

    /**
     * Returns a copy of the arguments the user has given.
     *
     * @return a copy of the arguments the user has given
     */
    get args(): string[] {
        return this._args.slice();
    }


    /**
     * Returns the value of the given option, or the given default value if that option has not been set.
     *
     * @param key the key of the option to return the value of
     * @param def the default value to return in case the option with the given key has not been set
     * @return the value of the given option, or the given default value if that option has not been set
     * @throws if the option with the given key has not been set and no default value is given
     */
    getOption(key: string, def: string | undefined = undefined): string | undefined {
        return (def === undefined)
            ? this._options[key]
            : (this.hasOption(key) ? this._options[key] : def);
    }

    /**
     * Returns `true` if and only if the option with the given key has been set.
     *
     * @param key the key to check
     * @return `true` if and only if the option with the given key has been set
     */
    hasOption(key: string): boolean {
        return this._options.hasOwnProperty(key);
    }

    /**
     * Returns `true` if and only if at least one of the options with the given keys has been set.
     *
     * @param keys the keys to check
     * @return `true` if and only if at least one of the options with the given keys has been set
     */
    hasAnyOption(keys: string[]): boolean {
        for (let i = 0; i < keys.length; i++)
            if (this.hasOption(keys[i]))
                return true;

        return false;
    }


    /**
     * Returns the argument at the given index, or the given default value if that argument could not be found.
     *
     * @param index the index of the argument to return
     * @param def the default value to return in case there is no argument at the given index
     * @return the argument at the given index, or the given default value if that argument could not be found
     * @throws if there is no argument at the given index and no default value is given
     */
    getArg(index: number, def: string | undefined = undefined): string {
        return (def === undefined)
            ? this._args[index]
            : (this.hasArg(index) ? this._args[index] : def);
    }

    /**
     * Returns `true` if and only if there is an argument at the given index.
     *
     * @param index the index to check
     * @return `true` if and only if there is an argument at the given index
     */
    hasArg(index: number): boolean {
        return index >= 0 && index < this._args.length;
    }
}
