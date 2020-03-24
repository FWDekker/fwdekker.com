import {expect} from "chai";
import "mocha";

import {File, FileStream} from "../main/js/FileSystem";


describe("file stream", () => {
    describe("constructor", () => {
        it("throws an error if the pointer is negative", () => {
            expect(() => new FileStream(new File("contents"), -3)).to.throw();
        });

        it("does not throw an error if the pointer equals the file length", () => {
            expect(() => new FileStream(new File("contents"), 8)).to.not.throw();
        });

        it("throws an error if the pointer exceeds the file length", () => {
            expect(() => new FileStream(new File("contents"), 10)).to.throw();
        });
    });

    describe("read", () => {
        it("reads from the file", () => {
            expect(new FileStream(new File("contents")).read(2)).to.equal("co");
        });

        it("starts reading at the pointer", () => {
            expect(new FileStream(new File("contents"), 2).read(2)).to.equal("nt");
        });

        it("advances the pointer while reading", () => {
            const stream = new FileStream(new File("contents"), 1);

            stream.read(2);

            expect(stream.read(2)).to.equal("te");
        });

        it("reads nothing if the pointer is a the file's end", () => {
            const stream = new FileStream(new File("contents"), 5);

            stream.read(3);

            expect(stream.read()).to.equal("");
        });

        it("does not exceed the file's pointer", () => {
            const file = new File("contents");
            const stream = new FileStream(file, 5);

            stream.read(10);
            stream.write("_new");

            expect(file.contents).to.equal("contents_new");
        });
    });

    describe("write", () => {
        it("writes to the file", () => {
            const file = new File();

            new FileStream(file).write("contents");

            expect(file.contents).to.equal("contents");
        });

        it("appends if the pointer is at the end", () => {
            const file = new File("old");

            new FileStream(file, 3).write("_new");

            expect(file.contents).to.equal("old_new");
        });

        it("writes multiple times", () => {
            const file = new File("");
            const stream = new FileStream(file, 0);

            stream.write("old");
            stream.write("_new");

            expect(file.contents).to.equal("old_new");
        });

        it("overwrites in the middle of the string", () => {
            const file = new File("old");

            new FileStream(file).write("new");

            expect(file.contents).to.equal("new");
        });

        it("partially overwrites and appends", () => {
            const file = new File("old");

            new FileStream(file, 1).write("new");

            expect(file.contents).to.equal("onew");
        });
    });
});
