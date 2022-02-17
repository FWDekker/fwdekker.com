import {Commands, ExitCode} from "./Commands";
import {Environment} from "./Environment";
import {Directory, FileSystem, Path} from "./FileSystem";
import {InputArgs} from "./InputArgs";
import {InputHistory} from "./InputHistory";
import {Globber, InputParser} from "./InputParser";
import {Persistence} from "./Persistence";
import {asciiHeaderHtml, ExpectedGoodbyeError, IllegalStateError, isStandalone} from "./Shared";
import {OutputStream, StreamSet} from "./Stream";
import {EscapeCharacters} from "./Terminal";
import {UserList} from "./UserList";


/**
 * A shell that interacts with the environment, user list, file system to execute commands.
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
     * The user list describing the available users.
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
        this.fileSystem = Persistence.getFileSystem();
        this.userList = new UserList(this.fileSystem);
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

               PhD student Computer Science <span class="smallScreenOnly">
               </span>@ <a href="https://www.tudelft.nl/en/" ${target}>TU Delft</a>, the Netherlands
               <span class="wideScreenOnly">${(new Date()).toISOString()}
               </span>
               Type "<a onclick="execute('help');">help</a>" for help.

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

        const status = this.environment.get("status");
        const statusString = status === "0" ? "" : ` <span class="errorMessage">[${status}]</span>`;

        return `${userName}@fwdekker.com <span class="prefixPath">${rootText}${partText}</span>${statusString}&gt; `;
    }


    /**
     * Processes a user's input and returns the associated exit code.
     *
     * @param streams the standard streams
     */
    execute(streams: StreamSet): void {
        const inputString = streams.ins.readLine().replace("\n", "");
        if (inputString === "factory-reset") {
            Persistence.reset();
            location.reload();
            throw new ExpectedGoodbyeError("Goodbye");
        }

        if (this.environment.get("user") === "") {
            if (this.attemptUser === undefined) {
                if (inputString.trim() !== "") {
                    streams.out.write(EscapeCharacters.Escape + EscapeCharacters.HideInput);

                    this.attemptUser = inputString.trim();
                }
            } else {
                streams.out.write(EscapeCharacters.Escape + EscapeCharacters.ShowInput);

                const attemptUser = this.userList.get(this.attemptUser);
                if (attemptUser !== undefined && attemptUser.hasPassword(inputString)) {
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
            if (!(error instanceof Error))
                throw Error(`Error while processing parsing error:\n${error}`);

            streams.err.writeLine(`Could not parse input: ${error.message}`);
            this.environment.set("status", "" + ExitCode.USAGE);
            return;
        }

        inputs.forEach(input => {
            const status = this.commands.execute(input, streams);
            this.environment.set("status", "" + status);

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
}
