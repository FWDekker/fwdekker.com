/**
 * Manages a list of users.
 */
export class UserList {
    /**
     * All users that exist in the system.
     */
    private _users: User[];


    /**
     * Constructs a new list of users.
     *
     * @param users the list of users that are available, or `undefined` if the default users should be available
     */
    constructor(users: User[] | undefined = undefined) {
        if (users === undefined)
            this._users = [
                new User("felix", "password", "/home/felix", "Why are you logged in on <i>my</i> account?"),
                new User("root", "g9PjKu", "/root", "You're a hacker, Harry!")
            ];
        else
            this._users = users;
    }


    /**
     * Returns a copy of the list of all users.
     */
    get users(): User[] {
        return this._users.slice();
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
     * Returns the user with the given name, or `undefined` if there is no such user.
     *
     * @param name the name of the user to return
     */
    get(name: string): User | undefined {
        return this._users.find(it => it.name === name);
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
     * @param home the path to the user's home directory
     * @param description the description of the user
     */
    constructor(name: string, password: string, home: string, description: string) {
        this.name = name;
        this.password = password;
        this.home = home;
        this.description = description;
    }
}
