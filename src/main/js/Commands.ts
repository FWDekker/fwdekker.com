import {Environment} from "./Environment";
import "./Extensions";
import {Directory, File, FileSystem, Node, Path,} from "./FileSystem";
import {InputArgs} from "./InputArgs";
import {InputParser} from "./InputParser";
import {Persistence} from "./Persistence";
import {escapeHtml, IllegalArgumentError, IllegalStateError, isStandalone} from "./Shared";
import {StreamSet} from "./Stream";
import {EscapeCharacters} from "./Terminal";
import {HashProvider, User, UserList} from "./UserList";


/**
 * A collection of commands that can be executed.
 */
export class Commands {
    /**
     * The environment in which commands are executed.
     */
    private readonly environment: Environment;
    /**
     * The user list describing the available users.
     */
    private readonly userList: UserList;
    /**
     * The file system to interact with.
     */
    private readonly fileSystem: FileSystem;


    /**
     * Constructs a new collection of commands.
     *
     * @param environment the environment in which commands are executed
     * @param userList the user list describing the user that executes commands
     * @param fileSystem the file system to interact with
     */
    constructor(environment: Environment, userList: UserList, fileSystem: FileSystem) {
        this.environment = environment;
        this.userList = userList;
        this.fileSystem = fileSystem;
    }


    /**
     * Parses and executes the given input string and returns the exit code of that command.
     *
     * @param input the input string to parse and execute
     * @param streams the streams to interact with
     */
    execute(input: InputArgs, streams: StreamSet): number {
        if (input.command === "")
            return 0;

        const command = this.resolve(input.command);
        if (command === undefined) {
            streams.err.writeLine(`Unknown command '${input.command}'.`);
            return -1;
        }
        if (command instanceof Error) {
            streams.err.writeLine(`Could not parse command '${input.command}': ${command}.`);
            return -1;
        }
        if (command instanceof DocOnlyCommand) {
            streams.err.writeLine(`Could not execute doc-only command. Try 'help ${input.command}' instead.`);
            return -1;
        }

        const validation = command.validator.validate(input);
        if (!validation[0]) {
            streams.err.writeLine(this.createUsageErrorOutput(input.command, command, validation[1]));
            return -1;
        }

        return command.fun.bind(this)(input, streams);
    }

    /**
     * Finds the `Command` with the given name and returns it.
     *
     * @param commandName the name of or path to the command to find
     * @return the command addressed by the given name or path, an 'Error' if the command could be found but could not
     * be parsed, or `undefined` if the command could not be found
     */
    resolve(commandName: string): Command | Error | undefined {
        const cwd = this.environment.get("cwd");

        let script: Node | undefined;
        if (commandName.includes("/")) {
            script = this.fileSystem.get(Path.interpret(cwd, commandName));
        } else {
            script = this.fileSystem.get(Path.interpret(cwd, "/bin", commandName));
        }
        if (!(script instanceof File)) {
            return undefined;
        }

        const code = script.open("read").read();
        try {
            return this.interpretScript(code, this.environment, this.userList, this.fileSystem);
        } catch (e) {
            console.error(`Failed to interpret script '${commandName}'.`, code, e);
            return e;
        }
    }

    /**
     * Interprets the given code and returns the `Command` it describes.
     *
     * @param code a string describing a `Command`
     * @param environment the environment in which the code is to be executed
     * @param userList the list of users relevant to the code
     * @param fileSystem the file system to refer to when executing code
     * @return the `Command` described by the given code
     */
    private interpretScript(code: string, environment: Environment, userList: UserList,
                            fileSystem: FileSystem): Command {
        const josh = {
            "environment": environment,
            "fileSystem": fileSystem,
            "interpreter": this,
            "userList": userList,
            "util": {
                "escapeHtml": escapeHtml,
                "isStandalone": isStandalone
            }
        };
        const namespace = {
            "Command": Command,
            "Directory": Directory,
            "DocOnlyCommand": DocOnlyCommand,
            "EscapeCharacters": EscapeCharacters,
            "File": File,
            "HashProvider": HashProvider,
            "InputParser": InputParser,
            "InputValidator": InputValidator,
            "Path": Path,
            "Persistence": Persistence,
            "User": User,
            "josh": josh
        };

        return Function(...(Object.keys(namespace).concat([code])))(...Object.values(namespace));
    };

    /**
     * Formats an error message about invalid usage of the given command.
     *
     * @param commandName the name of the command that was used incorrectly
     * @param command the command of which the input is invalid
     * @param errorMessage the message describing how the command was used incorrectly; preferably ended with a `.`
     * @return an error message about invalid usage of the given command
     */
    private createUsageErrorOutput(commandName: string, command: Command, errorMessage: string | undefined): string {
        return `Invalid usage of '${commandName}'. ${errorMessage ?? ""}

               <b>Usage</b>
               ${command.usage}`.trimLines();
    }
}


/**
 * A command that can be executed.
 */
export class Command {
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
export class DocOnlyCommand extends Command {
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


// An escaped newline escape symbol.
const n = "\\\\\\";

// noinspection HtmlUnknownAttribute // False positive
/**
 * Returns the script contents of the binaries in the `/bin` directory.
 *
 * @return the script contents of the binaries in the `/bin` directory
 */
export const commandBinaries: { [key: string]: string } = {
    "and": `\
return new Command(
    (input, streams) => {
        const previousStatus = Number(josh.environment.getOrDefault("status", "0"));
        if (previousStatus !== 0)
            return previousStatus;

        return josh.interpreter.execute(
            InputParser.create(josh.environment, josh.fileSystem).parseCommand(input.args),
            streams
        );
    },
    \`execute command if previous command did not fail\`,
    \`and <u>command</u>\`,
    \`Executes <u>command</u> with its associated options and arguments if and only if the status code of the ${n}
    previously-executed command is 0.

    The exit code is retained if it was non-zero, and is changed to that of <u>command</u> otherwise.${n}
    \`.trimMultiLines(),
    new InputValidator({minArgs: 1})
)`,
    "cat": `\
return new Command(
    (input, streams) => {
        return input.args
            .map(arg => Path.interpret(josh.environment.get("cwd"), arg))
            .map(path => {
                const node = josh.fileSystem.get(path);
                if (!(node instanceof File)) {
                    streams.err.writeLine(\`cat: '\${path}': No such file.\`);
                    return -1;
                }

                let contents = node.open("read").read();
                if (input.hasAnyOption("-e", "--escape-html"))
                    contents = josh.util.escapeHtml(contents);
                if (!contents.endsWith("\\n"))
                    contents += "\\n";

                streams.out.write(contents);
                return 0;
            })
            .reduce((acc, exitCode) => exitCode === 0 ? acc : exitCode);
    },
    \`concatenate and print files\`,
    \`cat [<b>-e</b> | <b>--escape-html</b>] <u>file</u> <u>...</u>\`,
    \`Reads files sequentially, writing them to the standard output.

    If the file contains valid HTML, it will be displayed as such by default. If the <b>--escape-html</b> option is ${n}
    given, special HTML characters are escaped and the raw text contents can be inspected.\`.trimMultiLines(),
    new InputValidator({minArgs: 1})
)`,
    "cd": `\
return new Command(
    (input, streams) => {
        if (input.argc === 0) {
            josh.environment.set("cwd", josh.environment.get("home"));
            return 0;
        }

        const path = Path.interpret(josh.environment.get("cwd"), input.args[0]);
        if (!(josh.fileSystem.get(path) instanceof Directory)) {
            streams.err.writeLine(\`cd: The directory '\${path}' does not exist.\`);
            return -1;
        }

        josh.environment.set("cwd", path.toString());
        return 0;
    },
    \`change directory\`,
    \`cd [<u>directory</u>]\`,
    \`Changes the current working directory to <u>directory</u>. If no <u>directory</u> is supplied, the current ${n}
    working directory is changed to the current user's home directory.\`.trimMultiLines(),
    new InputValidator({maxArgs: 1})
)`,
    "clear": `\
return new Command(
    (input, streams) => {
        streams.out.write(EscapeCharacters.Escape + EscapeCharacters.Clear);
        return 0;
    },
    \`clear terminal output\`,
    \`clear\`,
    \`Clears all previous terminal output.\`,
    new InputValidator({maxArgs: 0})
)`,
    "cp": `\
return new Command(
    (input, streams) => {
        let mappings;
        try {
            const cwd = josh.environment.get("cwd");
            mappings = josh.fileSystem.determineMoveMappings(
                input.args.slice(0, -1).map((it) => Path.interpret(cwd, it)),
                Path.interpret(cwd, input.args.slice(-1)[0])
            );
        } catch (error) {
            streams.err.writeLine(\`cp: \${error.message}\`);
            return -1;
        }

        return mappings
            .map(([source, destination]) => {
                try {
                    josh.fileSystem.copy(source, destination, input.hasAnyOption("-r", "-R", "--recursive"));
                    return 0;
                } catch (error) {
                    streams.err.writeLine(\`cp: \${error.message}\`);
                    return -1;
                }
            })
            .reduce((acc, exitCode) => exitCode === 0 ? acc : exitCode);
    },
    \`copy files\`,
    \`cp [<b>-r</b> | <b>-R</b> | <b>--recursive</b>] <u>source</u> <u>target file</u>
    cp [<b>-r</b> | <b>-R</b> | <b>--recursive</b>] <u>source</u> <u>...</u> <u>target directory</u>\`,
    \`In its first form, <u>source</u> is copied to <u>target file</u>. This form is used if there is no file or ${n}
    directory at <u>target file</u> beforehand.

    In its second form, all <u>source</u> files are copied into <u>target directory</u>, which must be a ${n}
    pre-existing directory. The file names of the <u>source</u> files are retained.

    In both forms, <u>source</u> files are not copied if they are directories and the <b>-R</b> option is not given.${n}
    \`.trimMultiLines(),
    new InputValidator({minArgs: 2})
)`,
    "echo": `\
return new Command(
    (input, streams) => {
        const message = input.args.join(" ").replace("hunter2", "*******");

        if (input.hasAnyOption("-n", "--newline"))
            streams.out.write(message);
        else
            streams.out.writeLine(message);

        return 0;
    },
    \`display text\`,
    \`echo [<b>-n</b> | <b>--newline</b>] [<u>text</u> <u>...</u>]\`,
    \`Displays each <u>text</u> separated by a single whitespace.

    Unless the <b>--newline</b> parameter is given, a newline is appended to the end.\`.trimMultiLines(),
    new InputValidator()
)`,
    "exit": `\
return new Command(
    (input, streams) => {
        josh.environment.set("user", "");
        return 0;
    },
    \`close session\`,
    \`exit\`,
    \`Closes the terminal session.\`,
    new InputValidator({maxArgs: 0})
)`,
    "help": `\
return new Command(
    (input, streams) => {
        if (input.argc > 0) {
            return input.args
                .map((commandName, i) => {
                    if (i > 0)
                        streams.out.write("\\n\\n");

                    const command = josh.interpreter.resolve(commandName);
                    if (command === undefined) {
                        streams.out.writeLine(\`Unknown command '\${commandName}'.\`);
                        return -1;
                    }

                    let helpString = "<b>Name</b>\\n" + commandName;
                    if (command.summary !== null)
                        helpString += "\\n\\n<b>Summary</b>\\n" + command.summary;
                    if (command.usage !== null)
                        helpString += "\\n\\n<b>Usage</b>\\n" + command.usage;
                    if (command.desc !== null)
                        helpString += "\\n\\n<b>Description</b>\\n" + command.desc;

                    streams.out.writeLine(helpString);
                    return 0;
                })
                .reduce((acc, exitCode) => exitCode === 0 ? acc : exitCode);
        } else {
            const cwd = josh.environment.get("cwd");
            const slashBin = josh.fileSystem.get(Path.interpret(cwd, "/bin"));
            if (!(slashBin instanceof Directory)) {
                return -1;
            }

            const commands = {};
            Object.keys(slashBin.nodes).map(it => {
                const command = josh.interpreter.resolve(it);
                if (command !== undefined) commands[it] = command;
            });
            const commandNames = Object.keys(commands).filter(it => !(commands[it] instanceof DocOnlyCommand));

            const commandWidth = Math.max.apply(null, commandNames.map(it => it.length)) + 4;
            const commandPaddings = commandNames.map(it => commandWidth - it.length);
            const commandLinks = commandNames
                .map(it => \`<a href="#" onclick="execute('help \${it}')">\${it}</a>\`)
                .map((it, i) => \`\${it.padEnd(it.length + commandPaddings[i], " ")}\`);
            const commandEntries = commandNames
                .map((it, i) => \`\${commandLinks[i]}\${commands[it].summary}\`);

            const target = josh.util.isStandalone() ? \`target="_blank"\` : "";
            streams.out.writeLine(
                \`The source code of this website is ${n}
                <a href="https://git.fwdekker.com/FWDekker/fwdekker.com" \${target}>available on git</a>.

                <b>List of commands</b>
                \${commandEntries.join("\\n")}

                Write "help [COMMAND]" or click a command in the list above for more information.\`.trimMultiLines()
            );
            return 0;
        }
    },
    \`display documentation\`,
    \`help [<u>command</u> <u>...</u>]\`,
    \`Displays help documentation for each <u>command</u>.

    If no commands are given, a list of all commands is shown.\`.trimMultiLines(),
    new InputValidator()
)`,
    "hier": `\
return new DocOnlyCommand(
    \`description of the file system hierarchy\`,
    \`A typical josh system has, among others, the following directories:

    <u>/</u>      This is the root directory. This is where the whole tree starts.

    <u>/bin</u>   Executable programs fundamental to user environments.

    <u>/dev</u>   Contains special files and device files that refer to physical devices.

    <u>/etc</u>   System configuration files and scripts.

    <u>/home</u>  Contains directories for users to store personal files in.

    <u>/root</u>  The home directory of the root user.\`.trimMultiLines()
)`,
    "ls": `\
return new Command(
    (input, streams) => {
        return (input.argc === 0 ? [""] : input.args)
            .map(arg => Path.interpret(josh.environment.get("cwd"), arg))
            .map((path, i) => {
                if (i > 0)
                    streams.out.write("\\n");

                const node = josh.fileSystem.get(path);
                if (node === undefined) {
                    streams.err.writeLine(\`ls: The directory '\${path}' does not exist.\`);
                    return -1;
                }
                if (!(node instanceof Directory)) {
                    streams.err.writeLine(\`ls: '\${path}' is not a directory.\`);
                    return -1;
                }

                const dirList = [
                    new Directory().nameString("./", path),
                    new Directory().nameString("../", path.parent)
                ];
                const fileList = [];

                const nodes = node.nodes;
                Object.keys(nodes)
                    .sortAlphabetically(it => it, true)
                    .forEach(name => {
                        const node = nodes[name];
                        if (name.startsWith(".") && !input.hasAnyOption("-a", "-A", "--all"))
                            return;

                        if (node instanceof Directory)
                            dirList.push(node.nameString(\`\${name}/\`, path.getChild(name)));
                        else if (node instanceof File)
                            fileList.push(node.nameString(name, path.getChild(name)));
                        else
                            throw new IllegalStateError(
                                \`ls: '\${path.getChild(name)}' is neither a file nor a directory.\`);
                    });

                if (input.argc > 1)
                    streams.out.writeLine(\`<b>\${path}</b>\`);
                streams.out.writeLine(dirList.concat(fileList).join("\\n"));
                return 0;
            })
            .reduce((acc, exitCode) => exitCode === 0 ? acc : exitCode);
    },
    \`list directory contents\`,
    \`ls [<b>-a</b> | <b>-A</b> | <b>--all</b>] [<u>directory</u> <u>...</u>]\`,
    \`Displays the files and directories in each <u>directory</u>. If no directory is given, the files and ${n}
    directories in the current working directory are shown. If more than one directory is given, the files and ${n}
    directories are shown for each given <u>directory</u> in order.

    Files starting with a <u>.</u> are only shown if the <b>--all</b> option is given, with the exception of ${n}
    <u>.</u> and <u>..</u>, which are always shown.\`.trimMultiLines(),
    new InputValidator()
)`,
    "mkdir": `\
return new Command(
    (input, streams) => {
        return input.args
            .map(arg => Path.interpret(josh.environment.get("cwd"), arg))
            .map(path => {
                try {
                    josh.fileSystem.add(path, new Directory(), input.hasAnyOption("-p", "--parents"));
                    return 0;
                } catch (error) {
                    streams.err.writeLine(\`mkdir: \${error.message}\`);
                    return -1;
                }
            })
            .reduce((acc, exitCode) => exitCode === 0 ? acc : exitCode);
    },
    \`make directories\`,
    \`mkdir [<b>-p</b> | <b>--parents</b>] <u>directory</u> <u>...</u>\`,
    \`Creates the directories given by <u>directory</u>.

    If more than one <u>directory</u> is given, the directories are created in the order they are given in. If the ${n}
    <b>--parents</b> option is given, parent directories that do not exist are created as well.\`.trimMultiLines(),
    new InputValidator({minArgs: 1})
)`,
    "mv": `\
return new Command(
    (input, streams) => {
        let mappings;
        try {
            const cwd = josh.environment.get("cwd");
            mappings = josh.fileSystem.determineMoveMappings(
                input.args.slice(0, -1).map((it) => Path.interpret(cwd, it)),
                Path.interpret(cwd, input.args.slice(-1)[0])
            );
        } catch (error) {
            streams.err.writeLine(\`mv: \${error.message}\`);
            return -1;
        }

        return mappings
            .map(([source, destination]) => {
                try {
                    josh.fileSystem.move(source, destination);
                    return 0;
                } catch (error) {
                    streams.err.writeLine(\`mv: \${error.message}\`);
                    return -1;
                }
            })
            .reduce((acc, exitCode) => exitCode === 0 ? acc : exitCode);
    },
    \`move files\`,
    \`mv <u>source</u> <u>destination file</u>
    mv <u>source</u> <u>...</u> <u>destination directory</u>\`,
    \`In its first form, <u>source</u> is renamed to <u>target file</u>. <u>target file</u> must not exist yet.

    In its second form, all <u>source</u> files are moved into <u>target directory</u>, which must be a ${n}
    pre-existing directory. The file names of the <u>source</u> files are retained.\`.trimMultiLines(),
    new InputValidator({minArgs: 2})
)`,
    "not": `\
return new Command(
    (input, streams) => {
        return Number(!josh.interpreter.execute(
            InputParser.create(josh.environment, josh.fileSystem).parseCommand(input.args),
            streams
        ));
    },
    \`execute command and invert status code\`,
    \`not <u>command</u>\`,
    \`Executes <u>command</u> with its associated options and arguments and inverts its exit code. More precisely, ${n}
    the exit code is set to 0 if it was non-zero, and is set to 1 otherwise.\`.trimMultiLines(),
    new InputValidator({minArgs: 1})
)`,
    "open": `\
return new Command(
    (input, streams) => {
        return input.args
            .map(it => Path.interpret(josh.environment.get("cwd"), it))
            .map((path, i) => {
                try {
                    const target = i > 0 || input.hasAnyOption("-b", "--blank") || josh.util.isStandalone()
                        ? "_blank"
                        : "_self";
                    window.open(josh.fileSystem.open(path, "read").read(), target);
                    return 0;
                } catch (error) {
                    streams.err.writeLine(\`open: \${error.message}\`);
                    return -1;
                }
            })
            .reduce((acc, exitCode) => exitCode === 0 ? acc : exitCode);
    },
    \`open web pages\`,
    \`open [<b>-b</b> | <b>--blank</b>] <u>file</u> <u>...</u>\`,
    \`Opens the web pages linked to by <u>file</u>. The first <u>file</u> is opened in this tab and the subsequent ${n}
    <u>file</u>s are opened in new tabs. If <b>--blank</b> is set, the first <u>file</u> is opened in a new tab as ${n}
    well.

    If this command is executed inside of a standalone app instead of a browser, every <u>file</u> is opened in a ${n}
    tab regardless of whether <b>--blank</b> is given.\`.trimMultiLines(),
    new InputValidator({minArgs: 1})
)`,
    "or": `\
return new Command(
    (input, streams) => {
        const previousStatus = Number(josh.environment.getOrDefault("status", "0"));
        if (previousStatus === 0)
            return previousStatus;

        return josh.interpreter.execute(
            InputParser.create(josh.environment, josh.fileSystem).parseCommand(input.args),
            streams
        );
    },
    \`execute command if previous command failed\`,
    \`or <u>command</u>\`,
    \`Executes <u>command</u> with its associated options and arguments if and only if the status code of the ${n}
    previously-executed command is not 0.

    The exit code is retained if it was zero, and is changed to that of <u>command</u> otherwise.\`.trimMultiLines(),
    new InputValidator({minArgs: 1})
)`,
    "poweroff": `\
return new Command(
    (input, streams) => {
        const userName = josh.environment.get("user");
        if (userName === "") {
            streams.err.writeLine("poweroff: Cannot execute while not logged in.");
            return -1;
        }

        Persistence.setPoweroff(true);
        setTimeout(() => location.reload(), 2000);

        streams.out.writeLine(
            \`Shutdown NOW!

            *** FINAL System shutdown message from \${userName}@fwdekker.com ***

            System going down IMMEDIATELY


            System shutdown time has arrived\`.trimLines()
        );
        return 0;
    },
    \`close down the system\`,
    \`poweroff\`,
    \`Automated shutdown procedure to nicely notify users when the system is shutting down.\`,
    new InputValidator({maxArgs: 0})
)`,
    "pwd": `\
return new Command(
    (input, streams) => {
        streams.out.writeLine(josh.environment.get("cwd") || "");
        return 0;
    },
    \`print working directory\`,
    \`pwd\`,
    \`Displays the current working directory.\`,
    new InputValidator({maxArgs: 0})
)`,
    "rm": `\
return new Command(
    (input, streams) => {
        return input.args
            .map(arg => Path.interpret(josh.environment.get("cwd"), arg))
            .map(path => {
                try {
                    const target = josh.fileSystem.get(path);
                    if (target === undefined) {
                        if (input.hasAnyOption("-f", "--force"))
                            return 0;

                        streams.err.writeLine(\`rm: The file '\${path}' does not exist.\`);
                        return -1;
                    }
                    if (target instanceof Directory) {
                        if (!input.hasAnyOption("-r", "-R", "--recursive")) {
                            streams.err.writeLine(\`rm: '\${path}' is a directory.\`);
                            return -1;
                        }
                        if (path.toString() === "/" && !input.hasAnyOption("--no-preserve-root")) {
                            streams.err.writeLine("rm: Cannot remove root directory.");
                            return -1;
                        }
                    }

                    josh.fileSystem.remove(path);
                    return 0;
                } catch (error) {
                    streams.err.writeLine(\`rm: \${error.message}\`);
                    return -1;
                }
            })
            .reduce((acc, exitCode) => exitCode === 0 ? acc : exitCode);
    },
    \`remove file\`,
    \`rm [<b>-f</b> | <b>--force</b>] [<b>-r</b> | <b>-R</b> | <b>--recursive</b>] ${n}
    [<b>--no-preserve-root</b>] <u>file</u> <u>...</u>\`.trimMultiLines(),
    \`Removes each given <u>file</u>. If more than one <u>file</u> is given, they are removed in the order they are ${n}
    given in.

    If <b>--force</b> is set, no warning is given if a file could not be removed.

    If <b>--recursive</b> is set, files and directories are removed recursively; without this option directories ${n}
    cannot be removed.

    Unless <b>--no-preserve-root</b> is set, the root directory cannot be removed.\`.trimMultiLines(),
    new InputValidator({minArgs: 1})
)`,
    "rmdir": `\
return new Command(
    (input, streams) => {
        return input.args
            .map(arg => Path.interpret(josh.environment.get("cwd"), arg))
            .map(path => {
                try {
                    const target = josh.fileSystem.get(path);
                    if (target === undefined) {
                        streams.err.writeLine(\`rmdir: '\${path}' does not exist.\`);
                        return -1;
                    }
                    if (!(target instanceof Directory)) {
                        streams.err.writeLine(\`rmdir: '\${path}' is not a directory.\`);
                        return -1;
                    }
                    if (target.nodeCount !== 0) {
                        streams.err.writeLine(\`rmdir: '\${path}' is not empty.\`);
                        return -1;
                    }

                    josh.fileSystem.remove(path);
                    return 0;
                } catch (error) {
                    streams.err.writeLine(\`rmdir: \${error.message}\`);
                    return -1;
                }
            })
            .reduce((acc, exitCode) => exitCode === 0 ? acc : exitCode);
    },
    \`remove directories\`,
    \`rmdir <u>directory</u> <u>...</u>\`,
    \`Removes each given <u>directory</u>. If more than one <u>directory</u> is given, they are removed in the ${n}
    order they are given in. Non-empty directories will not be removed.\`.trimMultiLines(),
    new InputValidator({minArgs: 1})
)`,
    "set": `\
return new Command(
    (input, streams) => {
        try {
            if (input.argc === 1)
                josh.environment.safeDelete(input.args[0]);
            else
                josh.environment.safeSet(input.args[0], input.args[1]);
        } catch (error) {
            streams.err.writeLine(\`set: \${error.message}\`);
            return -1;
        }

        return 0;
    },
    \`set environment variable\`,
    \`set <u>key</u> [<u>value</u>]\`,
    \`Sets the environment variable <u>key</u> to <u>value</u>. If no <u>value</u> is given, the environment ${n}
    variable is cleared. Read-only variables cannot be set.\`.trimMultiLines(),
    new InputValidator({minArgs: 1, maxArgs: 2})
)`,
    "touch": `\
return new Command(
    (input, streams) => {
        return input.args
            .map(arg => Path.interpret(josh.environment.get("cwd"), arg))
            .map(path => {
                try {
                    josh.fileSystem.add(path, new File(), false);
                    return 0;
                } catch (error) {
                    streams.err.writeLine(\`touch: \${error.message}\`);
                    return -1;
                }
            })
            .reduce((acc, exitCode) => exitCode === 0 ? acc : exitCode);
    },
    \`change file timestamps\`,
    \`touch <u>file</u> <u>...</u>\`,
    \`Update the access and modification times of each <u>file</u> to the current time. If a <u>file</u> does not ${n}
    exist, it is created.\`.trimMultiLines(),
    new InputValidator({minArgs: 1})
)`,
    "useradd": `\
return new Command(
    (input, streams) => {
        if (josh.userList.has(input.args[0])) {
            streams.err.writeLine(\`useradd: User '\${input.args[0]}' already exists.\`);
            return -1;
        }

        let user;
        try {
            user = new User(input.args[0], HashProvider.default.hashPassword(input.args[1]));
            if (input.hasAnyOption("-h", "--home"))
                user.home = input.options["-h"] || input.options["--home"];
            if (input.hasAnyOption("-d", "--description"))
                user.description = input.options["-d"] || input.options["--description"];
        } catch (error) {
            streams.err.writeLine(\`useradd: \${error.message}\`);
            return -1;
        }

        if (!josh.userList.add(user)) {
            streams.err.writeLine(\`useradd: Unexpectedly failed to add user '\${input.args[0]}'.\`);
            return -1;
        }

        streams.out.writeLine(\`useradd: Added user '\${input.args[0]}'.\`);
        return 0;
    },
    \`add new user\`,
    \`useradd ${n}
        [<b>-h</b>/<b>--home</b>=<u>home</u>] ${n}
        [<b>-d</b>/<b>--description</b>=<u>description</u>] ${n}
        <u>name</u> <u>password</u>\`.trimMultiLines(),
    \`Adds a user with the given data to the system.

    The <u>name</u> must consist solely of alphanumerical characters.
    The <u>home</u> directory and the <u>description</u> must not contain the pipe character (') or the newline ${n}
    character ('\\\\n').

    If no <u>home</u> is given, it defaults to "/home/<u>name</u>".\`.trimMultiLines(),
    new InputValidator({minArgs: 2, maxArgs: 4})
)`,
    "userdel": `\
return new Command(
    (input, streams) => {
        if (!josh.userList.has(input.args[0])) {
            streams.err.writeLine(\`userdel: Could not delete non-existent user '\${input.args[0]}'.\`);
            return -1;
        }

        if (!josh.userList.delete(input.args[0])) {
            streams.err.writeLine(\`userdel: Unexpectedly failed to delete user '\${input.args[0]}'.\`);
            return -1;
        }

        streams.out.writeLine(\`userdel: Deleted user '\${input.args[0]}'.\`);
        return 0;
    },
    \`delete user\`,
    \`userdel <u>name</u>\`,
    \`Deletes the user with the given <u>name</u>.\`.trimMultiLines(),
    new InputValidator({minArgs: 1, maxArgs: 1})
)`,
    "usermod": `\
return new Command(
    (input, streams) => {
        let user = josh.userList.get(input.args[0]);
        if (user === undefined) {
            streams.err.writeLine(\`usermod: Could not modify non-existent user '\${input.args[0]}'.\`);
            return -1;
        }

        try {
            if (input.hasAnyOption("-p", "--password")) {
                const password = input.options["-p"] || input.options["--password"];
                user.passwordHash = HashProvider.default.hashPassword(password);
            }
            if (input.hasAnyOption("-h", "--home"))
                user.home = input.options["-h"] || input.options["--home"];
            if (input.hasAnyOption("-d", "--description"))
                user.description = input.options["-d"] || input.options["--description"];
        } catch (error) {
            streams.err.writeLine(\`usermod: \${error.message}\`);
            return -1;
        }

        if (!josh.userList.modify(user)) {
            streams.err.writeLine(\`usermod: Unexpectedly failed to modify user '\${input.args[0]}'.\`);
            return -1;
        }

        streams.out.writeLine(\`usermod: Modified user '\${input.args[0]}'.\`);
        return 0;
    },
    \'modify user\',
    \`usermod ${n}
        [<b>-p</b>/<b>--password</b>=<u>password</u>] ${n}
        [<b>-h</b>/<b>--home</b>=<u>home</u>] ${n}
        [<b>-d</b>/<b>--description</b>=<u>description</u>] ${n}
        <u>name</u>\`.trimMultiLines(),
    \`Modifies the user with the given <u>name</u>. See the "useradd" command for more information on the fields ${n}
    that can be modified.\`.trimMultiLines(),
    new InputValidator({minArgs: 1, maxArgs: 1})
)`,
    "whoami": `\
return new Command(
    (input, streams) => {
        const user = josh.userList.get(josh.environment.get("user"));
        if (user === undefined) {
            streams.err.writeLine("whoami: Cannot execute while not logged in.");
            return -1;
        }

        streams.out.writeLine(user.description);
        return 0;
    },
    \`print short description of user\`,
    \`whoami\`,
    \`Print a description of the user associated with the current effective user ID.\`,
    new InputValidator({maxArgs: 0})
)`,
};
