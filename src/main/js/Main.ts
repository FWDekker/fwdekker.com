import * as semver from "semver";
// @ts-ignore
const {$, doAfterLoad, nav} = window.fwdekker;
import {FileSystem} from "./FileSystem";
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
        location.reload(true);
        throw new ExpectedGoodbyeError("Goodbye");
    }

    if (Persistence.getWasUpdated()) {
        $("#terminalOutput").innerHTML = "" +
            "<span style=\"color:red\">The terminal application has been updated. To prevent unexpected errors, all " +
            "previous user changes have been reset.</span>\n\n";
        Persistence.setWasUpdated(false);
    }

    Persistence.setVersion(latestVersion);
});

/**
 * Exits the application if the server is "shut down".
 */
doAfterLoad(() => {
    if (!Persistence.getPoweroff()) return;

    $("#terminalOutput").innerText = "Could not connect to fwdekker.com. Retrying in 10 seconds.";
    setTimeout(() => location.reload(), 10000);
    throw new ExpectedGoodbyeError("Goodbye");
});

/**
 * Initializes the application.
 */
doAfterLoad(async () => {
    $("#nav").appendChild(nav("/"));
    if (!Persistence.hasFileSystem())
        await FileSystem.loadNavApi();

    window.terminal = new Terminal(
        $("#terminal"),
        $("#terminalInputField"),
        $("#terminalOutput"),
        $("#terminalInputPrefix"),
        $("#terminalSuggestions")
    );
    window.execute = (command: string) => window.terminal.processInput(command);

    // @ts-ignore: Ugly hack to check if user is logged in
    if (window.terminal.shell.environment.get("user") !== "")
        window.execute("ls -l");
});
