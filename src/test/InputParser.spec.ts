import "mocha";
import {expect} from "chai";

import "../main/js/Extensions"
import {Environment} from "../main/js/Environment";
import {Globber, InputParser, Tokenizer} from "../main/js/InputParser";
import {Directory, File, FileSystem} from "../main/js/FileSystem";
import {EscapeCharacters} from "../main/js/Terminal";


describe("input parser", () => {
    let parser: InputParser;


    beforeEach(() => {
        const dummyGlobber = new class extends Globber {
            constructor() {
                super(new FileSystem(), "");
            }


            glob(tokens: string[]): string[] {
                return tokens;
            }
        };

        parser = new InputParser(new Tokenizer(new Environment()), dummyGlobber);
    });


    describe("command", () => {
        it("returns the first token as the command", () => {
            expect(parser.parse("command arg1 arg2").command).to.equal("command");
        });
    });

    describe("options", () => {
        describe("short options", () => {
            it("assigns null to a parameter-less short option", () => {
                expect(parser.parse("command -o").options).to.have.own.property("o", null);
            });

            it("assigns null to each parameter-less short option", () => {
                const options = parser.parse("command -o -p").options;
                expect(options).to.have.own.property("o", null);
                expect(options).to.have.own.property("p", null);
            });

            it("assigns null to each parameter-less short option in a group", () => {
                const options = parser.parse("command -op").options;
                expect(options).to.have.own.property("o", null);
                expect(options).to.have.own.property("p", null);
            });

            it("assigns the given value to a short option", () => {
                expect(parser.parse("command -o=value").options).to.have.own.property("o", "value");
            });

            it("assigns the given value containing a space to a short option", () => {
                expect(parser.parse(`command -o="val ue"`).options).to.have.own.property("o", "val ue");
            });

            it("assigns an empty string to a short option", () => {
                expect(parser.parse("command -o= -p").options).to.have.own.property("o", "");
            });

            it("does not assign a value to grouped short options", () => {
                expect(() => parser.parse("command -opq=arg -r")).to.throw;
            });

            it("considers an assignment to an empty short option to be an argument", () => {
                expect(parser.parse("command -=value -p").options).not.to.have.own.property("p");
            });
        });

        describe("long options", () => {
            it("assigns null to a parameter-less long option", () => {
                expect(parser.parse("command --option").options).to.have.own.property("option", null);
            });

            it("assigns null to each parameter-less long option", () => {
                const options = parser.parse("command --option1 --option2").options;
                expect(options).to.have.own.property("option1", null);
                expect(options).to.have.own.property("option2", null);
            });

            it("assigns the given value to a long option", () => {
                expect(parser.parse("command --option=value").options).to.have.own.property("option", "value");
            });

            it("assigns the given value containing a space to a long option", () => {
                expect(parser.parse(`command --option="val ue"`).options).to.have.own.property("option", "val ue");
            });

            it("stops parsing options after the first non-option", () => {
                expect(parser.parse("command -o=value arg -p").options).to.not.have.own.property("p");
            });

            it("considers an assignment to an empty long option to be an argument", () => {
                const options = parser.parse("command --=value -p").options;
                expect(options).not.to.have.own.property("p");
            });
        });

        it("stops parsing options if an option name contains a space", () => {
            expect(parser.parse(`command "--opt ion" -p`).options).to.not.have.own.property("p");
        });

        it("stops parsing options after --", () => {
            expect(parser.parse("command -- -p").options).to.not.have.own.property("p");
        });

        it("considers an option surrounded by quotes as any other option", () => {
            const options = parser.parse(`command -o "-p"`).options;
            expect(options).to.have.own.property("o", null);
            expect(options).to.have.own.property("p", null);
        });
    });

    describe("args", () => {
        it("has no arguments if only the command is given", () => {
            expect(parser.parse("command").args).to.have.length(0);
        });

        it("has no arguments if only options are given", () => {
            expect(parser.parse("command -o=value -p").args).to.have.length(0);
        });

        it("has all simple arguments", () => {
            const args = parser.parse("command a b c").args;
            expect(args).to.include("a");
            expect(args).to.include("b");
            expect(args).to.include("c");
        });

        it("has arguments containing spaces", () => {
            expect(parser.parse(`command "a b c"`).args).to.include("a b c");
        });

        it("has arguments containing dashes", () => {
            expect(parser.parse("command -o -- -p").args).to.include("-p");
        });
    });

    describe("output redirection", () => {
        it("should have the default redirect target by default", () => {
            expect(parser.parse("command").redirectTarget).to.have.members(["default"]);
        });

        it("should find the writing redirect target", () => {
            expect(parser.parse("command > file").redirectTarget).to.have.members(["write", "file"]);
        });

        it("should find the appending redirect target", () => {
            expect(parser.parse("command >> file").redirectTarget).to.have.members(["append", "file"]);
        });

        it("should find the redirect target without a space between the operator and filename", () => {
            expect(parser.parse("command >file").redirectTarget).to.have.members(["write", "file"]);
        });

        it("should find the redirect target with multiple spaces between the operator and filename", () => {
            expect(parser.parse("command >   file").redirectTarget).to.have.members(["write", "file"]);
        });

        it("should find the redirect target without a space between the previous token and the target", () => {
            const inputArgs = parser.parse("command arg>file");
            expect(inputArgs.redirectTarget).to.have.members(["write", "file"]);
            expect(inputArgs.args).to.have.members(["arg"]);
        });

        it("should choose the last redirect target if multiple are present", () => {
            expect(parser.parse("command > file1 >> file2").redirectTarget).to.have.members(["append", "file2"]);
            expect(parser.parse("command >> file1 > file2").redirectTarget).to.have.members(["write", "file2"]);
        });

        it("should find the writing redirect target if placed at the end", () => {
            const inputArgs = parser.parse("command -o=p arg1 > file");
            expect(inputArgs.options).to.deep.equal({o: "p"});
            expect(inputArgs.args).to.have.members(["arg1"]);
            expect(inputArgs.redirectTarget).to.have.members(["write", "file"]);
        });

        it("should find the redirect target if placed in between arguments", () => {
            const inputArgs = parser.parse("command arg1 > file arg2");
            expect(inputArgs.redirectTarget).to.have.members(["write", "file"]);
            expect(inputArgs.args).to.have.members(["arg1", "arg2"]);
        });

        it("should find the redirect target if placed in between options", () => {
            const inputArgs = parser.parse("command -o=p >> file --ba=ba arg2");
            expect(inputArgs.redirectTarget).to.have.members(["append", "file"]);
            expect(inputArgs.options).to.deep.equal({o: "p", ba: "ba"});
        });

        it("should ignore the redirect target if inside quotation marks", () => {
            expect(parser.parse("command '> file'").redirectTarget).to.have.members(["default"]);
        });

        it("should ignore the redirect target if the operator is escaped", () => {
            const inputArgs = parser.parse("command \\> file");
            expect(inputArgs.redirectTarget).to.have.members(["default"]);
            expect(inputArgs.args).to.have.members([">", "file"]);
        });
    });
});

describe("tokenizer", () => {
    const escape = EscapeCharacters.Escape;
    let tokenizer: Tokenizer;


    beforeEach(() => {
        tokenizer = new Tokenizer(new Environment());
    });


    describe("tokens", () => {
        describe("whitespace", () => {
            it("ignores unnecessary leading whitespace", () => {
                expect(tokenizer.tokenize("    token1 token2")).to.have.members(["token1", "token2"]);
            });

            it("ignores unnecessary trailing whitespace", () => {
                expect(tokenizer.tokenize("token1 token2   ")).to.have.members(["token1", "token2"]);
            });

            it("ignores unnecessary whitespace in between tokens", () => {
                expect(tokenizer.tokenize("token1     token2")).to.have.members(["token1", "token2"]);
            });
        });

        describe("escape characters", () => {
            it("includes escaped spaces into the token", () => {
                expect(tokenizer.tokenize("com\\ mand")).to.have.members(["com mand"]);
            });

            it("includes escaped quotation marks in the token", () => {
                expect(tokenizer.tokenize(`com\\'man\\"d`)).to.have.members([`com'man"d`]);
            });

            it("does not escape ordinary characters inside strings", () => {
                expect(tokenizer.tokenize(`\\p`)).to.have.members(["p"]);
                expect(tokenizer.tokenize(`'\\p'`)).to.have.members(["\\p"]);
                expect(tokenizer.tokenize(`"\\p"`)).to.have.members(["\\p"]);
            });

            it("includes escaped spaces at the very end", () => {
                expect(tokenizer.tokenize("a b\\ ")).to.have.members(["a", "b "]);
            });

            it("throws an error if an escape occurs but no character follows", () => {
                expect(() => tokenizer.tokenize("\\")).to.throw;
            });
        });

        describe("grouping", () => {
            describe("quotes", () => {
                it("groups using single quotes", () => {
                    expect(tokenizer.tokenize("a'b'a")).to.have.members(["aba"]);
                });

                it("groups using double quotes", () => {
                    expect(tokenizer.tokenize(`a"b"a`)).to.have.members(["aba"]);
                });

                it("throws an error if single quotes are not closed", () => {
                    expect(() => tokenizer.tokenize("a'ba")).to.throw;
                });

                it("throws an error if double quotes are not closed", () => {
                    expect(() => tokenizer.tokenize(`a"ba`)).to.throw;
                });

                it("does not group double quotes within single quotes", () => {
                    expect(tokenizer.tokenize(`a'b"b'a`)).to.have.members([`ab"ba`]);
                });

                it("does not group single quotes within double quotes", () => {
                    expect(tokenizer.tokenize(`a"b'b"a`)).to.have.members(["ab'ba"]);
                });
            });

            describe("curly braces", () => {
                it("groups using curly braces", () => {
                    expect(tokenizer.tokenize("a{b}a")).to.have.members(["aba"]);
                });

                it("groups using nested curly braces", () => {
                    expect(tokenizer.tokenize("a{{b}{b}}a")).to.have.members(["abba"]);
                });

                it("throws an error if curly braces are not closed", () => {
                    expect(() => tokenizer.tokenize("a{ba")).to.throw;
                });

                it("throws an error if curly braces are not opened", () => {
                    expect(() => tokenizer.tokenize("a}ba")).to.throw;
                });

                it("throws an error if nested curly braces are not closed", () => {
                    expect(() => tokenizer.tokenize("a{{b}a")).to.throw;
                });

                it("does not group curly braces within single quotes", () => {
                    expect(tokenizer.tokenize(`a'b{b'a`)).to.have.members(["ab{ba"]);
                });

                it("does not group curly braces within double quotes", () => {
                    expect(tokenizer.tokenize(`a"b{b"a`)).to.have.members(["ab{ba"]);
                });
            });
        });
    });

    describe("environment", () => {
        beforeEach(() => {
            tokenizer = new Tokenizer(new Environment([], {a: "b", aa: "c", r: ">", cwd: "/"}));
        });


        it("substitutes a known environment variable with its value", () => {
            expect(tokenizer.tokenize("$a")).to.have.members(["b"]);
        });

        it("substitutes an unknown environment variable with nothing", () => {
            expect(tokenizer.tokenize("a$b")).to.have.members(["a"]);
        });

        it("substitutes consecutive known environment variables with their value", () => {
            expect(tokenizer.tokenize("$a$aa$a")).to.have.members(["bcb"]);
        });

        it("throws an error for nameless environment variables", () => {
            expect(() => tokenizer.tokenize("$")).to.throw;
        });

        it("does not substitute environment variables in the middle of a single-quoted string", () => {
            expect(tokenizer.tokenize("a'$a'c")).to.have.members(["a$ac"]);
        });

        it("does not substitute environment variables in the middle of a double-quoted string", () => {
            expect(tokenizer.tokenize(`a"$a"c`)).to.have.members(["a$ac"]);
        });

        it("substitutes environment variables in the middle of curly braces", () => {
            expect(tokenizer.tokenize("a{$a}c")).to.have.members(["abc"]);
        });
    });

    describe("escapes", () => {
        it("escapes output target characters", () => {
            expect(tokenizer.tokenize("a >b")).to.have.members(["a", `${escape}>b`]);
            expect(tokenizer.tokenize("a >>b")).to.have.members(["a", `${escape}>${escape}>b`]);
        });

        it("does not escape escaped target characters", () => {
            expect(tokenizer.tokenize("a \\>b")).to.have.members(["a", ">b"]);
            expect(tokenizer.tokenize("a \\>>b")).to.have.members(["a", ">", `${escape}>b`]);
        });

        it("escapes glob characters", () => {
            expect(tokenizer.tokenize("a b?")).to.have.members(["a", `b${escape}?`]);
            expect(tokenizer.tokenize("a b*")).to.have.members(["a", `b${escape}*`]);
            expect(tokenizer.tokenize("a b**")).to.have.members(["a", `b${escape}*${escape}*`]);
        });

        it("does not escape escaped glob characters", () => {
            expect(tokenizer.tokenize("a b\\?")).to.have.members(["a", `b?`]);
            expect(tokenizer.tokenize("a b\\*")).to.have.members(["a", `b*`]);
        });
    });
});

describe("globber", () => {
    const escape = EscapeCharacters.Escape;
    let globber: Globber;


    beforeEach(() => {
        globber = new Globber(
            new FileSystem(new Directory({
                "aa": new Directory({
                    "ab1": new File()
                }),
                "ab1": new File(),
                "ab2": new File(),
                "aa3": new File(),
                "b?": new File(),
                ".a": new File()
            })),
            "/"
        );
    });


    describe("?", () => {
        it("throws an error if no matches are found", () => {
            expect(() => globber.glob([`x${escape}?`])).to.throw;
        });

        it("globs a single ?", () => {
            expect(globber.glob([`ab${escape}?`])).to.have.members(["ab1", "ab2"]);
        });

        it("globs multiple ?s", () => {
            expect(globber.glob([`a${escape}?${escape}?`])).to.have.members(["ab1", "ab2", "aa3"]);
        });

        it("does not process unescaped ?s", () => {
            expect(globber.glob(["a?"])).to.have.members(["a?"]);
        });
    });

    describe("*", () => {
        it("throws an error if no matches are found", () => {
            expect(() => globber.glob([`x${escape}*`])).to.throw;
        });

        it("globs a single *", () => {
            expect(globber.glob([`a${escape}*`])).to.have.members(["aa", "ab1", "ab2", "aa3"]);
        });

        it("globs multiple *s", () => {
            expect(globber.glob([`a${escape}*/${escape}*`])).to.have.members(["aa/ab1"]);
        });

        it("does not process unescaped *s", () => {
            expect(globber.glob(["a*"])).to.have.members(["a*"]);
        });
    });

    describe("**", () => {
        it("throws an error if no matches are found", () => {
            expect(() => globber.glob([`x${escape}**`])).to.throw;
        });

        it("globs **", () => {
            expect(globber.glob([`${escape}*${escape}*b1`])).to.have.members(["ab1", "aa/ab1"]);
        });

        it("does not match the directory itself", () => {
            expect(globber.glob([`${escape}*${escape}*`]).map(it => it.trim())).to.not.contain("");
        });

        it("does not process unescaped **s", () => {
            expect(globber.glob(["a**"])).to.have.members(["a**"]);
        });
    });

    it("does not use an embedded `.*` in regex matching", () => {
        expect(globber.glob([`.${escape}*`])).to.have.members([".a"]);
    })
});
