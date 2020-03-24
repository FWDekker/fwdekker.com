import {expect} from "chai";
import "mocha";

import {File, NullFile, Path} from "../main/js/FileSystem";


describe("file", () => {
    describe("open", () => {
        describe("append", () => {
            it("returns a stream that reads nothing", () => {
                expect(new File("contents").open("append").read()).to.equal("");
            });

            it("returns a stream that writes to the end of the file", () => {
                const file = new File("old");

                file.open("append").write("_new");

                expect(file.contents).to.equal("old_new");
            });
        });

        describe("read", () => {
            it("returns a stream that reads from the start of the file", () => {
                expect(new File("contents").open("read").read()).to.equal("contents");
            });
        });

        describe("write", () => {
            it("empties the file", () => {
                const file = new File("contents");

                file.open("write");

                expect(file.contents).to.equal("");
            });

            it("returns a stream that overwrites the file", () => {
                const file = new File("old");

                file.open("write").write("new");

                expect(file.contents).to.equal("new");
            });
        });
    });

    describe("nameString", () => {
        it("returns the name if no type is known", () => {
            expect(new File("contents").nameString("file", new Path("/file"))).to.equal("file");
        });

        it("uses the file extension to determine the value", () => {
            expect(new File("contents").nameString("file.txt", new Path("/file")))
                .to.equal(`<a href="#" class="fileLink" onclick="execute('cat /file')">file.txt</a>`);
        });

        it("uses the mime type if no type is known", () => {
            expect(new File("contents", "txt").nameString("file", new Path("/file")))
                .to.equal(`<a href="#" class="fileLink" onclick="execute('cat /file')">file</a>`);
        });

        it("overrides the file extension with the mime type", () => {
            expect(new File("link", "lnk").nameString("file.txt", new Path("/file")))
                .to.equal(`<a href="link" class="fileLink" onclick="execute('open /file'); return false">file.txt</a>`);
        });
    });
});

describe("null file", () => {
    let file: NullFile;


    beforeEach(() => {
        file = new NullFile();
    });


    it("has empty contents", () => {
        expect(file.contents).to.equal("");
    });

    it("is empty after writing to it", () => {
        file.open("write").write("contents");

        expect(file.contents).to.equal("");
    });

    it("is empty when reading from a stream", () => {
        expect(file.open("read").read()).to.equal("");
    });
});
