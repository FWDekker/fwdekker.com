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
        const tokens = this.tokenizer.tokenize(escape(input));

        const textTokens = this.globber.glob(tokens.filter(it => it instanceof InputParser.TextToken))
            .map(it => new InputParser.TextToken(unescape(it.contents)));
        const redirectTokens = tokens
            .filter(it => it instanceof InputParser.RedirectToken)
            .map(it => new InputParser.RedirectToken(unescape(it.contents)));

        const command = tokens[0]?.contents ?? "";
        const [options, args] = this.parseOpts(textTokens.slice(1));
        const outTargets = this.getRedirectTargets(redirectTokens);

        return new InputArgs(command, options, args.map(it => it.contents), outTargets[0], outTargets[1]);
    }


    /**
     * Returns the redirect target described by the last token that describes a redirect target, or the default redirect
     * target if no token describes a redirect target.
     *
     * @param tokens an array of tokens of which some tokens may describe a redirect target
     */
    private getRedirectTargets(tokens: InputParser.RedirectToken[]): InputArgs.RedirectTarget[] {
        const targets: InputArgs.RedirectTarget[] = [{type: "default"}, {type: "default"}];

        tokens
            .map(it => it.contents)
            .forEach(token => {
                const stream = token.startsWith(">") ? 1 : parseInt(token.slice(0, token.indexOf(">")));

                const target = token.slice(token.indexOf(">"));
                if (target.startsWith(">>"))
                    targets[stream - 1] = {type: "append", target: target.slice(2)};
                else if (target.startsWith(">"))
                    targets[stream - 1] = {type: "write", target: target.slice(1)};
            });

        return targets;
    }

    /**
     * Parses options and arguments.
     *
     * @param tokens the tokens that form the options and arguments
     */
    private parseOpts(tokens: InputParser.TextToken[]): [InputArgs.Options, InputParser.TextToken[]] {
        const options: { [key: string]: string | null } = {};

        let i;
        for (i = 0; i < tokens.length; i++) {
            const arg = tokens[i].contents;

            if (!arg.startsWith("-") || arg === "--")
                break;

            const argsParts = arg.split(/=(.*)/, 2);
            if (argsParts.length === 0 || argsParts.length > 2)
                throw new IllegalArgumentError("Unexpected number of parts.");
            if (argsParts[0].includes(' ') || argsParts[0].match(/[0-9]/))
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
    tokenize(input: string): InputParser.Token[] {
        const tokens: InputParser.Token[] = [];

        let token = new InputParser.TextToken();
        let isInSingleQuotes = false;
        let isInDoubleQuotes = false;
        let isInCurlyBraces = 0;
        for (let i = 0; i < input.length; i++) {
            const char = input[i];
            switch (char) {
                // Escape character
                case "\\":
                    if (i === input.length - 1)
                        throw new IllegalArgumentError(
                            "Unexpected end of input. '\\' was used but there was nothing to escape.");

                    const nextChar = input[i + 1];
                    if (isInSingleQuotes || isInDoubleQuotes)
                        token.contents += "\\" + nextChar;
                    else if (nextChar === "n")
                        token.contents += "\n";
                    else
                        token.contents += nextChar;
                    i++;
                    break;
                // Grouping
                case "'":
                    if (isInDoubleQuotes)
                        token.contents += char;
                    else
                        isInSingleQuotes = !isInSingleQuotes;
                    break;
                case "\"":
                    if (isInSingleQuotes)
                        token.contents += char;
                    else
                        isInDoubleQuotes = !isInDoubleQuotes;
                    break;
                case "{":
                    if (isInSingleQuotes || isInDoubleQuotes)
                        token.contents += char;
                    else
                        isInCurlyBraces++;
                    break;
                case "}":
                    if (isInSingleQuotes || isInDoubleQuotes)
                        token.contents += char;
                    else
                        isInCurlyBraces--;

                    if (isInCurlyBraces < 0)
                        throw new IllegalArgumentError("Unexpected closing '}' without corresponding '{'.");
                    break;
                // Separator
                case " ":
                    if (isInSingleQuotes || isInDoubleQuotes || isInCurlyBraces) {
                        token.contents += char;
                    } else if (token.contents !== "") {
                        tokens.push(token);
                        token = new InputParser.TextToken();
                    }
                    break;
                // Environment variable
                case "$":
                    if (isInSingleQuotes || isInDoubleQuotes) {
                        token.contents += char;
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

                    token.contents += this.environment.getOrDefault(key, "");
                    break;
                // Redirection
                case ">":
                    if (isInSingleQuotes || isInDoubleQuotes) {
                        token.contents += char;
                        break;
                    }

                    if (token.contents !== "" && !token.contents.match(/[0-9]+/)) {
                        tokens.push(token);
                        token = new InputParser.RedirectToken();
                    } else {
                        token = new InputParser.RedirectToken(token.contents);
                    }

                    token.contents += ">";
                    if (input[i + 1] === ">") {
                        token.contents += ">";
                        i++;
                    }
                    while (input[i + 1] === " ")
                        i++;

                    break;
                // Glob token
                case "*":
                case "?":
                    if (token instanceof InputParser.RedirectToken)
                        throw new IllegalArgumentError(`Invalid token '${char}' in redirect target.`);

                    if (isInSingleQuotes || isInDoubleQuotes)
                        token.contents += char;
                    else
                        token.contents += InputParser.EscapeChar + char;
                    break;
                // Home directory
                case "~":
                    if (isInSingleQuotes || isInDoubleQuotes || isInCurlyBraces || token.contents !== "")
                        token.contents += char;
                    else if (input[i + 1] === "/" || input[i + 1] === " " || input[i + 1] === undefined)
                        token.contents += this.environment.get("home");
                    else
                        token.contents += char;
                    break;
                default:
                    token.contents += char;
                    break;
            }
        }
        if (token.contents !== "")
            tokens.push(token);

        if (isInSingleQuotes)
            throw new IllegalArgumentError("Unexpected end of input. Missing closing '.");
        if (isInDoubleQuotes)
            throw new IllegalArgumentError("Unexpected end of input. Missing closing \".");
        if (isInCurlyBraces)
            throw new IllegalArgumentError("Unexpected end of input. Missing closing }.");

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
    glob(tokens: InputParser.TextToken[]): InputParser.TextToken[] {
        return tokens
            .map(it => it.contents)
            .map(token => {
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
            })
            .reduce((acc, tokens) => acc.concat(tokens), [])
            .map(it => new InputParser.TextToken(it));
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
            return [history + glob];

        const nextPart = glob.includes("/") ? glob.substring(0, glob.indexOf("/")) : glob; // excluding /
        const remainder = glob.includes("/") ? glob.substring(glob.indexOf("/") + 1) : ""; // excluding /

        if (nextPart === ".")
            return this.glob2(history + nextPart + "/", remainder, path);
        if (nextPart === "..")
            return this.glob2(history + nextPart + "/", remainder, path.parent);

        return Object.keys(dir.nodes)
            .filter(it => it.match(this.glob2regex(nextPart)))
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


    /**
     * A token containing text.
     */
    export abstract class Token {
        /**
         * The type of token; used to distinguish between types when comparing tokens.
         */
        abstract readonly type: string;
        contents: string;


        constructor(contents: string = "") {
            this.contents = contents;
        }
    }

    /**
     * A token without a special meaning.
     */
    export class TextToken extends Token {
        readonly type: string = "text";
    }

    /**
     * A token defining a redirect target.
     */
    export class RedirectToken extends Token {
        readonly type: string = "redirect";
    }
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
