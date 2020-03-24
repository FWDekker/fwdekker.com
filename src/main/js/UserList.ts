/**
 * Manages a list of users.
 */
import {File, FileSystem, Path} from "./FileSystem";
import {sha256} from "js-sha256";


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
}


/**
 * A user that can be logged in to.
 */
export class User {
    /**
     * The name of the user.
     */
    readonly name: string;
    /**
     * The password of the user.
     */
    readonly password: string;
    /**
     * The path to the user's home directory.
     */
    readonly home: string;
    /**
     * The description of the user.
     */
    readonly description: string;


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
        this.password = password;
        this.home = home ?? `/home/${name}`;
        this.description = description ?? "";
    }


    /**
     * Returns `true` if and only if the given password matches that of this user.
     *
     * @param password the password to compare against the password of this user
     * @return `true` if and only if the given password matches that of this user
     */
    hasPassword(password: string): boolean {
        const salt = this.password.split("$", 2)[0];
        return User.hashPassword(password, salt) === this.password;
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
        return `${user.name}|${user.password}|${user.home}|${user.description}`;
    }


    /**
     * Hashes the given password.
     *
     * @param password the password to hash
     * @param salt the salt to flavor the password with
     * @return the hashed password
     */
    static hashPassword(password: string, salt: string | undefined = undefined): string {
        salt = salt ?? Array.from(window.crypto.getRandomValues(new Uint8Array(8)))
            .map(it => it.toString(16).padStart(2, "0"))
            .join("");
        return salt + "$" + sha256(salt + password);
    }
}
