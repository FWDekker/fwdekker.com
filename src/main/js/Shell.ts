import {Commands} from "./Commands";
import {Environment} from "./Environment";
import {Directory, FileSystem, Path} from "./FileSystem";
import {InputParser} from "./InputParser";
import {Persistence} from "./Persistence";
import {asciiHeaderHtml, IllegalStateError} from "./Shared";
import {EscapeCharacters, InputHistory} from "./Terminal";
import {UserList} from "./UserList";
import {StreamSet} from "./Stream";


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
     * Processes a user's input and returns the associated exit code.
     *
     * @param streams the standard streams
     */
    execute(streams: StreamSet): number {
        const inputString = streams.ins.readLine().replace("\n", "");

        if (this.environment.get("user") === "") {
            if (this.attemptUser === undefined) {
                streams.out.write(EscapeCharacters.Escape + EscapeCharacters.HideInput);

                this.attemptUser = inputString.trim() ?? undefined; // Leave at undefined if empty string
            } else {
                streams.out.write(EscapeCharacters.Escape + EscapeCharacters.ShowInput);

                const attemptUser = this.userList.get(this.attemptUser);
                if (attemptUser !== undefined && attemptUser.password === inputString) {
                    this.environment.set("user", attemptUser.name);
                    this.environment.set("home", attemptUser.home);
                    this.environment.set("cwd", attemptUser.home);
                    this.environment.set("status", "0");
                    streams.out.writeLine(this.generateHeader());
                } else {
                    streams.out.writeLine("Access denied");
                }

                this.attemptUser = undefined;
            }
            this.saveState();
            return 0;
        }

        this.inputHistory.addEntry(inputString);

        let input;
        try {
            input = InputParser.create(this.environment, this.fileSystem).parse(inputString);
        } catch (error) {
            streams.err.writeLine(`Could not parse input: ${error.message}`);
            this.environment.set("status", "-1");
            return -1;
        }

        if (input.redirectTarget.type !== "default") {
            if (input.redirectTarget.target === undefined)
                throw new IllegalStateError("Redirect target's target is undefined.");

            try {
                const target = Path.interpret(this.environment.get("cwd"), input.redirectTarget.target);
                streams.out = this.fileSystem.open(target, input.redirectTarget.type);
            } catch (error) {
                streams.err.writeLine(`Error while redirecting output:\n${error.message}`);
                this.environment.set("status", "-1");
                return -1;
            }
        }

        const output = this.commands.execute(input, streams);
        this.environment.set("status", "" + output);

        if (this.environment.get("user") === "") {
            this.inputHistory.clear();
            this.environment.clear();
            this.environment.set("user", "");
        }
        this.saveState();

        return output;
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
    export type RedirectTarget = { type: "default" | "write" | "append", target?: string };
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
        this._options = Object.assign({}, options);
        this._args = args.slice();
        this.redirectTarget = Object.assign({}, redirectTarget);
    }


    /**
     * Returns a copy of the options the user has given.
     */
    get options(): InputArgs.Options {
        return Object.assign({}, this._options);
    }

    /**
     * Returns `true` if and only if at least one of the options with the given keys has been set.
     *
     * @param keys the keys to check
     */
    hasAnyOption(...keys: string[]): boolean {
        for (let i = 0; i < keys.length; i++)
            if (this._options.hasOwnProperty(keys[i]))
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
     * Returns the number of arguments.
     */
    get argc(): number {
        return this.args.length;
    }
}
