const {$, doAfterLoad} = (window as any).fwdekker;
import * as semver from "semver";

import {Persistence} from "./Persistence";
import {ExpectedGoodbyeError} from "./Shared";
import {Terminal} from "./Terminal";


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
 * Compares version numbers to ensure no compatibility errors ensue.
 */
doAfterLoad(() => {
    const userVersion = Persistence.getVersion();
    const latestVersion = "%%VERSION_NUMBER%%";

    if (semver.lt(userVersion, latestVersion)) {
        Persistence.reset();
        Persistence.setWasUpdated(true);  // Message is displayed after reload
        location.reload();
        throw new ExpectedGoodbyeError("Goodbye");
    }

    if (Persistence.getWasUpdated()) {
        $("#terminal-output").innerHTML = "" +
            "<span class=\"error-message\">The terminal application has been updated. To prevent unexpected errors, " +
            "all previous user changes have been reset.</span>\n\n";
        Persistence.setWasUpdated(false);
    }

    Persistence.setVersion(latestVersion);
});

/**
 * Exits the application if the server is "shut down".
 */
doAfterLoad(() => {
    if (!Persistence.getPoweroff()) return;

    $("#terminal-output").innerText = "Could not connect to fwdekker.com. Retrying in 10 seconds.";
    setTimeout(() => location.reload(), 10000);
    throw new ExpectedGoodbyeError("Goodbye");
});

/**
 * Initializes the application.
 */
doAfterLoad(async () => {
    window.terminal = new Terminal(
        $("#terminal"),
        $("#terminal-input-field"),
        $("#terminal-output"),
        $("#terminal-input-prefix"),
        $("#terminal-suggestions")
    );
    window.execute = (command: string) => window.terminal.processInput(command);

    // @ts-ignore: Ugly hack to check if user is logged in
    if (window.terminal.shell.environment.get("user") !== "")
        window.execute("ls -l");
});
