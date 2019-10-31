import {Commands} from "./commands.js";
import {FileSystem} from "./fs.js";
import {asciiHeaderHtml} from "./shared.js";
import {InputHistory, OutputAction} from "./terminal.js";
import {UserSession} from "./user-session.js";


/**
 * A shell that interacts with the user session and file system to execute commands.
 */
export class Shell {
    /**
     * The history of the user's inputs.
     */
    private readonly inputHistory: InputHistory;
    /**
     * The user session describing the user that interacts with the terminal.
     */
    private readonly userSession: UserSession;
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

        // @ts-ignore
        const user = Cookies.get("user");
        if (user === undefined)
            this.userSession = new UserSession("felix");
        else if (user === "")
            this.userSession = new UserSession();
        else
            this.userSession = new UserSession(user);

        // @ts-ignore
        this.fileSystem = new FileSystem(Cookies.get("files"), Cookies.get("cwd"));
        this.commands = new Commands(this.userSession, this.fileSystem);
    }


    /**
     * Generates the header that is displayed when a user logs in.
     *
     * @return the header that is displayed when a user logs in
     */
    generateHeader(): string {
        if (!this.userSession.isLoggedIn)
            return "";

        return "" +
            `${asciiHeaderHtml}

            Student MSc Computer Science <span class="smallScreenOnly">
            </span>@ <a href="https://www.tudelft.nl/en/">TU Delft</a>, the Netherlands
            <span class="wideScreenOnly">${(new Date()).toISOString()}
            </span>
            Type "<a href="#" onclick="run('help');">help</a>" for help.

            `.trimLines();
    }

    /**
     * Generates the prefix based on the current state of the terminal.
     *
     * @return  the prefix based on the current state of the terminal
     */
    generatePrefix(): string {
        if (!this.userSession.isLoggedIn) {
            if (this.attemptUser === undefined)
                return "login as: ";
            else
                return `Password for ${this.attemptUser}@fwdekker.com: `;
        } else {
            if (this.userSession.currentUser === undefined)
                throw "User is logged in as undefined.";

            return `${this.userSession.currentUser.name}@fwdekker.com <span style="color: green;">${this.fileSystem.cwd}</span>&gt; `;
        }
    }

    /**
     * Processes a user's input.
     *
     * @param input the input to process
     */
    run(input: string): OutputAction[] {
        if (!this.userSession.isLoggedIn) {
            if (this.attemptUser === undefined) {
                this.attemptUser = input.trim();

                this.saveState();
                return [["hide-input", true]];
            } else {
                const isLoggedIn = this.userSession.tryLogIn(this.attemptUser, input);
                this.attemptUser = undefined;

                this.saveState();
                return [
                    ["hide-input", false],
                    ["append", isLoggedIn ? this.generateHeader() : "Access denied\n"]
                ];
            }
        }

        const output = this.commands.execute(input.trim());
        this.inputHistory.addEntry(input.trim());

        if (!this.userSession.isLoggedIn) {
            this.inputHistory.clear();
            this.fileSystem.cwd = "/";
        }

        this.saveState();
        return [output];
    }


    /**
     * Saves the shell's state in cookies.
     */
    private saveState() {
        // @ts-ignore
        Cookies.set("files", this.fileSystem.serializedRoot, {
            "expires": new Date(new Date().setFullYear(new Date().getFullYear() + 25)),
            "path": "/"
        });
        // @ts-ignore
        Cookies.set("cwd", this.fileSystem.cwd, {"path": "/"});

        const user = this.userSession.currentUser;
        // @ts-ignore
        Cookies.set("user", user === undefined ? "" : user.name, {"path": "/"});
    }
}
