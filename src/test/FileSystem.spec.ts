import "mocha";
import {expect} from "chai";

import "../main/js/Extensions";
import {Directory, File, FileSystem, Path} from "../main/js/FileSystem";


describe("file system", () => {
    let fileSystem: FileSystem;


    beforeEach(() => {
        fileSystem = new FileSystem(new Directory());
    });


    describe("constructor", () => {
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
            expect(() => fileSystem.add(new Path("/"), new File(), false)).to.throw();
        });

        it("fails if an intermediate directory does not exist", () => {
            expect(() => fileSystem.add(new Path("/dir1/dir2/file2"), new File(), false)).to.throw();
        });

        it("fails if an intermediate directory is not a directory", () => {
            fileSystem.add(new Path("/file1"), new File(), false);

            expect(() => fileSystem.add(new Path("/file1/file2"), new File(), false)).to.throw();
        });

        it("fails if a node already exists at the path", () => {
            fileSystem.add(new Path("/file1"), new File(), false);

            expect(() => fileSystem.add(new Path("/file1"), new File(), false)).to.throw();
        });

        it("fails if a file is added at a directory path", () => {
            expect(() => fileSystem.add(new Path("/dir/"), new File(), false)).to.throw();
        });
    });

    describe("copy", () => {
        it("throws an error if the source does not exist", () => {
            expect(() => fileSystem.copy(new Path("/src"), new Path("/dst"), false)).to.throw();
        });

        it("throws an error if the source is a directory and the recursive options it not given", () => {
            fileSystem.add(new Path("/src"), new Directory(), false);

            expect(() => fileSystem.copy(new Path("/src"), new Path("/dst"), false)).to.throw();
        });

        it("throws an error if the target's parent does not exist", () => {
            fileSystem.add(new Path("/src"), new File(), false);

            expect(() => fileSystem.copy(new Path("/src"), new Path("/parent/dst"), false)).to.throw();
        });

        it("throws an error if the target's parent is not a directory", () => {
            fileSystem.add(new Path("/src"), new File(), false);
            fileSystem.add(new Path("/parent"), new File(), false);

            expect(() => fileSystem.copy(new Path("/src"), new Path("/parent/dst"), false)).to.throw();
        });

        it("throws an error if the target already exists", () => {
            fileSystem.add(new Path("/src"), new File(), false);
            fileSystem.add(new Path("/parent"), new Directory(), false);
            fileSystem.add(new Path("/parent/dst"), new File(), false);

            expect(() => fileSystem.copy(new Path("/src"), new Path("/parent/dst"), false)).to.throw();
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
            file.open("write").write("new");

            expect((<File> fileSystem.get(new Path("/dst"))).open("read").read()).to.equal("old");
        });
    });

    describe("get", () => {
        it("returns the root node for the root path", () => {
            expect(fileSystem.get(new Path("/"))).to.equal(fileSystem.root);
        });

        it("returns the node at the given path", () => {
            const file = new File();
            fileSystem.add(new Path("/dir"), new Directory(), false);
            fileSystem.add(new Path("/dir/file"), file, false);

            expect(fileSystem.get(new Path("/dir/file"))).to.equal(file);
        });

        it("returns the file at the given file path", () => {
            const file = new File();
            fileSystem.add(new Path("/file"), file, false);

            expect(fileSystem.get(new Path("/file"))).to.equal(file);
        });

        it("returns the directory at the given file path", () => {
            const directory = new Directory();
            fileSystem.add(new Path("/dir"), directory, false);

            expect(fileSystem.get(new Path("/dir"))).to.equal(directory);
        });

        it("returns undefined for a directory path even though a file exists with the same name", () => {
            const file = new File();
            fileSystem.add(new Path("/file"), file, false);

            expect(fileSystem.get(new Path("/file/"))).to.be.undefined;
        });

        it("returns the directory at the given directory path", () => {
            const directory = new Directory();
            fileSystem.add(new Path("/dir"), directory, false);

            expect(fileSystem.get(new Path("/dir/"))).to.equal(directory);
        });

        it("returns undefined if the parent is not a directory", () => {
            fileSystem.add(new Path("/file1"), new File(), false);

            expect(fileSystem.get(new Path("/file1/file2"))).to.be.undefined;
        });

        it("returns undefined if the parent does not contain the node", () => {
            fileSystem.add(new Path("/dir"), new Directory(), false);

            expect(fileSystem.get(new Path("/dir/file"))).to.be.undefined;
        });
    });

    describe("has", () => {
        it("returns true for the root path", () => {
            expect(fileSystem.has(new Path("/"))).to.be.true;
        });

        it("returns true if a file exists at the given file path", () => {
            fileSystem.add(new Path("/dir"), new File(), false);

            expect(fileSystem.has(new Path("/dir"))).to.be.true;
        });

        it("returns true if a directory exists at the given file path", () => {
            fileSystem.add(new Path("/dir"), new Directory(), false);

            expect(fileSystem.has(new Path("/dir"))).to.be.true;
        });

        it("returns false if a file with the same name exists but a directory path is given", () => {
            fileSystem.add(new Path("/dir"), new File(), false);

            expect(fileSystem.has(new Path("/dir/"))).to.be.false;
        });

        it("returns true if a directory exists at the given directory path", () => {
            fileSystem.add(new Path("/dir"), new Directory(), false);

            expect(fileSystem.has(new Path("/dir/"))).to.be.true;
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
            fileSystem.add(new Path("/src"), new File(), false);

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

        it("moves rather than copies", () => {
            const file = new File("old");
            fileSystem.add(new Path("/src"), file, false);

            fileSystem.move(new Path("/src"), new Path("/dst"));
            file.open("write").write("new");

            expect((<File> fileSystem.get(new Path("/dst"))).open("read").read()).to.equal("new");
        });

        it("throws an error if the destination already exists", () => {
            fileSystem.add(new Path("/src"), new File(), false);
            fileSystem.add(new Path("/dst"), new File(), false);

            expect(() => fileSystem.move(new Path("/src"), new Path("/dst"))).to.throw();
        });

        it("throws an error if the destination's parent directory does not exist", () => {
            fileSystem.add(new Path("/src"), new File(), false);

            expect(() => fileSystem.move(new Path("/src"), new Path("/dir/dst"))).to.throw();
        });

        it("throws an error if the destination's parent is a file", () => {
            fileSystem.add(new Path("/src"), new File(), false);
            fileSystem.add(new Path("/file"), new File(), false);

            expect(() => fileSystem.move(new Path("/src"), new Path("/file/dst"))).to.throw();
        });
    });

    describe("open", () => {
        it("throws an error if the target is an existing directory", () => {
            fileSystem.add(new Path("/dir"), new Directory(), false);

            expect(() => fileSystem.open(new Path("/dir"), "read")).to.throw();
        });

        it("throws an error in read mode if a directory path is given", () => {
            expect(() => fileSystem.open(new Path("/dir/"), "read")).to.throw();
        });

        it("creates the target in write mode if it does not exist yet", () => {
            fileSystem.open(new Path("/file"), "write");

            expect(fileSystem.has(new Path("/file"))).to.be.true;
        });

        it("returns a stream containing the target file's contents", () => {
            fileSystem.add(new Path("/file"), new File("contents"), false);

            expect(fileSystem.open(new Path("/file"), "read").read()).to.equal("contents");
        });
    });

    describe("remove", () => {
        it("removes a file", () => {
            fileSystem.add(new Path("/file"), new File(), false);

            fileSystem.remove(new Path("/file"));

            expect(fileSystem.has(new Path("/file"))).to.be.false;
        });

        it("removes a directory", () => {
            fileSystem.add(new Path("/dir"), new Directory(), false);
            fileSystem.add(new Path("/dir/file"), new File(), false);

            fileSystem.remove(new Path("/dir"));

            expect(fileSystem.has(new Path("/dir"))).to.be.false;
            expect(fileSystem.has(new Path("/dir/file"))).to.be.false;
        });

        it("removes the root", () => {
            fileSystem.add(new Path("/dir"), new Directory(), false);
            fileSystem.add(new Path("/dir/file"), new File(), false);
            fileSystem.add(new Path("/file"), new File(), false);

            fileSystem.remove(new Path("/"));

            expect(fileSystem.has(new Path("/dir"))).to.be.false;
        });

        it("does not remove a file at a directory path", () => {
            fileSystem.add(new Path("/file"), new File(), false);

            fileSystem.remove(new Path("/file/"));

            expect(fileSystem.has(new Path("/file"))).to.be.true;
        });
    });

    describe("determineMoveMappings", () => {
        describe("single source", () => {
            it("maps to the destination if the destination does not exist and its parent is a directory", () => {
                fileSystem.add(new Path("/src"), new File(), false);

                expect(fileSystem.determineMoveMappings([new Path("/src")], new Path("/dst")))
                    .to.deep.equal([[new Path("/src"), new Path("/dst")]]);
            });

            it("maps into the destination if the destination exists and it is a directory", () => {
                fileSystem.add(new Path("/src"), new File(), false);
                fileSystem.add(new Path("/dst"), new Directory(), false);

                expect(fileSystem.determineMoveMappings([new Path("/src")], new Path("/dst")))
                    .to.deep.equal([[new Path("/src"), new Path("/dst/src")]]);
            });

            it("fails if neither the destination nor its parent exists", () => {
                fileSystem.add(new Path("/src"), new File(), false);

                expect(() => fileSystem.determineMoveMappings([new Path("/src")], new Path("/parent/dst"))).to.throw();
            });

            it("fails if the destination does not exist and its parent is a file", () => {
                fileSystem.add(new Path("/src"), new File(), false);
                fileSystem.add(new Path("/parent"), new File(), false);

                expect(() => fileSystem.determineMoveMappings([new Path("/src")], new Path("/parent/dst"))).to.throw();
            });

            it("fails if neither the destination nor its parent exists", () => {
                fileSystem.add(new Path("/src"), new File(), false);

                expect(() => fileSystem.determineMoveMappings([new Path("/src")], new Path("/parent/dst"))).to.throw();
            });

            it("fails if the destination already exists and it is a file", () => {
                fileSystem.add(new Path("/src"), new File(), false);
                fileSystem.add(new Path("/dst"), new File(), false);

                expect(() => fileSystem.determineMoveMappings([new Path("/src")], new Path("/dst"))).to.throw();
            });
        });

        describe("multiple sources", () => {
            it("maps into the destination if the destination exists and it is a directory", () => {
                fileSystem.add(new Path("/src1"), new File(), false);
                fileSystem.add(new Path("/src2"), new File(), false);
                fileSystem.add(new Path("/dst"), new Directory(), false);

                const sources = [new Path("/src1"), new Path("/src2")];
                const mappings = [
                    [new Path("/src1"), new Path("/dst/src1")],
                    [new Path("/src2"), new Path("/dst/src2")]
                ];
                expect(fileSystem.determineMoveMappings(sources, new Path("/dst"))).to.deep.equal(mappings);
            });

            it("maps the filenames into the destination if the sources have different parents, the destination " +
                "exists, and it is a directory", () => {
                fileSystem.add(new Path("/src1"), new File(), false);
                fileSystem.add(new Path("/parent/src2"), new File(), true);
                fileSystem.add(new Path("/dst"), new Directory(), false);

                const sources = [new Path("/src1"), new Path("/parent/src2")];
                const mappings = [
                    [new Path("/src1"), new Path("/dst/src1")],
                    [new Path("/parent/src2"), new Path("/dst/src2")]
                ];
                expect(fileSystem.determineMoveMappings(sources, new Path("/dst"))).to.deep.equal(mappings);
            });

            it("fails if the destination does not exist", () => {
                fileSystem.add(new Path("/src1"), new File(), false);
                fileSystem.add(new Path("/src2"), new File(), false);

                const sources = [new Path("/src1"), new Path("/src2")];
                expect(() => fileSystem.determineMoveMappings(sources, new Path("/dst"))).to.throw();
            });

            it("fails if the destination exists and is a file", () => {
                fileSystem.add(new Path("/src1"), new File(), false);
                fileSystem.add(new Path("/src2"), new File(), false);
                fileSystem.add(new Path("/dst"), new File(), false);

                const sources = [new Path("/src1"), new Path("/src2")];
                expect(() => fileSystem.determineMoveMappings(sources, new Path("/dst"))).to.throw();
            });
        });
    });
});
