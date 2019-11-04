import * as Cookies from "js-cookie";
import {Commands} from "./Commands";
import {Directory, File, FileSystem, Node} from "./FileSystem";
import {asciiHeaderHtml, IllegalStateError, stripHtmlTags} from "./Shared";
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
                parts.push(this.fileSystem.getNode(path).nameString(path.fileName, path));
                path = path.parent;
            }
            const link = this.fileSystem.getNode(path).nameString("/", path) + parts.reverse().join("/");

            return `${this.userSession.currentUser.name}@fwdekker.com <span class="prefixPath">${link}</span>&gt; `;
        }
    }


    /**
     * Processes a user's input.
     *
     * @param inputString the input to process
     */
    execute(inputString: string): string    {
        if (!this.userSession.isLoggedIn) {
            if (this.attemptUser === undefined) {
                this.attemptUser = inputString.trim();

                this.saveState();
                return EscapeCharacters.Escape + EscapeCharacters.HideInput;
            } else {
                const isLoggedIn = this.userSession.tryLogIn(this.attemptUser, inputString);
                this.attemptUser = undefined;

                this.saveState();
                return EscapeCharacters.Escape + EscapeCharacters.ShowInput
                    + (isLoggedIn ? this.generateHeader() : "Access denied\n");
            }
        }

        this.inputHistory.addEntry(inputString.trim());

        const input = new InputParser().parse(stripHtmlTags(inputString));
        if (input.redirectTarget[0] === "write") {
            const rms = this.fileSystem.rms([input.redirectTarget[1]], true);
            if (rms !== "")
                return rms;
        }

        let output = this.commands.execute(input);
        if (input.redirectTarget[0] !== "default")
            output = this.writeToFile(input.redirectTarget[1], output, input.redirectTarget[0] === "append");

        if (!this.userSession.isLoggedIn) {
            this.inputHistory.clear();
            this.fileSystem.cwd = "/";
        }
        this.saveState();

        return input.redirectTarget[0] === "default" ? output : "";
    }

    /**
     * Writes or appends `data` to `file`.
     *
     * @param file the file to write or append to
     * @param data the data to write or append
     * @param append `true` if and only if the data should be appended
     * @return an empty string if the writing or appending was successful, or a message explaining what went wrong
     */
    private writeToFile(file: string, data: string, append: boolean): string {
        const touch = this.fileSystem.createFiles([file]);
        if (touch !== "")
            return touch;

        const target = this.fileSystem.getNode(file);
        if (!(target instanceof File))
            throw new Error("File unexpectedly disappeared since last check.");

        if (append)
            target.contents += data;
        else
            target.contents = data;

        return "";
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


/**
 * The options given to a command.
 */
export type InputOptions = { [key: string]: string | null };

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
    private readonly _options: InputOptions;
    /**
     * The remaining non-option arguments that the user has given.
     */
    private readonly _args: string[];
    /**
     * The target of the output stream.
     */
    readonly redirectTarget: RedirectTarget;


    /**
     * Constructs a new set of parsed command-line arguments.
     *
     * @param command the name of the command, i.e. the first token in the input string
     * @param options the set of options and the corresponding values that the user has given
     * @param args the remaining non-option arguments that the user has given
     * @param redirectTarget the target of the output stream
     */
    constructor(command: string, options: InputOptions, args: string[], redirectTarget: RedirectTarget) {
        this.command = command;
        this._options = options;
        this._args = args;
        this.redirectTarget = redirectTarget;
    }


    /**
     * Returns a copy of the options the user has given.
     *
     * @return a copy of the options the user has given
     */
    get options(): InputOptions {
        return Object.assign({}, this._options);
    }

    /**
     * Returns `true` if and only if the option with the given key has been set.
     *
     * @param key the key to check
     * @return `true` if and only if the option with the given key has been set
     */
    hasOption(key: string): boolean {
        return this._options.hasOwnProperty(key);
    }

    /**
     * Returns `true` if and only if at least one of the options with the given keys has been set.
     *
     * @param keys the keys to check
     * @return `true` if and only if at least one of the options with the given keys has been set
     */
    hasAnyOption(keys: string[]): boolean {
        for (let i = 0; i < keys.length; i++)
            if (this.hasOption(keys[i]))
                return true;

        return false;
    }


    /**
     * Returns a copy of the arguments the user has given.
     *
     * @return a copy of the arguments the user has given
     */
    get args(): string[] {
        return this._args.slice();
    }

    /**
     * Returns `true` if and only if there is an argument at the given index.
     *
     * @param index the index to check
     * @return `true` if and only if there is an argument at the given index
     */
    hasArg(index: number): boolean {
        return this._args[index] !== undefined;
    }
}

/**
 * A parser for input strings.
 */
export class InputParser {
    /**
     * Parses the given input string to a set of command-line arguments.
     *
     * @param input the string to parse
     * @return the set of parsed command-line arguments
     */
    parse(input: string): InputArgs {
        const tokens = this.tokenize(input);
        const command = tokens[0] || "";
        const [options, args] =
            this.parseOpts(
                tokens.slice(1)
                    .filter(it => !it.startsWith(">"))
                    .map(it => it.replace(/\\>/, ">"))
            );
        const redirectTarget = this.getRedirectTarget(tokens.slice(1));

        return new InputArgs(command, options, args, redirectTarget);
    }


    /**
     * Returns the first token present in the given string.
     *
     * @param input the string of which to return the first token
     * @return the first token present in the given string
     */
    private getNextToken(input: string): [string, string] {
        let token = "";
        let isInSingleQuotes = false;
        let isInDoubleQuotes = false;
        for (let i = 0; i < input.length; i++) {
            const char = input[i];
            switch (char) {
                case "\\":
                    if (i === input.length - 1)
                        throw new Error("Unexpected end of input. `\\` was used but there was nothing to escape.");

                    const nextChar = input[i + 1];
                    switch (nextChar) {
                        case "\\":
                            token += "\\";
                            break;
                        case "/":
                            if (isInSingleQuotes || isInDoubleQuotes)
                                token += "\\/";
                            else
                                token += "/";
                            break;
                        case "'":
                            token += "'";
                            break;
                        case "\"":
                            token += "\"";
                            break;
                        case " ":
                            token += " ";
                            break;
                        case ">":
                            token += "\\>";
                            break;
                        default:
                            token += "\\" + nextChar;
                            break;
                    }
                    i++;
                    break;
                case "'":
                    if (isInDoubleQuotes)
                        token += "'";
                    else
                        isInSingleQuotes = !isInSingleQuotes;
                    break;
                case "\"":
                    if (isInSingleQuotes)
                        token += "\"";
                    else
                        isInDoubleQuotes = !isInDoubleQuotes;
                    break;
                case " ":
                    if (isInSingleQuotes || isInDoubleQuotes)
                        token += char;
                    else if (token !== "")
                        return [token, input.slice(i + 1)];
                    break;
                case ">":
                    if (!isInSingleQuotes && !isInDoubleQuotes) {
                        if (token !== "")
                            return [token, input.slice(i)];

                        if (i !== input.length - 1 && input[i + 1] === ">") {
                            const token = this.getNextToken(input.slice(i + 2));
                            token[0] = ">>" + token[0];
                            return token;
                        } else {
                            const token = this.getNextToken(input.slice(i + 1));
                            token[0] = ">" + token[0];
                            return token;
                        }
                    } else {
                        token += "\\" + char;
                    }
                    break;
                default:
                    token += char;
                    break;
            }
        }

        if (isInSingleQuotes || isInDoubleQuotes)
            throw new Error("Unexpected end of input. Missing closing quotation mark.");

        return [token, ""];
    }

    /**
     * Tokenizes the input string.
     *
     * @param input the string to tokenize
     * @return the array of tokens found in the input string
     */
    private tokenize(input: string): string[] {
        const tokens = [];

        while (input !== "") {
            let token;
            [token, input] = this.getNextToken(input);
            tokens.push(token);
        }

        return tokens;
    }

    /**
     * Returns the redirect target described by the last token that describes a redirect target, or the default redirect
     * target if no token describes a redirect target.
     *
     * @param tokens an array of tokens of which some tokens may describe a redirect target
     * @return the redirect target described by the last token that describes a redirect target, or the default redirect
     * target if no token describes a redirect target
     */
    private getRedirectTarget(tokens: string[]): ["default"] | ["write" | "append", string] {
        let redirectTarget: ["default"] | ["write" | "append", string] = ["default"];

        tokens.forEach(token => {
            if (token.startsWith(">>"))
                redirectTarget = ["append", token.slice(2)];
            else if (token.startsWith(">"))
                redirectTarget = ["write", token.slice(1)];
        });

        return redirectTarget;
    }

    /**
     * Parses options and arguments.
     *
     * @param tokens the tokens that form the options and arguments
     * @return the options and arguments as `[options, arguments]`
     */
    private parseOpts(tokens: string[]): [{ [key: string]: string | null }, string[]] {
        const options: { [key: string]: string | null } = {};

        let i;
        for (i = 0; i < tokens.length; i++) {
            const arg = tokens[i];

            if (!arg.startsWith("-") || arg === "--")
                break;

            const argsParts = arg.split(/=(.*)/, 2);
            if (argsParts.length === 0 || argsParts.length > 2)
                throw new Error("Unexpected number of parts.");
            if (argsParts[0].indexOf(' ') >= 0)
                break;

            const value = argsParts.length === 1 ? null : argsParts[1];

            if (argsParts[0].startsWith("--")) {
                const key = argsParts[0].substr(2);
                if (key === "")
                    break;

                options[key] = value;
            } else {
                const keys = argsParts[0].substr(1);
                if (keys === "")
                    break;

                if (keys.length === 1) {
                    options[keys] = value;
                } else {
                    if (value !== null)
                        throw new Error("Cannot assign value to multiple short options.");

                    for (const key of keys)
                        options[key] = value;
                }
            }
        }

        return [options, tokens.slice(i)];
    }
}
