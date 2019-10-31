import * as Cookies from "js-cookie";
import "./extensions"
import {File, FileSystem, Path} from "./fs"
import {stripHtmlTags} from "./shared";
import {OutputAction} from "./terminal";
import {UserSession} from "./user-session";


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
            "cat": new Command(
                this.cat,
                `concatenate and print files`,
                `cat FILE ...`,
                `Reads files sequentially, writing them to the standard output.`,
                new InputValidator({minArgs: 1})
            ),
            "clear": new Command(
                this.clear,
                `clear terminal output`,
                `clear`,
                `Clears all previous terminal output.`.trimLines(),
                new InputValidator({maxArgs: 0})
            ),
            "cd": new Command(
                this.cd,
                `change directory`,
                `cd [DIRECTORY]`,
                `Changes the current working directory to [DIRECTORY].
                If [DIRECTORY] is empty, nothing happens.`.trimLines(),
                new InputValidator({maxArgs: 1})
            ),
            "cp": new Command(
                this.cp,
                `copy file`,
                `cp [-R] SOURCE DESTINATION`,
                `Copies SOURCE to DESTINATION.
                SOURCE is what should be copied, and DESTINATION is where it should be copied to.
                If DESTINATION is an existing directory, SOURCE is copied into that directory.
                Unless -R is given, SOURCE must be a file.`.trimLines(),
                new InputValidator({minArgs: 2, maxArgs: 2})
            ),
            "echo": new Command(
                this.echo,
                `display text`,
                `echo [TEXT]`,
                `Displays [TEXT].`.trimLines(),
                new InputValidator()
            ),
            "exit": new Command(
                this.exit,
                `close session`,
                `exit`,
                `Closes the terminal session.`.trimLines(),
                new InputValidator({maxArgs: 0})
            ),
            "help": new Command(
                this.help,
                `display documentation`,
                `help [COMMAND...]`,
                `Displays help documentation for each command in [COMMAND...].
                If no commands are given, a list of all commands is shown.`.trimLines(),
                new InputValidator()
            ),
            "ls": new Command(
                this.ls,
                `list directory contents`,
                `ls [DIRECTORY...]`,
                `Displays the files and directories in [DIRECTORY...].
                If no directory is given, the files and directories in the current working directory are shown.
                If more than one directory is given, the files and directories are shown for each given directory in order.`.trimLines(),
                new InputValidator()
            ),
            "man": new Command(
                this.man,
                `display manual documentation pages`,
                `man PAGE...`,
                `Displays the manual pages with names PAGE....`.trimLines(),
                new InputValidator()
            ),
            "mkdir": new Command(
                this.mkdir,
                `make directories`,
                `mkdir DIRECTORY...`,
                `Creates the directories given by DIRECTORY.
                    
                If more than one directory is given, the directories are created in the order they are given in.`.trimLines(),
                new InputValidator({minArgs: 1})
            ),
            "mv": new Command(
                this.mv,
                `move file`,
                `mv SOURCE DESTINATION`,
                `Renames SOURCE to DESTINATION.`.trimLines(),
                new InputValidator({minArgs: 2, maxArgs: 2})
            ),
            "open": new Command(
                this.open,
                `open web page`,
                `open [-b | --blank] FILE`,
                `Opens the web page linked to by FILE in this browser window.
                        
                If -b or --blank is set, the web page is opened in a new tab.`.trimLines(),
                new InputValidator({minArgs: 1, maxArgs: 1})
            ),
            "poweroff": new Command(
                this.poweroff,
                `close down the system`,
                `poweroff`,
                `Automated shutdown procedure to nicely notify users when the system is shutting down.`.trimLines(),
                new InputValidator({maxArgs: 0})
            ),
            "pwd": new Command(
                this.pwd,
                `print working directory`,
                `pwd`,
                `Displays the current working directory.`.trimLines(),
                new InputValidator({maxArgs: 0})
            ),
            "rm": new Command(
                this.rm,
                `remove file`,
                `rm [-f | --force] [-r | -R | --recursive] [--no-preserve-root] FILE...`,
                `Removes the files given by FILE.
                
                If more than one file is given, the files are removed in the order they are given in.
                
                If -f or --force is set, no warning is given if a file could not be removed.
                
                If -r, -R, or --recursive is set, files and directories are removed recursively.
                
                Unless --no-preserve-root is set, the root directory cannot be removed.`.trimLines(),
                new InputValidator({minArgs: 1})
            ),
            "rmdir": new Command(
                this.rmdir,
                `remove directories`,
                `rmdir DIRECTORY...`,
                `Removes the directories given by DIRECTORY.
                    
                If more than one directory is given, the directories are removed in the order they are given in.`.trimLines(),
                new InputValidator({minArgs: 1})
            ),
            "touch": new Command(
                this.touch,
                `change file timestamps`,
                `touch FILE...`,
                `Update the access and modification times of each FILE to the current time.
                    
                If a file does not exist, it is created.`.trimLines(),
                new InputValidator({minArgs: 1})
            ),
            "whoami": new Command(
                this.whoami,
                `print short description of user`,
                `whoami`,
                `Print a description of the user associated with the current effective user ID.`,
                new InputValidator({maxArgs: 0})
            )
        };
    }


    /**
     * Parses and executes the given input string and returns the output generated by that command.
     *
     * @param inputString the input string to parse and execute
     * @return the output generated by that command
     */
    execute(inputString: string): OutputAction {
        if (inputString === "factory-reset") {
            Cookies.remove("files");
            Cookies.remove("cwd");
            Cookies.remove("user");
            location.reload();
            throw "Goodbye";
        }

        const input = new InputArgs(stripHtmlTags(inputString));
        if (input.command === "")
            return ["nothing"];
        if (!this.commands.hasOwnProperty(input.command))
            return ["append", `Unknown command '${input.command}'`];

        const command = this.commands[input.command];
        const validation = command.validator.validate(input);
        if (!validation[0])
            return this.createUsageErrorOutput(input.command, validation[1]);

        return command.fun.bind(this)(input);
    }

    /**
     * Returns an output action corresponding to an error message about invalid usage of a command.
     *
     * @param commandName the name of the command that was used incorrectly
     * @param errorMessage the message describing how the command was used incorrectly; preferably ended with a `.`
     * @return an output action corresponding to an error message about invalid usage of a command
     */
    private createUsageErrorOutput(commandName: string, errorMessage: string | undefined): OutputAction {
        const command = this.commands[commandName];
        if (command === undefined)
            throw `Unknown command \`${commandName}\`.`;

        return ["append",
            `Invalid usage of ${commandName}.${errorMessage === undefined ? "" : ` ${errorMessage}`}
            
            <b>Usage</b>
            ${command.usage}`.trimLines()
        ];
    }


    private cat(input: InputArgs): OutputAction {
        return ["append",
            input.args
                .map(it => {
                    const node = this.fileSystem.getNode(it);
                    if (node === undefined || !(node instanceof File))
                        return `cat: ${it}: No such file`;

                    return node.contents;
                })
                .join("\n")
        ]
    }

    private cd(input: InputArgs): OutputAction {
        return ["append", this.fileSystem.cd(input.args[0])];
    }

    private cp(input: InputArgs): OutputAction {
        return ["append", this.fileSystem.cp(input.args[0], input.args[1], input.hasAnyOption(["r", "R"]))];
    }

    private clear(): OutputAction {
        return ["clear"];
    }

    private echo(input: InputArgs): OutputAction {
        return ["append", input.args.join(" ").replace("hunter2", "*******") + "\n"];
    }

    private exit(): OutputAction {
        this.userSession.logOut();
        return ["nothing"];
    }

    private help(input: InputArgs): OutputAction {
        const commandNames = Object.keys(this.commands);

        if (input.args.length > 0) {
            return ["append",
                input.args
                    .map(it => {
                        if (!this.commands.hasOwnProperty(it))
                            return `Unknown command ${it}.`;

                        const commandName = it.toLowerCase();
                        const command = this.commands[commandName];

                        return "" +
                            `<b>Name</b>
                            ${commandName}
                            
                            <b>Summary</b>
                            ${command.summary}

                            <b>Usage</b>
                            ${command.usage}

                            <b>Description</b>
                            ${command.desc}`.trimLines();
                    })
                    .join("\n\n\n")
            ];
        } else {
            const commandWidth = Math.max.apply(null, commandNames.map(it => it.length)) + 4;
            const commandPaddings = commandNames.map(it => commandWidth - it.length);
            const commandLinks = commandNames
                .map(it => `<a href="#" onclick="run('help ${it}')">${it}</a>`)
                .map((it, i) => `${it.padEnd(it.length + commandPaddings[i], ' ')}`);
            const commandEntries = commandNames
                .map((it, i) => `${commandLinks[i]}${this.commands[it].summary}`);

            return ["append",
                `The source code of this website is <a href="https://git.fwdekker.com/FWDekker/fwdekker.com">available on git</a>.

                <b>List of commands</b>
                ${commandEntries.join("\n")}

                Write "help [COMMAND]" or click a command in the list above for more information on a command.`.trimLines()];
        }
    }

    private ls(input: InputArgs): OutputAction {
        if (input.args.length <= 1)
            return ["append", this.fileSystem.ls(input.args[0] || "")];

        return ["append", input.args
            .map(arg => "" +
                `<b>${this.fileSystem.getPathTo(arg)}/</b>
                ${this.fileSystem.ls(arg)}`.trimLines())
            .join("\n\n")];
    }

    private man(input: InputArgs): OutputAction {
        if (input.args.length === 0)
            return ["append", "What manual page do you want?"];
        else if (Object.keys(this.commands).indexOf(input.args[0]) < 0)
            return ["append", `No manual entry for ${input.args[0]}`];
        else
            return this.help(input);
    }

    private mkdir(input: InputArgs): OutputAction {
        return ["append", this.fileSystem.mkdirs(input.args)];
    }

    private mv(input: InputArgs): OutputAction {
        return ["append", this.fileSystem.mv(input.args[0], input.args[1])];
    }

    private open(input: InputArgs): OutputAction {
        const fileName = input.args[0];
        const target = input.hasAnyOption(["b", "blank"]) ? "_blank" : "_self";

        const node = this.fileSystem.getNode(fileName);
        if (node === undefined)
            return ["append", `The file '${fileName}' does not exist`];
        if (!(node instanceof File))
            return ["append", `'${fileName}' is not a file`];

        window.open(node.contents, target);
        return ["nothing"];
    }

    private poweroff(): OutputAction {
        const user = this.userSession.currentUser;
        if (user === undefined)
            throw "Cannot execute `poweroff` while not logged in.";

        Cookies.set("poweroff", "true", {
            "expires": new Date(new Date().setSeconds(new Date().getSeconds() + 30)),
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

    private rm(input: InputArgs): OutputAction {
        return [
            "append",
            this.fileSystem.rms(
                input.args,
                input.hasAnyOption(["f", "force"]),
                input.hasAnyOption(["r", "R", "recursive"]),
                input.hasOption("no-preserve-root")
            )
        ];
    }

    private rmdir(input: InputArgs): OutputAction {
        return ["append", this.fileSystem.rmdirs(input.args)];
    }

    private touch(input: InputArgs): OutputAction {
        return ["append", this.fileSystem.createFiles(input.args)];
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
     * A function that validates input for this command.
     */
    readonly validator: InputValidator;


    /**
     * Constructs a new command.
     *
     * @param fun the function to execute with the command is executed
     * @param summary a short summary of what the command does
     * @param usage a string describing how the command is to be used
     * @param desc a longer description of what the command does and how its parameters work
     * @param validator a function that validates input for this command
     */
    constructor(fun: (args: InputArgs) => OutputAction, summary: string, usage: string, desc: string,
                validator: InputValidator) {
        this.fun = fun;
        this.summary = summary;
        this.usage = usage;
        this.desc = desc;
        this.validator = validator;
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
     * Returns `true` if and only if there is an argument at the given index.
     *
     * @param index the index to check
     * @return `true` if and only if there is an argument at the given index
     */
    hasArg(index: number): boolean {
        return this._args[index] !== undefined;
    }
}

/**
 * Validates the input of a command.
 */
class InputValidator {
    /**
     * The minimum number of arguments allowed.
     */
    readonly minArgs: number;
    /**
     * The maximum number of arguments allowed.
     */
    readonly maxArgs: number;


    /**
     * Constructs a new input validator.
     *
     * @param minArgs the minimum number of arguments allowed
     * @param maxArgs the maximum number of arguments allowed
     */
    constructor({minArgs = 0, maxArgs = Number.MAX_SAFE_INTEGER}: { minArgs?: number, maxArgs?: number } = {}) {
        if (minArgs > maxArgs)
            throw "`minArgs` must be less than or equal to `maxArgs`.";

        this.minArgs = minArgs;
        this.maxArgs = maxArgs;
    }


    /**
     * Returns `[true]` if the input is valid, or `[false, string]` where the string is a reason if the input is not
     * valid.
     *
     * @param input the input to validate
     * @return `[true]` if the input is valid, or `[false, string]` where the string is a reason if the input is not
     * valid
     */
    validate(input: InputArgs): [true] | [false, string] {
        if (this.minArgs === this.maxArgs && input.args.length !== this.minArgs)
            return [false, `Expected ${this.arguments(this.minArgs)} but got ${input.args.length}.`];
        if (input.args.length < this.minArgs)
            return [false, `Expected at least ${this.arguments(this.minArgs)} but got ${input.args.length}.`];
        if (input.args.length > this.maxArgs)
            return [false, `Expected at most ${this.arguments(this.maxArgs)} but got ${input.args.length}.`];

        return [true];
    }

    /**
     * Returns `"1 argument"` if the given amount is `1` and returns `"$n arguments"` otherwise.
     *
     * @param amount the amount to check
     * @return `"1 argument"` if the given amount is `1` and returns `"$n arguments"` otherwise.
     */
    private arguments(amount: number): string {
        return amount === 1 ? `1 argument` : `${amount} arguments`;
    }
}
