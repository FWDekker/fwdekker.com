import {sha256} from "js-sha256";
import {File, FileSystem, Path} from "./FileSystem";
import {IllegalArgumentError} from "./Shared";


/**
 * Manages a file containing user data.
 */
export class UserList {
    /**
     * The file system in which the user data file is located.
     */
    private readonly fileSystem: FileSystem;
    /**
     * The path to the file containing user data.
     */
    private readonly userFilePath: Path;


    /**
     * Constructs a new user list manager.
     *
     * @param fileSystem the file system in which the user data file is located
     * @param userFilePath the path to the file containing user data
     */
    constructor(fileSystem: FileSystem, userFilePath: Path = new Path("/etc/passwd")) {
        this.fileSystem = fileSystem;
        this.userFilePath = userFilePath;
    }


    /**
     * Returns the user data file, creating it if it does not exist.
     *
     * @return the user data file, creating it if it does not exist
     */
    private get userFile(): File {
        let userFile = this.fileSystem.get(this.userFilePath);
        if (userFile === undefined) {
            userFile = new File();
            this.fileSystem.add(this.userFilePath, userFile, true);
        } else if (!(userFile instanceof File)) {
            userFile = new File();
            this.fileSystem.remove(this.userFilePath);
            this.fileSystem.add(this.userFilePath, userFile, true);
        }
        return userFile as File;
    }

    /**
     * Returns a copy of the list of all users.
     */
    get users(): User[] {
        return this.userFile.open("read").read()
            .split("\n")
            .filter(it => it.trim().length > 0)
            .map(it => User.fromString(it));
    }


    /**
     * Adds the given user to the user list.
     *
     * If the user already exists, nothing happens.
     *
     * @param user the user to add
     * @return `true` if and only if the user was added
     */
    add(user: User): boolean {
        if (this.has(user.name))
            return false;

        this.userFile.open("append").writeLine(User.toString(user));
        return true;
    }

    /**
     * Removes the user with the given username from the list.
     *
     * @param name the name of the user to remove
     * @return `true` if and only if the user was removed successfully
     */
    delete(name: string): boolean {
        if (!this.has(name))
            return false;

        const retainedUsers = this.users.filter(user => user.name !== name);
        this.userFile.open("write"); // Empty file
        retainedUsers.forEach(user => this.add(user));
        return true;
    }

    /**
     * Returns the user with the given name, or `undefined` if there is no such user.
     *
     * @param name the name of the user to return
     */
    get(name: string): User | undefined {
        return this.users.find(it => it.name === name);
    }

    /**
     * Returns `true` if and only if a user with the given name exists.
     *
     * @param name the name of the user to check
     */
    has(name: string): boolean {
        return this.get(name) !== undefined;
    }

    /**
     * Overwrites the user matching the given user's name with the given user data.
     *
     * This method cannot be used to change a user's name.
     *
     * @param modifiedUser the user data to overwrite with
     * @return `true` if and only if the user was successfully modified
     */
    modify(modifiedUser: User): boolean {
        if (!this.has(modifiedUser.name))
            return false;

        const modifiedUsers = this.users.map(user => user.name === modifiedUser.name ? modifiedUser : user);
        this.userFile.open("write"); // Empty file
        modifiedUsers.forEach(user => this.add(user));
        return true;
    }
}


/**
 * Hashes and checks passwords.
 */
export class HashProvider {
    /**
     * The default instance to be used.
     */
    static default = new HashProvider();


    /**
     * Hashes the given password.
     *
     * @param password the password to hash
     * @param salt the salt to flavor the password with
     * @return the hashed password
     */
    hashPassword(password: string, salt: string | undefined = undefined): string {
        salt = salt ?? Array.from(window.crypto.getRandomValues(new Uint8Array(8)))
            .map(it => it.toString(16).padStart(2, "0"))
            .join("");
        return salt + "$" + sha256(salt + password);
    }

    /**
     * Returns `true` if and only if the given password corresponds to the given hash.
     *
     * @param hash the hash that may describe the given password
     * @param password the password to compare against the given hash
     * @return `true` if and only if the given password corresponds to the given hash
     */
    checkPassword(hash: string, password: string): boolean {
        const salt = hash.split("$", 2)[0];
        return this.hashPassword(password, salt) === hash;
    }
}


/**
 * A user that can be logged in to.
 */
export class User {
    /**
     * The name of the user.
     */
    private _name: string = "";
    /**
     * The hash of the password of the user.
     */
    private _passwordHash: string = "";
    /**
     * The path to the user's home directory.
     */
    private _home: string = "";
    /**
     * The description of the user.
     */
    private _description: string = "";


    /**
     * Constructs a new user.
     *
     * @param name the name of the user
     * @param password the hash of this user's password
     * @param home the path to the user's home directory, or `undefined` to use `/home/<name>`
     * @param description the description of the user
     */
    constructor(name: string, password: string, home: string | undefined = undefined,
                description: string | undefined = undefined) {
        this.name = name;
        this.passwordHash = password;
        this.home = home ?? `/home/${name}`;
        this.description = description ?? "";
    }


    /**
     * Returns the name of the user.
     *
     * @return the name of the user
     */
    get name(): string {
        return this._name;
    }

    /**
     * Sets the name of the user.
     *
     * @param name the name to set
     */
    set name(name: string) {
        if (!name.match(/^[0-9a-zA-Z]+$/))
            throw new IllegalArgumentError("Name must contain only alphanumerical characters.");

        this._name = name;
    }

    /**
     * Returns the hash of the password of the user.
     *
     * @return the hash of the password of the user
     */
    get passwordHash(): string {
        return this._passwordHash;
    }

    /**
     * Sets the hash of the password of the user.
     *
     * @param password the hash of the password of the user to set
     */
    set passwordHash(password: string) {
        this._passwordHash = password;
    }

    /**
     * Returns the path to the user's home directory.
     *
     * @return the path to the user's home directory
     */
    get home(): string {
        return this._home;
    }

    /**
     * Sets the path to the user's home directory.
     *
     * @param home the path to the user's home directory to set
     */
    set home(home: string) {
        if (home?.includes("|") || home?.includes("\n"))
            throw new IllegalArgumentError("Home must not contain pipe ('|') or newline character.");

        this._home = home;
    }

    /**
     * Returns the description of the user.
     *
     * @return the description of the user
     */
    get description(): string {
        return this._description;
    }

    /**
     * Sets the description of the user.
     *
     * @param description the description of the user to set
     */
    set description(description: string) {
        if (description?.includes("|") || description?.includes("\n"))
            throw new IllegalArgumentError("Description must not contain pipe ('|') or newline character.");

        this._description = description;
    }


    /**
     * Returns `true` if and only if the given password matches that of this user.
     *
     * @param password the password to compare against the password of this user
     * @return `true` if and only if the given password matches that of this user
     */
    hasPassword(password: string): boolean {
        return HashProvider.default.checkPassword(this.passwordHash, password);
    }


    /**
     * Converts a string to a user object.
     *
     * @param string the string to convert to a user object
     * @return the user object described by the given string
     */
    static fromString(string: string): User {
        const parts = string.split("|", 4);
        return new User(parts[0], parts[1], parts[2], parts[3]);
    }

    /**
     * Converts a user object to a string.
     *
     * @param user the user to convert to a string
     * @return the string describing the given user
     */
    static toString(user: User): string {
        return `${user.name}|${user.passwordHash}|${user.home}|${user.description}`;
    }
}
