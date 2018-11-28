//////
///
/// Commands
///
//////

const commands = {};


// Init
addOnLoad(() => {
    terminal.reset();
    terminal.processInput(`ls`);
    terminal.input.focus();
});


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

        return trim(
            `${command} - ${info.summary}

					<b>Usage</b>
					${info.usage}

					<b>Description</b>
					${info.desc}`
        );
    } else {
        const commandWidth = Math.max.apply(null, commandNames.map(it => it.length)) + 4;
        const commandEntries = commandNames.map(
            it => `${it.padEnd(commandWidth, ' ')}${commands.list[it].summary}`
        );

        return trim(
            `<b>List of commands</b>
					${commandEntries.join(`\n`)}

					Write "help [COMMAND]" for more information on a command.`
        );
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
        desc: trim(
            `Clears all previous terminal output.`
        )
    },
    cd: {
        fun: commands.cd,
        summary: `change directory`,
        usage: `cd [DIRECTORY]`,
        desc: trim(
            `Changes the current working directory to [DIRECTORY].
					If [DIRECTORY] is empty, nothing happens.`
        )
    },
    echo: {
        fun: commands.echo,
        summary: `display text`,
        usage: `echo [TEXT]`,
        desc: trim(
            `Displays [TEXT].`
        )
    },
    exit: {
        fun: commands.exit,
        summary: `close session`,
        usage: `exit`,
        desc: trim(
            `Closes the terminal session.`
        )
    },
    help: {
        fun: commands.help,
        summary: `display documentation`,
        usage: `help [COMMAND]`,
        desc: trim(
            `Displays help documentation for [COMMAND].
					If [COMMAND] is empty, a list of all commands is shown.`
        )
    },
    ls: {
        fun: commands.ls,
        summary: `list directory contents`,
        usage: `ls [DIRECTORY]`,
        desc: trim(
            `Displays the files and directories in [DIRECTORY].
					If [DIRECTORY] is empty, the files and directories in the current working directory are shown.`
        )
    },
    mkdir: {
        fun: commands.mkdir,
        summary: `create directory`,
        usage: `mkdir [DIRECTORY]`,
        desc: trim(
            `Creates a directory with name [DIRECTORY].`
        )
    },
    pwd: {
        fun: commands.pwd,
        summary: `print working directory`,
        usage: `pwd`,
        desc: trim(
            `Displays the current working directory.`
        )
    },
    rm: {
        fun: commands.rm,
        summary: `remove file`,
        usage: `rm [-f | --force] FILE`,
        desc: trim(
            `Removes FILE if it is a file.`
        )
    },
    rmdir: {
        fun: commands.rmdir,
        summary: `remove directory`,
        usage: `rmdir [-f | --force] DIR`,
        desc: trim(
            `Removes DIR if it is a directory.`
        )
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
