import {Commands} from "./Commands";
import {Environment} from "./Environment";
import {Directory, FileSystem, Path} from "./FileSystem";
import {InputHistory} from "./InputHistory";
import {Globber, InputParser} from "./InputParser";
import {Persistence} from "./Persistence";
import {asciiHeaderHtml, IllegalStateError, isStandalone} from "./Shared";
import {EscapeCharacters} from "./Terminal";
import {UserList} from "./UserList";
import {OutputStream, StreamSet} from "./Stream";
import {InputArgs} from "./InputArgs";


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

        const target = isStandalone() ? `target="_blank"` : "";
        return `${asciiHeaderHtml}

               Student MSc Computer Science <span class="smallScreenOnly">
               </span>@ <a href="https://www.tudelft.nl/en/" ${target}>TU Delft</a>, the Netherlands
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
    execute(streams: StreamSet): void {
        const inputString = streams.ins.readLine().replace("\n", "");

        if (this.environment.get("user") === "") {
            if (this.attemptUser === undefined) {
                if (inputString.trim() !== "") {
                    streams.out.write(EscapeCharacters.Escape + EscapeCharacters.HideInput);

                    this.attemptUser = inputString.trim();
                }
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
            return;
        }

        this.inputHistory.add(inputString);

        let inputs;
        try {
            inputs = InputParser.create(this.environment, this.fileSystem).parseCommands(inputString);
        } catch (error) {
            streams.err.writeLine(`Could not parse input: ${error.message}`);
            this.environment.set("status", "-1");
            return;
        }

        inputs.forEach(input => {
            try {
                streams.out = this.toStream(input.redirectTargets[1]) ?? streams.out;
                streams.err = this.toStream(input.redirectTargets[2]) ?? streams.err;
            } catch (error) {
                streams.err.writeLine(`Error while redirecting output:\n${error.message}`);
                this.environment.set("status", "-1");
                return;
            }

            const output = this.commands.execute(input, streams);
            this.environment.set("status", "" + output);

            if (this.environment.get("user") === "") {
                this.inputHistory.clear();
                this.environment.clear();
                this.environment.set("user", "");
            }
            this.saveState();
        });
    }

    /**
     * Tries to auto-complete the given parameter.
     *
     * @param parameter the parameter to complete
     * @return the suggestions for the given parameter
     */
    autoComplete(parameter: string): string[] {
        const cwd = this.environment.get("cwd");
        return new Globber(this.fileSystem, cwd)
            .glob(parameter + InputParser.EscapeChar + "*")
            .map((it) => this.fileSystem.get(Path.interpret(cwd, it)) instanceof Directory ? it + "/" : it);
    }


    /**
     * Persists the shell's state.
     *
     * @see Persistence
     */
    private saveState() {
        Persistence.setHistory(this.inputHistory);
        Persistence.setEnvironment(this.environment);
        Persistence.setFileSystem(this.fileSystem);
    }

    /**
     * Converts a redirect target to an output stream, or `undefined` if the default stream is used.
     *
     * @param target the target to convert
     * @throws if the stream could not be opened
     */
    private toStream(target: InputArgs.RedirectTarget | undefined): OutputStream | undefined {
        if (target === undefined)
            return undefined;

        if (target.target === undefined)
            throw new IllegalStateError("Redirect target's target is undefined.");

        return this.fileSystem.open(Path.interpret(this.environment.get("cwd"), target.target), target.type);
    }
}
