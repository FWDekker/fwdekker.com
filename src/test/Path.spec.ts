import "mocha";
import {expect} from "chai";

import "../main/js/Extensions"
import {Path} from "../main/js/FileSystem";


describe("paths", () => {
    describe("path", () => {
        describe("simplification", () => {
            it("removes consecutive slashes", () => {
                expect(new Path("/dir1//dir2///file").toString()).to.equal("/dir1/dir2/file");
            });

            it("removes consecutive slashes at the root", () => {
                expect(new Path("//").toString()).to.equal("/");
            });

            it("removes all parent references", () => {
                expect(new Path("/dir1/dir2/../file").toString()).to.equal("/dir1/file");
            });

            it("removes all reflexive references", () => {
                expect(new Path("/dir1/./file").toString()).to.equal("/dir1/file");
            });

            it("returns root if the parent of root is given", () => {
                expect(new Path("/..").toString()).to.equal("/");
                expect(new Path("/../").toString()).to.equal("/");
            });

            it("returns root if the reflexive of root is given", () => {
                expect(new Path("/.").toString()).to.equal("/");
                expect(new Path("/./").toString()).to.equal("/");
            });

            it("ignores parent references at the root", () => {
                expect(new Path("/../../../dir1/../file").toString()).to.equal("/file");
            });

            it("interprets the given path as an absolute path", () => {
                expect(new Path("dir1/file").toString()).to.equal("/dir1/file");
            });

            it("identifies newline characters as characters", () => {
                expect(new Path("/dir/\n").toString()).to.equal("/dir/\n");
            });
        });

        describe("parts", () => {
            it("throws an error if no parts are given", () => {
                expect(() => new Path()).to.throw();
            });

            it("concatenates multiple parts", () => {
                expect(new Path("/dir1", "/dir2", "/file").toString()).to.equal("/dir1/dir2/file");
            });

            it("removes empty parts", () => {
                expect(new Path("/dir1", "", "/file").toString()).to.equal("/dir1/file");
            });

            it("ignores parts containing only slashes", () => {
                expect(new Path("/", "///", "/file").toString()).to.equal("/file");
            });
        });

        describe("interpret", () => {
            it("uses only the cwd if no paths are given", () => {
                expect(Path.interpret("/cwd").toString()).to.equal("/cwd");
            });

            it("ignores the cwd if the first path is absolute", () => {
                expect(Path.interpret("/cwd", "/dir1", "dir2").toString()).to.equal("/dir1/dir2");
            });

            it("uses all parts if the first path is relative", () => {
                expect(Path.interpret("/cwd", "dir1", "/dir2").toString()).to.equal("/cwd/dir1/dir2");
            });
        });
    });

    describe("fileName", () => {
        it("should return the name of the node", () => {
            expect(new Path("/dir/name").fileName).to.equal("name");
        });

        it("should return the name of the node if the path ends with a slash", () => {
            expect(new Path("/dir/name/").fileName).to.equal("name");
        });

        it("should return an empty string if the path is the root path", () => {
            expect(new Path("/").fileName).to.equal("");
        });

        it("should return an empty string if the path is a complex version of the root path", () => {
            expect(new Path("/dir//./..///").fileName).to.equal("");
        });
    });

    describe("directory", () => {
        it("is a directory path if the last part ends with a slash", () => {
            expect(new Path("/dir/").isDirectory).to.be.true;
        });

        it("is a directory if the last part ends with a slash", () => {
            expect(new Path("/dir1", "dir2/").isDirectory).to.be.true;
        });

        it("is not a directory path if the last part does not end with a slash", () => {
            expect(new Path("/dir").isDirectory).to.be.false;
        });

        it("is not a directory if only the first part ends with a slash", () => {
            expect(new Path("/dir/", "file").isDirectory).to.be.false;
        });
    });

    describe("parent", () => {
        it("returns root as the parent of root", () => {
            expect(new Path("/").parent.toString()).to.equal(new Path("/").toString());
        });

        it("returns a directory's parent directory", () => {
            expect(new Path("/dir1/dir2/").parent.toString()).to.equal(new Path("/dir1/").toString());
        });

        it("returns a file's parent directory", () => {
            expect(new Path("/dir1/file").parent.toString()).to.equal(new Path("/dir1/").toString());
        });
    });

    describe("ancestors", () => {
        it("returns an empty list for the root path", () => {
            expect(new Path("/").ancestors.map(it => it.toString())).to.have.length(0);
        });

        it("returns the root path for a path to a subdirectory of root", () => {
            expect(new Path("/dir").ancestors.map(it => it.toString())).to.have.members(["/"]);
        });

        it("returns both ancestors of a second-level path", () => {
            expect(new Path("/dir1/dir2").ancestors.map(it => it.toString())).to.have.members(["/dir1", "/"]);
        });
    });

    describe("is ancestor of", () => {
        it("returns false for root self-ancestry", () => {
            expect(new Path("/").isAncestorOf(new Path("/"))).to.be.false;
        });

        it("returns false for non-root self-ancestry", () => {
            expect(new Path("/dir").isAncestorOf(new Path("/dir"))).to.be.false;
        });

        it("returns true when checking if the root is an ancestor", () => {
            expect(new Path("/").isAncestorOf(new Path("/dir"))).to.be.true;
            expect(new Path("/").isAncestorOf(new Path("/dir/file"))).to.be.true;
        });

        it("returns true when checking for a child of a non-root directory", () => {
            expect(new Path("/dir").isAncestorOf(new Path("/dir/file"))).to.be.true;
        });

        it("returns false when checking if a non-root path is an ancestor of root", () => {
            expect(new Path("/dir").isAncestorOf(new Path("/"))).to.be.false;
        });

        it("returns false when comparing two disjoint paths", () => {
            expect(new Path("/dir1").isAncestorOf(new Path("/dir2"))).to.be.false;
            expect(new Path("/dir/file1").isAncestorOf(new Path("/dir/file2"))).to.be.false;
        });
    });

    describe("ancestors until", () => {
        it("returns no ancestors between root and itself", () => {
            expect(new Path("/").getAncestorsUntil(new Path("/"))).to.have.length(0);
        });

        it("returns no ancestors between a non-root and itself", () => {
            expect(new Path("/dir/file").getAncestorsUntil(new Path("/dir/file"))).to.have.length(0);
        });

        it("returns the root parent if there are no other ancestors in between", () => {
            expect(new Path("/dir").getAncestorsUntil(new Path("/")).map(it => it.toString()))
                .to.have.members(["/"]);
        });

        it("returns the non-root parent if there are no other ancestors in between", () => {
            expect(new Path("/dir/file").getAncestorsUntil(new Path("/dir")).map(it => it.toString()))
                .to.have.members(["/dir"]);
        });

        it("throws an exception if it's not a child", () => {
            expect(() => new Path("/dir1/file").getAncestorsUntil(new Path("/dir2"))).to.throw();
        });

        it("throws an exception if the order is the wrong way around", () => {
            expect(() => new Path("/dir").getAncestorsUntil(new Path("/dir/file"))).to.throw();
        });
    });

    describe("child", () => {
        it("returns itself for a reflexive 'child'", () => {
            expect(new Path("/dir1/dir2/").getChild("./").toString())
                .to.equal(new Path("/dir1/dir2/").toString());
        });

        it("returns the parent directory for a parent 'child'", () => {
            expect(new Path("/dir1/dir2/").getChild("../").toString())
                .to.equal(new Path("/dir1/").toString());
        });

        it("returns the child of a directory", () => {
            expect(new Path("/dir1/dir2/").getChild("dir3").toString())
                .to.equal(new Path("/dir1/dir2/dir3/").toString());
        });

        it("returns the grandchild of a directory", () => {
            expect(new Path("/dir1/dir2/").getChild("dir3/file").toString())
                .to.equal(new Path("/dir1/dir2/dir3/file").toString());
        });
    });
});
