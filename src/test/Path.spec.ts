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
                expect(new Path("/../").toString()).to.equal("/");
            });

            it("ignores parent references at the root", () => {
                expect(new Path("/../../../dir1/../file").toString()).to.equal("/file");
            });

            it("interprets the given path as an absolute path", () => {
                expect(new Path("dir1/file").toString()).to.equal("/dir1/file");
            });
        });

        describe("parts", () => {
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
            expect(new Path("/").ancestors.map(it => it.toString())).to.have.members([]);
        });

        it("returns the root path for a path to a subdirectory of root", () => {
            expect(new Path("/dir").ancestors.map(it => it.toString())).to.have.members(["/"]);
        });

        it("returns both ancestors of a second-level path", () => {
            expect(new Path("/dir1/dir2").ancestors.map(it => it.toString())).to.have.members(["/dir1", "/"]);
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
