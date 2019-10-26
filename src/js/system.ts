export class System { // TODO Rename to "user manager"?
    private _users: User[];
    private _currentUser: User | undefined;


    constructor() {
        this._users = [
            new User("felix", "password", "Why are you logged in on <i>my</i> account?"),
            new User("root", "root", "Wait how did you get here?")
        ];
        this._currentUser = this.getUser("felix");
        if (this._currentUser === undefined)
            throw "Could not find user `felix`.";
    }


    get users(): User[] {
        return this._users.slice();
    }

    get currentUser(): User | undefined {
        return this._currentUser;
    }

    get isLoggedIn(): boolean {
        return this.currentUser !== undefined;
    }


    getUser(name: string): User | undefined {
        return this._users.find(it => it.name === name);
    }

    tryLogIn(name: string, password: string): boolean {
        const user = this.getUser(name);
        if (user === undefined)
            return false;

        if (user.password !== password)
            return false;

        this._currentUser = user;
        return true;
    }


    logOut(): void {
        this._currentUser = undefined;
    }
}


export class User {
    readonly name: string;
    readonly password: string;
    readonly description: string;


    constructor(name: string, password: string, description: string) {
        this.name = name;
        this.password = password;
        this.description = description;
    }
}
