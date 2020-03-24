import "mocha";
import "jsdom-global"
import {expect} from "chai";

import {Directory, File, FileSystem, Path} from "../main/js/FileSystem";
import {User, UserList} from "../main/js/UserList";


describe("user list", () => {
    const userFilePath = new Path("/etc/passwd");

    let fileSystem: FileSystem;
    let userList: UserList;


    const readUserFile = () => (fileSystem.get(userFilePath) as File).open("read").read();


    beforeEach(() => {
        fileSystem = new FileSystem(new Directory());
        userList = new UserList(fileSystem, userFilePath);
    });


    describe("file management", () => {
        it("creates the file if it does not exist when a method is invoked", () => {
            userList.has("user");

            expect(fileSystem.has(userFilePath)).to.be.true;
            expect(readUserFile()).to.equal("");
        });

        it("creates the file if the target is a directory when a method is invoked", () => {
            userList.has("user");

            expect(fileSystem.has(userFilePath)).to.be.true;
            expect(readUserFile()).to.equal("");
        });
    });

    describe("add", () => {
        it("adds the given user", () => {
            const user = new User("user", "pwd", "/home", "");

            userList.add(user);

            expect(readUserFile()).to.equal(User.toString(user) + "\n");
        });

        it("does not add duplicate users", () => {
            const user = new User("user", "pwd", "/home", "");

            userList.add(user);
            userList.add(user);

            expect(readUserFile()).to.equal(User.toString(user) + "\n");
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

describe("user", () => {
    describe("password hash", () => {
        it("returns a different hash for a different salt", () => {
            expect(User.hashPassword("password", "salt1")).to.not.equal(User.hashPassword("password", "salt2"));
        });

        it("returns true if the password matches the user's password", () => {
            const hash = User.hashPassword("password", "salt");
            const user = new User("user", hash);

            expect(user.hasPassword("password")).to.be.true;
        });

        it("returns false if the password does not match the user's password", () => {
            const hash = User.hashPassword("password", "salt");
            const user = new User("user", hash);

            expect(user.hasPassword("not-password")).to.be.false;
        });
    });
});
