import {expect} from "chai";
import "jsdom-global";
import "mocha";

import {Command, commandBinaries, Commands, ExitCode} from "../main/js/Commands";
import {Environment} from "../main/js/Environment";
import {Directory, File, FileSystem, Path} from "../main/js/FileSystem";
import {InputParser} from "../main/js/InputParser";
import {emptyFunction} from "../main/js/Shared";
import {Buffer, StreamSet} from "../main/js/Stream";
import {HashProvider, User, UserList} from "../main/js/UserList";


/**
 * A plain hash provider that doesn't actually hash anything.
 */
const plainHashProvider = new class extends HashProvider {
    hashPassword(password: string): string {
        return password;
    }

    checkPassword(hash: string, password: string): boolean {
        return password === hash;
    }
};


describe("commands", () => {
    let environment: Environment;
    let fileSystem: FileSystem;
    let userList: UserList;
    let commands: Commands;
    let parser: InputParser;
    let streamSet: StreamSet;


    beforeEach(() => {
        environment = new Environment(["cwd"], {"cwd": "/"});
        fileSystem = new FileSystem(new Directory());
        userList = new UserList(fileSystem);
        commands = new Commands(environment, userList, fileSystem);
        parser = InputParser.create(environment, fileSystem);
        streamSet = new StreamSet(new Buffer(), new Buffer(), new Buffer());
    });

    const loadCommand = (name: string) =>
        fileSystem.add(new Path(`/bin/${name}`), new File(commandBinaries[name]), true);

    const execute = (command: string) => commands.execute(parser.parseCommands(command)[0], streamSet);

    const readOut = () => (streamSet.out as Buffer).read();

    const readErr = () => (streamSet.err as Buffer).read();


    describe("execute", () => {
        it("writes an error if it cannot resolve the command", () => {
            expect(execute("does-not-exist")).to.equal(ExitCode.COMMAND_NOT_FOUND);
            expect(readErr()).to.equal("Unknown command 'does-not-exist'.\n");
        });

        it("writes an error if the command is invalid", () => {
            fileSystem.add(new Path("/command"), new File("invalid"), false);

            expect(execute("/command")).to.equal(ExitCode.COMMAND_NOT_FOUND);
            expect(readErr()).to.equal("Could not parse command '/command': ReferenceError: invalid is not defined.\n");
        });

        it("writes an error if the command is a doc-only command", () => {
            fileSystem.add(new Path("/command"), new File(`return new DocOnlyCommand("", "")`), false);

            expect(execute("/command")).to.equal(ExitCode.COMMAND_NOT_FOUND);
            expect(readErr()).to.equal("Could not execute doc-only command. Try 'help /command' instead.\n");
        });

        it("writes an error if the arguments to the command are invalid", () => {
            const command = `return new Command("", "", "", "", new InputValidator({minArgs: 2}))`;
            fileSystem.add(new Path("/command"), new File(command), false);

            expect(execute("/command arg1")).to.equal(ExitCode.USAGE);
            expect(readErr()).to.contain("Invalid usage of '/command'. Expected at least 2 arguments but got 1.");
        });

        it("executes the command otherwise", () => {
            const command = `return new Command(
                (input, streams) => { streams.out.writeLine(input.args[0]); return Number(input.args[1]); },
                "", "", "",
                new InputValidator()
            )`.trimMultiLines();
            fileSystem.add(new Path("/command"), new File(command), false);

            expect(execute("/command output 42")).to.equal(42);
            expect(readOut()).to.equal("output\n");
        });
    });

    describe("resolve", () => {
        describe("/bin commands", () => {
            it("resolves a command from /bin if it exists", () => {
                const command = `return new Command("", "Summary", "", "", "")`;
                fileSystem.add(new Path("/bin/command"), new File(command), true);

                expect((commands.resolve("command") as Command).summary).to.equal("Summary");
            });

            it("cannot resolve a command from /bin if it does not exist", () => {
                expect(commands.resolve("command")).to.equal(undefined);
            });

            it("resolves a /bin command using a relative path", () => {
                const command = `return new Command("", "Summary", "", "", "")`;
                fileSystem.add(new Path("/bin/command"), new File(command), true);

                expect((commands.resolve("bin/command") as Command).summary).to.equal("Summary");
            });
        });

        describe("relative commands", () => {
            it("resolves a command from a relative path if it exists", () => {
                fileSystem.add(new Path("/command"), new File(`return new Command("", "Summary", "", "", "")`), true);

                expect((commands.resolve("./command") as Command).summary).to.equal("Summary");
            });

            it("cannot resolve a command from a relative path if it does not exist", () => {
                expect(commands.resolve("./command")).to.equal(undefined);
            });
        });

        it("cannot resolve a command if the file cannot be parsed", () => {
            fileSystem.add(new Path("/command"), new File("invalid"), true);

            expect((commands.resolve("./command") as Error).message).to.equal("invalid is not defined");
        });
    });

    describe("commands", () => {
        describe("and", () => {
            beforeEach(() => {
                loadCommand("and");
                loadCommand("echo");
            });


            it("does nothing if the previous command exited unsuccessfully with a negative code", () => {
                environment.set("status", "-1");

                expect(execute("and echo 'message'")).to.equal(-1);
                expect(readOut()).to.equal("");
            });

            it("does nothing if the previous command exited unsuccessfully with a positive code", () => {
                environment.set("status", "1");

                expect(execute("and echo 'message'")).to.equal(1);
                expect(readOut()).to.equal("");
            });

            it("executes the command if the previous command exited successfully", () => {
                environment.set("status", "" + ExitCode.OK);

                expect(execute("and echo 'message'")).to.equal(ExitCode.OK);
                expect(readOut()).to.equal("message\n");
            });
        });

        describe("cat", () => {
            beforeEach(() => loadCommand("cat"));


            it("fails if the file does not exist", () => {
                expect(execute("cat /file")).to.equal(ExitCode.FILE_NOT_FOUND);
                expect(readErr()).to.equal(`cat: '/file': No such file.\n`);
            });

            it("fails if the target is not a file", () => {
                fileSystem.add(new Path("/dir"), new Directory(), false);

                expect(execute("cat /dir")).to.equal(ExitCode.FILE_NOT_FOUND);
                expect(readErr()).to.equal(`cat: '/dir': No such file.\n`);
            });

            it("writes the contents of the file to the output stream", () => {
                fileSystem.add(new Path("/file"), new File("contents"), false);

                expect(execute("cat /file")).to.equal(ExitCode.OK);
                expect(readOut()).to.equal("contents\n");
            });

            it("does not add an extra newline at the end if there already is one", () => {
                fileSystem.add(new Path("/file"), new File("contents\n"), false);

                expect(execute("cat /file")).to.equal(ExitCode.OK);
                expect(readOut()).to.equal("contents\n");
            });

            it("escapes HTML if prompted to do so", () => {
                fileSystem.add(new Path("/file"), new File("<i>contents</i>"), false);

                expect(execute("cat -e /file")).to.equal(ExitCode.OK);
                expect(readOut()).to.equal("&lt;i&gt;contents&lt;/i&gt;\n");
            });

            it("concatenates multiple file outputs", () => {
                fileSystem.add(new Path("/file1"), new File("contents1"), false);
                fileSystem.add(new Path("/file2"), new File("contents2"), false);

                expect(execute("cat /file1 /file2")).to.equal(ExitCode.OK);
                expect(readOut()).to.equal("contents1\ncontents2\n");
            });
        });

        describe("cd", () => {
            beforeEach(() => loadCommand("cd"));


            it("changes the directory to the home directory if no directory is given", () => {
                environment.set("home", "/home");

                expect(execute("cd")).to.equal(ExitCode.OK);
                expect(environment.get("cwd")).to.equal("/home");
            });

            it("fails if the target directory does not exist", () => {
                expect(execute("cd target")).to.equal(ExitCode.FILE_NOT_FOUND);
                expect(readErr()).to.equal("cd: The directory '/target' does not exist.\n");
            });

            it("fails if the target is a file", () => {
                fileSystem.add(new Path("/target"), new File(), false);

                expect(execute("cd target")).to.equal(ExitCode.USAGE);
                expect(readErr()).to.equal("cd: '/target' is not a directory.\n");
            });

            it("changes the directory to the given target", () => {
                fileSystem.add(new Path("/target"), new Directory(), false);

                expect(execute("cd target")).to.equal(ExitCode.OK);
                expect(environment.get("cwd")).to.equal("/target");
            });
        });

        describe("cp", () => {
            beforeEach(() => loadCommand("cp"));


            it("copies the source file to the exact target if it does not exist already", () => {
                fileSystem.add(new Path("/src"), new File("contents"), false);

                expect(execute("cp /src /dst")).to.equal(ExitCode.OK);
                expect(fileSystem.open(new Path("/src"), "read").read()).to.equal("contents");
                expect(fileSystem.open(new Path("/dst"), "read").read()).to.equal("contents");
            });

            it("fails if the source is a directory and the recursive option is not given", () => {
                fileSystem.add(new Path("/src"), new Directory(), true);

                expect(execute("cp /src /dst")).to.equal(ExitCode.MISC);
                expect(readErr()).to.equal("cp: '/src' is a directory.\n");
            });

            it("copies the source directory to the exact target if it does not exist already", () => {
                fileSystem.add(new Path("/src/file"), new File("contents"), true);

                expect(execute("cp -r /src /dst")).to.equal(ExitCode.OK);
                expect(fileSystem.open(new Path("/src/file"), "read").read()).to.equal("contents");
                expect(fileSystem.open(new Path("/dst/file"), "read").read()).to.equal("contents");
            });

            it("fails if there are multiple sources and the target does not exist", () => {
                fileSystem.add(new Path("/src1"), new File("contents1"), false);
                fileSystem.add(new Path("/src2"), new File("contents2"), false);

                expect(execute("cp /src1 /src2 /dst")).to.equal(ExitCode.MISC);
                expect(readErr()).to.equal("cp: '/dst' is not a directory.\n");
            });

            it("fails if the target is a file", () => {
                fileSystem.add(new Path("/src1"), new File("contents1"), false);
                fileSystem.add(new Path("/src2"), new File("contents2"), false);
                fileSystem.add(new Path("/dst"), new File(), false);

                expect(execute("cp /src1 /src2 /dst")).to.equal(ExitCode.MISC);
                expect(readErr()).to.equal("cp: '/dst' is not a directory.\n");
            });

            it("copies all sources into the target directory", () => {
                fileSystem.add(new Path("/src1"), new File("contents1"), false);
                fileSystem.add(new Path("/src2"), new File("contents2"), false);
                fileSystem.add(new Path("/dst"), new Directory(), false);

                expect(execute("cp /src1 /src2 /dst")).to.equal(ExitCode.OK);
                expect(fileSystem.open(new Path("/src1"), "read").read()).to.equal("contents1");
                expect(fileSystem.open(new Path("/src2"), "read").read()).to.equal("contents2");
                expect(fileSystem.open(new Path("/dst/src1"), "read").read()).to.equal("contents1");
                expect(fileSystem.open(new Path("/dst/src2"), "read").read()).to.equal("contents2");
            });
        });

        describe("echo", () => {
            beforeEach(() => loadCommand("echo"));


            it("adds a newline to the end by default", () => {
                expect(execute("echo a b c \n")).to.equal(ExitCode.OK);
                expect(readOut()).to.equal("a b c \n\n");
            });

            it("does not add a newline if prompted to do so", () => {
                expect(execute("echo -n a b c")).to.equal(ExitCode.OK);
                expect(readOut()).to.equal("a b c");
            });
        });

        describe("exit", () => {
            beforeEach(() => loadCommand("exit"));


            it("changes the current user", () => {
                expect(execute("exit")).to.equal(ExitCode.OK);
                expect(environment.get("user")).to.equal("");
            });
        });

        describe("false", () => {
            beforeEach(() => loadCommand("false"));


            it("sets the exit code to an erroneous value", () => {
                expect(execute("false")).to.not.equal(ExitCode.OK);
            });
        });

        describe("help", () => {
            beforeEach(() => loadCommand("help"));


            it("outputs an error if the command could not be found", () => {
                expect(execute("help error")).to.equal(ExitCode.USAGE);
                expect(readErr()).to.equal("help: Unknown command 'error'.\n");
            });

            it("outputs something if the command could be found", () => {
                expect(execute("help help")).to.equal(ExitCode.OK);
                expect(readOut()).to.not.equal("");
            });
        });

        describe("hier", () => {
            beforeEach(() => {
                loadCommand("help");
                loadCommand("hier");
            });


            it("outputs something", () => {
                expect(execute("help hier")).to.equal(ExitCode.OK);
                expect(readOut()).to.not.equal("");
            });
        });

        describe("ls", () => {
            beforeEach(() => loadCommand("ls"));


            it("fails if the target does not exist", () => {
                expect(execute("ls dir")).to.equal(ExitCode.FILE_NOT_FOUND);
                expect(readErr()).to.equal("ls: The directory '/dir' does not exist.\n");
            });

            it("fails if the target is a file", () => {
                fileSystem.add(new Path("file"), new File(), true);

                expect(execute("ls file")).to.equal(ExitCode.USAGE);
                expect(readErr()).to.equal("ls: '/file' is not a directory.\n");
            });

            it("outputs something otherwise", () => {
                fileSystem.add(new Path("dir"), new Directory(), true);

                expect(execute("ls dir")).to.equal(ExitCode.OK);
                expect(readOut()).to.not.equal("");
            });
        });

        describe("mkdir", () => {
            beforeEach(() => loadCommand("mkdir"));


            it("fails if the given directory exists", () => {
                fileSystem.add(new Path("/dir"), new Directory(), false);

                expect(execute("mkdir /dir")).to.equal(ExitCode.MISC);
                expect(readErr()).to.equal("mkdir: A file or directory already exists at '/dir'.\n");
            });

            it("fails if the parent does not exist", () => {
                expect(execute("mkdir /parent/dir")).to.equal(ExitCode.MISC);
                expect(readErr()).to.equal("mkdir: The directory '/parent' does not exist.\n");
            });

            it("creates the parents if opted to do so", () => {
                expect(execute("mkdir -p /parent/dir")).to.equal(ExitCode.OK);
                expect(fileSystem.has(new Path("/parent/dir"))).to.be.true;
            });

            it("creates the given directories in order", () => {
                expect(execute("mkdir /parent /parent/dir1 /dir2")).to.equal(ExitCode.OK);
                expect(fileSystem.has(new Path("/parent/dir1"))).to.be.true;
                expect(fileSystem.has(new Path("/dir2"))).to.be.true;
            });
        });

        describe("mv", () => {
            beforeEach(() => loadCommand("mv"));


            it("moves the source file to the exact target if it does not exist already", () => {
                fileSystem.add(new Path("/src"), new File("contents"), false);

                expect(execute("mv /src /dst")).to.equal(ExitCode.OK);
                expect(fileSystem.has(new Path("/src"))).to.be.false;
                expect(fileSystem.open(new Path("/dst"), "read").read()).to.equal("contents");
            });

            it("moves the source directory to the exact target if it does not exist already", () => {
                fileSystem.add(new Path("/src/file"), new File("contents"), true);

                expect(execute("mv -r /src /dst")).to.equal(ExitCode.OK);
                expect(fileSystem.has(new Path("/src"))).to.be.false;
                expect(fileSystem.has(new Path("/src/file"))).to.be.false;
                expect(fileSystem.open(new Path("/dst/file"), "read").read()).to.equal("contents");
            });

            it("fails if there are multiple sources and the target does not exist", () => {
                fileSystem.add(new Path("/src1"), new File("contents1"), false);
                fileSystem.add(new Path("/src2"), new File("contents2"), false);

                expect(execute("mv /src1 /src2 /dst")).to.equal(ExitCode.MISC);
                expect(readErr()).to.equal("mv: '/dst' is not a directory.\n");
            });

            it("fails if the target is a file", () => {
                fileSystem.add(new Path("/src1"), new File("contents1"), false);
                fileSystem.add(new Path("/src2"), new File("contents2"), false);
                fileSystem.add(new Path("/dst"), new File(), false);

                expect(execute("mv /src1 /src2 /dst")).to.equal(ExitCode.MISC);
                expect(readErr()).to.equal("mv: '/dst' is not a directory.\n");
            });

            it("moves all sources into the target directory", () => {
                fileSystem.add(new Path("/src1"), new File("contents1"), false);
                fileSystem.add(new Path("/src2"), new File("contents2"), false);
                fileSystem.add(new Path("/dst"), new Directory(), false);

                expect(execute("mv /src1 /src2 /dst")).to.equal(ExitCode.OK);
                expect(fileSystem.has(new Path("/src1"))).to.be.false;
                expect(fileSystem.has(new Path("/src2"))).to.be.false;
                expect(fileSystem.open(new Path("/dst/src1"), "read").read()).to.equal("contents1");
                expect(fileSystem.open(new Path("/dst/src2"), "read").read()).to.equal("contents2");
            });
        });

        describe("not", () => {
            beforeEach(() => {
                loadCommand("not");
                loadCommand("rm");
            });


            it("returns 0 if the given command exits unsuccessfully", () => {
                expect(execute("not rm /file")).to.equal(ExitCode.OK);
            });

            it("returns 1 if the command exits successfully", () => {
                fileSystem.add(new Path("/file"), new File(), false);

                expect(execute("not rm /file")).to.equal(1);
            });
        });

        describe("open", () => {
            before(() => {
                window.matchMedia = window.matchMedia || function() {
                    return {matches: false, addListener: emptyFunction, removeListener: emptyFunction};
                };
            });

            beforeEach(() => loadCommand("open"));


            it("fails if the file does not exist", () => {
                expect(execute("open file.lnk")).to.equal(ExitCode.MISC);
                expect(readErr()).to.equal("open: File '/file.lnk' does not exist.\n");
            });
        });

        describe("or", () => {
            beforeEach(() => {
                loadCommand("or");
                loadCommand("echo");
            });


            it("does nothing if the previous command exited successfully", () => {
                environment.set("status", "0");

                expect(execute("or echo 'message'")).to.equal(ExitCode.OK);
                expect(readOut()).to.equal("");
            });

            it("executes the command if the previous command did not exit successfully", () => {
                environment.set("status", "-1");

                expect(execute("or echo 'message'")).to.equal(ExitCode.OK);
                expect(readOut()).to.equal("message\n");
            });
        });

        describe("poweroff", () => {
            beforeEach(() => loadCommand("poweroff"));


            it("fails if no user is logged in", () => {
                environment.set("user", "");

                expect(execute("poweroff")).to.equal(ExitCode.MISC);
                expect(readErr()).to.equal("poweroff: Cannot execute while not logged in.\n");
            });

            it("it outputs something", () => {
                environment.set("user", "user");

                expect(execute("poweroff")).to.equal(ExitCode.OK);
                expect(readOut().trim()).to.not.equal("");
            });
        });

        describe("pwd", () => {
            beforeEach(() => loadCommand("pwd"));


            it("writes the cwd variable to the output stream", () => {
                environment.set("cwd", "/dir");

                expect(execute("pwd")).to.equal(ExitCode.OK);
                expect(readOut()).to.equal("/dir\n");
            });

            it("writes an empty string if the cwd variable has no value", () => {
                environment.set("cwd", "");

                expect(execute("pwd")).to.equal(ExitCode.OK);
                expect(readOut()).to.equal("\n");
            });
        });

        describe("rm", () => {
            beforeEach(() => loadCommand("rm"));


            it("fails if the target does not exist", () => {
                expect(execute("rm /file")).to.equal(ExitCode.FILE_NOT_FOUND);
                expect(readErr()).to.equal("rm: The file '/file' does not exist.\n");
            });

            it("does nothing if the target does not exist but the force option is given", () => {
                expect(execute("rm -f /file")).to.equal(ExitCode.OK);
                expect(readErr()).to.equal("");
            });

            it("fails if the target is a directory", () => {
                fileSystem.add(new Path("/dir"), new Directory(), false);

                expect(execute("rm /dir")).to.equal(ExitCode.USAGE);
                expect(readErr()).to.equal("rm: '/dir' is a directory.\n");
            });

            it("removes an empty directory if the recursive option is given", () => {
                fileSystem.add(new Path("/dir"), new Directory(), false);

                expect(execute("rm -r /dir")).to.equal(ExitCode.OK);
                expect(fileSystem.has(new Path("/dir"))).to.be.false;
            });

            it("removes a non-empty directory if the recursive option is given", () => {
                fileSystem.add(new Path("/dir/file"), new File(), true);

                expect(execute("rm -r /dir")).to.equal(ExitCode.OK);
                expect(fileSystem.has(new Path("/dir"))).to.be.false;
            });

            it("fails if the target is the root even though the recursive option is given", () => {
                expect(execute("rm -r /")).to.equal(ExitCode.USAGE);
                expect(readErr()).to.equal("rm: Cannot remove root directory.\n");
            });

            it("removes the root if the recursive and no-preserve-root options are given", () => {
                fileSystem.add(new Path("/dir"), new Directory(), false);

                expect(execute("rm -r --no-preserve-root /")).to.equal(ExitCode.OK);
                expect(fileSystem.has(new Path("/dir"))).to.be.false;
                expect(fileSystem.has(new Path("/"))).to.be.true;
            });

            it("removes the given file", () => {
                fileSystem.add(new Path("/file"), new File(), false);

                expect(execute("rm /file")).to.equal(ExitCode.OK);
                expect(fileSystem.has(new Path("/file"))).to.be.false;
            });

            it("removes files but not directories if the recursive option is not given", () => {
                fileSystem.add(new Path("/dir"), new Directory(), false);
                fileSystem.add(new Path("/file"), new File(), false);

                expect(execute("rm /dir /file")).to.equal(ExitCode.USAGE);
                expect(fileSystem.has(new Path("/dir"))).to.be.true;
                expect(fileSystem.has(new Path("/file"))).to.be.false;
            });
        });

        describe("rmdir", () => {
            beforeEach(() => loadCommand("rmdir"));


            it("fails if the target does not exist", () => {
                expect(execute("rmdir /dir")).to.equal(ExitCode.FILE_NOT_FOUND);
                expect(readErr()).to.equal("rmdir: '/dir' does not exist.\n");
            });

            it("fails if the target is not a directory", () => {
                fileSystem.add(new Path("/file"), new File(), false);

                expect(execute("rmdir /file")).to.equal(ExitCode.USAGE);
                expect(readErr()).to.equal("rmdir: '/file' is not a directory.\n");
            });

            it("fails if the target is not empty", () => {
                fileSystem.add(new Path("/dir/file"), new File(), true);

                expect(execute("rmdir /dir")).to.equal(ExitCode.MISC);
                expect(readErr()).to.equal("rmdir: '/dir' is not empty.\n");
            });

            it("removes the target if it is an empty directory", () => {
                fileSystem.add(new Path("/dir"), new Directory(), false);

                expect(execute("rmdir /dir")).to.equal(ExitCode.OK);
                expect(fileSystem.has(new Path("/dir"))).to.be.false;
            });

            it("removes the targets if they're empty directories", () => {
                fileSystem.add(new Path("/dir1/dir2"), new Directory(), true);

                expect(execute("rmdir /dir1/dir2 /dir1")).to.equal(ExitCode.OK);
                expect(fileSystem.has(new Path("/dir1"))).to.be.false;
            });
        });

        describe("set", () => {
            beforeEach(() => loadCommand("set"));


            it("creates a variable if it does not exist", () => {
                expect(execute("set var val")).to.equal(ExitCode.OK);
                expect(environment.variables["var"]).to.equal("val");
            });

            it("changes a variable if it exists", () => {
                environment.set("var", "old");

                expect(execute("set var new")).to.equal(ExitCode.OK);
                expect(environment.variables["var"]).to.equal("new");
            });

            it("removes the variable if no value is given", () => {
                environment.set("var", "val");

                expect(execute("set var")).to.equal(ExitCode.OK);
                expect(environment.variables["var"]).to.be.undefined;
            });

            it("cannot change a read-only variable", () => {
                environment.set("cwd", "old");

                expect(execute("set cwd new")).to.equal(ExitCode.MISC);
                expect(readErr()).to.equal("set: Cannot set read-only environment variable.\n");
                expect(environment.variables["cwd"]).to.equal("old");
            });

            it("cannot remove a read-only variable", () => {
                environment.set("cwd", "old");

                expect(execute("set cwd")).to.equal(ExitCode.MISC);
                expect(readErr()).to.equal("set: Cannot set read-only environment variable.\n");
                expect(environment.variables["cwd"]).to.equal("old");
            });
        });

        describe("touch", () => {
            beforeEach(() => loadCommand("touch"));


            it("fails if a directory already exists at the target", () => {
                fileSystem.add(new Path("/dir"), new Directory(), false);

                expect(execute("touch /dir")).to.equal(ExitCode.MISC);
                expect(readErr()).to.equal("touch: A file or directory already exists at '/dir'.\n");
            });

            it("fails if the parent of the target does not exist", () => {
                expect(execute("touch /parent/file")).to.equal(ExitCode.MISC);
                expect(readErr()).to.equal("touch: The directory '/parent' does not exist.\n");
            });

            it("fails if the parent of the target is a file", () => {
                fileSystem.add(new Path("/parent"), new File(), false);

                expect(execute("touch /parent/file")).to.equal(ExitCode.MISC);
                expect(readErr()).to.equal("touch: '/parent' is not a directory.\n");
            });

            it("creates a file at the target", () => {
                expect(execute("touch /file")).to.equal(ExitCode.OK);
                expect(fileSystem.has(new Path("/file"))).to.be.true;
            });

            it("creates files at the target", () => {
                expect(execute("touch /file1 /file2")).to.equal(ExitCode.OK);
                expect(fileSystem.has(new Path("/file1"))).to.be.true;
                expect(fileSystem.has(new Path("/file2"))).to.be.true;
            });
        });

        describe("true", () => {
            beforeEach(() => loadCommand("true"));


            it("sets the exit code to a successful value", () => {
                expect(execute("true")).to.equal(ExitCode.OK);
            });
        });

        describe("useradd", () => {
            before(() => HashProvider.default = plainHashProvider);

            beforeEach(() => loadCommand("useradd"));

            after(() => HashProvider.default = new HashProvider());


            it("fails if the user already exists", () => {
                userList.add(new User("user", "old"));

                expect(execute("useradd user new")).to.equal(ExitCode.MISC);
                expect(readErr()).to.equal("useradd: User 'user' already exists.\n");
            });

            it("fails if any of the fields is malformed", () => {
                expect(execute("useradd user_name password")).to.equal(ExitCode.MISC);
                expect(readErr()).to.equal("useradd: Name must contain only alphanumerical characters.\n");
            });

            it("adds a user with default home and empty description if those fields are not given", () => {
                expect(execute("useradd user password")).to.equal(ExitCode.OK);
                expect(userList.get("user")).to.deep.equal(new User("user", "password"));
            });

            it("adds a new user with default home if that option is not given", () => {
                expect(execute("useradd --description=description user password")).to.equal(ExitCode.OK);
                expect(userList.get("user")).to.deep.equal(new User("user", "password", undefined, "description"));
            });

            it("adds a user with default description if that option is not given", () => {
                expect(execute("useradd --home=/user user password")).to.equal(ExitCode.OK);
                expect(userList.get("user")).to.deep.equal(new User("user", "password", "/user"));
            });

            it("adds a user with the given home and description", () => {
                expect(execute("useradd --home=/user --description=description user password")).to.equal(ExitCode.OK);
                expect(userList.get("user")).to.deep.equal(new User("user", "password", "/user", "description"));
            });
        });

        describe("userdel", () => {
            beforeEach(() => loadCommand("userdel"));


            it("fails if the target user does not exist", () => {
                expect(execute("userdel user")).to.equal(ExitCode.USAGE);
                expect(readErr()).to.equal("userdel: Could not delete non-existent user 'user'.\n");
            });

            it("deletes the given user", () => {
                userList.add(new User("user", "password"));

                expect(execute("userdel user")).to.equal(ExitCode.OK);
                expect(userList.has("user")).to.be.false;
            });
        });

        describe("usermod", () => {
            before(() => HashProvider.default = plainHashProvider);

            beforeEach(() => loadCommand("usermod"));

            after(() => HashProvider.default = new HashProvider());


            it("fails if the target user does not exist", () => {
                expect(execute("usermod user")).to.equal(ExitCode.USAGE);
                expect(readErr()).to.equal("usermod: Could not modify non-existent user 'user'.\n");
            });

            it("fails if a changed parameter is malformed", () => {
                const user = new User("user", "password", "/home");
                userList.add(user);

                expect(execute("usermod -h=/ho|me user")).to.equal(ExitCode.MISC);
                expect(readErr()).to.equal("usermod: Home must not contain pipe ('|') or newline character.\n");
            });

            it("modifies nothing if no modified fields are given", () => {
                const user = new User("user", "password", "/home", "description");
                userList.add(user);

                expect(execute("usermod user")).to.equal(ExitCode.OK);
                expect(userList.get("user")).to.deep.equal(user);
            });

            it("modifies the user's password", () => {
                const user = new User("user", "old");
                userList.add(user);

                expect(execute("usermod -p=new user")).to.equal(ExitCode.OK);
                expect(userList.get("user")?.passwordHash).to.equal("new");
            });

            it("modifies the user's home", () => {
                const user = new User("user", "pwd", "/old");
                userList.add(user);

                expect(execute("usermod -h=/new user")).to.equal(ExitCode.OK);
                expect(userList.get("user")?.home).to.equal("/new");
            });

            it("modifies the user's description", () => {
                const user = new User("user", "password", undefined, "old");
                userList.add(user);

                expect(execute("usermod -d=new user")).to.equal(ExitCode.OK);
                expect(userList.get("user")?.description).to.equal("new");
            });
        });

        describe("whatis", () => {
            beforeEach(() => loadCommand("whatis"));


            it("outputs an error if a command could not be found", () => {
                expect(execute("whatis error")).to.equal(ExitCode.USAGE);
                expect(readErr()).to.equal("whatis: Unknown command 'error'.\n");
            });

            it("outputs a short summary of itself", () => {
                expect(execute("whatis whatis")).to.equal(ExitCode.OK);
                expect(readOut()).to.equal("<b>whatis</b> - display one-line documentation\n");
            });
        });

        describe("whoami", () => {
            beforeEach(() => loadCommand("whoami"));


            it("fails if no user is logged in", () => {
                environment.set("user", "");

                expect(execute("whoami")).to.equal(ExitCode.MISC);
                expect(readErr()).to.equal("whoami: Cannot execute while not logged in.\n");
            });

            it("it outputs something", () => {
                userList.add(new User("user", "pwd", "/", "Description"));
                environment.set("user", "user");

                expect(execute("whoami")).to.equal(ExitCode.OK);
                expect(readOut()).to.equal("Description\n");
            });
        });
    });
});
