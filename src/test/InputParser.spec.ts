import "mocha";
import {expect} from "chai";

import "../main/js/Extensions"
import {Environment} from "../main/js/Environment";
import {Globber, InputParser, Tokenizer} from "../main/js/InputParser";
import {Directory, File, FileSystem, Node, Path} from "../main/js/FileSystem";
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

            it("stops parsing options if a short option name contains a space", () => {
                expect(parser.parse(`command "-opt ion" -p`).options).to.not.have.own.property("p");
            });

            it("stops parsing options if a short option-like negative number is given", () => {
                expect(parser.parse(`command -2 -p`).options).to.not.have.own.property("p");
            });

            it("continues parsing options if the value of a short option is a number", () => {
                expect(parser.parse(`command -a=2 -p`).options).to.have.own.property("a", "2");
            });

            it("considers an assignment to an empty short option to be an argument", () => {
                expect(parser.parse("command -=value -p").options).to.not.have.own.property("p");
            });

            it("considers a short option surrounded by quotes as any other option", () => {
                const options = parser.parse(`command -o "-p"`).options;
                expect(options).to.have.own.property("o", null);
                expect(options).to.have.own.property("p", null);
            });
        });

        describe("long options", () => {
            it("assigns null to a parameter-less long option", () => {
                expect(parser.parse("command --option").options).to.have.own.property("option", null);
            });

            it("assigns null to each parameter-less long option", () => {
                const options = parser.parse("command --optionA --optionB").options;
                expect(options).to.have.own.property("optionA", null);
                expect(options).to.have.own.property("optionB", null);
            });

            it("assigns the given value to a long option", () => {
                expect(parser.parse("command --option=value").options).to.have.own.property("option", "value");
            });

            it("assigns the given value containing a space to a long option", () => {
                expect(parser.parse(`command --option="val ue"`).options).to.have.own.property("option", "val ue");
            });

            it("stops parsing options if a long option name contains a space", () => {
                expect(parser.parse(`command "--opt ion" -p`).options).to.not.have.own.property("p");
            });

            it("stops parsing options if a long option-like negative number is given", () => {
                expect(parser.parse(`command --2 -p`).options).to.not.have.own.property("p");
            });

            it("continues parsing options if the value of a long option is a number", () => {
                expect(parser.parse(`command --a=2 -p`).options).to.have.own.property("a", "2");
            });

            it("considers an assignment to an empty long option to be an argument", () => {
                const options = parser.parse("command --=value -p").options;
                expect(options).to.not.have.own.property("p");
            });

            it("considers a long option surrounded by quotes as any other option", () => {
                const options = parser.parse(`command -o "--p"`).options;
                expect(options).to.have.own.property("o", null);
                expect(options).to.have.own.property("p", null);
            });
        });

        it("stops parsing options after the first non-option", () => {
            expect(parser.parse("command -o=value arg -p").options).to.not.have.own.property("p");
        });

        it("stops parsing options after --", () => {
            expect(parser.parse("command -- -p").options).to.not.have.own.property("p");
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

    describe("home directory", () => {
        beforeEach(() => {
            tokenizer = new Tokenizer(new Environment([], {home: "/home"}));
        });


        it("substitutes the home directory for ~ at the end of the input", () => {
            expect(tokenizer.tokenize("token ~")).to.have.members(["token", "/home"]);
        });

        it("substitutes the home directory for ~ if followed by a /", () => {
            expect(tokenizer.tokenize("token ~/")).to.have.members(["token", "/home/"]);
        });

        it("does not substitute the home directory for ~ if followed something else", () => {
            expect(tokenizer.tokenize("token ~~")).to.have.members(["token", "~~"]);
            expect(tokenizer.tokenize("token ~a")).to.have.members(["token", "~a"]);
            expect(tokenizer.tokenize("token ~.")).to.have.members(["token", "~."]);
        });

        it("does not substitute the home directory in the middle of a token", () => {
            expect(tokenizer.tokenize("token ab~cd")).to.have.members(["token", "ab~cd"]);
        });

        it("does not substitute the home directory for ~ if surrounded by parentheses or braces", () => {
            expect(tokenizer.tokenize("token '~'")).to.have.members(["token", "~"]);
            expect(tokenizer.tokenize(`token "~"`)).to.have.members(["token", "~"]);
            expect(tokenizer.tokenize("token {~}")).to.have.members(["token", "~"]);
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
        });

        it("does not escape escaped glob characters", () => {
            expect(tokenizer.tokenize("a b\\?")).to.have.members(["a", `b?`]);
            expect(tokenizer.tokenize("a b\\*")).to.have.members(["a", `b*`]);
        });
    });
});

describe("globber", () => {
    const escape = EscapeCharacters.Escape;


    const createGlobber = function(nodes: { [path: string]: Node } = {}, cwd: string = "/"): Globber {
        const fs = new FileSystem(new Directory());
        for (const path of Object.getOwnPropertyNames(nodes))
            fs.add(new Path(path), nodes[path], true);

        return new Globber(fs, cwd);
    };


    describe("?", () => {
        it("does not expand unescaped ?s", () => {
            const globber = createGlobber({"/ab": new File()});

            expect(globber.glob(["a?"])).to.have.members(["a?"]);
        });

        it("expands a single instance", () => {
            const globber = createGlobber({"/a1": new File(), "/a2": new File()});

            expect(globber.glob([`a${escape}?`])).to.have.members(["a1", "a2"]);
        });

        it("expand multiple consecutive instances", () => {
            const globber = createGlobber({"/a11": new File(), "/a12": new File(), "/a21": new File()});

            expect(globber.glob([`a${escape}?${escape}?`])).to.have.members(["a11", "a12", "a21"]);
        });

        it("expand multiple non-consecutive instances", () => {
            const globber = createGlobber({"/1a1": new File(), "/1a2": new File(), "/2a1": new File()});

            expect(globber.glob([`${escape}?a${escape}?`])).to.have.members(["1a1", "1a2", "2a1"]);
        });

        it("does not expand to an empty character", () => {
            const globber = createGlobber({"/a": new File(), "/aa": new File()});

            expect(globber.glob([`a${escape}?`])).to.have.members(["aa"]);
        });

        it("does not expand to multiple characters", () => {
            const globber = createGlobber({"/aa": new File(), "/aaa": new File()});

            expect(globber.glob([`a${escape}?`])).to.have.members(["aa"]);
        });

        it("includes directories when not using a trailing slash", () => {
            const globber = createGlobber({"/a1": new File(), "/a2": new Directory()});

            expect(globber.glob([`a${escape}?`])).to.have.members(["a1", "a2"]);
        });

        it("excludes files when using a trailing slash", () => {
            const globber = createGlobber({"/a1": new File(), "/a2": new Directory()});

            expect(globber.glob([`a${escape}?/`])).to.have.members(["a2/"]);
        });

        it("expands in a subdirectory", () => {
            const globber = createGlobber({"/a1": new File(), "/dir/a1": new File(), "/dir/a2": new File()});

            expect(globber.glob([`/dir/a${escape}?`])).to.have.members(["/dir/a1", "/dir/a2"]);
        });

        it("expands in the parent directory", () => {
            const globber = createGlobber({"/dir/a1": new File(), "/a2": new File(), "/a3": new File()}, "/dir");

            expect(globber.glob([`../a${escape}?`])).to.have.members(["../a2", "../a3"]);
        });

        it("expands in the reflexive directory", () => {
            const globber = createGlobber({"/dir/a1": new File(), "/a2": new File(), "/a3": new File()}, "/dir");

            expect(globber.glob([`./a${escape}?`])).to.have.members(["./a1"]);
        });

        it("expands in an absolute path to the root", () => {
            const globber = createGlobber({"/dir/a1": new File(), "/a2": new File(), "/a3": new File()}, "/dir");

            expect(globber.glob([`/a${escape}?`])).to.have.members(["/a2", "/a3"]);
        });

        it("expands in an absolute path to a sibling", () => {
            const globber = createGlobber({"/d1/a1": new File(), "/d2/a2": new File(), "/d2/a3": new File()}, "/d1");

            expect(globber.glob([`/d2/a${escape}?`])).to.have.members(["/d2/a2", "/d2/a3"]);
        });
    });

    describe("*", () => {
        it("does not process unescaped *s", () => {
            const globber = createGlobber({"/ab": new File()});

            expect(globber.glob(["a*"])).to.have.members(["a*"]);
        });

        it("expands a single instance", () => {
            const globber = createGlobber({"/a1": new File(), "/a2": new File()});

            expect(globber.glob([`a${escape}*`])).to.have.members(["a1", "a2"]);
        });

        it("expands multiple non-consecutive instances", () => {
            const globber = createGlobber({"/1a1": new File(), "/2a2": new File()});

            expect(globber.glob([`${escape}*a${escape}*`])).to.have.members(["1a1", "2a2"]);
        });

        it("expands to match all files in a directory", () => {
            const globber = createGlobber({"/a": new File(), "/b": new File()});

            expect(globber.glob([`${escape}*`])).to.have.members(["a", "b"]);
        });

        it("expands to an empty character", () => {
            const globber = createGlobber({"/a": new File(), "/aa": new File()});

            expect(globber.glob([`a${escape}*`])).to.have.members(["a", "aa"]);
        });

        it("expands to multiple characters", () => {
            const globber = createGlobber({"/aa": new File(), "/aaa": new File()});

            expect(globber.glob([`a${escape}*`])).to.have.members(["aa", "aaa"]);
        });

        it("does not expand to a slash", () => {
            const globber = createGlobber({"/a1/file": new File(), "/a2": new File()});

            expect(globber.glob([`a${escape}*`])).to.have.members(["a1", "a2"]);
        });

        it("includes directories when not using a trailing slash", () => {
            const globber = createGlobber({"/a1": new File(), "/a2": new Directory()});

            expect(globber.glob([`a${escape}*`])).to.have.members(["a1", "a2"]);
        });

        it("excludes files when using a trailing slash", () => {
            const globber = createGlobber({"/a1": new File(), "/a2": new Directory()});

            expect(globber.glob([`a${escape}*/`])).to.have.members(["a2/"]);
        });

        it("expands in a subdirectory", () => {
            const globber = createGlobber({"/a1": new File(), "/dir/a1": new File(), "/dir/a2": new File()});

            expect(globber.glob([`/dir/a${escape}*`])).to.have.members(["/dir/a1", "/dir/a2"]);
        });

        it("expands to no files in a subdirectory", () => {
            const globber = createGlobber({"/dir1/a1": new File(), "/dir2": new Directory()});

            expect(globber.glob([`/${escape}*/${escape}*`])).to.have.members(["/dir1/a1"]);
        });

        it("expands in the parent directory", () => {
            const globber = createGlobber({"/dir/a1": new File(), "/a2": new File(), "/a3": new File()}, "/dir");

            expect(globber.glob([`../a${escape}*`])).to.have.members(["../a2", "../a3"]);
        });

        it("expands in the reflexive directory", () => {
            const globber = createGlobber({"/dir/a1": new File(), "/a2": new File(), "/a3": new File()}, "/dir");

            expect(globber.glob([`./a${escape}*`])).to.have.members(["./a1"]);
        });

        it("expands in an absolute path to the root", () => {
            const globber = createGlobber({"/dir/a1": new File(), "/a2": new File(), "/a3": new File()}, "/dir");

            expect(globber.glob([`/a${escape}*`])).to.have.members(["/a2", "/a3"]);
        });

        it("expands in an absolute path to a sibling", () => {
            const globber = createGlobber({"/d1/a1": new File(), "/d2/a2": new File(), "/d2/a3": new File()}, "/d1");

            expect(globber.glob([`/d2/a${escape}*`])).to.have.members(["/d2/a2", "/d2/a3"]);
        });
    });

    describe("shared edge cases", () => {
        it("throws an error if no matches are found", () => {
            expect(() => createGlobber().glob([`x${escape}?`])).to.throw;
        });

        it("returns an empty token without change", () => {
            expect(createGlobber().glob([""])).to.have.members([""]);
        });

        it("returns a glob-less token without change", () => {
            expect(createGlobber().glob(["abc"])).to.have.members(["abc"]);
        });

        it("returns any token without change if the cwd does not exist", () => {
            const globber = createGlobber({"/a1": new File()}, "/dir");

            expect(globber.glob([`a${EscapeCharacters.Escape}?`])).to.have.members([`a${EscapeCharacters.Escape}?`]);
        });
    });
});
