import {Directory, File} from "./FileSystem";


// An escaped newline escape symbol.
const n = "\\\\\\";


// noinspection HtmlUnknownAttribute // False positive
/**
 * Creates the default scripts in the `/bin` directory.
 *
 * @return the default scripts in the `/bin` directory
 */
export const createSlashBin = () => new Directory({
    "and": new File(`new Command(
        (input, streams) => {
            const previousStatus = Number(josh.environment.getOrDefault("status", "0"));
            if (previousStatus !== 0)
                return previousStatus;

            return josh.interpreter.execute(
                InputParser.create(josh.environment, josh.fileSystem).parseCommand(input.args),
                streams
            );
        },
        \`execute command if previous command did not fail\`,
        \`and <u>command</u>\`,
        \`Executes <u>command</u> with its associated options and arguments if and only if the status code of the ${n}
        previously-executed command is 0.

        The exit code is retained if it was non-zero, and is changed to that of <u>command</u> otherwise.${n}
        \`.trimMultiLines(),
        new InputValidator({minArgs: 1})
    )`),
    "cat": new File(`new Command(
        (input, streams) => {
            return input.args
                .map(arg => Path.interpret(josh.environment.get("cwd"), arg))
                .map(path => {
                    if (!josh.fileSystem.has(path)) {
                        streams.err.writeLine(\`cat: \${path}: No such file.\`);
                        return -1;
                    }

                    const node = josh.f.get(path);
                    if (!(node instanceof File)) {
                        streams.err.writeLine(\`cat: \${path}: No such file.\`);
                        return -1;
                    }

                    let contents = node.open("read").read();
                    if (input.hasAnyOption("e", "--escape-html"))
                        contents = escapeHtml(contents);
                    if (!contents.endsWith("\\n"))
                        contents += "\\n";

                    streams.out.write(contents);
                    return 0;
                })
                .reduce((acc, exitCode) => exitCode === 0 ? acc : exitCode);
        },
        \`concatenate and print files\`,
        \`cat [<b>-e</b> | <b>--escape-html</b>] <u>file</u> <u>...</u>\`,
        \`Reads files sequentially, writing them to the standard output.

        If the file contains valid HTML, it will be displayed as such by default. If the <b>--html</b> option is ${n}
        given, special HTML characters are escaped and the raw text contents can be inspected.\`.trimMultiLines(),
        new InputValidator({minArgs: 1})
    )`),
    "cd": new File(`new Command(
        (input, streams) => {
            if (input.argc === 0 || input.args[0] === "") {
                josh.environment.set("cwd", josh.environment.get("home"));
                return 0;
            }

            const path = Path.interpret(josh.environment.get("cwd"), input.args[0]);
            if (!josh.fileSystem.has(path) || !(josh.fileSystem.get(path) instanceof Directory)) {
                streams.err.writeLine(\`cd: The directory '\${path}' does not exist.\`);
                return -1;
            }

            josh.environment.set("cwd", path.toString());
            return 0;
        },
        \`change directory\`,
        \`cd [<u>directory</u>]\`,
        \`Changes the current working directory to <u>directory</u>. If no <u>directory</u> is supplied, the ${n}
        current working directory is changed to the current user's home directory.\`.trimMultiLines(),
        new InputValidator({maxArgs: 1})
    )`),
    "cp": new File(`new Command(
        (input, streams) => {
            let mappings;
            try {
                mappings = josh.interpreter.moveCopyMappings(input);
            } catch (error) {
                streams.err.writeLine(\`cp: \${error.message}\`);
                return -1;
            }

            return mappings
                .map(([source, destination]) => {
                    try {
                        josh.fileSystem.copy(source, destination, input.hasAnyOption("-r", "-R", "--recursive"));
                        return 0;
                    } catch (error) {
                        streams.err.writeLine(\`cp: \${error.message}\`);
                        return -1;
                    }
                })
                .reduce((acc, exitCode) => exitCode === 0 ? acc : exitCode);
        },
        \`copy files\`,
        \`cp [<b>-r</b> | <b>-R</b> | <b>--recursive</b>] <u>source</u> <u>target file</u>
        cp [<b>-r</b> | <b>-R</b> | <b>--recursive</b>] <u>source</u> <u>...</u> <u>target directory</u>\`,
        \`In its first form, <u>source</u> is copied to <u>target file</u>. This form is used if there is no file ${n}
        or directory at <u>target file</u> beforehand.

        In its second form, all <u>source</u> files are copied into <u>target directory</u>, which must be a ${n}
        pre-existing directory. The file names of the <u>source</u> files are retained.

        In both forms, <u>source</u> files are not copied if they are directories and the <b>-R</b> option is not ${n}
        given.\`.trimMultiLines(),
        new InputValidator({minArgs: 2})
    )`),
    "clear": new File(`new Command(
        (input, streams) => {
            streams.out.write(EscapeCharacters.Escape + EscapeCharacters.Clear);
            return 0;
        },
        \`clear terminal output\`,
        \`clear\`,
        \`Clears all previous terminal output.\`,
        new InputValidator({maxArgs: 0})
    )`),
    "echo": new File(`new Command(
        (input, streams) => {
            const message = input.args.join(" ").replace("hunter2", "*******");

            if (input.hasAnyOption("-n", "--newline"))
                streams.out.write(message);
            else
                streams.out.writeLine(message);

            return 0;
        },
        \`display text\`,
        \`echo [<b>-n</b> | <b>--newline</b>] [<u>text</u> <u>...</u>]\`,
        \`Displays each <u>text</u> separated by a single whitespace.

        Unless the <b>--newline</b> parameter is given, a newline is appended to the end.\`.trimMultiLines(),
        new InputValidator()
    )`),
    "exit": new File(`new Command(
        (input, streams) => {
            josh.environment.set("user", "");
            return 0;
        },
        \`close session\`,
        \`exit\`,
        \`Closes the terminal session.\`,
        new InputValidator({maxArgs: 0})
    )`),
    "hier": new File(`new DocOnlyCommand(
        \`description of the filesystem hierarchy\`,
        \`A typical josh system has, among others, the following directories:

        <u>/</u>      This is the root directory. This is where the whole tree starts.

        <u>/bin</u>   Executable programs fundamental to user environments.

        <u>/dev</u>   Contains special files and device files that refer to physical devices.

        <u>/home</u>  Contains directories for users to store personal files in.

        <u>/root</u>  The home directory of the root user.\`.trimMultiLines()
    )`),
    "ls": new File(`new Command(
        (input, streams) => {
            return (input.argc === 0 ? [""] : input.args)
                .map(arg => Path.interpret(josh.environment.get("cwd"), arg))
                .map((path, i) => {
                    if (i > 0)
                        streams.out.write("\\n");

                    const node = josh.fileSystem.get(path);
                    if (node === undefined) {
                        streams.err.writeLine(\`ls: The directory '\${path}' does not exist.\`);
                        return -1;
                    }
                    if (!(node instanceof Directory)) {
                        streams.err.writeLine(\`ls: '\${path}' is not a directory.\`);
                        return -1;
                    }

                    const dirList = [
                        new Directory().nameString("./", path),
                        new Directory().nameString("../", path.parent)
                    ];
                    const fileList = [];

                    const nodes = node.nodes;
                    Object.keys(nodes)
                        .sortAlphabetically(it => it, true)
                        .forEach(name => {
                            const node = nodes[name];
                            if (!input.hasAnyOption("-a", "-A", "--all") && name.startsWith("."))
                                return;

                            if (node instanceof Directory)
                                dirList.push(node.nameString(\`\${name}/\`, path.getChild(name)));
                            else if (node instanceof File)
                                fileList.push(node.nameString(name, path.getChild(name)));
                            else
                                throw new IllegalStateError(
                                    \`ls: '\${path.getChild(name)}' is neither a file nor a directory.\`);
                        });

                    if (input.argc > 1)
                        streams.out.writeLine(\`<b>\${path}</b>\`);
                    streams.out.writeLine(dirList.concat(fileList).join("\\n"));
                    return 0;
                })
                .reduce((acc, exitCode) => exitCode === 0 ? acc : exitCode);
        },
        \`list directory contents\`,
        \`ls [<b>-a</b> | <b>-A</b> | <b>--all</b>] [<u>directory</u> <u>...</u>]\`,
        \`Displays the files and directories in each <u>directory</u>. If no directory is given, the files and ${n}
        directories in the current working directory are shown. If more than one directory is given, the files and ${n}
        directories are shown for each given <u>directory</u> in order.

        Files starting with a <u>.</u> are only shown if the <b>--all</b> option is given, with the exception of ${n}
        <u>.</u> and <u>..</u>, which are always shown.\`.trimMultiLines(),
        new InputValidator()
    )`),
    "help": new File(`new Command(
        (input, streams) => {
            if (input.argc > 0) {
                return input.args
                    .map((commandName, i) => {
                        if (i > 0)
                            streams.out.write("\\n\\n");

                        const command = josh.interpreter.resolve(commandName);
                        if (command === undefined) {
                            streams.out.writeLine(\`Unknown command '\${commandName}'.\`);
                            return -1;
                        }

                        let helpString = "<b>Name</b>\\n" + commandName;
                        if (command.summary !== null)
                            helpString += "\\n\\n<b>Summary</b>\\n" + command.summary;
                        if (command.usage !== null)
                            helpString += "\\n\\n<b>Usage</b>\\n" + command.usage;
                        if (command.desc !== null)
                            helpString += "\\n\\n<b>Description</b>\\n" + command.desc;

                        streams.out.writeLine(helpString);
                        return 0;
                    })
                    .reduce((acc, exitCode) => exitCode === 0 ? acc : exitCode);
            } else {
                const cwd = josh.environment.get("cwd");
                const slashBin = josh.fileSystem.get(Path.interpret(cwd, "/bin"));
                if (!(slashBin instanceof Directory)) {
                    return -1;
                }

                const commands = {};
                Object.keys(slashBin.nodes).map(it => {
                    const command = josh.interpreter.resolve(it);
                    if (command !== undefined) commands[it] = command;
                });
                const commandNames = Object.keys(commands).filter(it => !(commands[it] instanceof DocOnlyCommand));

                const commandWidth = Math.max.apply(null, commandNames.map(it => it.length)) + 4;
                const commandPaddings = commandNames.map(it => commandWidth - it.length);
                const commandLinks = commandNames
                    .map(it => \`<a href="#" onclick="execute('help \${it}')">\${it}</a>\`)
                    .map((it, i) => \`\${it.padEnd(it.length + commandPaddings[i], " ")}\`);
                const commandEntries = commandNames
                    .map((it, i) => \`\${commandLinks[i]}\${commands[it].summary}\`);

                const target = josh.util.isStandalone() ? \`target="_blank"\` : "";
                streams.out.writeLine(
                    \`The source code of this website is ${n}
                    <a href="https://git.fwdekker.com/FWDekker/fwdekker.com" \${target}>available on git</a>.

                    <b>List of commands</b>
                    \${commandEntries.join("\\n")}

                    Write "help [COMMAND]" or click a command in the list above for more information.\`.trimMultiLines()
                );
                return 0;
            }
        },
        \`display documentation\`,
        \`help [<u>command</u> <u>...</u>]\`,
        \`Displays help documentation for each <u>command</u>.

        If no commands are given, a list of all commands is shown.\`.trimMultiLines(),
        new InputValidator()
    )`),
    "mkdir": new File(`new Command(
        (input, streams) => {
            return input.args
                .map(arg => Path.interpret(josh.environment.get("cwd"), arg))
                .map(path => {
                    try {
                        josh.fileSystem.add(path, new Directory(), input.hasAnyOption("-p", "--parents"));
                        return 0;
                    } catch (error) {
                        streams.err.writeLine(\`mkdir: \${error.message}\`);
                        return -1;
                    }
                })
                .reduce((acc, exitCode) => exitCode === 0 ? acc : exitCode);
        },
        \`make directories\`,
        \`mkdir [<b>-p</b> | <b>--parents</b>] <u>directory</u> <u>...</u>\`,
        \`Creates the directories given by <u>directory</u>.

        If more than one <u>directory</u> is given, the directories are created in the order they are given in. If ${n}
        the <b>--parents</b> option is given, parent directories that do not exist are created as well.${n}
        \`.trimMultiLines(),
        new InputValidator({minArgs: 1})
    )`),
    "mv": new File(`new Command(
        (input, streams) => {
            let mappings;
            try {
                mappings = josh.interpreter.moveCopyMappings(input);
            } catch (error) {
                streams.err.writeLine(\`mv: \${error.message}\`);
                return -1;
            }

            return mappings
                .map(([source, destination]) => {
                    try {
                        josh.fileSystem.move(source, destination);
                        return 0;
                    } catch (error) {
                        streams.err.writeLine(\`mv: \${error.message}\`);
                        return -1;
                    }
                })
                .reduce((acc, exitCode) => exitCode === 0 ? acc : exitCode);
        },
        \`move files\`,
        \`mv <u>source</u> <u>destination file</u>
        mv <u>source</u> <u>...</u> <u>destination directory</u>\`,
        \`In its first form, <u>source</u> is renamed to <u>target file</u>. <u>target file</u> must not exist yet.

        In its second form, all <u>source</u> files are moved into <u>target directory</u>, which must be a ${n}
        pre-existing directory. The file names of the <u>source</u> files are retained.\`.trimMultiLines(),
        new InputValidator({minArgs: 2})
    )`),
    "not": new File(`new Command(
        (input, streams) => {
            return Number(!josh.interpreter.execute(
                InputParser.create(josh.environment, josh.fileSystem).parseCommand(input.args),
                streams
            ));
        },
        \`execute command and invert status code\`,
        \`not <u>command</u>\`,
        \`Executes <u>command</u> with its associated options and arguments and inverts its exit code. More ${n}
        precisely, the exit code is set to 0 if it was non-zero, and is set to 1 otherwise.\`.trimMultiLines(),
        new InputValidator({minArgs: 1})
    )`),
    "open": new File(`new Command(
        (input, streams) => {
            return input.args
                .map(it => Path.interpret(josh.environment.get("cwd"), it))
                .map((path, i) => {
                    try {
                        const target = i > 0 || input.hasAnyOption("-b", "--blank") || josh.util.isStandalone()
                            ? "_blank"
                            : "_self";
                        window.open(josh.fileSystem.open(path, "read").read(), target);
                        return 0;
                    } catch (error) {
                        streams.err.writeLine(\`open: \${error.message}\`);
                        return -1;
                    }
                })
                .reduce((acc, exitCode) => exitCode === 0 ? acc : exitCode);
        },
        \`open web pages\`,
        \`open [<b>-b</b> | <b>--blank</b>] <u>file</u> <u>...</u>\`,
        \`Opens the web pages linked to by <u>file</u>. The first <u>file</u> is opened in this tab and the ${n}
        subsequent <u>file</u>s are opened in new tabs. If <b>--blank</b> is set, the first <u>file</u> is opened ${n}
        in a new tab as well.

        If this command is executed inside of a standalone app instead of a browser, every <u>file</u> is opened in ${n}
        a tab regardless of whether <b>--blank</b> is given.\`.trimMultiLines(),
        new InputValidator({minArgs: 1})
    )`),
    "or": new File(`new Command(
        (input, streams) => {
            const previousStatus = Number(josh.environment.getOrDefault("status", "0"));
            if (previousStatus === 0)
                return previousStatus;

            return josh.interpreter.execute(
                InputParser.create(josh.environment, josh.fileSystem).parseCommand(input.args),
                streams
            );
        },
        \`execute command if previous command failed\`,
        \`or <u>command</u>\`,
        \`Executes <u>command</u> with its associated options and arguments if and only if the status code of the ${n}
        previously-executed command is not 0.

        The exit code is retained if it was zero, and is changed to that of <u>command</u> otherwise.${n}
        \`.trimMultiLines(),
        new InputValidator({minArgs: 1})
    )`),
    "poweroff": new File(`new Command(
        (input, streams) => {
            const userName = josh.environment.get("user");
            if (userName === "") {
                streams.err.writeLine("poweroff: Cannot execute while not logged in.");
                return -1;
            }

            Persistence.setPoweroff(true);
            setTimeout(() => location.reload(), 2000);

            streams.out.writeLine(
                \`Shutdown NOW!

                *** FINAL System shutdown message from \${userName}@fwdekker.com ***

                System going down IMMEDIATELY


                System shutdown time has arrived\`.trimLines()
            );
            return 0;
        },
        \`close down the system\`,
        \`poweroff\`,
        \`Automated shutdown procedure to nicely notify users when the system is shutting down.\`,
        new InputValidator({maxArgs: 0})
    )`),
    "pwd": new File(`new Command(
        (input, streams) => {
            streams.out.writeLine(josh.environment.get("cwd") ?? "");
            return 0;
        },
        \`print working directory\`,
        \`pwd\`,
        \`Displays the current working directory.\`,
        new InputValidator({maxArgs: 0})
    )`),
    "rm": new File(`new Command(
        (input, streams) => {
            return input.args
                .map(arg => Path.interpret(josh.environment.get("cwd"), arg))
                .map(path => {
                    try {
                        const target = josh.fileSystem.get(path);
                        if (target === undefined) {
                            if (input.hasAnyOption("-f", "--force"))
                                return 0;

                            streams.err.writeLine(\`rm: The file '\${path}' does not exist.\`);
                            return -1;
                        }
                        if (target instanceof Directory) {
                            if (!input.hasAnyOption("-r", "-R", "--recursive")) {
                                streams.err.writeLine(\`rm: '\${path}' is a directory.\`);
                                return -1;
                            }
                            if (path.toString() === "/" && !input.hasAnyOption("--no-preserve-root")) {
                                streams.err.writeLine("rm: Cannot remove root directory.");
                                return -1;
                            }
                        }

                        josh.fileSystem.remove(path);
                        return 0;
                    } catch (error) {
                        streams.err.writeLine(\`rm: \${error.message}\`);
                        return -1;
                    }
                })
                .reduce((acc, exitCode) => exitCode === 0 ? acc : exitCode);
        },
        \`remove file\`,
        \`rm [<b>-f</b> | <b>--force</b>] [<b>-r</b> | <b>-R</b> | <b>--recursive</b>] ${n}
        [<b>--no-preserve-root</b>] <u>file</u> <u>...</u>\`.trimMultiLines(),
        \`Removes each given <u>file</u>. If more than one <u>file</u> is given, they are removed in the order they ${n}
        are given in.

        If <b>--force</b> is set, no warning is given if a file could not be removed.

        If <b>--recursive</b> is set, files and directories are removed recursively; without this option ${n}
        directories cannot be removed.

        Unless <b>--no-preserve-root</b> is set, the root directory cannot be removed.\`.trimMultiLines(),
        new InputValidator({minArgs: 1})
    )`),
    "rmdir": new File(`new Command(
        (input, streams) => {
            return input.args
                .map(arg => Path.interpret(josh.environment.get("cwd"), arg))
                .map(path => {
                    try {
                        const target = josh.fileSystem.get(path);
                        if (target === undefined) {
                            streams.err.writeLine(\`rmdir: '\${path}' does not exist.\`);
                            return -1;
                        }
                        if (!(target instanceof Directory)) {
                            streams.err.writeLine(\`rmdir: '\${path}' is not a directory.\`);
                            return -1;
                        }
                        if (target.nodeCount !== 0) {
                            streams.err.writeLine(\`rmdir: '\${path}' is not empty.\`);
                            return -1;
                        }

                        josh.fileSystem.remove(path);
                        return 0;
                    } catch (error) {
                        streams.err.writeLine(\`rmdir: \${error.message}\`);
                        return -1;
                    }
                })
                .reduce((acc, exitCode) => exitCode === 0 ? acc : exitCode);
        },
        \`remove directories\`,
        \`rmdir <u>directory</u> <u>...</u>\`,
        \`Removes each given <u>directory</u>. If more than one <u>directory</u> is given, they are removed in the ${n}
        order they are given in. Non-empty directories will not be removed.\`.trimMultiLines(),
        new InputValidator({minArgs: 1})
    )`),
    "set": new File(`new Command(
        (input, streams) => {
            try {
                if (input.argc === 1)
                    josh.environment.safeDelete(input.args[0]);
                else
                    josh.environment.safeSet(input.args[0], input.args[1]);
            } catch (error) {
                streams.err.writeLine(\`set: \${error.message}\`);
                return -1;
            }

            return 0;
        },
        \`set environment variable\`,
        \`set <u>key</u> [<u>value</u>]\`,
        \`Sets the environment variable <u>key</u> to <u>value</u>. If no <u>value</u> is given, the environment ${n}
        variable is cleared. Read-only variables cannot be set.\`.trimMultiLines(),
        new InputValidator({minArgs: 1, maxArgs: 2})
    )`),
    "touch": new File(`new Command(
        (input, streams) => {
            return input.args
                .map(arg => Path.interpret(josh.environment.get("cwd"), arg))
                .map(path => {
                    try {
                        josh.fileSystem.add(path, new File(), false);
                        return 0;
                    } catch (error) {
                        streams.err.writeLine(\`touch: \${error.message}\`);
                        return -1;
                    }
                })
                .reduce((acc, exitCode) => exitCode === 0 ? acc : exitCode);
        },
        \`change file timestamps\`,
        \`touch <u>file</u> <u>...</u>\`,
        \`Update the access and modification times of each <u>file</u> to the current time. If a <u>file</u> does ${n}
        not exist, it is created.\`.trimMultiLines(),
        new InputValidator({minArgs: 1})
    )`),
    "whoami": new File(`new Command(
        (input, streams) => {
            const user = josh.userList.get(josh.environment.get("user"));
            if (user === undefined) {
                streams.err.writeLine("whoami: Cannot execute while not logged in.");
                return -1;
            }

            streams.out.writeLine(user.description);
            return 0;
        },
        \`print short description of user\`,
        \`whoami\`,
        \`Print a description of the user associated with the current effective user ID.\`,
        new InputValidator({maxArgs: 0})
    )`),
});
