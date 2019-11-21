import {Persistence} from "./Persistence";
import {addOnLoad, q} from "./Shared";
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


addOnLoad(() => {
    if (Persistence.getPoweroff()) {
        q("#terminalOutput").innerText = "Could not connect to fwdekker.com. Retrying in 10 seconds.";
        setTimeout(() => location.reload(), 10000);
        return;
    }

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
