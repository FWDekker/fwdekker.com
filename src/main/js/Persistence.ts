import * as Cookies from "js-cookie";
import {Environment} from "./Environment";
import {Directory, FileSystem, Node, Path} from "./FileSystem";
import {UserList} from "./UserList";


/**
 * Manages persistence of state.
 */
export class Persistence {
    /**
     * Deserializes a file system from persistent storage, or returns the default file system if the deserialization
     * failed.
     */
    static getFileSystem(): FileSystem {
        const filesString = Cookies.get("files");

        let files: Directory | undefined = undefined;
        if (filesString !== undefined) {
            try {
                const parsedFiles = Node.deserialize(filesString);
                if (parsedFiles instanceof Directory)
                    files = parsedFiles;
                else
                    console.warn("`files` cookie contains non-directory.");
            } catch (error) {
                console.warn("Failed to deserialize `files` cookie.", error);
            }
        }

        return new FileSystem(files);
    }

    /**
     * Persists the given file system.
     *
     * @param fileSystem the file system to persist
     */
    static setFileSystem(fileSystem: FileSystem) {
        Cookies.set("files", fileSystem.root, {
            "expires": new Date(new Date().setFullYear(new Date().getFullYear() + 25)),
            "path": "/"
        });
    }

    /**
     * Deserializes an environment from persistent storage, or returns the default environment if the deserialization
     * failed.
     *
     * @param fileSystem the file system used to validate the `cwd` environment variable
     * @param userList the list of users used to validate the `user` environment variable
     */
    static getEnvironment(fileSystem: FileSystem, userList: UserList): Environment {
        const environmentString = Cookies.get("env") ?? "{}";

        let environment: Environment;
        try {
            environment = new Environment(["cwd", "home", "user"], JSON.parse(environmentString));
        } catch (error) {
            console.warn("Failed to set environment from cookie.");
            environment = new Environment(["cwd", "home", "user"]);
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
        if (!environment.has("cwd")) {
            environment.set("cwd", environment.get("home"));
        } else if (!fileSystem.has(new Path(environment.get("cwd")))) {
            console.warn(`Invalid cwd '${environment.get("cwd")}' in environment.`);
            environment.set("cwd", environment.get("home"));
        }

        return environment;
    }

    /**
     * Persists the given environment.
     *
     * @param environment the environment to persist
     */
    static setEnvironment(environment: Environment) {
        Cookies.set("env", environment.variables, {"path": "/"});
    }

    /**
     * Persists the "power off" setting.
     *
     * @param value the value to persist for the "power off" setting
     */
    static setPoweroff(value: boolean) {
        Cookies.set("poweroff", `${value}`, {
            "expires": new Date(new Date().setSeconds(new Date().getSeconds() + 30)),
            "path": "/"
        });
    }

    /**
     * Removes all persistent storage.
     */
    static reset() {
        Cookies.remove("files");
        Cookies.remove("env");
        Cookies.remove("poweroff");
    }
}
