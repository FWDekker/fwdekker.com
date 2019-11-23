import "mocha";
import {expect} from "chai";

import {Environment} from "../main/js/Environment";
import {Expander, Globber, InputParser, Tokenizer} from "../main/js/InputParser";
import {Directory, File, FileSystem, Node, Path} from "../main/js/FileSystem";

/**
 * Shorthand for the escape character used internally in the input parser.
 */
const escape = InputParser.EscapeChar;


describe("input parser", () => {
    let parser: InputParser;


    beforeEach(() => {
        /**
         * A dummy implementation of the tokenizer that simply splits the given string by unescaped whitespaces.
         *
         * Note that escaped escape symbols are not recognized by this simple tokenizer.
         */
        const dummyTokenizer = new class extends Tokenizer {
            tokenize(input: string): string[] {
                return input.split(/(?<!\\)\s/);
            }
        };

        /**
         * A dummy implementation of the globber that simply returns the given token.
         */
        const dummyGlobber = new class extends Globber {
            constructor() {
                super(new FileSystem(), "");
            }


            glob(token: string): string[] {
                return [token];
            }
        };

        /**
         * A dummy implementation of the expander that simply returns the given token.
         */
        const dummyExpander = new class extends Expander {
            constructor() {
                super(new Environment(), dummyGlobber);
            }


            glob(token: string): string[] {
                return [token];
            }
        };

        parser = new InputParser(dummyTokenizer, dummyExpander);
    });


    describe("command", () => {
        it("returns the first token as the command", () => {
            expect(parser.parseCommands("command arg1 arg2")[0].command).to.equal("command");
        });

        describe("multiple commands", () => {
            it("returns the respective commands", () => {
                const inputArgs = parser.parseCommands("a ; b");

                expect(inputArgs[0].command).to.equal("a");
                expect(inputArgs[1].command).to.equal("b");
            });
        });
    });

    describe("options", () => {
        describe("short options", () => {
            describe("simple cases", () => {
                it("assigns the given value to a short option", () => {
                    expect(parser.parseCommands("command -o=value")[0].options).to.have.own.property("-o", "value");
                });

                it("assigns an empty string to a short option", () => {
                    expect(parser.parseCommands("command -o= -p")[0].options).to.have.own.property("-o", "");
                });

                it("throws an error if a value is assigned to a group of short options", () => {
                    expect(() => parser.parseCommands("command -opq=arg -r")[0]).to.throw();
                });
            });

            describe("value-less", () => {
                it("assigns null to a value-less short option", () => {
                    expect(parser.parseCommands("command -o")[0].options).to.have.own.property("-o", null);
                });

                it("assigns null to each value-less short option", () => {
                    const options = parser.parseCommands("command -o -p")[0].options;
                    expect(options).to.have.own.property("-o", null);
                    expect(options).to.have.own.property("-p", null);
                });

                it("assigns null to each value-less short option in a group", () => {
                    const options = parser.parseCommands("command -op")[0].options;
                    expect(options).to.have.own.property("-o", null);
                    expect(options).to.have.own.property("-p", null);
                });
            });

            describe("numbers", () => {
                it("stops parsing options if a short option-like negative number is given", () => {
                    expect(parser.parseCommands(`command -2 -p`)[0].options).to.not.have.own.property("-p");
                });

                it("continues parsing options if the value of a short option is a number", () => {
                    expect(parser.parseCommands(`command -a=2 -p`)[0].options).to.have.own.property("-a", "2");
                });
            });

            describe("invalid names", () => {
                it("stops parsing options if a short option name contains a space", () => {
                    expect(parser.parseCommands(`command -opt\\ ion -p`)[0].options).to.not.have.own.property("-p");
                });

                it("considers an assignment to an empty short option to be an argument", () => {
                    expect(parser.parseCommands("command -=value -p")[0].options).to.not.have.own.property("-p");
                });
            });

            it("considers a short option surrounded by quotes as just any other option", () => {
                const options = parser.parseCommands(`command -o "-p"`)[0].options;
                expect(options).to.have.own.property("-o", null);
                expect(options).to.have.own.property("-p", null);
            });
        });

        describe("long options", () => {
            describe("simple", () => {
                it("assigns the given value to a long option", () => {
                    expect(parser.parseCommands("command --option=value")[0].options).to.have.own.property("--option", "value");
                });

                it("assigns the given value containing a space to a long option", () => {
                    expect(parser.parseCommands(`command --option=val\\ ue`)[0].options).to.have.own.property("--option", "val ue");
                });
            });

            describe("value-less", () => {
                it("assigns null to a value-less long option", () => {
                    expect(parser.parseCommands("command --option")[0].options).to.have.own.property("--option", null);
                });

                it("assigns null to each value-less long option", () => {
                    const options = parser.parseCommands("command --optionA --optionB")[0].options;
                    expect(options).to.have.own.property("--optionA", null);
                    expect(options).to.have.own.property("--optionB", null);
                });
            });

            describe("numbers", () => {
                it("stops parsing options if a long option-like double negative number is given", () => {
                    expect(parser.parseCommands(`command --23 -p`)[0].options).to.not.have.own.property("-p");
                });

                it("continues parsing options if the value of a long option is a number", () => {
                    expect(parser.parseCommands(`command --a=2 -p`)[0].options).to.have.own.property("--a", "2");
                });
            });

            describe("invalid names", () => {
                it("stops parsing options if a long option name contains a space", () => {
                    expect(parser.parseCommands(`command "--opt ion" -p`)[0].options).to.not.have.own.property("-p");
                });

                it("stops parsing options if a long option-like negative number is given", () => {
                    expect(parser.parseCommands(`command --2 -p`)[0].options).to.not.have.own.property("-p");
                });

                it("considers an assignment to an empty long option to be an argument", () => {
                    const options = parser.parseCommands("command --=value -p")[0].options;
                    expect(options).to.not.have.own.property("-p");
                });
            });

            it("considers a long option surrounded by quotes as any other option", () => {
                const options = parser.parseCommands(`command -o "--p"`)[0].options;
                expect(options).to.have.own.property("-o", null);
                expect(options).to.have.own.property("--p", null);
            });
        });

        describe("shared cases", () => {
            it("distinguishes between short and long options", () => {
                const options = parser.parseCommands("command -s --long")[0].options;

                expect(options).to.not.have.own.property("s", null);
                expect(options).to.have.own.property("-s", null);
                expect(options).to.not.have.own.property("--s", null);

                expect(options).to.not.have.own.property("long", null);
                expect(options).to.not.have.own.property("-long", null);
                expect(options).to.have.own.property("--long", null);
            });

            it("stops parsing options after the first non-option", () => {
                expect(parser.parseCommands("command -o=value arg -p")[0].options).to.not.have.own.property("-p");
            });

            it("stops parsing options after --", () => {
                expect(parser.parseCommands("command -- -p")[0].options).to.not.have.own.property("-p");
            });

            it("throws an error if multiple equals signs occur", () => {
                expect(() => parser.parseCommands("command -a=b=c")[0]).to.throw();
            });
        });

        describe("multiple commands", () => {
            it("keeps the commands' options separate", () => {
                const inputArgs = parser.parseCommands("a --abc -- -e ; b -e --d=f");

                expect(inputArgs[0].options).to.have.own.property("--abc", null);
                expect(inputArgs[0].options).to.not.have.own.property("-e", null);
                expect(inputArgs[1].options).to.have.own.property("-e", null);
                expect(inputArgs[1].options).to.have.own.property("--d", "f");
            });
        });
    });

    describe("args", () => {
        it("has no arguments if only the command is given", () => {
            expect(parser.parseCommands("command")[0].args).to.have.length(0);
        });

        it("has no arguments if only options are given", () => {
            expect(parser.parseCommands("command -o=value -p")[0].args).to.have.length(0);
        });

        it("has all simple arguments", () => {
            expect(parser.parseCommands("command a b c")[0].args).to.have.members(["a", "b", "c"]);
        });

        it("has arguments containing spaces", () => {
            expect(parser.parseCommands(`command a\\ b\\ c`)[0].args).to.have.members(["a b c"]);
        });

        it("has arguments containing dashes", () => {
            expect(parser.parseCommands("command -o -- -p")[0].args).to.have.members(["-p"]);
        });

        it("interprets options as arguments after --", () => {
            expect(parser.parseCommands("command -o -- -p")[0].args).to.have.members(["-p"]);
        });

        describe("multiple commands", () => {
            it("keeps the commands' arguments separate", () => {
                const inputArgs = parser.parseCommands("command a b ; command d e f");

                expect(inputArgs[0].args).to.have.deep.members(["a", "b"]);
                expect(inputArgs[1].args).to.have.deep.members(["d", "e", "f"]);
            });
        });
    });

    describe("redirect targets", () => {
        it("assigns a number-less target to index 1", () => {
            expect(parser.parseCommands("command >file")[0].redirectTargets[1]).to.deep.equal({type: "write", target: "file"});
            expect(parser.parseCommands("command >>file")[0].redirectTargets[1]).to.deep.equal({
                type: "append",
                target: "file"
            });
        });

        it("assigns the target to the preceding number", () => {
            expect(parser.parseCommands("command 3>file")[0].redirectTargets[3]).to.deep.equal({type: "write", target: "file"});
            expect(parser.parseCommands("command 3>>file")[0].redirectTargets[3]).to.deep.equal({
                type: "append",
                target: "file"
            });
        });

        it("uses the last target that is defined", () => {
            expect(parser.parseCommands("command 3>old 3>>new")[0].redirectTargets[3])
                .to.deep.equal({type: "append", target: "new"});
        });

        it("does not include redirect targets in the arguments", () => {
            expect(parser.parseCommands("command arg1 3>file arg2")[0].args).to.have.members(["arg1", "arg2"]);
        });

        describe("multiple commands", () => {
            it("keeps the commands' redirect targets separate", () => {
                const inputArgs = parser.parseCommands("command a b >out 2>>err ; command 3>magic");

                expect(inputArgs[0].redirectTargets).to.deep.equal([
                    undefined,
                    {type: "write", target: "out"},
                    {type: "append", target: "err"}
                ]);
                expect(inputArgs[1].redirectTargets).to.deep.equal([
                    undefined,
                    undefined,
                    undefined,
                    {type: "write", target: "magic"}
                ]);
            });
        });
    });
});

describe("tokenizer", () => {
    let tokenizer: Tokenizer;


    beforeEach(() => {
        tokenizer = new Tokenizer();
    });


    describe("separator", () => {
        // See "backslash" for tests about escaped whitespace

        // See "grouping" for tests about whitespace inside of groups

        describe("unnecessary whitespace", () => {
            it("ignores unnecessary leading whitespace", () => {
                expect(tokenizer.tokenize("    token1 token2")).to.have.deep.members(["token1", "token2"]);
            });

            it("ignores unnecessary trailing whitespace", () => {
                expect(tokenizer.tokenize("token1 token2   ")).to.have.deep.members(["token1", "token2"]);
            });

            it("ignores unnecessary whitespace in between tokens", () => {
                expect(tokenizer.tokenize("token1     token2")).to.have.deep.members(["token1", "token2"]);
            });
        });

        describe("semicolon", () => {
            it("separates tokens and adds a new token containing only the semicolon", () => {
                expect(tokenizer.tokenize("a;b")).to.have.deep.members(["a", ";", "b"]);
                expect(tokenizer.tokenize("a; b")).to.have.deep.members(["a", ";", "b"]);
                expect(tokenizer.tokenize("a ;b")).to.have.deep.members(["a", ";", "b"]);
                expect(tokenizer.tokenize("a ; b")).to.have.deep.members(["a", ";", "b"]);
            });

            it("does not separate tokens inside groups", () => {
                expect(tokenizer.tokenize(`a';'b`)).to.have.deep.members([`a';'b`]);
                expect(tokenizer.tokenize(`a";"b`)).to.have.deep.members([`a";"b`]);
                expect(tokenizer.tokenize(`a{;}b`)).to.have.deep.members([`a{;}b`]);
            });

            it("does not push empty tokens in between consecutive semicolons", () => {
                expect(tokenizer.tokenize(";ab;;;;;c")).to.have.deep.members(["ab", ";", "c"]);
            });
        });
    });

    describe("grouping", () => {
        describe("quotes", () => {
            it("throws an error if quotes are not closed", () => {
                expect(() => tokenizer.tokenize("a'b")).to.throw();
                expect(() => tokenizer.tokenize("a\"b")).to.throw();
            });

            it("does not throw an error if a quote opened inside other quotes is not closed", () => {
                expect(tokenizer.tokenize(`a"b'c"d`)).to.have.deep.members([`a"b'c"d`]);
                expect(tokenizer.tokenize(`a'b"c'd`)).to.have.deep.members([`a'b"c'd`]);
            });

            it("includes whitespace if within quotes", () => {
                expect(tokenizer.tokenize("a' 'b")).to.have.deep.members(["a' 'b"]);
                expect(tokenizer.tokenize("a\" \"b")).to.have.deep.members(["a\" \"b"]);
            });

            it("adds the redirect character literally if inside quotes", () => {
                expect(tokenizer.tokenize("a'>'b")).to.have.deep.members(["a'>'b"]);
                expect(tokenizer.tokenize("a\">\"b")).to.have.deep.members(["a\">\"b"]);
            });
        });

        describe("curly braces", () => {
            it("throws an error if curly braces are not closed", () => {
                expect(() => tokenizer.tokenize("a{ba")).to.throw();
            });

            it("throws an error if nested curly braces are not closed", () => {
                expect(() => tokenizer.tokenize("a{{b}a")).to.throw();
            });

            it("throws an error if curly braces are not opened", () => {
                expect(() => tokenizer.tokenize("a}ba")).to.throw();
            });

            it("does not throw an error if a curly brace opened inside quotes is not closed", () => {
                expect(tokenizer.tokenize(`a'{'b`)).to.have.deep.members([`a'{'b`]);
                expect(tokenizer.tokenize(`a"{"b`)).to.have.deep.members([`a"{"b`]);
            });

            it("throws an error if curly braces are closed inside quotes", () => {
                expect(() => tokenizer.tokenize(`a{'}'b`)).to.throw();
                expect(() => tokenizer.tokenize(`a{"}"b`)).to.throw();
            });

            it("includes whitespace if within curly braces", () => {
                expect(tokenizer.tokenize("a{ }b")).to.have.deep.members(["a{ }b"]);
            });

            it("adds the redirect character literally if inside curly braces", () => {
                expect(tokenizer.tokenize("a{>}b")).to.have.deep.members(["a{>}b"]);
            });
        });
    });

    describe("redirection", () => {
        describe("delimiter detection", () => {
            it("includes a single redirect symbol in a single token", () => {
                expect(tokenizer.tokenize("a>b")).to.have.deep.members(["a", ">b"]);
                expect(tokenizer.tokenize("a> b")).to.have.deep.members(["a", ">b"]);
                expect(tokenizer.tokenize("a >b")).to.have.deep.members(["a", ">b"]);
                expect(tokenizer.tokenize("a > b")).to.have.deep.members(["a", ">b"]);
            });

            it("includes two redirect symbols in a single token", () => {
                expect(tokenizer.tokenize("a>>b")).to.have.deep.members(["a", ">>b"]);
                expect(tokenizer.tokenize("a>> b")).to.have.deep.members(["a", ">>b"]);
                expect(tokenizer.tokenize("a >>b")).to.have.deep.members(["a", ">>b"]);
                expect(tokenizer.tokenize("a >> b")).to.have.deep.members(["a", ">>b"]);
            });

            it("creates two tokens if three redirect symbols are given without a space", () => {
                expect(tokenizer.tokenize("a>>>b")).to.have.deep.members(["a", ">>", ">b"]);
                expect(tokenizer.tokenize("a>>> b")).to.have.deep.members(["a", ">>", ">b"]);
                expect(tokenizer.tokenize("a >>>b")).to.have.deep.members(["a", ">>", ">b"]);
                expect(tokenizer.tokenize("a >>> b")).to.have.deep.members(["a", ">>", ">b"]);
            });

            it("creates two tokens for two redirect symbols separated by a space", () => {
                expect(tokenizer.tokenize("a> >b")).to.have.deep.members(["a", ">", ">b"]);
                expect(tokenizer.tokenize("a> > b")).to.have.deep.members(["a", ">", ">b"]);
                expect(tokenizer.tokenize("a > >b")).to.have.deep.members(["a", ">", ">b"]);
                expect(tokenizer.tokenize("a > > b")).to.have.deep.members(["a", ">", ">b"]);
            });
        });

        describe("stream identifiers", () => {
            it("includes the preceding identifier", () => {
                expect(tokenizer.tokenize("a 42>b")).to.have.deep.members(["a", "42>b"]);
                expect(tokenizer.tokenize("a 42> b")).to.have.deep.members(["a", "42>b"]);

                expect(tokenizer.tokenize("a 42>>b")).to.have.deep.members(["a", "42>>b"]);
                expect(tokenizer.tokenize("a 42>> b")).to.have.deep.members(["a", "42>>b"]);
            });

            it("does not include the identifier if it is followed by a space", () => {
                expect(tokenizer.tokenize("a 42 >b")).to.have.deep.members(["a", "42", ">b"]);
                expect(tokenizer.tokenize("a 42 > b")).to.have.deep.members(["a", "42", ">b"]);

                expect(tokenizer.tokenize("a 42 >>b")).to.have.deep.members(["a", "42", ">>b"]);
                expect(tokenizer.tokenize("a 42 >> b")).to.have.deep.members(["a", "42", ">>b"]);
            });

            it("does not include the identifier if it is not preceded by a space", () => {
                expect(tokenizer.tokenize("a42>b")).to.have.deep.members(["a42", ">b"]);
                expect(tokenizer.tokenize("a42> b")).to.have.deep.members(["a42", ">b"]);

                expect(tokenizer.tokenize("a42>>b")).to.have.deep.members(["a42", ">>b"]);
                expect(tokenizer.tokenize("a42>> b")).to.have.deep.members(["a42", ">>b"]);
            });
        });
    });

    describe("backslash", () => {
        it("includes any escaped character in the token", () => {
            expect(tokenizer.tokenize(`'\\p'"\\""\\ `)).to.have.deep.members([`'\\p'"\\""\\ `]);
        });

        it("does not separate at an escaped whitespace", () => {
            expect(tokenizer.tokenize("a\\ b")).to.have.deep.members(["a\\ b"]);
        });

        it("retains an escaped trailing whitespace", () => {
            expect(tokenizer.tokenize("ab\\ ")).to.have.deep.members(["ab\\ "]);
        });

        it("throws an error if an escape occurs but no character follows", () => {
            expect(() => tokenizer.tokenize("ab\\")).to.throw();
        });
    });
});

describe("expander", () => {
    let environment: Environment;
    let expander: Expander;


    beforeEach(() => {
        /**
         * A dummy implementation of the globber that simply returns the given token.
         */
        const dummyGlobber = new class extends Globber {
            constructor() {
                super(new FileSystem(), "");
            }


            glob(token: string): string[] {
                return [token];
            }
        };

        environment = new Environment();
        expander = new Expander(environment, dummyGlobber);
    });


    describe("backslash", () => {
        describe("outside quotes", () => {
            it("escapes the escape character", () => {
                expect(expander.expand("\\\\")).to.have.deep.members(["\\"]);
            });

            it("escapes separators", () => {
                expect(expander.expand("\\ ")).to.have.deep.members([" "]);
                expect(expander.expand("\\;")).to.have.deep.members([";"]);
            });

            it("escapes the home directory character", () => {
                expect(expander.expand("\\~")).to.have.deep.members(["~"]);
            });

            it("escape the environment variable character", () => {
                expect(expander.expand("\\$")).to.have.deep.members(["$"]);
            });

            it("escapes redirection characters", () => {
                expect(expander.expand("\\>")).to.have.deep.members([">"]);
            });

            it("escapes glob characters", () => {
                expect(expander.expand("\\?")).to.have.deep.members(["?"]);
                expect(expander.expand("\\*")).to.have.deep.members(["*"]);
            });

            it("escapes grouping characters", () => {
                expect(expander.expand("\\'")).to.have.deep.members(["'"]);
                expect(expander.expand("\\\"")).to.have.deep.members(["\""]);
                expect(expander.expand("\\{")).to.have.deep.members(["{"]);
                expect(expander.expand("\\}")).to.have.deep.members(["}"]);
            });

            it("does not escape other characters", () => {
                expect(expander.expand("\\a\\b\\_")).to.have.deep.members(["\\a\\b\\_"]);
            });
        });

        describe("inside quotes", () => {
            it("does not retain the backslash if the current quote style is escaped", () => {
                expect(expander.expand(`'\\''`)).to.have.deep.members([`'`]);
                expect(expander.expand(`"\\""`)).to.have.deep.members([`"`]);
            });

            it("retains the backslash for any other character", () => {
                expect(expander.expand(`'\\a\\n\\$\\"'`)).to.have.deep.members([`\\a\\n\\$\\"`]);
                expect(expander.expand(`"\\a\\n\\$\\'"`)).to.have.deep.members([`\\a\\n\\$\\'`]);
            });
        });
    });

    describe("grouping", () => {
        it("retains quotes placed inside the other quote", () => {
            expect(expander.expand(`"'"`)).to.have.deep.members([`'`]);
            expect(expander.expand(`'"'`)).to.have.deep.members([`"`]);
        });

        it("retains curly braces in quotes", () => {
            expect(expander.expand(`'{}'`)).to.have.deep.members(["{}"]);
            expect(expander.expand(`"{}"`)).to.have.deep.members(["{}"]);
        });

        it("removes curly braces outside of quotes", () => {
            expect(expander.expand(`{'{'}`)).to.have.deep.members(["{"]);
            expect(expander.expand(`{"{"}`)).to.have.deep.members(["{"]);
        });

        it("removes nested curly braces outside of quotes", () => {
            expect(expander.expand(`{''{'{'}}`)).to.have.deep.members(["{"]);
            expect(expander.expand(`{""{"{"}}`)).to.have.deep.members(["{"]);
        });
    });

    describe("environment variables", () => {
        beforeEach(() => {
            environment.set("a", "b");
            environment.set("aa", "c");
            environment.set("r", ">");
            environment.set("cwd", "/");
        });


        it("substitutes a known environment variable with its value", () => {
            expect(expander.expand("$a")).to.have.deep.members(["b"]);
        });

        it("substitutes an unknown environment variable with nothing", () => {
            expect(expander.expand("a$b")).to.have.deep.members(["a"]);
        });

        it("substitutes consecutive known environment variables with their values", () => {
            expect(expander.expand("$a$aa$a")).to.have.deep.members(["bcb"]);
        });

        it("throws an error for nameless environment variables", () => {
            expect(() => expander.expand("$")).to.throw();
        });

        it("does not substitute environment variables in the middle of a single-quoted string", () => {
            expect(expander.expand("a'$a'c")).to.have.deep.members(["a$ac"]);
        });

        it("substitutes environment variables in the middle of a double-quoted string", () => {
            expect(expander.expand(`a"$a"c`)).to.have.deep.members(["abc"]);
        });

        it("substitutes environment variables in the middle of curly braces", () => {
            expect(expander.expand("a{$a}c")).to.have.deep.members(["abc"]);
        });
    });

    describe("glob characters", () => {
        it("escapes glob characters", () => {
            expect(expander.expand("b?")).to.have.deep.members([`b${escape}?`]);
            expect(expander.expand("b*")).to.have.deep.members([`b${escape}*`]);
        });

        it("does not escape user-escaped glob characters", () => {
            expect(expander.expand("b\\?")).to.have.deep.members(["b?"]);
            expect(expander.expand("b\\*")).to.have.deep.members(["b*"]);
        });

        it("does not escape glob characters inside quotes", () => {
            expect(expander.expand("'b?'")).to.have.deep.members(["b?"]);
            expect(expander.expand("\"b*\"")).to.have.deep.members(["b*"]);
        });
    });

    describe("home directory", () => {
        beforeEach(() => {
            environment.set("home", "/home");
        });


        it("substitutes the home directory for ~ at the end of the input", () => {
            expect(expander.expand("~")).to.have.deep.members(["/home"]);
        });

        it("substitutes the home directory for ~ if followed by a /", () => {
            expect(expander.expand("~/")).to.have.deep.members(["/home/"]);
        });

        it("does not substitute the home directory for ~ if followed by something else", () => {
            expect(expander.expand("~~")).to.have.deep.members(["~~"]);
            expect(expander.expand("~a")).to.have.deep.members(["~a"]);
            expect(expander.expand("~.")).to.have.deep.members(["~."]);
        });

        it("does not substitute the home directory in the middle of a token", () => {
            expect(expander.expand("ab~cd")).to.have.deep.members(["ab~cd"]);
        });

        it("does not substitute the home directory for ~ if surrounded by parentheses or braces", () => {
            expect(expander.expand("'~'")).to.have.deep.members(["~"]);
            expect(expander.expand(`"~"`)).to.have.deep.members(["~"]);
            expect(expander.expand("{~}")).to.have.deep.members(["~"]);
        });
    });
});

describe("globber", () => {
    const createGlobber = function(nodes: { [path: string]: Node } = {}, cwd: string = "/"): Globber {
        const fs = new FileSystem(new Directory());
        for (const path of Object.getOwnPropertyNames(nodes))
            fs.add(new Path(path), nodes[path], true);

        return new Globber(fs, cwd);
    };


    describe("?", () => {
        describe("escape characters", () => {
            it("does not remove internal escape characters from the output", () => {
                const globber = createGlobber({[`/${escape}1`]: new File()});

                expect(globber.glob(`${escape}${escape}${escape}?`))
                    .to.have.deep.members([`${escape}${escape}1`]);
            });

            it("does not expand unescaped ?s", () => {
                const globber = createGlobber({"/ab": new File()});

                expect(globber.glob("a?")).to.have.deep.members(["a?"]);
            });
        });

        describe("expansion length", () => {
            it("expands a single instance", () => {
                const globber = createGlobber({"/a1": new File(), "/a2": new File()});

                expect(globber.glob(`a${escape}?`)).to.have.deep.members(["a1", "a2"]);
            });

            it("expand multiple consecutive instances", () => {
                const globber = createGlobber({"/a11": new File(), "/a12": new File(), "/a21": new File()});

                expect(globber.glob(`a${escape}?${escape}?`)).to.have.deep.members(["a11", "a12", "a21"]);
            });

            it("expand multiple non-consecutive instances", () => {
                const globber = createGlobber({"/1a1": new File(), "/1a2": new File(), "/2a1": new File()});

                expect(globber.glob(`${escape}?a${escape}?`)).to.have.deep.members(["1a1", "1a2", "2a1"]);
            });

            it("does not expand to an empty character", () => {
                const globber = createGlobber({"/a": new File(), "/aa": new File()});

                expect(globber.glob(`a${escape}?`)).to.have.deep.members(["aa"]);
            });

            it("does not expand to multiple characters", () => {
                const globber = createGlobber({"/aa": new File(), "/aaa": new File()});

                expect(globber.glob(`a${escape}?`)).to.have.deep.members(["aa"]);
            });
        });

        describe("relative directories", () => {
            it("expands in a subdirectory", () => {
                const globber = createGlobber({"/a1": new File(), "/dir/a1": new File(), "/dir/a2": new File()});

                expect(globber.glob(`/dir/a${escape}?`)).to.have.deep.members(["/dir/a1", "/dir/a2"]);
            });

            it("expands in the parent directory", () => {
                const globber = createGlobber({"/dir/a1": new File(), "/a2": new File(), "/a3": new File()}, "/dir");

                expect(globber.glob(`../a${escape}?`)).to.have.deep.members(["../a2", "../a3"]);
            });

            it("expands in the reflexive directory", () => {
                const globber = createGlobber({"/dir/a1": new File(), "/a2": new File(), "/a3": new File()}, "/dir");

                expect(globber.glob(`./a${escape}?`)).to.have.deep.members(["./a1"]);
            });

            it("expands in an absolute path to the root", () => {
                const globber = createGlobber({"/dir/a1": new File(), "/a2": new File(), "/a3": new File()}, "/dir");

                expect(globber.glob(`/a${escape}?`)).to.have.deep.members(["/a2", "/a3"]);
            });

            it("expands in an absolute path to a sibling", () => {
                const globber = createGlobber({
                    "/d1/a1": new File(),
                    "/d2/a2": new File(),
                    "/d2/a3": new File()
                }, "/d1");

                expect(globber.glob(`/d2/a${escape}?`)).to.have.deep.members(["/d2/a2", "/d2/a3"]);
            });
        });

        describe("strict matching", () => {
            it("includes directories when not using a trailing slash", () => {
                const globber = createGlobber({"/a1": new File(), "/a2": new Directory()});

                expect(globber.glob(`a${escape}?`)).to.have.deep.members(["a1", "a2"]);
            });

            it("excludes files when using a trailing slash", () => {
                const globber = createGlobber({"/a1": new File(), "/a2": new Directory()});

                expect(globber.glob(`a${escape}?/`)).to.have.deep.members(["a2/"]);
            });

            it("does not match the hidden file character", () => {
                const globber = createGlobber({"/.a": new File(), "/aa": new File()});

                expect(globber.glob(`/${escape}?a`)).to.have.deep.members(["/aa"]);
            });
        });
    });

    describe("*", () => {
        describe("escape characters", () => {
            it("does not remove internal escape characters from the output", () => {
                const globber = createGlobber({[`/${escape}1`]: new File()});

                expect(globber.glob(`${escape}${escape}${escape}*`)).to.have.deep.members([`${escape}${escape}1`]);
            });

            it("does not process unescaped *s", () => {
                const globber = createGlobber({"/ab": new File()});

                expect(globber.glob("a*")).to.have.deep.members(["a*"]);
            });
        });

        describe("expansion length", () => {
            it("expands a single instance", () => {
                const globber = createGlobber({"/a1": new File(), "/a2": new File()});

                expect(globber.glob(`a${escape}*`)).to.have.deep.members(["a1", "a2"]);
            });

            it("expands multiple non-consecutive instances", () => {
                const globber = createGlobber({"/1a1": new File(), "/2a2": new File()});

                expect(globber.glob(`${escape}*a${escape}*`)).to.have.deep.members(["1a1", "2a2"]);
            });

            it("expands to match all files in a directory", () => {
                const globber = createGlobber({"/a": new File(), "/b": new File()});

                expect(globber.glob(`${escape}*`)).to.have.deep.members(["a", "b"]);
            });

            it("expands to an empty character", () => {
                const globber = createGlobber({"/a": new File(), "/aa": new File()});

                expect(globber.glob(`a${escape}*`)).to.have.deep.members(["a", "aa"]);
            });

            it("expands to multiple characters", () => {
                const globber = createGlobber({"/aa": new File(), "/aaa": new File()});

                expect(globber.glob(`a${escape}*`)).to.have.deep.members(["aa", "aaa"]);
            });

            it("does not expand to a slash", () => {
                const globber = createGlobber({"/a1/file": new File(), "/a2": new File()});

                expect(globber.glob(`a${escape}*`)).to.have.deep.members(["a1", "a2"]);
            });
        });

        describe("relative directories", () => {
            it("expands in a subdirectory", () => {
                const globber = createGlobber({"/a1": new File(), "/dir/a1": new File(), "/dir/a2": new File()});

                expect(globber.glob(`/dir/a${escape}*`)).to.have.deep.members(["/dir/a1", "/dir/a2"]);
            });

            it("expands to no files in a subdirectory", () => {
                const globber = createGlobber({"/dir1/a1": new File(), "/dir2": new Directory()});

                expect(globber.glob(`/${escape}*/${escape}*`)).to.have.deep.members(["/dir1/a1"]);
            });

            it("expands in the parent directory", () => {
                const globber = createGlobber({"/dir/a1": new File(), "/a2": new File(), "/a3": new File()}, "/dir");

                expect(globber.glob(`../a${escape}*`)).to.have.deep.members(["../a2", "../a3"]);
            });

            it("expands in the reflexive directory", () => {
                const globber = createGlobber({"/dir/a1": new File(), "/a2": new File(), "/a3": new File()}, "/dir");

                expect(globber.glob(`./a${escape}*`)).to.have.deep.members(["./a1"]);
            });

            it("expands in an absolute path to the root", () => {
                const globber = createGlobber({"/dir/a1": new File(), "/a2": new File(), "/a3": new File()}, "/dir");

                expect(globber.glob(`/a${escape}*`)).to.have.deep.members(["/a2", "/a3"]);
            });

            it("expands in an absolute path to a sibling", () => {
                const globber = createGlobber({
                    "/d1/a1": new File(),
                    "/d2/a2": new File(),
                    "/d2/a3": new File()
                }, "/d1");

                expect(globber.glob(`/d2/a${escape}*`)).to.have.deep.members(["/d2/a2", "/d2/a3"]);
            });
        });

        describe("strict matching", () => {
            it("includes directories when not using a trailing slash", () => {
                const globber = createGlobber({"/a1": new File(), "/a2": new Directory()});

                expect(globber.glob(`a${escape}*`)).to.have.deep.members(["a1", "a2"]);
            });

            it("excludes files when using a trailing slash", () => {
                const globber = createGlobber({"/a1": new File(), "/a2": new Directory()});

                expect(globber.glob(`a${escape}*/`)).to.have.deep.members(["a2/"]);
            });

            it("does not match the hidden file character", () => {
                const globber = createGlobber({"/.a": new File(), "/aa": new File()});

                expect(globber.glob(`/${escape}*a`)).to.have.deep.members(["/aa"]);
            });
        });
    });

    describe("shared cases", () => {
        describe("no matches", () => {
            it("throws an error if no matches are found", () => {
                expect(() => createGlobber().glob(`x${escape}?`)).to.throw();
            });

            it("throws an error if no matches are found because the cwd does not exist", () => {
                const globber = createGlobber({"/a1": new File()}, "/dir");

                expect(() => globber.glob(`a${escape}?`)).to.throw();
            });
        });

        describe("glob-less inputs", () => {
            it("returns an empty token without change", () => {
                expect(createGlobber().glob("")).to.have.deep.members([""]);
            });

            it("does not remove escape characters from glob-less inputs", () => {
                expect(createGlobber().glob(`${escape}${escape}`)).to.have.deep.members([`${escape}${escape}`]);
            });

            it("returns a glob-less token without change if the cwd does not exist", () => {
                const globber = createGlobber({}, "/dir");

                expect(globber.glob("ab")).to.have.deep.members(["ab"]);
            });

            it("returns a glob-less token that doesn't match files without change", () => {
                expect(createGlobber().glob("abc")).to.have.deep.members(["abc"]);
            });
        });

        describe("regex creation", () => {
            it("escapes regex-like characters from the input", () => {
                const globber = createGlobber({"a*b": new File()});

                expect(globber.glob(`${escape}?*b`)).to.have.deep.members(["a*b"]);
            });

            it("throws an error if the escape character terminates the string", () => {
                const globber = createGlobber({"ab": new File()});

                expect(() => globber.glob(`${escape}?${escape}`)).to.throw();
            });
        });
    });
});
