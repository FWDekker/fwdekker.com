import * as Cookies from "js-cookie";
import "./Extensions"
import {File, FileSystem} from "./FileSystem"
import {IllegalStateError, stripHtmlTags} from "./Shared";
import {InputArgs} from "./Shell";
import {EscapeCharacters} from "./Terminal";
import {UserSession} from "./UserSession";


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
                `ls [-a] [DIRECTORY...]`,
                `Displays the files and directories in [DIRECTORY...].
                If no directory is given, the files and directories in the current working directory are shown.
                If more than one directory is given, the files and directories are shown for each given directory in order.
                Files starting with a . are only shown if the -a option is given, with the exception of . and .., which are always shown.`.trimLines(),
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
     * @param input the input string to parse and execute
     * @return the output generated by that command
     */
    execute(input: InputArgs): string {
        if (input.command === "factory-reset") {
            Cookies.remove("files");
            Cookies.remove("cwd");
            Cookies.remove("user");
            location.reload();
            throw new Error("Goodbye");
        }

        if (input.command === "")
            return "";
        if (!this.commands.hasOwnProperty(input.command))
            return `Unknown command '${input.command}'`;

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
    private createUsageErrorOutput(commandName: string, errorMessage: string | undefined): string {
        const command = this.commands[commandName];
        if (command === undefined)
            throw new Error(`Unknown command \`${commandName}\`.`);

        return "" +
            `Invalid usage of ${commandName}.${errorMessage === undefined ? "" : ` ${errorMessage}`}
            
            <b>Usage</b>
            ${command.usage}`.trimLines();
    }


    private cat(input: InputArgs): string {
        return input.args
            .map(it => {
                const node = this.fileSystem.getNode(it);
                if (node === undefined || !(node instanceof File))
                    return `cat: ${it}: No such file`;

                return node.contents;
            })
            .join("\n");
    }

    private cd(input: InputArgs): string {
        return this.fileSystem.cd(input.args[0]);
    }

    private cp(input: InputArgs): string {
        return this.fileSystem.cp(input.args[0], input.args[1], input.hasAnyOption(["r", "R"]));
    }

    private clear(): string {
        return EscapeCharacters.Escape + EscapeCharacters.Clear;
    }

    private echo(input: InputArgs): string {
        return input.args.join(" ").replace("hunter2", "*******") + "\n";
    }

    private exit(): string {
        this.userSession.logOut();
        return "";
    }

    private help(input: InputArgs): string {
        const commandNames = Object.keys(this.commands);

        if (input.args.length > 0) {
            return input.args
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
                .join("\n\n\n");
        } else {
            const commandWidth = Math.max.apply(null, commandNames.map(it => it.length)) + 4;
            const commandPaddings = commandNames.map(it => commandWidth - it.length);
            const commandLinks = commandNames
                .map(it => `<a href="#" onclick="execute('help ${it}')">${it}</a>`)
                .map((it, i) => `${it.padEnd(it.length + commandPaddings[i], ' ')}`);
            const commandEntries = commandNames
                .map((it, i) => `${commandLinks[i]}${this.commands[it].summary}`);

            return "" +
                `The source code of this website is <a href="https://git.fwdekker.com/FWDekker/fwdekker.com">available on git</a>.

                <b>List of commands</b>
                ${commandEntries.join("\n")}

                Write "help [COMMAND]" or click a command in the list above for more information on a command.`.trimLines();
        }
    }

    private ls(input: InputArgs): string {
        if (input.args.length <= 1)
            return this.fileSystem.ls(input.args[0] || "", input.hasAnyOption(["a", "A"]));

        return input.args
            .map(arg => "" +
                `<b>${this.fileSystem.getPathTo(arg)}/</b>
                ${this.fileSystem.ls(arg, input.hasAnyOption(["a", "A"]))}`.trimLines())
            .join("\n\n");
    }

    private man(input: InputArgs): string {
        if (input.args.length === 0)
            return "What manual page do you want?";
        else if (Object.keys(this.commands).indexOf(input.args[0]) < 0)
            return `No manual entry for ${input.args[0]}`;
        else
            return this.help(input);
    }

    private mkdir(input: InputArgs): string {
        return this.fileSystem.mkdirs(input.args);
    }

    private mv(input: InputArgs): string {
        return this.fileSystem.mv(input.args[0], input.args[1]);
    }

    private open(input: InputArgs): string {
        const fileName = input.args[0];
        const target = input.hasAnyOption(["b", "blank"]) ? "_blank" : "_self";

        const node = this.fileSystem.getNode(fileName);
        if (node === undefined)
            return `The file '${fileName}' does not exist`;
        if (!(node instanceof File))
            return `'${fileName}' is not a file`;

        window.open(node.contents, target);
        return "";
    }

    private poweroff(): string {
        const user = this.userSession.currentUser;
        if (user === undefined)
            throw new IllegalStateError("Cannot execute `poweroff` while not logged in.");

        Cookies.set("poweroff", "true", {
            "expires": new Date(new Date().setSeconds(new Date().getSeconds() + 30)),
            "path": "/"
        });

        setTimeout(() => location.reload(), 2000);
        return "" +
            `Shutdown NOW!
            
            *** FINAL System shutdown message from ${user.name}@fwdekker.com ***
            
            System going down IMMEDIATELY
            
            
            System shutdown time has arrived`.trimLines();
    }

    private pwd(): string {
        return this.fileSystem.cwd;
    }

    private rm(input: InputArgs): string {
        return this.fileSystem.rms(
            input.args,
            input.hasAnyOption(["f", "force"]),
            input.hasAnyOption(["r", "R", "recursive"]),
            input.hasOption("no-preserve-root")
        );
    }

    private rmdir(input: InputArgs): string {
        return this.fileSystem.rmdirs(input.args);
    }

    private touch(input: InputArgs): string {
        return this.fileSystem.createFiles(input.args);
    }

    private whoami(): string {
        const user = this.userSession.currentUser;
        if (user === undefined)
            throw new IllegalStateError("Cannot execute `whoami` while not logged in.");

        return user.description;
    }
}


/**
 * A command that can be executed.
 */
class Command {
    /**
     * The function to execute with the command is executed.
     */
    readonly fun: (args: InputArgs) => string;
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
    constructor(fun: (args: InputArgs) => string, summary: string, usage: string, desc: string,
                validator: InputValidator) {
        this.fun = fun;
        this.summary = summary;
        this.usage = usage;
        this.desc = desc;
        this.validator = validator;
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
            throw new IllegalStateError("`minArgs` must be less than or equal to `maxArgs`.");

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
            return [false, `Expected ${this.args(this.minArgs)} but got ${input.args.length}.`];
        if (input.args.length < this.minArgs)
            return [false, `Expected at least ${this.args(this.minArgs)} but got ${input.args.length}.`];
        if (input.args.length > this.maxArgs)
            return [false, `Expected at most ${this.args(this.maxArgs)} but got ${input.args.length}.`];

        return [true];
    }

    /**
     * Returns `"1 argument"` if the given amount is `1` and returns `"$n arguments"` otherwise.
     *
     * @param amount the amount to check
     * @return `"1 argument"` if the given amount is `1` and returns `"$n arguments"` otherwise.
     */
    private args(amount: number): string {
        return amount === 1 ? `1 argument` : `${amount} arguments`;
    }
}
