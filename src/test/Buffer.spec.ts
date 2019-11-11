import "mocha";
import {expect} from "chai";

import {Buffer} from "../main/js/Stream";


describe("buffer", () => {
    let buffer: Buffer;


    beforeEach(() => {
        buffer = new Buffer();
    });


    describe("has", () => {
        it("throws an exception if the count is negative", () => {
            expect(() => buffer.has(-2)).to.throw();
        });

        it("returns true for count 0 if the buffer is empty", () => {
            expect(buffer.has(0)).to.be.true;
        });

        it("returns true for count 0 if the buffer is not empty", () => {
            buffer.write("word");

            expect(buffer.has(0)).to.be.true;
        });

        it("returns false for non-zero count if the buffer is empty", () => {
            expect(buffer.has(3)).to.be.false;
        });

        it("returns true if the non-zero count is less than the buffer's size", () => {
            buffer.write("word");

            expect(buffer.has(2)).to.be.true;
        });

        it("returns true if the non-zero count equals the buffer's size", () => {
            buffer.write("word");

            expect(buffer.has(4)).to.be.true;
        });

        it("returns false if the non-zero count is greater than the buffer's size", () => {
            buffer.write("word");

            expect(buffer.has(6)).to.be.false;
        });
    });

    describe("read", () => {
        describe("undefined count", () => {
            it("returns an empty string if the buffer is empty", () => {
                expect(buffer.read()).to.equal("");
            });

            it("returns all contents if the buffer is not empty", () => {
                buffer.write("word");

                expect(buffer.read()).to.equal("word");
            });

            it("returns multiple lines if the buffer is not empty", () => {
                buffer.write("line\nline\nline\n");

                expect(buffer.read()).to.equal("line\nline\nline\n");
            });

            it("returns an empty string after reading the buffer again", () => {
                buffer.write("line\nline");
                buffer.read();

                expect(buffer.read()).to.equal("");
            });
        });

        describe("defined count", () => {
            it("returns an empty string if the count is greater than the buffer size", () => {
                expect(buffer.read(3)).to.equal("");
            });

            it("returns a substring if the count is less than the buffer size", () => {
                buffer.write("word");

                expect(buffer.read(2)).to.equal("wo");
            });

            it("advances the buffer's contents", () => {
                buffer.write("word");
                buffer.read(2);

                expect(buffer.read(2)).to.equal("rd");
            });
        });
    });

    describe("readLine", () => {
        it("returns an empty string if the buffer is empty", () => {
            expect(buffer.readLine()).to.equal("");
        });

        it("returns an empty string if there is no full line in the buffer", () => {
            buffer.write("word");

            expect(buffer.readLine()).to.equal("");
        });

        it("returns the whole buffer if there is one line in the buffer", () => {
            buffer.write("word\n");

            expect(buffer.readLine()).to.equal("word\n");
        });

        it("returns only a newline character", () => {
            buffer.write("\n");

            expect(buffer.readLine()).to.equal("\n");
        });

        it("returns only the first line", () => {
            buffer.write("word1\nword2\n");

            expect(buffer.readLine()).to.equal("word1\n");
        });

        it("advances the buffer to the next line", () => {
            buffer.write("word1\nword2\n");
            buffer.readLine();

            expect(buffer.readLine()).to.equal("word2\n");
        });
    });

    describe("peek", () => {
        it("does not advance the buffer", () => {
            buffer.write("word");
            buffer.peek(2);

            expect(buffer.peek(2)).to.equal("wo");
        });

        // Refer to `read` for more tests; it uses this method internally
    });

    describe("peekLine", () => {
        it("does not advance the buffer", () => {
            buffer.write("word\n");
            buffer.peekLine();

            expect(buffer.peekLine()).to.equal("word\n");
        });

        // Refer to `readLine` for more tests; it uses this method internally
    });

    describe("write", () => {
        it("appends the given string", () => {
            buffer.write("word");

            expect(buffer.read()).to.equal("word");
        });

        it("appends the string to the end", () => {
            buffer.write("word1");
            buffer.write("word2");

            expect(buffer.read()).to.equal("word1word2");
        });

        it("appends the string to the end after reading from it", () => {
            buffer.write("word1");
            buffer.read(2);
            buffer.write("word2");

            expect(buffer.read()).to.equal("rd1word2");
        });
    });

    describe("writeLine", () => {
        it("appends the given line", () => {
            buffer.writeLine("word");

            expect(buffer.read()).to.equal("word\n");
        });

        it("appends the line to the end", () => {
            buffer.writeLine("word1");
            buffer.writeLine("word2");

            expect(buffer.read()).to.equal("word1\nword2\n");
        });

        it("appends the line to the end after reading from it", () => {
            buffer.writeLine("word1");
            buffer.read(2);
            buffer.writeLine("word2");

            expect(buffer.read()).to.equal("rd1\nword2\n");
        });
    });
});
