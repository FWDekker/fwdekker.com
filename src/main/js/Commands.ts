import "./Extensions";
import {Environment} from "./Environment";
import {Directory, File, FileSystem, Node, Path,} from "./FileSystem";
import {InputArgs} from "./InputArgs";
import {InputParser} from "./InputParser";
import {Persistence} from "./Persistence";
import {ExpectedGoodbyeError, IllegalArgumentError, IllegalStateError, isStandalone} from "./Shared";
import {StreamSet} from "./Stream";
import {EscapeCharacters} from "./Terminal";
import {UserList} from "./UserList";


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
        if (input.command === "factory-reset") {
            Persistence.reset();
            location.reload(true);
            throw new ExpectedGoodbyeError("Goodbye");
        }
        if (input.command === "")
            return 0;

        const command = this.resolve(input.command);
        if (command === undefined || command instanceof DocOnlyCommand) {
            streams.err.writeLine(`Unknown command '${input.command}'.`);
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
     * @return the command addressed by the given name or path, or `undefined` if no such command could be found
     */
    private resolve(commandName: string): Command | undefined {
        const cwd = this.environment.get("cwd");

        let script: Node | undefined;
        if (commandName.includes("/")) {
            script = this.fileSystem.get(Path.interpret(cwd, commandName));
        } else {
            script = this.fileSystem.get(Path.interpret(cwd, "/bin", commandName));
        }
        if (!(script instanceof File)) {
            // TODO: Show error
            return undefined;
        }

        const code = script.open("read").read();
        try {
            return this.interpretScript(code, this.environment, this.userList, this.fileSystem);
        } catch (e) {
            console.error(`Failed to interpret script '${commandName}'.`, code, e);
            return undefined;
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
        const __JOSH_Directory = Directory;
        const __JOSH_EscapeCharacters = EscapeCharacters;
        const __JOSH_File = File;
        const __JOSH_Path = Path;
        const __JOSH_InputParser = InputParser;
        const __JOSH_InputValidator = InputValidator;
        const __JOSH_Persistence = Persistence;
        {
            // noinspection JSUnusedLocalSymbols
            const josh = {
                "environment": environment,
                "fileSystem": fileSystem,
                "interpreter": this,
                "userList": userList,
                "util": {
                    "isStandalone": isStandalone
                }
            };

            // noinspection JSUnusedLocalSymbols
            const Directory = __JOSH_Directory;
            // noinspection JSUnusedLocalSymbols
            const EscapeCharacters = __JOSH_EscapeCharacters;
            // noinspection JSUnusedLocalSymbols
            const File = __JOSH_File;
            // noinspection JSUnusedLocalSymbols
            const InputParser = __JOSH_InputParser;
            // noinspection JSUnusedLocalSymbols
            const InputValidator = __JOSH_InputValidator;
            // noinspection JSUnusedLocalSymbols
            const Path = __JOSH_Path;
            // noinspection JSUnusedLocalSymbols
            const Persistence = __JOSH_Persistence;
            return eval(code);
        }
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
        return `Invalid usage of ${commandName}. ${errorMessage ?? ""}

               <b>Usage</b>
               ${command.usage}`.trimLines();
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
