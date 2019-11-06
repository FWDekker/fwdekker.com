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
    window.terminal = new Terminal(
        q("#terminal"),
        q("#terminalCurrentFocusInput"),
        q("#terminalOutput"),
        q("#terminalCurrentPrefix")
    );
    window.execute = (command: string) => window.terminal.processInput(command);

    // @ts-ignore: Ugly hack to execute it anyway
    if (window.terminal.shell.environment.get("user") !== "")
        window.terminal.processInput("ls");
});
