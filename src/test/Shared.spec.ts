import {expect} from "chai";
import "mocha";

import {escapeHtml, extractWordBefore, getFileExtension, parseCssPixels} from "../main/js/Shared";


describe("shared functions", () => {
    describe("escapeHtml", () => {
        it("does not touch non-html", () => {
            expect(escapeHtml("my text")).to.equal("my text");
        });

        it("escape tags", () => {
            expect(escapeHtml("<b>my text</b>")).to.equal("&lt;b&gt;my text&lt;/b&gt;");
        });

        it("escapes quotes", () => {
            expect(escapeHtml(`"my" 'text'`)).to.equal("&quot;my&quot; &#039;text&#039;");
        });
    });

    describe("extractWordBefore", () => {
        it("returns the word", () => {
            const parts = extractWordBefore("a b c", 3);
            expect(parts).to.deep.equal(["a ", "b", " c"]);
        });

        it("returns the word including trailing whitespace", () => {
            const parts = extractWordBefore("a b   c", 5);
            expect(parts).to.deep.equal(["a ", "b  ", " c"]);
        });

        it("returns the word including trailing forward slashes", () => {
            const parts = extractWordBefore("a b// c", 5);
            expect(parts).to.deep.equal(["a ", "b//", " c"]);
        });

        it("returns the word including trailing whitespace and forward slashes", () => {
            const parts = extractWordBefore("a /b//    c", 9);
            expect(parts).to.deep.equal(["a /", "b//   ", " c"]);
        });

        it("returns the word consisting of only forward slashes, delimited by whitespace", () => {
            const parts = extractWordBefore("a / c", 4);
            expect(parts).to.deep.equal(["a ", "/ ", "c"]);
        });

        it("returns the word if there is no preceding delimiter", () => {
            const parts = extractWordBefore("ab c", 2);
            expect(parts).to.deep.equal(["", "ab", " c"]);
        });

        it("returns the word based on custom delimiters", () => {
            const parts = extractWordBefore("a|b c|d", 6, "|");
            expect(parts).to.deep.equal(["a|", "b c|", "d"]);
        });
    });

    describe("getFileExtension", () => {
        it("returns the extension of a file", () => {
            expect(getFileExtension("file.ext")).to.equal("ext");
        });

        it("returns an empty string if there is no extension", () => {
            expect(getFileExtension("file")).to.equal("");
        });

        it("returns an empty string if the string is empty", () => {
            expect(getFileExtension("")).to.equal("");
        });

        it("returns only the extension if the file name contains dots", () => {
            expect(getFileExtension("fi.le.ext")).to.equal("ext");
        });
    });

    describe("parseCssPixels", () => {
        it("returns 0 if null is given", () => {
            expect(parseCssPixels(null)).to.equal(0);
        });

        it("returns 0 if an empty string is given", () => {
            expect(parseCssPixels("")).to.equal(0);
        });

        it("returns 0 if a string containing only whitespace is given", () => {
            expect(parseCssPixels("   ")).to.equal(0);
        });

        it("throws an error if the string does not end with 'px'", () => {
            expect(() => parseCssPixels("12py")).to.throw();
        });

        it("returns 0 if the string does not contain a number", () => {
            expect(parseCssPixels("errorpx")).to.equal(0);
        });

        it("returns the number contained in the string", () => {
            expect(parseCssPixels("29px")).to.equal(29);
        });

        it("returns the number contained in the string even if surrounded with whitespace", () => {
            expect(parseCssPixels(" 17  px")).to.equal(17);
        });

        it("returns a decimal number", () => {
            expect(parseCssPixels("12.34px")).to.equal(12.34);
        });
    });
});

describe("extension functions", () => {
    describe("trimRightChar", () => {
        it("does nothing if the needle is empty", () => {
            expect("abc".trimRightChar("")).to.equal("abc");
        });

        describe("single-char needle", () => {
            it("does nothing to an empty string", () => {
                expect("".trimRightChar("a")).to.equal("");
            });

            it("does nothing if the string does not end with the needle", () => {
                expect("abc".trimRightChar("a")).to.equal("abc");
            });

            it("removes a single occurrence", () => {
                expect("aba".trimRightChar("a")).to.equal("ab");
            });

            it("removes multiple occurrences", () => {
                expect("abaa".trimRightChar("a")).to.equal("ab");
            });
        });

        describe("multi-char needle", () => {
            it("removes a single occurrence", () => {
                expect("abba".trimRightChar("ba")).to.equal("ab");
            });

            it("removes multiple occurrences", () => {
                expect("abbaba".trimRightChar("ba")).to.equal("ab");
            });

            it("does not remove a partial match", () => {
                expect("abcab".trimRightChar("abc")).to.equal("abcab");
            });
        });
    });

    describe("trimLines", () => {
        it("trims each line", () => {
            expect(`This
                   is
                   my
                   text`.trimLines()
            ).to.equal("This\nis\nmy\ntext");
        });

        it("trims uneven lines", () => {
            expect(`This
                is
                 my
                   text
               `.trimLines()
            ).to.equal("This\nis\nmy\ntext\n");
        });
    });

    describe("trimMultiLines", () => {
        it("trims each line", () => {
            it("trims each line", () => {
                expect(`This
                   is
                   my
                   text`.trimMultiLines()
                ).to.equal("This\nis\nmy\ntext");
            });

            it("trims uneven lines", () => {
                expect(`This
                is
                 my
                   text
               `.trimMultiLines()
                ).to.equal("This\nis\nmy\text\n");
            });

            it("trims multi-lines multiple times", () => {
                expect(
                    `This is\\\
                    my
                    text`.trimMultiLines()
                ).to.equal("This is my\ntext");
            });
        });
    });

    describe("sortAlphabetically", () => {
        it("sorts alphabetically with case sensitivity", () => {
            const array: string[] = ["B", "a", "A", "b"];

            expect(array.sortAlphabetically((it) => it, true))
                .to.have.members(["A", "B", "a", "b"]);
        });

        it("sorts alphabetically without case sensitivity", () => {
            const array: string[] = ["B", "a", "A", "b"];

            expect(array.sortAlphabetically((it) => it, false))
                .to.have.members(["A", "a", "B", "b"]);
        });

        it("sorts alphabetically with case sensitivity using the given mapping", () => {
            const array: number[] = [66, 97, 65, 98];

            expect(array.sortAlphabetically((it) => String.fromCharCode(it), true))
                .to.have.members([65, 66, 97, 98]);
        });

        it("sorts alphabetically without case sensitivity using the given mapping", () => {
            const array: number[] = [66, 97, 65, 98];

            expect(array.sortAlphabetically((it) => String.fromCharCode(it), true))
                .to.have.members([65, 97, 66, 98]);
        });
    });
});
