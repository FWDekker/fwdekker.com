import * as Cookies from "js-cookie";
import {Environment} from "./Environment";
import {Directory, FileSystem, Node} from "./FileSystem";
import {InputHistory} from "./InputHistory";
import {UserList} from "./UserList";


/**
 * Manages persistence of state.
 */
export class Persistence {
    /**
     * Deserializes an environment from persistent storage, or returns the default environment if the deserialization
     * failed.
     *
     * @param userList the list of users used to validate the `user` environment variable
     */
    static getEnvironment(userList: UserList): Environment {
        const environmentString = Cookies.get("env") ?? "{}";

        let environment: Environment;
        try {
            environment = new Environment(["cwd", "home", "user", "status"], JSON.parse(environmentString));
        } catch (error) {
            console.warn("Failed to set environment from cookie.");
            environment = new Environment(["cwd", "home", "user", "status"]);
        }

        // Check user in environment
        if (!environment.has("user")) {
            environment.set("user", "felix");
        } else if (environment.get("user") !== "" && !userList.has(environment.get("user"))) {
            console.warn(`Invalid user '${environment.get("user")}' in environment.`);
            environment.set("user", "felix");
        }

        // Set home directory
        environment.set("home", userList.get(environment.get("user"))?.home ?? "/");

        // Check cwd in environment
        if (!environment.has("cwd"))
            environment.set("cwd", environment.get("home"));

        // Set status
        environment.set("status", "0");

        return environment;
    }

    /**
     * Persists the given environment.
     *
     * @param environment the environment to persist
     */
    static setEnvironment(environment: Environment): void {
        Cookies.set("env", environment.variables, {"path": "/"});
    }

    /**
     * Deserializes a file system from persistent storage, or returns the default file system if the deserialization
     * failed.
     */
    static getFileSystem(): FileSystem {
        const fileString = localStorage.getItem("files");
        if (fileString !== null) {
            try {
                const parsedFiles = Node.deserialize(fileString);
                if (parsedFiles instanceof Directory)
                    return new FileSystem(parsedFiles);
                else
                    console.warn("'files' cookie contains non-directory.");
            } catch (error) {
                console.warn("Failed to deserialize 'files' cookie.", error);
            }
        }

        return new FileSystem();
    }

    /**
     * Persists the given file system.
     *
     * @param fileSystem the file system to persist
     */
    static setFileSystem(fileSystem: FileSystem): void {
        localStorage.setItem("files", JSON.stringify(fileSystem.root));
    }

    /**
     * Deserializes a history from persistent storage, or returns the default history if the deserialization failed.
     */
    static getHistory(): InputHistory {
        try {
            return new InputHistory(JSON.parse(localStorage.getItem("history") ?? "[]"));
        } catch (error) {
            console.warn("Failed to deserialize 'history' cookie.", error);
            return new InputHistory();
        }
    }

    /**
     * Persists the given history.
     *
     * @param history the history to persist
     */
    static setHistory(history: InputHistory): void {
        localStorage.setItem("history", JSON.stringify(history.entries));
    }

    /**
     * Returns the persisted "power off" setting.
     */
    static getPoweroff(): boolean {
        try {
            return JSON.parse(Cookies.get("poweroff") ?? "false");
        } catch(error) {
            console.warn("Failed to deserialize 'poweroff' cookie.", error);
            return false;
        }
    }

    /**
     * Persists the "power off" setting.
     *
     * @param value the value to persist for the "power off" setting
     */
    static setPoweroff(value: boolean): void {
        Cookies.set("poweroff", "" + value, {
            "expires": new Date(new Date().setSeconds(new Date().getSeconds() + 30)),
            "path": "/"
        });
    }

    /**
     * Removes all persistent storage.
     */
    static reset(): void {
        localStorage.clear();
        Cookies.remove("env");
        Cookies.remove("poweroff");
    }
}
