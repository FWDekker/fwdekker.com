import {Environment} from "./Environment";
import {Directory, File, FileSystem, Path} from "./FileSystem";
import {InputArgs} from "./InputArgs";
import {IllegalArgumentError} from "./Shared";


/**
 * A parser for input strings.
 */
export class InputParser {
    /**
     * The tokenizer turn the input into tokens with.
     */
    private readonly tokenizer: Tokenizer;
    /**
     * The expander to expand tokens with.
     */
    private readonly expander: Expander;


    /**
     * Constructs a new input parser.
     *
     * Usually, you'll want to use the static `InputParser#create` method instead.
     *
     * @param tokenizer the tokenizer turn the input into tokens with
     * @param expander the expander to expand tokens with
     */
    constructor(tokenizer: Tokenizer, expander: Expander) {
        this.tokenizer = tokenizer;
        this.expander = expander;
    }

    /**
     * Constructs a new input parser.
     *
     * @param environment the environment containing the variables to substitute
     * @param fileSystem the file system describing the valid paths to glob
     */
    static create(environment: Environment, fileSystem: FileSystem): InputParser {
        return new InputParser(
            new Tokenizer(),
            new Expander(environment, new Globber(fileSystem, environment.get("cwd")))
        );
    }


    /**
     * Parses the given input string to an array of input arguments to execute.
     *
     * @param input the string to parse
     */
    parse(input: string): InputArgs[] {
        return this.tokenizer
            .tokenize(escape(input))
            .reduce((acc, token) => {
                if (token === ";")
                    acc.push([]);
                else
                    acc[acc.length - 1].push(token);

                return acc;
            }, <string[][]> [[]])
            .filter(tokens => tokens.length !== 0)
            .map(tokens => {
                const textTokens = tokens.filter(it => !it.match(/^[0-9]*>/))
                    .reduce((acc, it) => acc.concat(this.expander.expand(it)), <string[]> [])
                    .map(it => unescape(it));
                const redirectTokens = tokens.map(it => unescape(it));

                const command = tokens[0] ?? "";
                const [options, args] = this.parseOpts(textTokens.slice(1));
                const outTargets = this.getRedirectTargets(redirectTokens);

                return new InputArgs(command, options, args, outTargets);
            });
    }


    /**
     * Returns the redirect target described by the last token that describes a redirect target, or the default redirect
     * target if no token describes a redirect target.
     *
     * @param tokens an array of tokens of which some tokens may describe a redirect target
     */
    private getRedirectTargets(tokens: string[]): InputArgs.RedirectTarget[] {
        const targets: InputArgs.RedirectTarget[] = [];

        tokens.forEach(token => {
            const stream = token.startsWith(">") ? 1 : parseInt(token.slice(0, token.indexOf(">")));

            const target = token.slice(token.indexOf(">"));
            if (target.startsWith(">>"))
                targets[stream] = {type: "append", target: target.slice(2)};
            else if (target.startsWith(">"))
                targets[stream] = {type: "write", target: target.slice(1)};
        });

        return targets;
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

            if (!arg.startsWith("-"))
                break;
            if (arg === "--") {
                i++;
                break;
            }

            const argsParts = arg.split("=");
            if (argsParts.length === 0 || argsParts.length > 2)
                throw new IllegalArgumentError("Unexpected number of parts.");
            if (argsParts[0].includes(" ") || argsParts[0].match(/[0-9]/))
                break;

            const value = argsParts.length === 1 ? null : argsParts[1];

            if (argsParts[0].startsWith("--")) {
                const key = argsParts[0].substr(2);
                if (key === "")
                    break;

                options[`--${key}`] = value;
            } else {
                const keys = argsParts[0].substr(1);
                if (keys === "")
                    break;

                if (keys.length === 1) {
                    options[`-${keys}`] = value;
                } else {
                    if (value !== null)
                        throw new IllegalArgumentError("Cannot assign value to multiple short options.");

                    for (const key of keys)
                        options[`-${key}`] = value;
                }
            }
        }

        return [options, tokens.slice(i)];
    }
}

/**
 * Turns an input string into a series of tokens.
 */
export class Tokenizer {
    /**
     * Separates the input string into a series of tokens, respecting the semantics of grouping, redirection parameters,
     * etc.
     *
     * Joining the returned array with spaces in between will give back the input string, disregarding extra whitespaces
     * in between tokens. That is, no bytes are added, removed, or escaped in tokens.
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
                // Escape character
                case "\\":
                    i++;
                    const nextChar = input[i];
                    if (nextChar === undefined)
                        throw new IllegalArgumentError(
                            "Unexpected end of input. '\\' was used but there was nothing to escape.");

                    token += char + nextChar;
                    break;
                // Grouping
                case "'":
                    if (!isInDoubleQuotes)
                        isInSingleQuotes = !isInSingleQuotes;

                    token += char;
                    break;
                case "\"":
                    if (!isInSingleQuotes)
                        isInDoubleQuotes = !isInDoubleQuotes;

                    token += char;
                    break;
                case "{":
                    if (!isInSingleQuotes && !isInDoubleQuotes)
                        isInCurlyBraces++;

                    token += char;
                    break;
                case "}":
                    if (!isInSingleQuotes && !isInDoubleQuotes) {
                        isInCurlyBraces--;

                        if (isInCurlyBraces < 0)
                            throw new IllegalArgumentError("Unexpected closing '}' without corresponding '{'.");
                    }

                    token += char;
                    break;
                // Separators
                case " ":
                    if (isInSingleQuotes || isInDoubleQuotes || isInCurlyBraces > 0) {
                        token += char;
                    } else {
                        if (token !== "")
                            tokens.push(token);

                        token = "";
                    }
                    break;
                case ";":
                    if (isInSingleQuotes || isInDoubleQuotes || isInCurlyBraces > 0) {
                        token += char;
                    } else {
                        if (token !== "")
                            tokens.push(token);

                        if (tokens.length !== 0 && tokens[tokens.length - 1] !== ";")
                            tokens.push(char);

                        token = "";
                    }
                    break;
                // Redirection
                case ">":
                    if (isInSingleQuotes || isInDoubleQuotes || isInCurlyBraces > 0) {
                        token += char;
                        break;
                    }

                    if (token !== "" && !token.match(/^[0-9]+$/)) {
                        tokens.push(token);
                        token = "";
                    }

                    token += ">";
                    if (input[i + 1] === ">") {
                        token += ">";
                        i++;
                    }
                    while (input[i + 1] === " ")
                        i++;

                    break;
                // Miscellaneous character
                default:
                    token += char;
                    break;
            }
        }
        if (token !== "")
            tokens.push(token);

        if (isInSingleQuotes)
            throw new IllegalArgumentError("Unexpected end of input. Missing closing '.");
        if (isInDoubleQuotes)
            throw new IllegalArgumentError("Unexpected end of input. Missing closing \".");
        if (isInCurlyBraces > 0)
            throw new IllegalArgumentError("Unexpected end of input. Missing closing }.");

        return tokens;
    }
}

/**
 * Expands individual tokens.
 */
export class Expander {
    /**
     * The environment containing the variables to substitute.
     */
    private readonly environment: Environment;
    /**
     * The globber to expand glob patterns with.
     */
    private readonly globber: Globber;


    /**
     * Constructs a new tokenizer.
     *
     * @param environment the environment containing the variables to substitute
     * @param globber the globber to expand glob patterns with
     */
    constructor(environment: Environment, globber: Globber) {
        this.environment = environment;
        this.globber = globber;
    }


    /**
     * Expands environment variables and glob patterns in the given token.
     *
     * It is assumed that the given token is valid; for example, its quotes and brackets should match.
     *
     * @param token the valid token to expand
     */
    expand(token: string): string[] {
        let expandedToken = "";

        let isInSingleQuotes = false;
        let isInDoubleQuotes = false;
        let isInCurlyBraces = 0;
        for (let i = 0; i < token.length; i++) {
            const char = token[i];
            switch (char) {
                // Escape character
                case "\\":
                    i++;
                    const nextChar = token[i];

                    if (isInSingleQuotes || isInDoubleQuotes) {
                        if ((isInSingleQuotes && nextChar === "'") || (isInDoubleQuotes && nextChar === "\""))
                            expandedToken += nextChar;
                        else
                            expandedToken += char + nextChar;
                        break;
                    }

                    switch (nextChar) {
                        case "\\":
                        case " ":
                        case ";":
                        case "~":
                        case "$":
                        case ">":
                        case "?":
                        case "*":
                        case "'":
                        case "\"":
                        case "{":
                        case "}":
                            expandedToken += nextChar;
                            break;
                        default:
                            expandedToken += char + nextChar;
                            break;
                    }
                    break;
                // Grouping
                case "'":
                    if (!isInDoubleQuotes)
                        isInSingleQuotes = !isInSingleQuotes;
                    else
                        expandedToken += char;
                    break;
                case "\"":
                    if (!isInSingleQuotes)
                        isInDoubleQuotes = !isInDoubleQuotes;
                    else
                        expandedToken += char;
                    break;
                case "{":
                    if (!isInSingleQuotes && !isInDoubleQuotes)
                        isInCurlyBraces++;
                    else
                        expandedToken += char;
                    break;
                case "}":
                    if (!isInSingleQuotes && !isInDoubleQuotes)
                        isInCurlyBraces--;
                    else
                        expandedToken += char;
                    break;
                // Environment variable
                case "$":
                    if (isInSingleQuotes) {
                        expandedToken += char;
                        break;
                    }

                    let key = "";
                    for (; i + 1 < token.length; i++) {
                        const nextChar = token[i + 1];
                        if (nextChar.match(/^[0-9a-z_]+$/i))
                            key += nextChar;
                        else
                            break;
                    }
                    if (key === "")
                        throw new IllegalArgumentError("Missing variable name after '$'.");

                    expandedToken += this.environment.getOrDefault(key, "");
                    break;
                // Glob characters
                case "*":
                case "?":
                    if (isInSingleQuotes || isInDoubleQuotes)
                        expandedToken += char;
                    else
                        expandedToken += InputParser.EscapeChar + char;
                    break;
                // Home directory
                case "~":
                    if (isInSingleQuotes || isInDoubleQuotes || isInCurlyBraces > 0 || expandedToken !== "")
                        expandedToken += char;
                    else if (token[i + 1] === undefined || token[i + 1] === "/")
                        expandedToken += this.environment.get("home");
                    else
                        expandedToken += char;
                    break;
                // Miscellaneous character
                default:
                    expandedToken += char;
                    break;
            }
        }

        return this.globber.glob(expandedToken);
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
     * @param token the token to glob
     */
    glob(token: string): string[] {
        if (!this.isGlob(token))
            return [token];

        let tokens: string[];
        if (token.startsWith("/"))
            tokens = this.glob2("/", token.slice(1), new Path("/"));
        else
            tokens = this.glob2("", token, this.cwd);

        if (tokens.length === 0)
            throw new IllegalArgumentError(`Token '${unescape(token)}' does not match any files.`);

        return tokens;
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
        const dir = this.fileSystem.get(path);
        if (!(dir instanceof Directory))
            return [];

        const nextPart = glob.includes("/") ? glob.substring(0, glob.indexOf("/")) : glob; // excluding /
        const remainder = glob.includes("/") ? glob.substring(glob.indexOf("/") + 1) : ""; // excluding /

        if (nextPart === ".")
            return this.glob2(history + nextPart + "/", remainder, path);
        if (nextPart === "..")
            return this.glob2(history + nextPart + "/", remainder, path.parent);

        return Object.keys(dir.nodes)
            .filter(it => it.match(this.glob2regex(nextPart)) && (it.startsWith(".") == nextPart.startsWith(".")))
            .map(it => escape(it))
            .map(fileName => {
                if (dir.nodes[fileName] instanceof File) {
                    // Only match files if there are no more /s to match
                    if (!glob.includes("/"))
                        return [history + fileName];
                    return <string[]> [];
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
            .reduce((acc, it) => acc.concat(it), []);
    }


    /**
     * Returns `true` if and only if the given glob string uses any special glob characters.
     *
     * @param glob the string to check for globness
     */
    private isGlob(glob: string): boolean {
        for (let i = 0; i < glob.length; i++) {
            const char = glob[i];

            if (char !== InputParser.EscapeChar)
                continue;

            i++;
            const nextChar = glob[i];
            if (nextChar === "?" || nextChar === "*")
                return true;
        }

        return false;
    }

    /**
     * Converts a glob string to a regular expression.
     *
     * @param glob the glob string to convert
     */
    private glob2regex(glob: string): RegExp {
        let regex = "";

        for (let i = 0; i < glob.length; i++) {
            const char = glob[i];
            if (char !== InputParser.EscapeChar) {
                if ("-\/\\^$*+?.()|[\]{}".includes(char))
                    regex += "\\" + char;
                else
                    regex += char;
                continue;
            }

            i++;
            const nextChar = glob[i];
            if (nextChar === undefined)
                throw new IllegalArgumentError("Unescaped escape character inside input parser.");

            if (nextChar === "?")
                regex += ".";
            else if (nextChar === "*")
                regex += "[^/]*";
            else
                regex += nextChar;
        }

        return new RegExp(`^${regex}$`);
    }
}


export module InputParser {
    /**
     * The token used to internally escape characters in the input parser.
     */
    export const EscapeChar = "\u001b";
}

/**
 * Escapes all occurrences of the input parser's escape character.
 *
 * @param string the string to escape in
 */
function escape(string: string): string {
    return string.replace(new RegExp(InputParser.EscapeChar, "g"), InputParser.EscapeChar + InputParser.EscapeChar);
}

/**
 * Unescapes all occurrences of the input parser's escape character.
 *
 * @param string the string to unescape in
 */
function unescape(string: string): string {
    return string.replace(new RegExp(InputParser.EscapeChar + InputParser.EscapeChar, "g"), InputParser.EscapeChar);
}
