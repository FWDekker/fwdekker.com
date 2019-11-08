import {Environment} from "./Environment";
import {Directory, File, FileSystem, Path} from "./FileSystem";
import {IllegalArgumentError} from "./Shared";
import {InputArgs} from "./Shell";
import {EscapeCharacters} from "./Terminal";


/**
 * A parser for input strings.
 */
export class InputParser {
    /**
     * The tokenizer turn the input into tokens with.
     */
    private readonly tokenizer: Tokenizer;
    /**
     * The globber to glob file paths with.
     */
    private readonly globber: Globber;


    /**
     * Constructs a new input parser.
     *
     * Usually, you'll want to use the static `InputParser#create` method instead.
     *
     * @param tokenizer the tokenizer turn the input into tokens with
     * @param globber the globber to glob file paths with
     */
    constructor(tokenizer: Tokenizer, globber: Globber) {
        this.tokenizer = tokenizer;
        this.globber = globber;
    }

    /**
     * Constructs a new input parser.
     *
     * @param environment the environment containing the variables to substitute
     * @param fileSystem the file system describing the valid paths to glob
     */
    static create(environment: Environment, fileSystem: FileSystem): InputParser {
        return new InputParser(new Tokenizer(environment), new Globber(fileSystem, environment.get("cwd")));
    }


    /**
     * Parses the given input string to a set of command-line arguments.
     *
     * @param input the string to parse
     */
    parse(input: string): InputArgs {
        const tokens = this.globber.glob(this.tokenizer.tokenize(input));
        const command = tokens[0] ?? "";
        const [options, args] = this.parseOpts(tokens.slice(1).filter(it => !it.startsWith(EscapeCharacters.Escape)));
        const redirectTarget = this.getRedirectTarget(tokens.slice(1));

        return new InputArgs(command, options, args, redirectTarget);
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
            if (token.startsWith(`${EscapeCharacters.Escape}>${EscapeCharacters.Escape}>`))
                redirectTarget = ["append", token.slice(4)];
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

/**
 * Turns an input string into a series of expanded tokens.
 */
export class Tokenizer {
    /**
     * The environment containing the variables to substitute.
     */
    private readonly environment: Environment;


    /**
     * Constructs a new tokenizer.
     *
     * @param environment the environment containing the variables to substitute
     */
    constructor(environment: Environment) {
        this.environment = environment;
    }


    /**
     * Tokenizes the input string and expands the tokens.
     *
     * @param input the string to tokenize
     */
    tokenize(input: string): string[] {
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
                        token += EscapeCharacters.Escape + ">";
                        i++;
                    }
                    while (input[i + 1] === " ")
                        i++;

                    break;
                case "*":
                case "?":
                    if (isInSingleQuotes || isInDoubleQuotes)
                        token += char;
                    else
                        token += EscapeCharacters.Escape + char;
                    break;
                case "~":
                    if (isInSingleQuotes || isInDoubleQuotes || isInCurlyBraces || token !== "")
                        token += char;
                    else if (input[i + 1] === "/" || input[i + 1] === " " || input[i + 1] === undefined)
                        token += this.environment.get("home");
                    else
                        token += char;
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
}

/**
 * Globs file paths in tokens.
 */
export class Globber {
    /**
     * The file system describing the valid paths to glob.
     */
    private readonly fileSystem: FileSystem;
    /**
     * The path to the current working directory to which globbing is relative.
     */
    private readonly cwd: Path;


    /**
     * Constructs a new globber.
     *
     * @param fileSystem the file system describing the valid paths to glob
     * @param cwd the path to the current working directory to which globbing is relative
     */
    constructor(fileSystem: FileSystem, cwd: string) {
        this.fileSystem = fileSystem;
        this.cwd = new Path(cwd);
    }


    /**
     * Returns globbed tokens.
     *
     * @param tokens the tokens to glob
     */
    glob(tokens: string[]): string[] {
        let results: string[] = [];
        tokens.forEach(token => {
            if (token.startsWith("/"))
                results = results.concat(this.glob2("/", token.slice(1), new Path("/")));
            else
                results = results.concat(this.glob2("", token, this.cwd));
        });
        return results;
    }

    /**
     * Recursively traverses the given path according to the glob pattern provided, keeping track of file system
     * location with the given path, and returns all paths that match the glob pattern.
     *
     * @param history the "de-globbed" pattern until now; must end with a slash in between recursive calls
     * @param glob the glob pattern that is still to be traversed
     * @param path the current location in the file system
     */
    private glob2(history: string, glob: string, path: Path): string[] {
        if (!glob.includes(EscapeCharacters.Escape + "?") && !glob.includes(EscapeCharacters.Escape + "*"))
            return [history + glob];

        const dir = this.fileSystem.get(path);
        if (!(dir instanceof Directory))
            return [history + glob];

        const nextPart = glob.includes("/") ? glob.substring(0, glob.indexOf("/")) : glob; // excluding /
        const remainder = glob.includes("/") ? glob.substring(glob.indexOf("/") + 1) : ""; // excluding /

        if (nextPart === ".")
            return this.glob2(history + nextPart + "/", remainder, path);
        if (nextPart === "..")
            return this.glob2(history + nextPart + "/", remainder, path.parent);

        const pattern = nextPart
            .replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&") // Escape regex from user input
            .replaceAll(new RegExp(`${EscapeCharacters.Escape}\\\\\\?`), ".")
            .replaceAll(new RegExp(`${EscapeCharacters.Escape}\\\\\\*`), "[^/]*");

        return Object.keys(dir.nodes)
            .filter(fileName => fileName.match(new RegExp(`^${pattern}$`)))
            .map(fileName => {
                if (dir.nodes[fileName] instanceof File) {
                    // Only match files if there are no more /s to match
                    if (!glob.includes("/"))
                        return [history + fileName];
                    return <string[]>[];
                }

                // Only recurse if there is still recurring to do
                if (remainder !== "")
                    return this.glob2(`${history}${fileName}/`, remainder, path.getChild(fileName));

                // Add / depending on user input
                if (glob.includes("/"))
                    return [history + fileName + "/"];
                else
                    return [history + fileName];
            })
            .reduce((acc, it) => acc.concat(it));
    }
}
