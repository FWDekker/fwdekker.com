import "mocha";
import {expect} from "chai";

import "../main/js/Extensions"
import {InputParser} from "../main/js/Shell";


describe("input args", () => {
    let parser: InputParser;


    beforeEach(() => {
        parser = new InputParser({});
    });


    describe("tokenization", () => {
        it("concatenates multiple strings into one token", () => {
            expect(parser.parse(`'co'm"m nd"`).command).to.equal("comm nd");
        });

        it("includes escaped spaces into the token", () => {
            expect(parser.parse("com\\ mand").command).to.equal("com mand");
        });

        it("includes escaped quotation marks into the token", () => {
            expect(parser.parse(`com\\'man\\"d`).command).to.equal(`com'man"d`);
        });

        it("does not escape inside strings", () => {
            expect(parser.parse(`\\n`).command).to.equal("n");
            expect(parser.parse(`"\\n"`).command).to.equal("\\n");
        });
    });

    describe("command", () => {
        it("returns the first token as the command", () => {
            expect(parser.parse("command arg1 arg2").command).to.equal("command");
        });

        it("returns the first token as the command even if there are unnecessary spaces", () => {
            expect(parser.parse("   command  arg1   arg2").command).to.equal("command");
        });

        it("returns the first token as the command even if it contains special symbols", () => {
            expect(parser.parse("4com-mand3 arg1 arg2").command).to.equal("4com-mand3");
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

    describe("environment", () => {
        beforeEach(() => {
            parser = new InputParser({
                a: {value: "b", readonly: false},
                aa: {value: "c", readonly: false},
                r: {value: ">", readonly: false}
            });
        });


        it("substitutes a known environment variable with its value", () => {
            expect(parser.parse("$a").command).to.equal("b");
        });

        it("substitutes an unknown environment variable with nothing", () => {
            expect(parser.parse("$b").command).to.equal("");
        });

        it("substitutes consecutive known environment variables with their value", () => {
            expect(parser.parse("$a$aa$a").command).to.equal("bcb");
        });

        it("substitutes nameless environment variables with nothing", () => {
            expect(parser.parse("$$$").command).to.equal("");
        });

        it("substitutes known environment variables that are in the middle of a string", () => {
            expect(parser.parse("a'$a'c").command).to.equal("abc");
        });

        it("substitutes special characters without interpreting them", () => {
            const inputArgs = parser.parse("command $r file");
            expect(inputArgs.args).to.have.members([">", "file"]);
            expect(inputArgs.redirectTarget).to.have.members(["default"]);
        });
    });
});
