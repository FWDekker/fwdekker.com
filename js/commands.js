const commands = {};


// Constants
commands.list = {};


// Functions
commands.cd = function (args) {
    return fs.cd(args[1]);
};

commands.clear = function () {
    terminal.clear();
    return ``;
};

commands.echo = function (args) {
    return args.slice(1).join(` `).replace(`hunter2`, `*******`);
};

commands.exit = function () {
    terminal.reset();
    return ``;
};

commands.help = function (args) {
    const command = (args[1] || ``).toLowerCase();
    const commandNames = Object.keys(commands.list);

    if (commandNames.indexOf(command) >= 0) {
        const info = commands.list[command];

        return "" +
            `${command} - ${info.summary}

			<b>Usage</b>
			${info.usage}

			<b>Description</b>
			${info.desc}`.trimLines();
    } else {
        const commandWidth = Math.max.apply(null, commandNames.map(it => it.length)) + 4;
        const commandEntries = commandNames.map(
            it => `${it.padEnd(commandWidth, ' ')}${commands.list[it].summary}`
        );

        return "" +
            `<b>List of commands</b>
			${commandEntries.join(`\n`)}

			Write "help [COMMAND]" for more information on a command.`.trimLines();
    }
};

commands.ls = function (args) {
    const files = fs.ls(args[1]);
    if (files === undefined) {
        return `The directory '${args[1]}' does not exist`;
    }

    const dirList = [];
    const fileList = [];

    Object.keys(files).sort().forEach(fileIndex => {
        const file = files[fileIndex];

        if (typeof file === `string`) {
            fileList.push(file);
        } else {
            dirList.push(`${fileIndex}/`);
        }
    });

    return dirList.concat(fileList).join(`\n`);
};

commands.mkdir = function (args) {
    return fs.mkdir(args[1]);
};

commands.pwd = function () {
    return fs.pwd;
};

commands.rm = function (args) {
    return fs.rm(args[1]);
};

commands.rmdir = function (args) {
    let path;
    let force;
    if (args[1] === `-f` || args[1] === `--force`) {
        path = args[2];
        force = true;
    } else {
        path = args[1];
        force = false;
    }

    return fs.rmdir(path, force);
};


// Init
commands.list = {
    clear: {
        fun: commands.clear,
        summary: `clear terminal output`,
        usage: `clear`,
        desc: `Clears all previous terminal output.`.trimLines()
    },
    cd: {
        fun: commands.cd,
        summary: `change directory`,
        usage: `cd [DIRECTORY]`,
        desc: "" +
            `Changes the current working directory to [DIRECTORY].
			If [DIRECTORY] is empty, nothing happens.`.trimLines()
    },
    echo: {
        fun: commands.echo,
        summary: `display text`,
        usage: `echo [TEXT]`,
        desc: `Displays [TEXT].`.trimLines()
    },
    exit: {
        fun: commands.exit,
        summary: `close session`,
        usage: `exit`,
        desc: `Closes the terminal session.`.trimLines()
    },
    help: {
        fun: commands.help,
        summary: `display documentation`,
        usage: `help [COMMAND]`,
        desc: "" +
            `Displays help documentation for [COMMAND].
			If [COMMAND] is empty, a list of all commands is shown.`.trimLines()
    },
    ls: {
        fun: commands.ls,
        summary: `list directory contents`,
        usage: `ls [DIRECTORY]`,
        desc: "" +
            `Displays the files and directories in [DIRECTORY].
			If [DIRECTORY] is empty, the files and directories in the current working directory are shown.`.trimLines()
    },
    mkdir: {
        fun: commands.mkdir,
        summary: `create directory`,
        usage: `mkdir [DIRECTORY]`,
        desc: `Creates a directory with name [DIRECTORY].`.trimLines()
    },
    pwd: {
        fun: commands.pwd,
        summary: `print working directory`,
        usage: `pwd`,
        desc: `Displays the current working directory.`.trimLines()
    },
    rm: {
        fun: commands.rm,
        summary: `remove file`,
        usage: `rm [-f | --force] FILE`,
        desc: `Removes FILE if it is a file.`.trimLines()
    },
    rmdir: {
        fun: commands.rmdir,
        summary: `remove directory`,
        usage: `rmdir [-f | --force] DIR`,
        desc: `Removes DIR if it is a directory.`.trimLines()
    }
};


// Functions
commands.parse = function (input) {
    const args = input.split(` `);
    const command = (args[0] || ``).toLowerCase();

    if (Object.keys(commands.list).indexOf(command) >= 0) {
        return commands.list[command].fun(args);
    } else if (command.trim() === ``) {
        return ``;
    } else {
        return `Unknown command '${args[0]}'`
    }
};
