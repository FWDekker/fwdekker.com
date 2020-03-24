import "mocha";
import {expect} from "chai";

import {Directory, File, FileSystem, Path} from "../main/js/FileSystem";
import {User, UserList} from "../main/js/UserList";


describe("user list", () => {
    let fileSystem: FileSystem;
    let userList: UserList;
    let initialContents: string;


    const readUserFile = () => (fileSystem.get(new Path("/etc/passwd")) as File).open("read").read();


    beforeEach(() => {
        fileSystem = new FileSystem(new Directory());
        userList = new UserList(fileSystem);
        initialContents = readUserFile();
    });


    describe("file management", () => {
        it("populates the file with a default root account if the file disappeared", () => {
            fileSystem.remove(new Path("/etc/passwd"));

            expect(userList.has("root")).to.be.true;
            expect(readUserFile()).to.equal(initialContents);
        });

        it("populates the file with a default root account if the target is a directory", () => {
            fileSystem.remove(new Path("/etc/passwd"));
            fileSystem.add(new Path("/etc/passwd"), new Directory(), true);

            expect(userList.has("root")).to.be.true;
            expect(readUserFile()).to.equal(initialContents);
        });
    });

    describe("add", () => {
        it("adds the given user", () => {
            const user = new User("user", "pwd", "/home", "");

            userList.add(user);

            expect(readUserFile()).to.equal(initialContents + User.toString(user) + "\n");
        });

        it("does not add duplicate users", () => {
            const user = new User("user", "pwd", "/home", "");

            userList.add(user);
            userList.add(user);

            expect(readUserFile()).to.equal(initialContents + User.toString(user) + "\n");
        });
    });

    describe("get", () => {
        it("returns the indicated user if it exists", () => {
            const user = new User("user", "pwd", "/home", "");

            userList.add(user);

            expect(userList.get("user")).to.deep.equal(user);
        });

        it("returns undefined if the user does not exist", () => {
            expect(userList.get("user")).to.be.undefined;
        });

        it("returns undefined for an empty user name", () => {
            expect(userList.get("")).to.be.undefined;
        });
    });

    describe("has", () => {
        it("returns `true` if the user exists", () => {
            userList.add(new User("user", "pwd", "/home", ""));

            expect(userList.has("user")).to.be.true;
        });

        it("returns `false` if the user does not exist", () => {
            expect(userList.has("user")).to.be.false;
        });
    });
});
