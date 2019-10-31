import {addOnLoad, q} from "./shared";
import {Terminal} from "./terminal";


// TODO Ignore ts-ignore in whole block
addOnLoad(() => {
    // @ts-ignore: Force definition
    window.terminal = new Terminal(
        q("#terminal"),
        q("#terminalCurrentFocusInput"),
        q("#terminalOutput"),
        q("#terminalCurrentPrefix")
    );
    // @ts-ignore: Force definition
    window.relToAbs = (filename: string) => window.terminal.shell.fileSystem.cwd + filename;
    // @ts-ignore: Force definition
    window.run = (command: string) => window.terminal.processInput(command);

    // @ts-ignore
    if (window.terminal.shell.userSession.isLoggedIn)
    // @ts-ignore
        window.terminal.processInput("ls");
});
