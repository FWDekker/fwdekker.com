import * as Cookies from "js-cookie";
import {Commands} from "./Commands";
import {Directory, FileSystem, Node} from "./FileSystem";
import {asciiHeaderHtml, IllegalStateError} from "./Shared";
import {EscapeCharacters, InputHistory} from "./Terminal";
import {UserSession} from "./UserSession";


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

        // Read user from cookie
        const user = Cookies.get("user");
        if (user === "")
            this.userSession = new UserSession();
        else if (user === undefined || !UserSession.userExists(user))
            this.userSession = new UserSession("felix");
        else
            this.userSession = new UserSession(user);

        // Read files from cookie
        let files: Directory | undefined = undefined;
        const filesJson = Cookies.get("files");
        if (filesJson !== undefined) {
            try {
                const parsedFiles = Node.deserialize(filesJson);
                if (parsedFiles instanceof Directory)
                    files = parsedFiles;
                else
                    console.warn("`files` cookie contains non-directory.");
            } catch (error) {
                console.warn("Failed to deserialize `files` cookie.", error);
            }
        }
        this.fileSystem = new FileSystem(files);

        // Read cwd from cookie
        const cwd = Cookies.get("cwd");
        if (cwd !== undefined) {
            if (this.fileSystem.getNode(cwd) !== undefined)
                this.fileSystem.cwd = cwd;
            else
                console.warn("Failed to set cwd from cookie.");
        }

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
            Type "<a href="#" onclick="execute('help');">help</a>" for help.

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
                throw new IllegalStateError("User is logged in as undefined.");

            let path = this.fileSystem.getPathTo("");
            const parts = [];
            while (path.toString() !== "/") {
                parts.push(`<a href="#" class="prefixPath" onclick="execute('cd &quot;${path}&quot;')">`
                    + `${path.fileName}</a>`);
                path = path.parent;
            }
            const link = `<a href="#" class="prefixPath" onclick="execute('cd &quot;/&quot;')">/</a>`
                + parts.reverse().join("/");

            return `${this.userSession.currentUser.name}@fwdekker.com <span class="prefixPath">${link}</span>&gt; `;
        }
    }

    /**
     * Processes a user's input.
     *
     * @param input the input to process
     */
    execute(input: string): string {
        if (!this.userSession.isLoggedIn) {
            if (this.attemptUser === undefined) {
                this.attemptUser = input.trim();

                this.saveState();
                return EscapeCharacters.Escape + EscapeCharacters.HideInput;
            } else {
                const isLoggedIn = this.userSession.tryLogIn(this.attemptUser, input);
                this.attemptUser = undefined;

                this.saveState();
                return EscapeCharacters.Escape + EscapeCharacters.ShowInput
                    + (isLoggedIn ? this.generateHeader() : "Access denied\n");
            }
        }

        const output = this.commands.execute(input.trim());
        this.inputHistory.addEntry(input.trim());

        if (!this.userSession.isLoggedIn) {
            this.inputHistory.clear();
            this.fileSystem.cwd = "/";
        }

        this.saveState();
        return output;
    }


    /**
     * Saves the shell's state in cookies.
     */
    private saveState() {
        Cookies.set("files", this.fileSystem.serializedRoot, {
            "expires": new Date(new Date().setFullYear(new Date().getFullYear() + 25)),
            "path": "/"
        });
        Cookies.set("cwd", this.fileSystem.cwd, {"path": "/"});

        const user = this.userSession.currentUser;
        Cookies.set("user", user === undefined ? "" : user.name, {"path": "/"});
    }
}
