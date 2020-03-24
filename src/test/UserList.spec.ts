import {expect} from "chai";
import "jsdom-global";
import "mocha";

import {Directory, File, FileSystem, Path} from "../main/js/FileSystem";
import {HashProvider, User, UserList} from "../main/js/UserList";


describe("user list", () => {
    const userFilePath = new Path("/etc/passwd");

    let fileSystem: FileSystem;
    let userList: UserList;


    const readUserFile = () => {
        const file = fileSystem.get(userFilePath);
        return !(file instanceof File) ? "" : file.open("read").read();
    };


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

    describe("delete", () => {
        it("does not delete a non-existent user", () => {
            const initialContents = readUserFile();

            expect(userList.delete("user")).to.be.false;
            expect(readUserFile()).to.equal(initialContents);
        });

        it("deletes only the target user", () => {
            userList.add(new User("user1", "password"));
            userList.add(new User("user2", "password"));
            userList.add(new User("user3", "password"));

            expect(userList.delete("user2")).to.be.true;
            expect(userList.users.length).to.equal(2);
            expect(userList.has("user1")).to.be.true;
            expect(userList.has("user2")).to.be.false;
            expect(userList.has("user3")).to.be.true;
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

    describe("modify", () => {
        it("does not modify a non-existent user", () => {
            const initialContents = readUserFile();

            expect(userList.modify(new User("user", "password"))).to.be.false;
            expect(readUserFile()).to.equal(initialContents);
        });

        it("changes all fields of the user to modify", () => {
            const oldUser = new User("user", "oldPassword", "oldHome", "oldDescription");
            const newUser = new User("user", "newPassword", "newHome", "newDescription");
            userList.add(oldUser);

            userList.modify(newUser);

            expect(userList.get("user")).to.deep.equal(newUser);
        });

        it("does not modify other users", () => {
            userList.add(new User("user1", "password"));
            userList.add(new User("user2", "password"));
            const initialContents = readUserFile();

            userList.add(new User("user3", "old"));
            userList.modify(new User("user3", "new"));
            userList.delete("user3");

            expect(readUserFile()).to.equal(initialContents);
        });
    });
});

describe("hash provider", () => {
    let provider = new HashProvider();


    it("returns a different hash for a different salt", () => {
        expect(provider.hashPassword("password", "salt1")).to.not.equal(provider.hashPassword("password", "salt2"));
    });

    it("returns true if the password matches the user's password", () => {
        const hash = provider.hashPassword("password", "salt");

        expect(provider.checkPassword(hash, "password")).to.be.true;
    });

    it("returns false if the password does not match the user's password", () => {
        const hash = provider.hashPassword("password", "salt");

        expect(provider.checkPassword(hash, "not-password")).to.be.false;
    });
});

describe("user", () => {
    describe("validation", () => {
        it("rejects a non-alphanumerical name", () => {
            expect(() => new User("na_me", "password")).to.throw("Name must contain only alphanumerical characters.");
        });

        it("rejects a name with leading and trailing whitespace", () => {
            expect(() => new User("  user ", "password")).to.throw("Name must contain only alphanumerical characters.");
        });

        it("rejects an empty name", () => {
            expect(() => new User("", "password")).to.throw("Name must contain only alphanumerical characters.");
        });

        it("rejects a home with a pipe character", () => {
            expect(() => new User("user", "password", "/ho|me"))
                .to.throw("Home must not contain pipe ('|') or newline character.");
        });

        it("rejects a home with a newline character", () => {
            expect(() => new User("user", "password", "/ho\nme"))
                .to.throw("Home must not contain pipe ('|') or newline character.");
        });

        it("rejects a description with a pipe character", () => {
            expect(() => new User("user", "password", undefined, "Detailed | Description"))
                .to.throw("Description must not contain pipe ('|') or newline character.");
        });

        it("rejects a description with a newline character", () => {
            expect(() => new User("user", "password", undefined, "Detailed\nDescription"))
                .to.throw("Description must not contain pipe ('|') or newline character.");
        });
    });
});
