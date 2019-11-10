import "./Extensions"
import {Environment} from "./Environment";
import {Directory, File, FileSystem, Path} from "./FileSystem"
import {Persistence} from "./Persistence";
import {IllegalArgumentError, IllegalStateError} from "./Shared";
import {InputArgs} from "./Shell";
import {EscapeCharacters} from "./Terminal";
import {UserList} from "./UserList";
import {StreamSet} from "./Stream";


/**
 * A collection of commands executed within a particular user session.
 */
export class Commands {
    /**
     * The environment in which commands are executed.
     */
    private readonly environment: Environment;
    /**
     * The user session describing the user that executes commands.
     */
    private readonly userSession: UserList;
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
     * @param environment the environment in which commands are executed
     * @param userSession the user session describing the user that executes commands
     * @param fileSystem the file system to interact with
     */
    constructor(environment: Environment, userSession: UserList, fileSystem: FileSystem) {
        this.environment = environment;
        this.userSession = userSession;
        this.fileSystem = fileSystem;
        this.commands = {
            "cat": new Command(
                this.cat,
                `concatenate and print files`,
                `cat FILE...`,
                `Reads files sequentially, writing them to the standard output.`,
                new InputValidator({minArgs: 1})
            ),
            "clear": new Command(
                this.clear,
                `clear terminal output`,
                `clear`,
                `Clears all previous terminal output.`,
                new InputValidator({maxArgs: 0})
            ),
            "cd": new Command(
                this.cd,
                `change directory`,
                `cd [DIRECTORY]`,
                `Changes the current working directory to [DIRECTORY]. If [DIRECTORY] is empty, the current working \\\
                directory is changed to the root.`.trimMultiLines(),
                new InputValidator({maxArgs: 1})
            ),
            "cp": new Command(
                this.cp,
                `copy files`,
                `cp [-r | -R | --recursive] SOURCE DESTINATION
                cp [-r | -R | --recursive] SOURCES... DESTINATION`,
                `In its first form, the file or directory at SOURCE is copied to DESTINATION. If DESTINATION is an \\\
                existing directory, SOURCE is copied into that directory, retaining the file name from SOURCE. If \\\
                DESTINATION does not exist, SOURCE is copied to the exact location of DESTINATION.

                In its second form, all files and directories at SOURCES are copied to DESTINATION. DESTINATION must \\\
                be a pre-existing directory, and all SOURCES are copied into DESTINATION retaining the file names \\\
                from SOURCES.

                In both forms, sources are not copied if they are directories unless the -R options is given.\\\
                `.trimMultiLines(),
                new InputValidator({minArgs: 2})
            ),
            "echo": new Command(
                this.echo,
                `display text`,
                `echo [-n] [TEXT]`,
                `Displays [TEXT].

                Unless the -n parameter is given, a newline is appended to the end.`.trimMultiLines(),
                new InputValidator()
            ),
            "exit": new Command(
                this.exit,
                `close session`,
                `exit`,
                `Closes the terminal session.`,
                new InputValidator({maxArgs: 0})
            ),
            "help": new Command(
                this.help,
                `display documentation`,
                `help [COMMAND...]`,
                `Displays help documentation for each command in [COMMAND...].

                If no commands are given, a list of all commands is shown.`.trimMultiLines(),
                new InputValidator()
            ),
            "ls": new Command(
                this.ls,
                `list directory contents`,
                `ls [-a | -A] [DIRECTORY...]`,
                `Displays the files and directories in [DIRECTORY...]. If no directory is given, the files and \\\
                directories in the current working directory are shown. If more than one directory is given, the \\\
                files and directories are shown for each given directory in order.

                Files starting with a . are only shown if the -a option is given, with the exception of . and .., \\\
                which are always shown.`.trimMultiLines(),
                new InputValidator()
            ),
            "man": new Command(
                this.man,
                `display manual documentation pages`,
                `man PAGE...`,
                `Displays the manual pages with names PAGE....`,
                new InputValidator()
            ),
            "mkdir": new Command(
                this.mkdir,
                `make directories`,
                `mkdir [-p] DIRECTORY...`,
                `Creates the directories given by DIRECTORY.

                If more than one directory is given, the directories are created in the order they are given in. If \\\
                the -p option is given, parent directories that do not exist are created as well.`.trimMultiLines(),
                new InputValidator({minArgs: 1})
            ),
            "mv": new Command(
                this.mv,
                `move files`,
                `mv SOURCE DESTINATION
                mv SOURCES... DESTINATION`,
                `In its first form, the file or directory at SOURCE is moved to DESTINATION. If DESTINATION is an \\\
                existing directory, SOURCE is moved into that directory, retaining the file name from SOURCE. If \\\
                DESTINATION does not exist, SOURCE is moved to the exact location of DESTINATION.

                In its second form, all files and directories at SOURCES are moved to DESTINATION. DESTINATION must \\\
                be a pre-existing directory, and all SOURCES are moved into DESTINATION retaining the file names \\\
                from SOURCES.`.trimMultiLines(),
                new InputValidator({minArgs: 2})
            ),
            "open": new Command(
                this.open,
                `open web page`,
                `open [-b | --blank] FILE`,
                `Opens the web page linked to by FILE in this browser window.

                If -b or --blank is set, the web page is opened in a new tab.`.trimMultiLines(),
                new InputValidator({minArgs: 1, maxArgs: 1})
            ),
            "poweroff": new Command(
                this.poweroff,
                `close down the system`,
                `poweroff`,
                `Automated shutdown procedure to nicely notify users when the system is shutting down.`,
                new InputValidator({maxArgs: 0})
            ),
            "pwd": new Command(
                this.pwd,
                `print working directory`,
                `pwd`,
                `Displays the current working directory.`,
                new InputValidator({maxArgs: 0})
            ),
            "rm": new Command(
                this.rm,
                `remove file`,
                `rm [-f | --force] [-r | -R | --recursive] [--no-preserve-root] FILE...`,
                `Removes the files given by FILE. If more than one file is given, the files are removed in the order \\\
                they are given in.

                If -f or --force is set, no warning is given if a file could not be removed.

                If -r, -R, or --recursive is set, files and directories are removed recursively.

                Unless --no-preserve-root is set, the root directory cannot be removed.`.trimMultiLines(),
                new InputValidator({minArgs: 1})
            ),
            "rmdir": new Command(
                this.rmdir,
                `remove directories`,
                `rmdir DIRECTORY...`,
                `Removes the directories given by DIRECTORY. If more than one directory is given, the directories \\\
                are removed in the order they are given in. Non-empty directories will not be removed.\\\
                `.trimMultiLines(),
                new InputValidator({minArgs: 1})
            ),
            "set": new Command(
                this.set,
                `set environment variable`,
                `set KEY [VALUE]`,
                `Sets the environment variable KEY to VALUE. If no value is given, the environment variable is \\\
                cleared. Read-only variables cannot be set.`.trimMultiLines(),
                new InputValidator({minArgs: 1, maxArgs: 2})
            ),
            "touch": new Command(
                this.touch,
                `change file timestamps`,
                `touch FILE...`,
                `Update the access and modification times of each FILE to the current time. If a file does not \\\
                exist, it is created.`.trimMultiLines(),
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
     * Parses and executes the given input string and returns the exit code of that command.
     *
     * @param input the input string to parse and execute
     * @param streams the streams to interact with
     */
    execute(input: InputArgs, streams: StreamSet): number {
        if (input.command === "factory-reset") {
            Persistence.reset();
            location.reload();
            throw new Error("Goodbye");
        }

        if (input.command === "")
            return 0;
        if (!this.commands.hasOwnProperty(input.command)) {
            streams.err.writeLine(`Unknown command '${input.command}'`);
            return -1;
        }

        const command = this.commands[input.command];
        const validation = command.validator.validate(input);
        if (!validation[0]) {
            streams.err.writeLine(this.createUsageErrorOutput(input.command, validation[1]));
            return -1;
        }

        return command.fun.bind(this)(input, streams);
    }

    /**
     * Returns an output action corresponding to an error message about invalid usage of a command.
     *
     * @param commandName the name of the command that was used incorrectly
     * @param errorMessage the message describing how the command was used incorrectly; preferably ended with a `.`
     */
    private createUsageErrorOutput(commandName: string, errorMessage: string | undefined): string {
        const command = this.commands[commandName];
        if (command === undefined)
            throw new IllegalArgumentError(`Unknown command \`${commandName}\`.`);

        return `Invalid usage of ${commandName}. ${errorMessage ?? ""}

               <b>Usage</b>
               ${command.usage}`.trimLines();
    }


    private cat(input: InputArgs, streams: StreamSet): number {
        return input.args
            .map(arg => Path.interpret(this.environment.get("cwd"), arg))
            .map(path => {
                if (!this.fileSystem.has(path)) {
                    streams.err.writeLine(`cat: ${path}: No such file`);
                    return -1;
                }

                const node = this.fileSystem.get(path);
                if (!(node instanceof File)) {
                    streams.err.writeLine(`cat: ${path}: No such file`);
                    return -1;
                }

                if (node.contents.endsWith("\n"))
                    streams.out.write(node.contents);
                else
                    streams.out.writeLine(node.contents);
                return 0;
            })
            .reduce((acc, exitCode) => exitCode === 0 ? acc : exitCode);
    }

    private cd(input: InputArgs, streams: StreamSet): number {
        if (input.args.length === 0 || input.args[0] === "") {
            this.environment.set("cwd", this.environment.get("home"));
            return 0;
        }

        const path = Path.interpret(this.environment.get("cwd"), input.args[0]);
        if (!this.fileSystem.has(path)) {
            streams.err.writeLine(`The directory '${path}' does not exist.`);
            return -1;
        }

        this.environment.set("cwd", path.toString());
        return 0;
    }

    private cp(input: InputArgs, streams: StreamSet): number {
        try {
            return this.moveCopyMappings(input)
                .map(([source, destination]) => {
                    try {
                        this.fileSystem.copy(source, destination, input.hasAnyOption(["r", "R", "recursive"]));
                        return 0;
                    } catch (error) {
                        streams.err.writeLine(error.message);
                        return -1;
                    }
                })
                .reduce((acc, exitCode) => exitCode === 0 ? acc : exitCode);
        } catch (error) {
            streams.err.writeLine(error.message);
            return -1;
        }
    }

    private clear(_: InputArgs, streams: StreamSet): number {
        streams.err.write(EscapeCharacters.Escape + EscapeCharacters.Clear);
        return 0;
    }

    private echo(input: InputArgs, streams: StreamSet): number {
        const message = input.args.join(" ").replace("hunter2", "*******");

        if (input.hasOption("n"))
            streams.out.write(message);
        else
            streams.out.writeLine(message);

        return 0;
    }

    private exit(): number {
        this.environment.set("user", "");
        return 0;
    }

    private help(input: InputArgs, streams: StreamSet): number {
        const commandNames = Object.keys(this.commands);

        if (input.args.length > 0) {
            return input.args
                .map((it, i) => {
                    if (i > 0)
                        streams.out.write("\n\n");

                    if (!this.commands.hasOwnProperty(it)) {
                        streams.out.writeLine(`Unknown command ${it}.`);
                        return -1;
                    }

                    const commandName = it.toLowerCase();
                    const command = this.commands[commandName];

                    streams.out.writeLine(
                        `<b>Name</b>
                        ${commandName}

                        <b>Summary</b>
                        ${command.summary}

                        <b>Usage</b>
                        ${command.usage}

                        <b>Description</b>
                        ${command.desc}`.trimLines()
                    );
                    return 0;
                })
                .reduce((acc, exitCode) => exitCode === 0 ? acc : exitCode);
        } else {
            const commandWidth = Math.max.apply(null, commandNames.map(it => it.length)) + 4;
            const commandPaddings = commandNames.map(it => commandWidth - it.length);
            const commandLinks = commandNames
                .map(it => `<a href="#" onclick="execute('help ${it}')">${it}</a>`)
                .map((it, i) => `${it.padEnd(it.length + commandPaddings[i], ' ')}`);
            const commandEntries = commandNames
                .map((it, i) => `${commandLinks[i]}${this.commands[it].summary}`);

            streams.out.writeLine(
                `The source code of this website is \\\
                <a href="https://git.fwdekker.com/FWDekker/fwdekker.com">available on git</a>.

                <b>List of commands</b>
                ${commandEntries.join("\n")}

                Write "help [COMMAND]" or click a command in the list above for more information.`.trimMultiLines()
            );
            return 0;
        }
    }

    private ls(input: InputArgs, streams: StreamSet): number {
        return (input.args.length === 0 ? [""] : input.args)
            .map(arg => Path.interpret(this.environment.get("cwd"), arg))
            .map((path, i) => {
                if (i > 0)
                    streams.out.write("\n");

                const node = this.fileSystem.get(path);
                if (node === undefined) {
                    streams.err.writeLine(`The directory '${path}' does not exist.`);
                    return -1;
                }
                if (!(node instanceof Directory)) {
                    streams.err.writeLine(`'${path}' is not a directory.`);
                    return -1;
                }

                const dirList = [
                    new Directory().nameString("./", path),
                    new Directory().nameString("../", path.parent)
                ];
                const fileList: string[] = [];

                const nodes = node.nodes;
                Object.keys(nodes)
                    .sortAlphabetically(it => it, true)
                    .forEach(name => {
                        const node = nodes[name];
                        if (!input.hasAnyOption(["a", "A"]) && name.startsWith("."))
                            return;

                        if (node instanceof Directory)
                            dirList.push(node.nameString(`${name}/`, path.getChild(name)));
                        else if (node instanceof File)
                            fileList.push(node.nameString(name, path.getChild(name)));
                        else
                            throw new IllegalStateError(`'${path.getChild(name)}' is neither a file nor a directory.`);
                    });

                if (input.args.length > 1)
                    streams.out.writeLine(`<b>${path}</b>`);
                streams.out.writeLine(dirList.concat(fileList).join("\n"));
                return 0;
            })
            .reduce((acc, exitCode) => exitCode === 0 ? acc : exitCode);
    }

    private man(input: InputArgs, streams: StreamSet): number {
        if (input.args.length === 0) {
            streams.out.writeLine("What manual page do you want?");
            return 0;
        }
        if (!Object.keys(this.commands).includes(input.args[0])) {
            streams.err.writeLine(`No manual entry for '${input.args[0]}'.`);
            return -1;
        }

        return this.help(input, streams);
    }

    private mkdir(input: InputArgs, streams: StreamSet): number {
        return input.args
            .map(arg => Path.interpret(this.environment.get("cwd"), arg))
            .map(path => {
                try {
                    this.fileSystem.add(path, new Directory(), input.hasOption("p"));
                    return 0;
                } catch (error) {
                    streams.err.writeLine(error.message);
                    return -1;
                }
            })
            .reduce((acc, exitCode) => exitCode === 0 ? acc : exitCode);
    }

    private mv(input: InputArgs, streams: StreamSet): number {
        try {
            return this.moveCopyMappings(input)
                .map(([source, destination]) => {
                    try {
                        this.fileSystem.move(source, destination);
                        return 0;
                    } catch (error) {
                        streams.err.writeLine(error.message);
                        return -1;
                    }
                })
                .reduce((acc, exitCode) => exitCode === 0 ? acc : exitCode);
        } catch (error) {
            streams.err.writeLine(error.message);
            return -1;
        }
    }

    private open(input: InputArgs, streams: StreamSet): number {
        const path = Path.interpret(this.environment.get("cwd"), input.args[0]);
        const target = input.hasAnyOption(["b", "blank"]) ? "_blank" : "_self";

        const node = this.fileSystem.get(path);
        if (node === undefined) {
            streams.err.writeLine(`The file '${path}' does not exist`);
            return -1;
        }
        if (!(node instanceof File)) {
            streams.err.writeLine(`'${path}' is not a file`);
            return -1;
        }

        window.open(node.contents, target);
        return 0;
    }

    private poweroff(_: InputArgs, streams: StreamSet): number {
        const userName = this.environment.get("user");
        if (userName === "") {
            streams.err.writeLine("Cannot execute `poweroff` while not logged in.");
            return -1;
        }

        Persistence.setPoweroff(true);
        setTimeout(() => location.reload(), 2000);

        streams.out.writeLine(
            `Shutdown NOW!

            *** FINAL System shutdown message from ${userName}@fwdekker.com ***

            System going down IMMEDIATELY


            System shutdown time has arrived`.trimLines()
        );
        return 0;
    }

    private pwd(_: InputArgs, streams: StreamSet): number {
        streams.out.writeLine(this.environment.get("cwd") ?? "");
        return 0;
    }

    private rm(input: InputArgs, streams: StreamSet): number {
        return input.args
            .map(arg => Path.interpret(this.environment.get("cwd"), arg))
            .map(path => {
                try {
                    const target = this.fileSystem.get(path);
                    if (target === undefined) {
                        if (input.hasAnyOption(["f", "force"]))
                            return 0;

                        streams.err.writeLine(`The file '${path}' does not exist.`);
                        return -1;
                    }
                    if (target instanceof Directory) {
                        if (!input.hasAnyOption(["r", "R", "recursive"])) {
                            streams.err.writeLine(`'${path}' is a directory.`);
                            return -1;
                        }
                        if (path.toString() === "/" && !input.hasOption("no-preserve-root")) {
                            streams.err.writeLine("Cannot remove root directory.");
                            return -1;
                        }
                    }

                    this.fileSystem.remove(path);
                    return 0;
                } catch (error) {
                    streams.err.writeLine(error.message);
                    return -1;
                }
            })
            .reduce((acc, exitCode) => exitCode === 0 ? acc : exitCode);
    }

    private rmdir(input: InputArgs, streams: StreamSet): number {
        return input.args
            .map(arg => Path.interpret(this.environment.get("cwd"), arg))
            .map(path => {
                try {
                    const target = this.fileSystem.get(path);
                    if (target === undefined) {
                        streams.err.writeLine(`'${path}' does not exist.`);
                        return -1;
                    }
                    if (!(target instanceof Directory)) {
                        streams.err.writeLine(`'${path}' is not a directory.`);
                        return -1;
                    }
                    if (target.nodeCount !== 0) {
                        streams.err.writeLine(`'${path}' is not empty.`);
                        return -1;
                    }

                    this.fileSystem.remove(path);
                    return 0;
                } catch (error) {
                    streams.err.writeLine(error.message);
                    return -1;
                }
            })
            .reduce((acc, exitCode) => exitCode === 0 ? acc : exitCode);
    }

    private set(input: InputArgs, streams: StreamSet): number {
        try {
            if (input.args.length === 1)
                this.environment.safeDelete(input.args[0]);
            else
                this.environment.safeSet(input.args[0], input.args[1]);
        } catch (error) {
            streams.err.writeLine(error.message);
            return -1;
        }

        return 0;
    }

    private touch(input: InputArgs, streams: StreamSet): number {
        return input.args
            .map(arg => Path.interpret(this.environment.get("cwd"), arg))
            .map(path => {
                try {
                    this.fileSystem.add(path, new File(), false);
                    return 0;
                } catch (error) {
                    streams.err.writeLine(error.message);
                    return -1;
                }
            })
            .reduce((acc, exitCode) => exitCode === 0 ? acc : exitCode);
    }

    private whoami(_: InputArgs, streams: StreamSet): number {
        const user = this.userSession.get(this.environment.get("user"));
        if (user === undefined) {
            streams.err.writeLine("Cannot execute `whoami` while not logged in.");
            return -1;
        }

        streams.out.writeLine(user.description);
        return 0;
    }


    /**
     * Maps sources to inputs for the `move` and `copy` commands.
     *
     * @param input the input to extract mappings from
     */
    private moveCopyMappings(input: InputArgs): [Path, Path][] {
        const sources = input.args.slice(0, -1).map(arg => Path.interpret(this.environment.get("cwd"), arg));
        const destination = Path.interpret(this.environment.get("cwd"), input.args.slice(-1)[0]);

        let mappings: [Path, Path][];
        if (this.fileSystem.has(destination)) {
            // Move into directory
            if (!(this.fileSystem.get(destination) instanceof Directory)) {
                if (sources.length === 1)
                    throw new IllegalArgumentError(`'${destination}' already exists.`);
                else
                    throw new IllegalArgumentError(`'${destination}' is not a directory.`);
            }

            mappings = sources.map(source => [source, destination.getChild(source.fileName)]);
        } else {
            // Move to exact location
            if (sources.length !== 1)
                throw new IllegalArgumentError(`'${destination}' is not a directory.`);

            if (!(this.fileSystem.get(destination.parent) instanceof Directory))
                throw new IllegalArgumentError(`'${destination.parent}' is not a directory.`);

            mappings = sources.map(path => [path, destination]);
        }

        return mappings;
    }
}


/**
 * A command that can be executed.
 */
class Command {
    /**
     * The function to execute with the command is executed.
     */
    readonly fun: (args: InputArgs, streams: StreamSet) => number;
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
    constructor(fun: (args: InputArgs, streams: StreamSet) => number, summary: string, usage: string, desc: string,
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
     */
    private args(amount: number): string {
        return amount === 1 ? `1 argument` : `${amount} arguments`;
    }
}
