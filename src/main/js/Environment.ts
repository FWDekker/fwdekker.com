import {IllegalArgumentError} from "./Shared";


/**
 * A set of environment variables.
 *
 * Variables can be marked as read-only. This ensures that the methods prefixed with `safe` cannot set or delete these
 * variables. All other methods can still affect read-only variables.
 */
export class Environment {
    /**
     * The environment variables and associated values.
     */
    private readonly _variables: { [key: string]: string } = {};
    /**
     * The keys of the environment variables that are read-only.
     */
    private readonly readonlyKeys: string[];


    /**
     * Constructs a new set of environment variables where the given keys are read-only.
     *
     * @param readonlyKeys the keys of the environment variables that are read-only
     * @param variables the variables to load by default
     */
    constructor(readonlyKeys: string[] = [], variables: { [key: string]: any } = {}) {
        this.readonlyKeys = readonlyKeys;
        this.load(variables);
    }


    /**
     * Returns a copy of the variables contained within this environment.
     */
    get variables(): { [key: string]: string } {
        return Object.assign({}, this._variables);
    }


    /**
     * Deletes all environment variables, including the read-only variables.
     */
    clear(): void {
        for (const key of Object.getOwnPropertyNames(this._variables))
            this.delete(key);
    }

    /**
     * Deletes the environment variable with the given key, even if it is read-only.
     *
     * @param key the key of the environment variable to delete
     * @throws if the key is invalid
     */
    delete(key: string): void {
        if (!Environment.isKeyValid(key))
            throw new IllegalArgumentError(
                "Environment variable keys can only contain alphanumerical characters and underscores.");

        delete this._variables[key];
    }

    /**
     * Deletes the environment variable with the given key, unless it is read-only.
     *
     * @param key the key of the environment variable to delete
     * @throws if the key is invalid or the environment variable to delete is read-only
     */
    safeDelete(key: string): void {
        if (this.readonlyKeys.indexOf(key) >= 0)
            throw new IllegalArgumentError("Cannot set read-only environment variable.");

        this.delete(key);
    }

    /**
     * Returns the value of the environment variable with the given key, or throws an exception if there is no such
     * environment variable.
     *
     * @param key the key of the environment variable to return
     * @throws if there is no such environment variable
     */
    get(key: string): string {
        if (!this.has(key))
            throw new IllegalArgumentError(`Cannot read non-existing environment variable '${key}'.`);

        return this._variables[key];
    }

    /**
     * Returns the value of the environment variable with the given key, or the given default value if there is no such
     * environment variable.
     *
     * @param key the key of the environment variable to return
     * @param def the default value to return in case there is no environment variable with the given key
     */
    getOrDefault(key: string, def: string): string {
        return this._variables[key] ?? def;
    }

    /**
     * Returns `true` if and only if there is an environment variable with the given key.
     *
     * @param key the key of the environment variable to check
     */
    has(key: string): boolean {
        return this._variables.hasOwnProperty(key);
    }

    /**
     * Loads all variables in the given object into this environment.
     *
     * @param variables the variables to load
     */
    load(variables: { [key: string]: any }): void {
        for (const key of Object.getOwnPropertyNames(variables))
            this.set(key, variables[key]);
    }

    /**
     * Sets the value of the environment variable with the given key, even if it is read-only.
     *
     * @param key the key of the environment variable to set
     * @param value the value to set the environment variable to
     * @throws if the key is invalid
     */
    set(key: string, value: string): void {
        if (!Environment.isKeyValid(key))
            throw new IllegalArgumentError(
                "Environment variable keys can only contain alphanumerical characters and underscores.");

        this._variables[key] = value;
    }

    /**
     * Sets the value of the environment variable with the given key, unless it is read-only.
     *
     * @param key the key of the environment variable to set
     * @param value the value to set the environment variable to
     * @throws if the key is invalid or the environment variable to set is read-only
     */
    safeSet(key: string, value: string): void {
        if (this.readonlyKeys.indexOf(key) >= 0)
            throw new IllegalArgumentError("Cannot set read-only environment variable.");

        this.set(key, value);
    }


    /**
     * Returns `true` if and only if the given key has a valid format.
     *
     * @param key the key to validate
     */
    private static isKeyValid(key: string): boolean {
        return !!key.match(/^[0-9a-z_]+$/i);
    }
}
