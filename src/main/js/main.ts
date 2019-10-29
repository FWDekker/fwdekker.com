import {addOnLoad, q} from "./shared.js";
import {Terminal} from "./terminal.js";


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
    window.relToAbs = (filename: string) => window.terminal.fileSystem.pwd + filename;
    // @ts-ignore: Force definition
    window.run = (command: string) => window.terminal.processInput(command);

    // @ts-ignore
    window.terminal.processInput("ls");
});
