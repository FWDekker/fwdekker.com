import "mocha";
import {expect} from "chai";

import {File, NullFile} from "../main/js/FileSystem";


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
