import {Commands} from "./Commands";
import {Environment} from "./Environment";
import {Directory, File, FileSystem, Path} from "./FileSystem";
import {InputParser} from "./InputParser";
import {Persistence} from "./Persistence";
import {asciiHeaderHtml, IllegalStateError, stripHtmlTags} from "./Shared";
import {EscapeCharacters, InputHistory} from "./Terminal";
import {UserList} from "./UserList";


/**
 * A shell that interacts with the user session and file system to execute commands.
 */
export class Shell {
    /**
     * The environment in which commands are executed.
     */
    private readonly environment: Environment;
    /**
     * The history of the user's inputs.
     */
    private readonly inputHistory: InputHistory;
    /**
     * The user session describing the user that interacts with the shell.
     */
    private readonly userList: UserList;
    /**
     * The file system.
     */
    private readonly fileSystem: FileSystem;
    /**
     * The set of commands that can be executed.
     */
    private readonly commands: Commands;

    /**
     * The name of the user that the user is currently trying to log in as, or `undefined` if the user is not currently
     * trying to log in.
     */
    private attemptUser: string | undefined;


    /**
     * Constructs a new shell.
     *
     * @param inputHistory the history of inputs
     */
    constructor(inputHistory: InputHistory) {
        this.inputHistory = inputHistory;
        this.userList = new UserList();
        this.fileSystem = Persistence.getFileSystem();
        this.environment = Persistence.getEnvironment(this.userList);
        this.commands = new Commands(this.environment, this.userList, this.fileSystem);

        this.saveState();
    }


    /**
     * Returns the header that is displayed when a user logs in.
     */
    generateHeader(): string {
        if (this.environment.get("user") === "")
            return "";

        return `${asciiHeaderHtml}

               Student MSc Computer Science <span class="smallScreenOnly">
               </span>@ <a href="https://www.tudelft.nl/en/">TU Delft</a>, the Netherlands
               <span class="wideScreenOnly">${(new Date()).toISOString()}
               </span>
               Type "<a href="#" onclick="execute('help');">help</a>" for help.

               Welcome to josh v%%VERSION_NUMBER%%, the javascript online shell.
               `.trimLines();
    }

    /**
     * Returns the prefix based on the current state of the terminal.
     */
    generatePrefix(): string {
        const userName = this.environment.get("user");
        if (userName === "") {
            return this.attemptUser === undefined
                ? "login as: "
                : `Password for ${this.attemptUser}@fwdekker.com: `;
        }

        const cwd = new Path(this.environment.get("cwd"));
        const home = new Path(this.environment.get("home"));

        let anchorPath: Path;
        let anchorSymbol: string;
        if (home.isAncestorOf(cwd) || home.toString() === cwd.toString()) {
            anchorPath = home;
            anchorSymbol = "~";
        } else {
            anchorPath = new Path("/");
            anchorSymbol = "/";
        }

        const parts = cwd.getAncestorsUntil(anchorPath).reverse().concat(cwd).slice(1);
        const rootText = (new Directory().nameString(anchorSymbol, anchorPath))
            + (parts.length !== 0 && !anchorSymbol.endsWith("/") ? "/" : "");
        const partText = parts
            .map(part => new Directory().nameString(part.fileName, part))
            .join("/");

        return `${userName}@fwdekker.com <span class="prefixPath">${rootText}${partText}</span>&gt; `;
    }


    /**
     * Processes a user's input.
     *
     * @param inputString the input to process
     */
    execute(inputString: string): string {
        if (this.environment.get("user") === "") {
            if (this.attemptUser === undefined) {
                this.attemptUser = inputString.trim() ?? undefined; // Set to undefined if empty string

                this.saveState();
                return EscapeCharacters.Escape + EscapeCharacters.HideInput;
            } else {
                const attemptUser = this.userList.get(this.attemptUser);

                let resultString: string;
                if (attemptUser !== undefined && attemptUser.password === inputString) {
                    this.environment.set("user", attemptUser.name);
                    this.environment.set("home", attemptUser.home);
                    this.environment.set("cwd", attemptUser.home);
                    resultString = this.generateHeader();
                } else {
                    resultString = "Access denied\n";
                }

                this.attemptUser = undefined;
                this.saveState();
                return EscapeCharacters.Escape + EscapeCharacters.ShowInput + resultString;
            }
        }

        this.inputHistory.addEntry(inputString.trim());

        const parser = InputParser.create(this.environment, this.fileSystem);
        let input;
        try {
            input = parser.parse(stripHtmlTags(inputString));
        } catch (error) {
            return error.message;
        }
        if (input.redirectTarget[0] === "write") {
            try {
                const path = Path.interpret(this.environment.get("cwd"), input.redirectTarget[1]);
                if (this.fileSystem.get(path) instanceof Directory)
                    return `Error while redirecting: '${path}' is a directory.`;
                this.fileSystem.remove(path);
            } catch (error) {
                return error.message;
            }
        }

        let output = this.commands.execute(input);
        if (input.redirectTarget[0] !== "default") {
            const path = Path.interpret(this.environment.get("cwd"), input.redirectTarget[1]);
            output = this.writeToFile(path, output, input.redirectTarget[0] === "append");
        }

        if (this.environment.get("user") === "") {
            this.inputHistory.clear();
            this.environment.clear();
            this.environment.set("user", "");
        }
        this.saveState();

        return output;
    }

    /**
     * Writes or appends `data` to `file`.
     *
     * @param path the path of the file to write or append to
     * @param data the data to write or append
     * @param append `true` if and only if the data should be appended
     */
    private writeToFile(path: Path, data: string, append: boolean): string {
        try {
            if (!this.fileSystem.has(path))
                this.fileSystem.add(path, new File(), true);
        } catch (error) {
            return error.message;
        }

        const target = this.fileSystem.get(path);
        if (!(target instanceof File))
            throw new IllegalStateError("File unexpectedly disappeared since last check.");

        if (append)
            target.contents += data;
        else
            target.contents = data;

        return "";
    }


    /**
     * Persists the shell's state.
     *
     * @see Persistence
     */
    private saveState() {
        Persistence.setFileSystem(this.fileSystem);
        Persistence.setEnvironment(this.environment);
    }
}


export module InputArgs {
    /**
     * The options given to a command.
     */
    export type Options = { [key: string]: string | null };

    /**
     * The intended target of the output of a command.
     *
     * <ul>
     *     <li>`default` means that the output should be written to the standard output</li>
     *     <li>`write` means that the output should be written to the file in the given string</li>
     *     <li>`append` means that the output should be appended to the file in the given string</li>
     * </ul>
     */
    export type RedirectTarget = ["default"] | ["write" | "append", string];
}

/**
 * A set of parsed command-line arguments.
 */
export class InputArgs {
    /**
     * The name of the command, i.e. the first token in the input string.
     */
    readonly command: string;
    /**
     * The set of options and the corresponding values that the user has given.
     */
    private readonly _options: InputArgs.Options;
    /**
     * The remaining non-option arguments that the user has given.
     */
    private readonly _args: string[];
    /**
     * The target of the output stream.
     */
    readonly redirectTarget: InputArgs.RedirectTarget;


    /**
     * Constructs a new set of parsed command-line arguments.
     *
     * @param command the name of the command, i.e. the first token in the input string
     * @param options the set of options and the corresponding values that the user has given
     * @param args the remaining non-option arguments that the user has given
     * @param redirectTarget the target of the output stream
     */
    constructor(command: string, options: InputArgs.Options, args: string[], redirectTarget: InputArgs.RedirectTarget) {
        this.command = command;
        this._options = options;
        this._args = args;
        this.redirectTarget = redirectTarget;
    }


    /**
     * Returns a copy of the options the user has given.
     */
    get options(): InputArgs.Options {
        return Object.assign({}, this._options);
    }

    /**
     * Returns `true` if and only if the option with the given key has been set.
     *
     * @param key the key to check
     */
    hasOption(key: string): boolean {
        return this._options.hasOwnProperty(key);
    }

    /**
     * Returns `true` if and only if at least one of the options with the given keys has been set.
     *
     * @param keys the keys to check
     */
    hasAnyOption(keys: string[]): boolean {
        for (let i = 0; i < keys.length; i++)
            if (this.hasOption(keys[i]))
                return true;

        return false;
    }


    /**
     * Returns a copy of the arguments the user has given.
     */
    get args(): string[] {
        return this._args.slice();
    }

    /**
     * Returns `true` if and only if there is an argument at the given index.
     *
     * @param index the index to check
     */
    hasArg(index: number): boolean {
        return this._args[index] !== undefined;
    }
}
