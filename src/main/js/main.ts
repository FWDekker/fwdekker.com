import {addOnLoad, q} from "./shared";
import {Terminal} from "./terminal";


// TODO Ignore ts-ignore in whole block
// TODO Add interface for Window to add types
addOnLoad(() => {
    // @ts-ignore: Force definition
    window.terminal = new Terminal(
        q("#terminal"),
        q("#terminalCurrentFocusInput"),
        q("#terminalOutput"),
        q("#terminalCurrentPrefix")
    );
    // @ts-ignore: Force definition
    window.relToAbs = (filename: string) => window.terminal.shell.fileSystem.getPathTo(filename).toString();
    // @ts-ignore: Force definition
    window.run = (command: string) => window.terminal.processInput(command);

    // @ts-ignore: Force definition
    if (window.terminal.shell.userSession.isLoggedIn)
    // @ts-ignore: Force definition
        window.terminal.processInput("ls");
});
