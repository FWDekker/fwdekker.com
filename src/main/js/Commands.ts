import "./Extensions";
import {Environment} from "./Environment";
import {Directory, File, FileSystem, Path} from "./FileSystem";
import {InputArgs} from "./InputArgs";
import {InputParser} from "./InputParser";
import {Persistence} from "./Persistence";
import {escapeHtml, ExpectedGoodbyeError, IllegalArgumentError, IllegalStateError, isStandalone} from "./Shared";
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
            "and": new Command(
                this.and,
                `execute command if previous command did not fail`,
                `and <u>command</u>`,
                `Executes <u>command</u> with its associated options and arguments if and only if the status code of \\\
                the previously-executed command is 0.

                The exit code is retained if it was non-zero, and is changed to that of <u>command</u> otherwise.\\\
                `.trimMultiLines(),
                new InputValidator({minArgs: 1})
            ),
            "cat": new Command(
                this.cat,
                `concatenate and print files`,
                `cat [<b>-e</b> | <b>--escape-html</b>] <u>file</u> <u>...</u>`,
                `Reads files sequentially, writing them to the standard output.

                If the file contains valid HTML, it will be displayed as such by default. If the <b>--html</b> \\\
                option is given, special HTML characters are escaped and the raw text contents can be inspected.\\\
                `.trimMultiLines(),
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
                `cd [<u>directory</u>]`,
                `Changes the current working directory to <u>directory</u>. If no <u>directory</u> is supplied, the \\\
                current working directory is changed to the current user's home directory.`.trimMultiLines(),
                new InputValidator({maxArgs: 1})
            ),
            "cp": new Command(
                this.cp,
                `copy files`,
                `cp [<b>-r</b> | <b>-R</b> | <b>--recursive</b>] <u>source</u> <u>target file</u>
                cp [<b>-r</b> | <b>-R</b> | <b>--recursive</b>] <u>source</u> <u>...</u> <u>target directory</u>`,
                `In its first form, <u>source</u> is copied to <u>target file</u>. This form is used if there is no
                file or directory at <u>target file</u> beforehand.

                In its second form, all <u>source</u> files are copied into <u>target directory</u>, which must be a \\\
                pre-existing directory. The file names of the <u>source</u> files are retained.

                In both forms, <u>source</u> files are not copied if they are directories and the <b>-R</b> option \\\
                is not given.`.trimMultiLines(),
                new InputValidator({minArgs: 2})
            ),
            "echo": new Command(
                this.echo,
                `display text`,
                `echo [<b>-n</b> | <b>--newline</b>] [<u>text</u> <u>...</u>]`,
                `Displays each <u>text</u> separated by a single whitespace.

                Unless the <b>--newline</b> parameter is given, a newline is appended to the end.`.trimMultiLines(),
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
                `help [<u>command</u> <u>...</u>]`,
                `Displays help documentation for each <u>command</u>.

                If no commands are given, a list of all commands is shown.`.trimMultiLines(),
                new InputValidator()
            ),
            "hier": new DocOnlyCommand(
                `description of the filesystem hierarchy`,
                `A typical josh system has, among others, the following directories:

                <u>/</u>      This is the root directory. This is where the whole tree starts.

                <u>/dev</u>   Contains special files and device files that refer to physical devices.

                <u>/home</u>  Contains directories for users to store personal files in.

                <u>/root</u>  The home directory of the root user.`.trimMultiLines()
            ),
            "ls": new Command(
                this.ls,
                `list directory contents`,
                `ls [<b>-a</b> | <b>-A</b> | <b>--all</b>] [<u>directory</u> <u>...</u>]`,
                `Displays the files and directories in each <u>directory</u>. If no directory is given, the files \\\
                and directories in the current working directory are shown. If more than one directory is given, the \\\
                files and directories are shown for each given <u>directory</u> in order.

                Files starting with a <u>.</u> are only shown if the <b>--all</b> option is given, with the \\\
                exception of <u>.</u> and <u>..</u>, which are always shown.`.trimMultiLines(),
                new InputValidator()
            ),
            "man": new Command(
                this.man,
                `display manual documentation pages`,
                `man <u>page</u> <u>...</u>`,
                `Displays the manual pages with names <u>page</u>. Equivalent to using <b>help</b> if at least one \\\
                <u>page</u> is given.`.trimMultiLines(),
                new InputValidator()
            ),
            "mkdir": new Command(
                this.mkdir,
                `make directories`,
                `mkdir [<b>-p</b> | <b>--parents</b>] <u>directory</u> <u>...</u>`,
                `Creates the directories given by <u>directory</u>.

                If more than one <u>directory</u> is given, the directories are created in the order they are given \\\
                in. If the <b>--parents</b> option is given, parent directories that do not exist are created as \\\
                well.`.trimMultiLines(),
                new InputValidator({minArgs: 1})
            ),
            "mv": new Command(
                this.mv,
                `move files`,
                `mv <u>source</u> <u>destination file</u>
                mv <u>source</u> <u>...</u> <u>destination directory</u>`,
                `In its first form, <u>source</u> is renamed to <u>target file</u>. <u>target file</u> must not \\\
                exist yet.

                In its second form, all <u>source</u> files are moved into <u>target directory</u>, which must be a \\\
                pre-existing directory. The file names of the <u>source</u> files are retained.`.trimMultiLines(),
                new InputValidator({minArgs: 2})
            ),
            "not": new Command(
                this.not,
                `execute command and invert status code`,
                `not <u>command</u>`,
                `Executes <u>command</u> with its associated options and arguments and inverts its exit code. More \\\
                precisely, the exit code is set to 0 if it was non-zero, and is set to 1 otherwise.`.trimMultiLines(),
                new InputValidator({minArgs: 1})
            ),
            "open": new Command(
                this.open,
                `open web pages`,
                `open [<b>-b</b> | <b>--blank</b>] <u>file</u> <u>...</u>`,
                `Opens the web pages linked to by <u>file</u>. The first <u>file</u> is opened in this tab and the \\\
                subsequent <u>file</u>s are opened in new tabs. If <b>--blank</b> is set, the first <u>file</u> is \\\
                opened in a new tab as well.

                If this command is executed inside of a standalone app instead of a browser, every <u>file</u> is \\\
                opened in a tab regardless of whether <b>--blank</b> is given.`.trimMultiLines(),
                new InputValidator({minArgs: 1})
            ),
            "or": new Command(
                this.or,
                `execute command if previous command failed`,
                `or <u>command</u>`,
                `Executes <u>command</u> with its associated options and arguments if and only if the status code of \\\
                the previously-executed command is not 0.

                The exit code is retained if it was zero, and is changed to that of <u>command</u> otherwise.\\\
                `.trimMultiLines(),
                new InputValidator({minArgs: 1})
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
                `rm [<b>-f</b> | <b>--force</b>] [<b>-r</b> | <b>-R</b> | <b>--recursive</b>] \\\
                [<b>--no-preserve-root</b>] <u>file</u> <u>...</u>`.trimMultiLines(),
                `Removes each given <u>file</u>. If more than one <u>file</u> is given, they are removed in the \\\
                order they are given in.

                If <b>--force</b> is set, no warning is given if a file could not be removed.

                If <b>--recursive</b> is set, files and directories are removed recursively; without this option \\\
                directories cannot be removed.

                Unless <b>--no-preserve-root</b> is set, the root directory cannot be removed.`.trimMultiLines(),
                new InputValidator({minArgs: 1})
            ),
            "rmdir": new Command(
                this.rmdir,
                `remove directories`,
                `rmdir <u>directory</u> <u>...</u>`,
                `Removes each given <u>directory</u>. If more than one <u>directory</u> is given, they are removed \\\
                in the order they are given in. Non-empty directories will not be removed.`.trimMultiLines(),
                new InputValidator({minArgs: 1})
            ),
            "set": new Command(
                this.set,
                `set environment variable`,
                `set <u>key</u> [<u>value</u>]`,
                `Sets the environment variable <u>key</u> to <u>value</u>. If no <u>value</u> is given, the \\\
                environment variable is cleared. Read-only variables cannot be set.`.trimMultiLines(),
                new InputValidator({minArgs: 1, maxArgs: 2})
            ),
            "touch": new Command(
                this.touch,
                `change file timestamps`,
                `touch <u>file</u> <u>...</u>`,
                `Update the access and modification times of each <u>file</u> to the current time. If a <u>file</u> \\\
                does not exist, it is created.`.trimMultiLines(),
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
            location.reload(true);
            throw new ExpectedGoodbyeError("Goodbye");
        }
        if (input.command === "")
            return 0;

        const command = this.commands[input.command];
        if (command === undefined || command instanceof DocOnlyCommand) {
            streams.err.writeLine(`Unknown command '${input.command}'.`);
            return -1;
        }

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
            throw new IllegalArgumentError(`Unknown command '${commandName}'.`);

        return `Invalid usage of ${commandName}. ${errorMessage ?? ""}

               <b>Usage</b>
               ${command.usage}`.trimLines();
    }


    private and(input: InputArgs, streams: StreamSet): number {
        const previousStatus = Number(this.environment.getOrDefault("status", "0"));
        if (previousStatus !== 0)
            return previousStatus;

        return this.execute(
            InputParser.create(this.environment, this.fileSystem).parseCommand(input.args),
            streams
        );
    }

    private cat(input: InputArgs, streams: StreamSet): number {
        return input.args
            .map(arg => Path.interpret(this.environment.get("cwd"), arg))
            .map(path => {
                if (!this.fileSystem.has(path)) {
                    streams.err.writeLine(`cat: ${path}: No such file.`);
                    return -1;
                }

                const node = this.fileSystem.get(path);
                if (!(node instanceof File)) {
                    streams.err.writeLine(`cat: ${path}: No such file.`);
                    return -1;
                }

                let contents = node.open("read").read();
                if (input.hasAnyOption("e", "--escape-html"))
                    contents = escapeHtml(contents);
                if (!contents.endsWith("\n"))
                    contents += "\n";

                streams.out.write(contents);
                return 0;
            })
            .reduce((acc, exitCode) => exitCode === 0 ? acc : exitCode);
    }

    private cd(input: InputArgs, streams: StreamSet): number {
        if (input.argc === 0 || input.args[0] === "") {
            this.environment.set("cwd", this.environment.get("home"));
            return 0;
        }

        const path = Path.interpret(this.environment.get("cwd"), input.args[0]);
        if (!this.fileSystem.has(path) || !(this.fileSystem.get(path) instanceof Directory)) {
            streams.err.writeLine(`cd: The directory '${path}' does not exist.`);
            return -1;
        }

        this.environment.set("cwd", path.toString());
        return 0;
    }

    private cp(input: InputArgs, streams: StreamSet): number {
        let mappings;
        try {
            mappings = this.moveCopyMappings(input);
        } catch (error) {
            streams.err.writeLine(`cp: ${error.message}`);
            return -1;
        }

        return mappings
            .map(([source, destination]) => {
                try {
                    this.fileSystem.copy(source, destination, input.hasAnyOption("-r", "-R", "--recursive"));
                    return 0;
                } catch (error) {
                    streams.err.writeLine(`cp: ${error.message}`);
                    return -1;
                }
            })
            .reduce((acc, exitCode) => exitCode === 0 ? acc : exitCode);
    }

    private clear(_: InputArgs, streams: StreamSet): number {
        streams.out.write(EscapeCharacters.Escape + EscapeCharacters.Clear);
        return 0;
    }

    private echo(input: InputArgs, streams: StreamSet): number {
        const message = input.args.join(" ").replace("hunter2", "*******");

        if (input.hasAnyOption("-n", "--newline"))
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
        if (input.argc > 0) {
            return input.args
                .map((commandName, i) => {
                    if (i > 0)
                        streams.out.write("\n\n");

                    const command = this.commands[commandName];
                    if (command === undefined) {
                        streams.out.writeLine(`Unknown command '${commandName}'.`);
                        return -1;
                    }

                    let helpString = "<b>Name</b>\n" + commandName;
                    if (command.summary !== null)
                        helpString += "\n\n<b>Summary</b>\n" + command.summary;
                    if (command.usage !== null)
                        helpString += "\n\n<b>Usage</b>\n" + command.usage;
                    if (command.desc !== null)
                        helpString += "\n\n<b>Description</b>\n" + command.desc;

                    streams.out.writeLine(helpString);
                    return 0;
                })
                .reduce((acc, exitCode) => exitCode === 0 ? acc : exitCode);
        } else {
            const commandNames = Object.keys(this.commands)
                .filter(it => !(this.commands[it] instanceof DocOnlyCommand));

            const commandWidth = Math.max.apply(null, commandNames.map(it => it.length)) + 4;
            const commandPaddings = commandNames.map(it => commandWidth - it.length);
            const commandLinks = commandNames
                .map(it => `<a href="#" onclick="execute('help ${it}')">${it}</a>`)
                .map((it, i) => `${it.padEnd(it.length + commandPaddings[i], " ")}`);
            const commandEntries = commandNames
                .map((it, i) => `${commandLinks[i]}${this.commands[it].summary}`);

            const target = isStandalone() ? `target="_blank"` : "";
            streams.out.writeLine(
                `The source code of this website is \\\
                <a href="https://git.fwdekker.com/FWDekker/fwdekker.com" ${target}>available on git</a>.

                <b>List of commands</b>
                ${commandEntries.join("\n")}

                Write "help [COMMAND]" or click a command in the list above for more information.`.trimMultiLines()
            );
            return 0;
        }
    }

    private ls(input: InputArgs, streams: StreamSet): number {
        return (input.argc === 0 ? [""] : input.args)
            .map(arg => Path.interpret(this.environment.get("cwd"), arg))
            .map((path, i) => {
                if (i > 0)
                    streams.out.write("\n");

                const node = this.fileSystem.get(path);
                if (node === undefined) {
                    streams.err.writeLine(`ls: The directory '${path}' does not exist.`);
                    return -1;
                }
                if (!(node instanceof Directory)) {
                    streams.err.writeLine(`ls: '${path}' is not a directory.`);
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
                        if (!input.hasAnyOption("-a", "-A", "--all") && name.startsWith("."))
                            return;

                        if (node instanceof Directory)
                            dirList.push(node.nameString(`${name}/`, path.getChild(name)));
                        else if (node instanceof File)
                            fileList.push(node.nameString(name, path.getChild(name)));
                        else
                            throw new IllegalStateError(
                                `ls: '${path.getChild(name)}' is neither a file nor a directory.`);
                    });

                if (input.argc > 1)
                    streams.out.writeLine(`<b>${path}</b>`);
                streams.out.writeLine(dirList.concat(fileList).join("\n"));
                return 0;
            })
            .reduce((acc, exitCode) => exitCode === 0 ? acc : exitCode);
    }

    private man(input: InputArgs, streams: StreamSet): number {
        if (input.argc === 0) {
            streams.out.writeLine("What manual page do you want?");
            return 0;
        }

        return this.help(input, streams);
    }

    private mkdir(input: InputArgs, streams: StreamSet): number {
        return input.args
            .map(arg => Path.interpret(this.environment.get("cwd"), arg))
            .map(path => {
                try {
                    this.fileSystem.add(path, new Directory(), input.hasAnyOption("-p", "--parents"));
                    return 0;
                } catch (error) {
                    streams.err.writeLine(`mkdir: ${error.message}`);
                    return -1;
                }
            })
            .reduce((acc, exitCode) => exitCode === 0 ? acc : exitCode);
    }

    private mv(input: InputArgs, streams: StreamSet): number {
        let mappings;
        try {
            mappings = this.moveCopyMappings(input);
        } catch (error) {
            streams.err.writeLine(`mv: ${error.message}`);
            return -1;
        }

        return mappings
            .map(([source, destination]) => {
                try {
                    this.fileSystem.move(source, destination);
                    return 0;
                } catch (error) {
                    streams.err.writeLine(`mv: ${error.message}`);
                    return -1;
                }
            })
            .reduce((acc, exitCode) => exitCode === 0 ? acc : exitCode);
    }

    private not(input: InputArgs, streams: StreamSet): number {
        return Number(!this.execute(
            InputParser.create(this.environment, this.fileSystem).parseCommand(input.args),
            streams
        ));
    }

    private open(input: InputArgs, streams: StreamSet): number {
        return input.args
            .map(it => Path.interpret(this.environment.get("cwd"), it))
            .map((path, i) => {
                try {
                    const target = i > 0 || input.hasAnyOption("-b", "--blank") || isStandalone()
                        ? "_blank"
                        : "_self";
                    window.open(this.fileSystem.open(path, "read").read(), target);
                    return 0;
                } catch (error) {
                    streams.err.writeLine(`open: ${error.message}`);
                    return -1;
                }
            })
            .reduce((acc, exitCode) => exitCode === 0 ? acc : exitCode);
    }

    private or(input: InputArgs, streams: StreamSet): number {
        const previousStatus = Number(this.environment.getOrDefault("status", "0"));
        if (previousStatus === 0)
            return previousStatus;

        return this.execute(
            InputParser.create(this.environment, this.fileSystem).parseCommand(input.args),
            streams
        );
    }

    private poweroff(_: InputArgs, streams: StreamSet): number {
        const userName = this.environment.get("user");
        if (userName === "") {
            streams.err.writeLine("poweroff: Cannot execute while not logged in.");
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
                        if (input.hasAnyOption("-f", "--force"))
                            return 0;

                        streams.err.writeLine(`rm: The file '${path}' does not exist.`);
                        return -1;
                    }
                    if (target instanceof Directory) {
                        if (!input.hasAnyOption("-r", "-R", "--recursive")) {
                            streams.err.writeLine(`rm: '${path}' is a directory.`);
                            return -1;
                        }
                        if (path.toString() === "/" && !input.hasAnyOption("--no-preserve-root")) {
                            streams.err.writeLine("rm: Cannot remove root directory.");
                            return -1;
                        }
                    }

                    this.fileSystem.remove(path);
                    return 0;
                } catch (error) {
                    streams.err.writeLine(`rm: ${error.message}`);
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
                        streams.err.writeLine(`rmdir: '${path}' does not exist.`);
                        return -1;
                    }
                    if (!(target instanceof Directory)) {
                        streams.err.writeLine(`rmdir: '${path}' is not a directory.`);
                        return -1;
                    }
                    if (target.nodeCount !== 0) {
                        streams.err.writeLine(`rmdir: '${path}' is not empty.`);
                        return -1;
                    }

                    this.fileSystem.remove(path);
                    return 0;
                } catch (error) {
                    streams.err.writeLine(`rmdir: ${error.message}`);
                    return -1;
                }
            })
            .reduce((acc, exitCode) => exitCode === 0 ? acc : exitCode);
    }

    private set(input: InputArgs, streams: StreamSet): number {
        try {
            if (input.argc === 1)
                this.environment.safeDelete(input.args[0]);
            else
                this.environment.safeSet(input.args[0], input.args[1]);
        } catch (error) {
            streams.err.writeLine(`set: ${error.message}`);
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
                    streams.err.writeLine(`touch: ${error.message}`);
                    return -1;
                }
            })
            .reduce((acc, exitCode) => exitCode === 0 ? acc : exitCode);
    }

    private whoami(_: InputArgs, streams: StreamSet): number {
        const user = this.userSession.get(this.environment.get("user"));
        if (user === undefined) {
            streams.err.writeLine("whoami: Cannot execute while not logged in.");
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
    readonly summary: string | null;
    /**
     * A string describing how the command is to be used.
     */
    readonly usage: string | null;
    /**
     * A longer description of what the command does and how its parameters work.
     */
    readonly desc: string | null;
    /**
     * A function that validates input for this command.
     */
    readonly validator: InputValidator;


    /**
     * Constructs a new command.
     *
     * @param fun the function to execute with the command is executed
     * @param summary a short summary of what the command does, or `null` if not applicable
     * @param usage a string describing how the command is to be used, or `null` if not applicable
     * @param desc a longer description of what the command does and how its parameters work, or `null` if not
     * applicable
     * @param validator a function that validates input for this command
     */
    constructor(fun: (args: InputArgs, streams: StreamSet) => number, summary: string | null, usage: string | null,
                desc: string | null, validator: InputValidator) {
        this.fun = fun;
        this.summary = summary;
        this.usage = usage;
        this.desc = desc;
        this.validator = validator;
    }
}

/**
 * A command that cannot be executed, but of which the documentation can be looked up anyway.
 */
class DocOnlyCommand extends Command {
    /**
     * Constructs a new doc-only command.
     *
     * @param summary a short summary of what the command does, or `null` if not applicable
     * @param desc a longer description of what the command does and how its parameters work, or `null` if not
     * applicable
     */
    constructor(summary: string | null, desc: string | null) {
        super(() => {
            throw new IllegalStateError("Cannot execute doc-only command.");
        }, summary, null, desc, new InputValidator());
    }
}

/**
 * Validates the input of a command.
 */
export class InputValidator {
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
        if (minArgs < 0)
            throw new IllegalArgumentError("'minArgs' must be non-negative.");
        if (maxArgs < 0)
            throw new IllegalArgumentError("'maxArgs' must be non-negative.");
        if (minArgs > maxArgs)
            throw new IllegalArgumentError("'minArgs' must be less than or equal to 'maxArgs'.");

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
        if (this.minArgs === this.maxArgs && input.argc !== this.minArgs)
            return [false, `Expected ${this.argString(this.minArgs)} but got ${input.argc}.`];
        if (input.argc < this.minArgs)
            return [false, `Expected at least ${this.argString(this.minArgs)} but got ${input.argc}.`];
        if (input.argc > this.maxArgs)
            return [false, `Expected at most ${this.argString(this.maxArgs)} but got ${input.argc}.`];

        return [true];
    }

    /**
     * Returns `"1 argument"` if the given amount is `1` and returns `"$n arguments"` otherwise.
     *
     * @param amount the amount to check
     */
    private argString(amount: number): string {
        return amount === 1 ? `1 argument` : `${amount} arguments`;
    }
}
