import "mocha";
import {expect} from "chai";

import "../main/js/Extensions"
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
            expect(new Directory({node: new File()}).hasNode("node")).to.be.true;
        });
    });

    describe("getNode", () => {
        it("throws an exception if he node does not exist", () => {
            expect(() => directory.getNode("error")).to.throw();
        });

        it("does not contain itself", () => {
            expect(() => directory.getNode(".")).to.throw();
        });

        it("returns the desired node", () => {
            const file = new File();
            directory.addNode("file", file);

            expect(directory.getNode("file")).to.equal(file);
        });
    });

    describe("hasNode", () => {
        it("returns false if the node does not exist", () => {
            expect(directory.hasNode("error")).to.be.false;
        });

        it("returns true if the node exists", () => {
            directory.addNode("file", new File());

            expect(directory.hasNode("file")).to.be.true;
        });

        it("returns false if the node is the reflexive node", () => {
            expect(directory.hasNode(".")).to.be.false;
        });

        it("returns false if the node is the parent node", () => {
            expect(directory.hasNode("..")).to.be.false;
        });

        it("returns false if the node refers to itself", () => {
            expect(directory.hasNode("")).to.be.false;
        });
    });

    describe("addNode", () => {
        it("adds the given node", () => {
            directory.addNode("file", new File());

            expect(directory.hasNode("file")).to.be.true;
        });

        it("overwrites an existing node", () => {
            directory.addNode("file", new File());
            directory.addNode("file", new Directory());

            expect(directory.getNode("file")).to.be.instanceOf(Directory);
        });

        it("refuses to add a node at the reflexive path", () => {
            expect(() => directory.addNode(".", new File())).to.throw();
        });

        it("refuses to add a node at the parent path", () => {
            expect(() => directory.addNode("..", new File())).to.throw();
        });

        it("refuses to add a node that refers to the directory", () => {
            expect(() => directory.addNode("", new File())).to.throw();
        });

        it("refuses to add a node with a name containing a slash", () => {
            expect(() => directory.addNode("a/b", new File())).to.throw();
        });
    });

    describe("removeNode", () => {
        it("removes the desired node", () => {
            directory.addNode("file", new File());

            directory.removeNode("file");

            expect(directory.nodeCount).to.equal(0);
        });

        it("empties the directory if the name is empty", () => {
            directory.addNode("file", new File());

            directory.removeNode("");

            expect(directory.nodeCount).to.equal(0);
        });

        it("empties the directory if the name is reflexive", () => {
            directory.addNode("file", new File());

            directory.removeNode(".");

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

            (<File>directory.getNode("file")).contents = "changed";
            expect((<File>copy.getNode("file")).contents).to.equal("contents");

            (<Directory>directory.getNode("dir")).addNode("file2", new File());
            expect((<Directory>copy.getNode("dir")).nodeCount).to.equal(0);

            directory.removeNode("file");
            expect(copy.nodeCount).to.equal(2);
        });
    });
});
