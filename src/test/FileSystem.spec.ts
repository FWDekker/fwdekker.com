import "mocha";
import {expect} from "chai";

import "../main/js/Extensions"
import {Directory, File, FileSystem, Path} from "../main/js/FileSystem";


describe("input args", () => {
    let fileSystem: FileSystem;


    beforeEach(() => {
        fileSystem = new FileSystem();
    });


    describe("constructor", () => {
        it("uses the default root if no directory is given", () => {
            expect(fileSystem.root).to.not.be.empty;
        });

        it("uses the given directory as root", () => {
            const root = new Directory();
            expect(new FileSystem(root).root).to.equal(root);
        });
    });

    describe("add", () => {
        it("adds the given node", () => {
            fileSystem.add(new Path("/file"), new File(), false);

            expect(fileSystem.has(new Path("/file"))).to.be.true;
        });

        it("adds intermediate directories if the option is given", () => {
            fileSystem.add(new Path("/dir1"), new Directory(), false);
            fileSystem.add(new Path("/dir1/file1"), new File(), false);

            fileSystem.add(new Path("/dir1/dir2/file2"), new File(), true);

            expect(fileSystem.get(new Path("/dir1/file1"))).to.be.instanceOf(File);
            expect(fileSystem.get(new Path("/dir1/dir2"))).to.be.instanceOf(Directory);
            expect(fileSystem.get(new Path("/dir1/dir2/file2"))).to.be.instanceOf(File);
        });

        it("fails if a node is added as root", () => {
            expect(() => fileSystem.add(new Path("/"), new File(), false)).to.throw;
        });

        it("fails if an intermediate directory does not exist", () => {
            expect(() => fileSystem.add(new Path("/dir1/dir2/file2"), new File(), false)).to.throw;
        });

        it("fails if an intermediate directory is not a directory", () => {
            fileSystem.add(new Path("/file1"), new File(), false);

            expect(() => fileSystem.add(new Path("/file1/file2"), new File(), false)).to.throw;
        });

        it("fails if a node already exists at the path", () => {
            fileSystem.add(new Path("/file1"), new File(), false);

            expect(() => fileSystem.add(new Path("/file1"), new File(), false)).to.throw;
        });
    });

    describe("copy", () => {
        it("throws an error if the source does not exist", () => {
            expect(() => fileSystem.copy(new Path("/src"), new Path("/dst"), false)).to.throw;
        });

        it("throws an error if the source is a directory and the recursive options it not given", () => {
            fileSystem.add(new Path("/src"), new Directory(), false);

            expect(() => fileSystem.copy(new Path("/src"), new Path("/dst"), false)).to.throw;
        });

        describe("target is destination", () => {
            it("throws an error if the target's parent does not exist", () => {
                fileSystem.add(new Path("/src"), new File(), false);

                expect(() => fileSystem.copy(new Path("/src"), new Path("/parent/dst"), false)).to.throw;
            });

            it("throws an error if the target's parent is not a directory", () => {
                fileSystem.add(new Path("/src"), new File(), false);
                fileSystem.add(new Path("/parent"), new Directory(), false);

                expect(() => fileSystem.copy(new Path("/src"), new Path("/parent/dst"), false)).to.throw;
            });

            it("throws an error if the target already exists", () => {
                fileSystem.add(new Path("/src"), new File(), false);
                fileSystem.add(new Path("/parent"), new Directory(), false);
                fileSystem.add(new Path("/parent/dst"), new File(), false);

                expect(() => fileSystem.copy(new Path("/src"), new Path("/parent/dst"), false)).to.throw;
            });

            it("copies the source file to the target", () => {
                fileSystem.add(new Path("/src"), new File(), false);

                fileSystem.copy(new Path("/src"), new Path("/dst"), false);

                expect(fileSystem.has(new Path("/dst"))).to.be.true;
            });

            it("copies the source directory to the target", () => {
                fileSystem.add(new Path("/src"), new Directory(), false);
                fileSystem.add(new Path("/src/file1"), new File(), false);
                fileSystem.add(new Path("/src/file2"), new File(), false);

                fileSystem.copy(new Path("/src"), new Path("/dst"), true);

                expect(fileSystem.has(new Path("/dst"))).to.be.true;
                expect(fileSystem.has(new Path("/dst/file1"))).to.be.true;
                expect(fileSystem.has(new Path("/dst/file2"))).to.be.true;
            });

            it("makes a deep copy", () => {
                const file = new File("old");
                fileSystem.add(new Path("/src"), file, false);

                fileSystem.copy(new Path("/src"), new Path("/dst"), false);
                file.contents = "new";

                expect((<File>fileSystem.get(new Path("/dst"))).contents).to.equal("old");
            });
        });

        describe("target is child of destination", () => {
            it("throws an error if the target is not a directory", () => {
                fileSystem.add(new Path("/src"), new File(), false);
                fileSystem.add(new Path("/dst"), new File(), false);

                expect(() => fileSystem.copy(new Path("/src"), new Path("/dst"), false)).to.throw;
            });

            it("throws an error if the target's child already exists", () => {
                fileSystem.add(new Path("/src"), new File(), false);
                fileSystem.add(new Path("/dst"), new Directory(), false);
                fileSystem.add(new Path("/dst/src"), new File(), false);

                expect(() => fileSystem.copy(new Path("/src"), new Path("/dst"), false)).to.throw;
            });

            it("copies the source file to the target", () => {
                fileSystem.add(new Path("/src"), new File(), false);
                fileSystem.add(new Path("/dst"), new Directory(), false);

                fileSystem.copy(new Path("/src"), new Path("/dst"), false);

                expect(fileSystem.has(new Path("/dst/src"))).to.be.true;
            });

            it("copies the source directory to the target", () => {
                fileSystem.add(new Path("/src"), new Directory(), false);
                fileSystem.add(new Path("/src/file1"), new File(), false);
                fileSystem.add(new Path("/src/file2"), new File(), false);
                fileSystem.add(new Path("/dst"), new Directory(), false);

                fileSystem.copy(new Path("/src"), new Path("/dst"), true);

                expect(fileSystem.has(new Path("/dst/src"))).to.be.true;
                expect(fileSystem.has(new Path("/dst/src/file1"))).to.be.true;
                expect(fileSystem.has(new Path("/dst/src/file2"))).to.be.true;
            });

            it("makes a deep copy", () => {
                const file = new File("old");
                fileSystem.add(new Path("/src"), file, false);
                fileSystem.add(new Path("/dst"), new Directory(), false);

                fileSystem.copy(new Path("/src"), new Path("/dst"), false);
                file.contents = "new";

                expect((<File>fileSystem.get(new Path("/dst/src"))).contents).to.equal("old");
            });
        });
    });

    describe("get", () => {
        it("returns the root node for the root path", () => {
            expect(fileSystem.get(new Path("/"))).to.equal(fileSystem.root);
        });

        it("returns undefined if the parent is not a directory", () => {
            fileSystem.add(new Path("/file1"), new File(), false);

            expect(fileSystem.get(new Path("/file1/file2"))).to.be.undefined;
        });

        it("returns undefined if the parent does not contain the node", () => {
            fileSystem.add(new Path("/dir"), new Directory(), false);

            expect(fileSystem.get(new Path("/dir/file"))).to.be.undefined;
        });

        it("returns the node at the given path", () => {
            const file = new File();
            fileSystem.add(new Path("/dir"), new Directory(), false);
            fileSystem.add(new Path("/dir/file"), file, false);

            expect(fileSystem.get(new Path("/dir/file"))).to.equal(file);
        });
    });

    describe("has", () => {
        it("returns true for the root path", () => {
            expect(fileSystem.has(new Path("/"))).to.be.true;
        });

        it("returns false if the node does not exist", () => {
            expect(fileSystem.has(new Path("/error"))).to.be.false;
        });

        it("returns true if the node is at the root", () => {
            fileSystem.add(new Path("/file"), new File(), false);

            expect(fileSystem.has(new Path("/file"))).to.be.true;
        });

        it("returns false if an intermediate directory does not exist", () => {
            fileSystem.add(new Path("/file"), new File(), false);

            expect(fileSystem.has(new Path("/dir/file"))).to.be.false;
        });
    });

    describe("move", () => {
        it("moves a file", () => {
            fileSystem.add(new Path("/src"), new File("old"), false);

            fileSystem.move(new Path("/src"), new Path("/dst"));

            expect(fileSystem.has(new Path("/src"))).to.be.false;
            expect(fileSystem.has(new Path("/dst"))).to.be.true;
        });

        it("moves a directory", () => {
            fileSystem.add(new Path("/src"), new Directory(), false);
            fileSystem.add(new Path("/src/file1"), new File(), false);
            fileSystem.add(new Path("/src/file2"), new File(), false);

            fileSystem.move(new Path("/src"), new Path("/dst"));

            expect(fileSystem.has(new Path("/src"))).to.be.false;
            expect(fileSystem.has(new Path("/src/file1"))).to.be.false;
            expect(fileSystem.has(new Path("/src/file2"))).to.be.false;
            expect(fileSystem.has(new Path("/dst"))).to.be.true;
            expect(fileSystem.has(new Path("/dst/file1"))).to.be.true;
            expect(fileSystem.has(new Path("/dst/file2"))).to.be.true;
        });
    });

    describe("remove", () => {
        it("throws an error if the node does not exist", () => {
            expect(() => fileSystem.remove(new Path("/error"), false, false, false)).to.throw;
        });

        it("does nothing if the node does not exist and the force option is given", () => {
            expect(() => fileSystem.remove(new Path("/error"), true, false, false)).not.to.throw;
        });

        it("throws an error if a directory is removed without the recursive option", () => {
            fileSystem.add(new Path("/dir"), new Directory(), false);

            expect(() => fileSystem.remove(new Path("/dir"), false, false, false)).to.throw;
        });

        it("throws an error if the root is remove without the recursive or no-preserve-root option", () => {
            expect(() => fileSystem.remove(new Path("/"), false, false, false)).to.throw;
            expect(() => fileSystem.remove(new Path("/"), false, true, false)).to.throw;
            expect(() => fileSystem.remove(new Path("/"), false, false, true)).to.throw;
        });

        it("removes a file", () => {
            fileSystem.add(new Path("/file"), new File(), false);
            fileSystem.remove(new Path("/file"), false, false, false);

            expect(fileSystem.has(new Path("/file"))).to.be.false;
        });

        it("removes a directory", () => {
            fileSystem.add(new Path("/dir"), new Directory(), false);
            fileSystem.remove(new Path("/dir"), false, true, false);

            expect(fileSystem.has(new Path("/dir"))).to.be.false;
        });

        it("removes the root", () => {
            fileSystem.add(new Path("/dir"), new Directory(), false);
            fileSystem.add(new Path("/file"), new File(), false);
            fileSystem.remove(new Path("/"), false, true, true);

            expect(fileSystem.has(new Path("/dir"))).to.be.false;
        });
    });
});
