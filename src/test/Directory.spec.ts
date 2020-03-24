import {expect} from "chai";
import "mocha";

import "../main/js/Extensions";
import {Directory, File} from "../main/js/FileSystem";


describe("directory", () => {
    let directory: Directory;


    beforeEach(() => {
        directory = new Directory();
    });


    describe("constructor", () => {
        it("has no nodes by default", () => {
            expect(directory.nodeCount).to.equal(0);
        });

        it("has the given nodes", () => {
            expect(new Directory({node: new File()}).has("node")).to.be.true;
        });
    });

    describe("get", () => {
        it("throws an exception if he node does not exist", () => {
            expect(directory.get("error")).to.be.undefined;
        });

        it("does not contain itself", () => {
            expect(directory.get(".")).to.be.undefined;
        });

        it("returns the desired node", () => {
            const file = new File();
            directory.add("file", file);

            expect(directory.get("file")).to.equal(file);
        });
    });

    describe("has", () => {
        it("returns false if the node does not exist", () => {
            expect(directory.has("error")).to.be.false;
        });

        it("returns true if the node exists", () => {
            directory.add("file", new File());

            expect(directory.has("file")).to.be.true;
        });

        it("returns false if the node is the reflexive node", () => {
            expect(directory.has(".")).to.be.false;
        });

        it("returns false if the node is the parent node", () => {
            expect(directory.has("..")).to.be.false;
        });

        it("returns false if the node refers to itself", () => {
            expect(directory.has("")).to.be.false;
        });
    });

    describe("add", () => {
        it("adds the given node", () => {
            directory.add("file", new File());

            expect(directory.has("file")).to.be.true;
        });

        it("overwrites an existing node", () => {
            directory.add("file", new File());
            directory.add("file", new Directory());

            expect(directory.get("file")).to.be.instanceOf(Directory);
        });

        it("refuses to add a node at the reflexive path", () => {
            expect(() => directory.add(".", new File())).to.throw();
        });

        it("refuses to add a node at the parent path", () => {
            expect(() => directory.add("..", new File())).to.throw();
        });

        it("refuses to add a node that refers to the directory", () => {
            expect(() => directory.add("", new File())).to.throw();
        });

        it("refuses to add a node with a name containing a slash", () => {
            expect(() => directory.add("a/b", new File())).to.throw();
        });
    });

    describe("remove", () => {
        it("removes the desired node", () => {
            directory.add("file", new File());

            directory.remove("file");

            expect(directory.nodeCount).to.equal(0);
        });

        it("empties the directory if the name is empty", () => {
            directory.add("file", new File());

            directory.remove("");

            expect(directory.nodeCount).to.equal(0);
        });

        it("empties the directory if the name is reflexive", () => {
            directory.add("file", new File());

            directory.remove(".");

            expect(directory.nodeCount).to.equal(0);
        });
    });

    describe("copy", () => {
        it("returns a deep copy of the directory", () => {
            directory = new Directory({
                file: new File("contents"),
                dir: new Directory()
            });
            const copy = directory.copy();

            (<File> directory.get("file")).open("write").write("changed");
            expect((<File> copy.get("file")).open("read").read()).to.equal("contents");

            (<Directory> directory.get("dir")).add("file2", new File());
            expect((<Directory> copy.get("dir")).nodeCount).to.equal(0);

            directory.remove("file");
            expect(copy.nodeCount).to.equal(2);
        });
    });
});
