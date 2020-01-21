import {Persistence} from "./Persistence";
import {addOnLoad, ExpectedGoodbyeError, q} from "./Shared";
import {Terminal} from "./Terminal";
import * as semver from "semver";


declare global {
    interface Window {
        /**
         * The main terminal.
         */
        terminal: Terminal
        /**
         * Executes a command in the main terminal.
         *
         * @param command the command to execute
         */
        execute: (command: string) => void
    }
}


/**
 * Compares version numbers to ensure no compatibility errors ensure.
 */
addOnLoad(() => {
    const userVersion = Persistence.getVersion();
    const latestVersion = "%%VERSION_NUMBER%%";

    if (semver.lt(userVersion, latestVersion)) {
        Persistence.reset();
        Persistence.setWasUpdated(true); // Message is displayed after reload
        location.reload(true);
        throw new ExpectedGoodbyeError("Goodbye");
    }

    if (Persistence.getWasUpdated()) {
        q("#terminalOutput").innerHTML = "" +
            "<span style=\"color:red\">This website has been updated. To prevent unexpected errors, all previous " +
            "user changes have been reset.</span>\n\n";
        Persistence.setWasUpdated(false);
    }

    Persistence.setVersion(latestVersion);
});

/**
 * Exist the application if the server is "shut down".
 */
addOnLoad(() => {
    if (Persistence.getPoweroff()) {
        q("#terminalOutput").innerText = "Could not connect to fwdekker.com. Retrying in 10 seconds.";
        setTimeout(() => location.reload(), 10000);
        throw new ExpectedGoodbyeError("Goodbye");
    }
});

/**
 * Initializes the application.
 */
addOnLoad(() => {
    window.terminal = new Terminal(
        q("#terminal"),
        q("#terminalCurrentFocusInput"),
        q("#terminalOutput"),
        q("#terminalCurrentPrefix")
    );
    window.execute = (command: string) => window.terminal.processInput(command);

    // @ts-ignore: Ugly hack to execute it anyway
    if (window.terminal.shell.environment.get("user") !== "")
        window.execute("ls");
});
