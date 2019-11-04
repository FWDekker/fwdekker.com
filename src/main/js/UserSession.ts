import {IllegalStateError} from "./Shared";


/**
 * Manages a user session.
 */
export class UserSession {
    /**
     * All users that exist in the system.
     */
    private static _users: User[];
    /**
     * The user that is currently logged in in this session, or `undefined` if no user is logged in.
     */
    private _currentUser: User | undefined;


    /**
     * Constructs a new user.
     *
     * @param name the name of the user to be logged in as by default, or `undefined` if no user should be logged in at
     * the start of the session
     * @throws if a name is given and no user with that name exists
     */
    constructor(name: string | undefined = undefined) {
        if (name !== undefined) {
            const user = UserSession.getUser(name);
            if (user === undefined)
                throw new Error(`Could not find user \`${name}\`.`);
            this._currentUser = user;
        }
    }


    /**
     * Returns a copy of the list of all users.
     *
     * @return a copy of the list of all users
     */
    static get users(): User[] {
        return UserSession._users.slice();
    }

    /**
     * Returns the user that is currently logged in in this session, or `undefined` if no user is logged in.
     *
     * @return the user that is currently logged in in this session, or `undefined` if no user is logged in
     */
    get currentUser(): User | undefined {
        return this._currentUser;
    }

    /**
     * Returns `true` if and only if a user is currently logged in.
     *
     * @return `true` if and only if a user is currently logged in
     */
    get isLoggedIn(): boolean {
        return this.currentUser !== undefined;
    }


    /**
     * Returns `true` if and only if a user with the given name exists.
     *
     * @param name the name of the user to check
     * @return `true` if and only if a user with the given name exists
     */
    static userExists(name: string): boolean {
        return this.getUser(name) !== undefined;
    }

    /**
     * Returns the user with the given name, or `undefined` if there is no such user.
     *
     * @param name the name of the user to return
     * @return the user with the given name, or `undefined` if there is no such user
     */
    static getUser(name: string): User | undefined {
        return UserSession._users.find(it => it.name === name);
    }


    /**
     * Attempts to log in as the given user with the given password, and returns `true` if and only if the user was
     * successfully logged in.
     *
     * If logging in was successful, the current user is updated to the user with the given name.
     *
     * @param name the name of the user to try to log in as
     * @param password the password of the user to try to log in as
     * @return `true` if and only if the user was successfully logged in
     * @throws if a user is already logged in
     */
    tryLogIn(name: string, password: string): boolean {
        if (this.isLoggedIn)
            throw new IllegalStateError("Cannot try to log in while already logged in.");

        const user = UserSession.getUser(name);
        if (user === undefined)
            return false;

        if (user.password !== password)
            return false;

        this._currentUser = user;
        return true;
    }


    /**
     * Logs out the current user.
     */
    logOut(): void {
        this._currentUser = undefined;
    }


    /**
     * Initializes the array of users to the default array.
     *
     * @private
     */
    static _initialize(): void {
        this._users = [
            new User("felix", "password", "Why are you logged in on <i>my</i> account?"),
            new User("root", "root", "Wait how did you get here?")
        ];
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
     * The description of the user.
     */
    readonly description: string;


    /**
     * Constructs a new user.
     *
     * @param name the name of the user
     * @param password the password of the user
     * @param description the description of the user
     */
    constructor(name: string, password: string, description: string) {
        this.name = name;
        this.password = password;
        this.description = description;
    }
}


// Initialize default list of users
UserSession._initialize();
