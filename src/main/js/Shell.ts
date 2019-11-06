import * as Cookies from "js-cookie";
import {Commands} from "./Commands";
import {Environment} from "./Environment";
import {Directory, File, FileSystem, Node, Path} from "./FileSystem";
import {asciiHeaderHtml, IllegalArgumentError, IllegalStateError, stripHtmlTags} from "./Shared";
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
        this.fileSystem = Shell.loadFileSystem();
        this.environment = Shell.loadEnvironment(this.fileSystem, this.userList);
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
        const link = cwd.ancestors.reverse()
            .concat(cwd)
            .map(part => this.fileSystem.get(part)?.nameString(part.fileName + "/", part)).join("");

        return `${userName}@fwdekker.com <span class="prefixPath">${link}</span>&gt; `;
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
                    this.environment.set("user", this.attemptUser);
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

        const parser = new InputParser(this.environment);
        const input = parser.parse(stripHtmlTags(inputString));
        if (input.redirectTarget[0] === "write") {
            try {
                const path = Path.interpret(this.environment.get("cwd"), input.redirectTarget[1]);
                this.fileSystem.remove(path, true, false, false);
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
            this.environment.set("cwd", "/");
            this.environment.set("user", "");
        }
        this.saveState();

        return input.redirectTarget[0] === "default" ? output : "";
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
     * Saves the shell's state in cookies.
     */
    private saveState() {
        Cookies.set("files", this.fileSystem.root, {
            "expires": new Date(new Date().setFullYear(new Date().getFullYear() + 25)),
            "path": "/"
        });
        Cookies.set("env", this.environment.variables, {"path": "/"});
    }

    /**
     * Returns the file system loaded from a cookie, or the default file system if no cookie is present or the cookie
     * is invalid.
     */
    private static loadFileSystem(): FileSystem {
        let files: Directory | undefined = undefined;
        const filesString = Cookies.get("files");
        if (filesString !== undefined) {
            try {
                const parsedFiles = Node.deserialize(filesString);
                if (parsedFiles instanceof Directory)
                    files = parsedFiles;
                else
                    console.warn("`files` cookie contains non-directory.");
            } catch (error) {
                console.warn("Failed to deserialize `files` cookie.", error);
            }
        }
        return new FileSystem(files);
    }

    /**
     * Returns the environment loaded from a cookie, or the default environment if no cookie is present or the cookie
     * is invalid.
     *
     * @param fileSystem the file system used to validate the `cwd` environment variable
     * @param userList the list of users used to validate the `user` environment variable
     */
    private static loadEnvironment(fileSystem: FileSystem, userList: UserList): Environment {
        const environmentString = Cookies.get("env") ?? "{}";
        let environment: Environment;
        try {
            environment = new Environment(["cwd", "user"], JSON.parse(environmentString));
        } catch (error) {
            console.warn("Failed to set environment from cookie.");
            environment = new Environment(["cwd", "user"]);
        }

        // Check cwd in environment
        if (!environment.has("cwd")) {
            environment.set("cwd", "/");
        } else if (!fileSystem.has(new Path(environment.get("cwd")))) {
            console.warn(`Invalid cwd '${environment.get("cwd")}' in environment.`);
            environment.set("cwd", "/");
        }

        // Check user in environment
        if (!environment.has("user")) {
            environment.set("user", "felix");
        } else if (environment.get("user") !== "" && !userList.has(environment.get("user"))) {
            console.warn(`Invalid user '${environment.get("user")}' in environment.`);
            environment.set("user", "felix");
        }

        return environment;
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

/**
 * A parser for input strings.
 */
export class InputParser {
    /**
     * The environment containing the variables to substitute.
     */
    private readonly environment: Environment;


    /**
     * Constructs a new input parser.
     *
     * @param environment the environment containing the variables to substitute
     */
    constructor(environment: Environment) {
        this.environment = environment;
    }


    /**
     * Parses the given input string to a set of command-line arguments.
     *
     * @param input the string to parse
     */
    parse(input: string): InputArgs {
        const tokens = this.tokenize(input);
        const command = tokens[0] ?? "";
        const [options, args] = this.parseOpts(tokens.slice(1).filter(it => !it.startsWith(EscapeCharacters.Escape)));
        const redirectTarget = this.getRedirectTarget(tokens.slice(1));

        return new InputArgs(command, options, args, redirectTarget);
    }


    /**
     * Tokenizes the input string.
     *
     * @param input the string to tokenize
     */
    private tokenize(input: string): string[] {
        const tokens: string[] = [];

        let token = "";
        let isInSingleQuotes = false;
        let isInDoubleQuotes = false;
        let isInCurlyBraces = 0;
        for (let i = 0; i < input.length; i++) {
            const char = input[i];
            switch (char) {
                case "\\":
                    if (i === input.length - 1)
                        throw new IllegalArgumentError(
                            "Unexpected end of input. '\\' was used but there was nothing to escape.");

                    const nextChar = input[i + 1];
                    if (isInSingleQuotes || isInDoubleQuotes)
                        token += "\\" + nextChar;
                    else if (nextChar === "n")
                        token += "\n";
                    else
                        token += nextChar;
                    i++;
                    break;
                case "'":
                    if (isInDoubleQuotes)
                        token += char;
                    else
                        isInSingleQuotes = !isInSingleQuotes;
                    break;
                case "\"":
                    if (isInSingleQuotes)
                        token += char;
                    else
                        isInDoubleQuotes = !isInDoubleQuotes;
                    break;
                case "{":
                    if (isInSingleQuotes || isInDoubleQuotes)
                        token += char;
                    else
                        isInCurlyBraces++;
                    break;
                case "}":
                    if (isInSingleQuotes || isInDoubleQuotes)
                        token += char;
                    else
                        isInCurlyBraces--;

                    if (isInCurlyBraces < 0)
                        throw new IllegalArgumentError("Unexpected closing '}' without corresponding '{'.");
                    break;
                case " ":
                    if (isInSingleQuotes || isInDoubleQuotes) {
                        token += char;
                    } else if (token !== "") {
                        tokens.push(token);
                        token = "";
                    }
                    break;
                case "$":
                    if (isInSingleQuotes || isInDoubleQuotes) {
                        token += char;
                        break;
                    }

                    let key = "";
                    for (; i + 1 < input.length; i++) {
                        const nextChar = input[i + 1];
                        if (nextChar.match(/^[0-9a-z_]+$/i))
                            key += nextChar;
                        else
                            break;
                    }
                    if (key === "")
                        throw new IllegalArgumentError(`Missing variable name after '$'.`);

                    token += this.environment.getOrDefault(key, "");
                    break;
                case ">":
                    if (isInSingleQuotes || isInDoubleQuotes) {
                        token += char;
                        break;
                    }

                    if (token !== "") {
                        tokens.push(token);
                        token = "";
                    }

                    token += EscapeCharacters.Escape + ">";
                    if (input[i + 1] === ">") {
                        token += `>`;
                        i++;
                    }
                    while (input[i + 1] === " ")
                        i++;

                    break;
                default:
                    token += char;
                    break;
            }
        }
        if (token !== "")
            tokens.push(token);

        if (isInSingleQuotes || isInDoubleQuotes)
            throw new IllegalArgumentError("Unexpected end of input. Missing closing quotation mark.");

        return tokens;
    }

    /**
     * Returns the redirect target described by the last token that describes a redirect target, or the default redirect
     * target if no token describes a redirect target.
     *
     * @param tokens an array of tokens of which some tokens may describe a redirect target
     */
    private getRedirectTarget(tokens: string[]): InputArgs.RedirectTarget {
        let redirectTarget: InputArgs.RedirectTarget = ["default"];

        tokens.forEach(token => {
            if (token.startsWith(`${EscapeCharacters.Escape}>>`))
                redirectTarget = ["append", token.slice(3)];
            else if (token.startsWith(`${EscapeCharacters.Escape}>`))
                redirectTarget = ["write", token.slice(2)];
        });

        return redirectTarget;
    }

    /**
     * Parses options and arguments.
     *
     * @param tokens the tokens that form the options and arguments
     */
    private parseOpts(tokens: string[]): [InputArgs.Options, string[]] {
        const options: { [key: string]: string | null } = {};

        let i;
        for (i = 0; i < tokens.length; i++) {
            const arg = tokens[i];

            if (!arg.startsWith("-") || arg === "--")
                break;

            const argsParts = arg.split(/=(.*)/, 2);
            if (argsParts.length === 0 || argsParts.length > 2)
                throw new IllegalArgumentError("Unexpected number of parts.");
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
                        throw new IllegalArgumentError("Cannot assign value to multiple short options.");

                    for (const key of keys)
                        options[key] = value;
                }
            }
        }

        return [options, tokens.slice(i)];
    }
}
