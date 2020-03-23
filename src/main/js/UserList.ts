/**
 * Manages a list of users.
 */
import {File, FileSystem, Path} from "./FileSystem";


/**
 * Manages a file containing user data.
 */
export class UserList {
    /**
     * The default contents of the user data file, inserted if the file is unexpectedly removed or invalidated.
     *
     * This is a function to prevent accidental modification of these data.
     */
    private readonly GET_DEFAULT_USER = () => new User("root", "root", "/root", "The root user.");


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

        this.userFile; // Initialize file
    }


    /**
     * Returns the user data file, creating it if it does not exist.
     *
     * @return the user data file, creating it if it does not exist
     */
    private get userFile(): File {
        let userFile = this.fileSystem.get(this.userFilePath);
        if (userFile === undefined) {
            userFile = new File(User.toString(this.GET_DEFAULT_USER()) + "\n");
            this.fileSystem.add(this.userFilePath, userFile, true);
        } else if (!(userFile instanceof File)) {
            userFile = new File(User.toString(this.GET_DEFAULT_USER()) + "\n");
            this.fileSystem.remove(this.userFilePath);
            this.fileSystem.add(this.userFilePath, userFile, true);
        }
        return userFile as File;
    }

    /**
     * Returns a copy of the list of all users.
     */
    get users(): User[] {
        return this.userFile.open("read").read().split("\n").map(it => User.fromString(it));
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
     * @param password the password of the user
     * @param home the path to the user's home directory, or `undefined` to use `/home/<name>`
     * @param description the description of the user
     */
    constructor(name: string, password: string, home: string | undefined, description: string = "") {
        this.name = name;
        this.password = password;
        this.home = home ?? `/home/${name}`;
        this.description = description;
    }


    /**
     * Converts a string to a user object.
     *
     * @param string the string to convert to a user object
     * @return the user object described by the given string
     */
    static fromString(string: string): User {
        const parts = string.split("|");
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
}
