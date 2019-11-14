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
    readonly outTarget: InputArgs.RedirectTarget;
    /**
     * The target of the error stream.
     */
    readonly errTarget: InputArgs.RedirectTarget;


    /**
     * Constructs a new set of parsed command-line arguments.
     *
     * @param command the name of the command, i.e. the first token in the input string
     * @param options the set of options and the corresponding values that the user has given
     * @param args the remaining non-option arguments that the user has given
     * @param outTarget the target of the output stream
     * @param errTarget the target of the error stream
     */
    constructor(command: string, options: InputArgs.Options, args: string[],
                outTarget: InputArgs.RedirectTarget = {type: "default"},
                errTarget: InputArgs.RedirectTarget = {type: "default"}) {
        this.command = command;
        this._options = Object.assign({}, options);
        this._args = args.slice();
        this.outTarget = Object.assign({}, outTarget);
        this.errTarget = Object.assign({}, errTarget);
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
