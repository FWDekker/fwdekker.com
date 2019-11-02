import "mocha";
import {expect} from "chai";

import "../main/js/Extensions"
import {InputArgs} from "../main/js/Shell";


describe("input args", () => {
    describe("tokenization", () => {
        it("concatenates multiple strings into one token", () => {
            expect(new InputArgs(`'co'm"m nd"`).command).to.equal("comm nd");
        });

        it("includes escaped spaces into the token", () => {
            expect(new InputArgs("com\\ mand").command).to.equal("com mand");
        });

        it("includes escaped quotation marks into the token", () => {
            expect(new InputArgs(`com\\'man\\"d`).command).to.equal(`com'man"d`);
        });
    });

    describe("command", () => {
        it("returns the first token as the command", () => {
            expect(new InputArgs("command arg1 arg2").command).to.equal("command");
        });

        it("returns the first token as the command even if there are unnecessary spaces", () => {
            expect(new InputArgs("   command  arg1   arg2").command).to.equal("command");
        });

        it("returns the first token as the command even if it contains special symbols", () => {
            expect(new InputArgs("4com-mand3 arg1 arg2").command).to.equal("4com-mand3");
        });
    });

    describe("options", () => {
        describe("short options", () => {
            it("assigns null to a parameter-less short option", () => {
                expect(new InputArgs("command -o").options).to.have.own.property("o", null);
            });

            it("assigns null to each parameter-less short option", () => {
                const options = new InputArgs("command -o -p").options;
                expect(options).to.have.own.property("o", null);
                expect(options).to.have.own.property("p", null);
            });

            it("assigns null to each parameter-less short option in a group", () => {
                const options = new InputArgs("command -op").options;
                expect(options).to.have.own.property("o", null);
                expect(options).to.have.own.property("p", null);
            });

            it("assigns the given value to a short option", () => {
                expect(new InputArgs("command -o=value").options).to.have.own.property("o", "value");
            });

            it("assigns the given value containing a space to a short option", () => {
                expect(new InputArgs(`command -o="val ue"`).options).to.have.own.property("o", "val ue");
            });

            it("assigns an empty string to a short option", () => {
                expect(new InputArgs("command -o= -p").options).to.have.own.property("o", "");
            });

            it("does not assign a value to grouped short options", () => {
                expect(() => new InputArgs("command -opq=arg -r")).to.throw;
            });

            it("considers an assignment to an empty short option to be an argument", () => {
                expect(new InputArgs("command -=value -p").options).not.to.have.own.property("p");
            });
        });

        describe("long options", () => {
            it("assigns null to a parameter-less long option", () => {
                expect(new InputArgs("command --option").options).to.have.own.property("option", null);
            });

            it("assigns null to each parameter-less long option", () => {
                const options = new InputArgs("command --option1 --option2").options;
                expect(options).to.have.own.property("option1", null);
                expect(options).to.have.own.property("option2", null);
            });

            it("assigns the given value to a long option", () => {
                expect(new InputArgs("command --option=value").options).to.have.own.property("option", "value");
            });

            it("assigns the given value containing a space to a long option", () => {
                expect(new InputArgs(`command --option="val ue"`).options).to.have.own.property("option", "val ue");
            });

            it("stops parsing options after the first non-option", () => {
                expect(new InputArgs("command -o=value arg -p").options).to.not.have.own.property("p");
            });

            it("considers an assignment to an empty long option to be an argument", () => {
                const options = new InputArgs("command --=value -p").options;
                expect(options).not.to.have.own.property("p");
            });
        });

        it("stops parsing options if an option name contains a space", () => {
            expect(new InputArgs(`command "--opt ion" -p`).options).to.not.have.own.property("p");
        });

        it("stops parsing options after --", () => {
            expect(new InputArgs("command -- -p").options).to.not.have.own.property("p");
        });

        it("considers an option surrounded by quotes as any other option", () => {
            const options = new InputArgs(`command -o "-p"`).options;
            expect(options).to.have.own.property("o", null);
            expect(options).to.have.own.property("p", null);
        });
    });

    describe("args", () => {
        it("has no arguments if only the command is given", () => {
            expect(new InputArgs("command").args).to.have.length(0);
        });

        it("has no arguments if only options are given", () => {
            expect(new InputArgs("command -o=value -p").args).to.have.length(0);
        });

        it("has all simple arguments", () => {
            const args = new InputArgs("command a b c").args;
            expect(args).to.include("a");
            expect(args).to.include("b");
            expect(args).to.include("c");
        });

        it("has arguments containing spaces", () => {
            expect(new InputArgs(`command "a b c"`).args).to.include("a b c");
        });

        it("has arguments containing dashes", () => {
            expect(new InputArgs("command -o -- -p").args).to.include("-p");
        });
    });

    describe("output redirection", () => {
        it("should have the default redirect target by default", () => {
            expect(new InputArgs("command").redirectTarget).to.have.members(["default"]);
        });

        it("should find the writing redirect target", () => {
            expect(new InputArgs("command > file").redirectTarget).to.have.members(["write", "file"]);
        });

        it("should find the appending redirect target", () => {
            expect(new InputArgs("command >> file").redirectTarget).to.have.members(["append", "file"]);
        });

        it("should find the redirect target without a space between the operator and filename", () => {
            expect(new InputArgs("command >file").redirectTarget).to.have.members(["write", "file"]);
        });

        it("should find the redirect target without a space between the previous token and the target", () => {
            const inputArgs = new InputArgs("command arg>file");
            expect(inputArgs.redirectTarget).to.have.members(["write", "file"]);
            expect(inputArgs.args).to.have.members(["arg"]);
        });

        it("should choose the last redirect target if multiple are present", () => {
            expect(new InputArgs("command > file1 >> file2").redirectTarget).to.have.members(["append", "file2"]);
            expect(new InputArgs("command >> file1 > file2").redirectTarget).to.have.members(["write", "file2"]);
        });

        it("should find the writing redirect target if placed at the end", () => {
            const inputArgs = new InputArgs("command -o=p arg1 > file");
            expect(inputArgs.options).to.deep.equal({o: "p"});
            expect(inputArgs.args).to.have.members(["arg1"]);
            expect(inputArgs.redirectTarget).to.have.members(["write", "file"]);
        });

        it("should find the redirect target if placed in between arguments", () => {
            const inputArgs = new InputArgs("command arg1 > file arg2");
            expect(inputArgs.redirectTarget).to.have.members(["write", "file"]);
            expect(inputArgs.args).to.have.members(["arg1", "arg2"]);
        });

        it("should find the redirect target if placed in between options", () => {
            const inputArgs = new InputArgs("command -o=p >> file --ba=ba arg2");
            expect(inputArgs.redirectTarget).to.have.members(["append", "file"]);
            expect(inputArgs.options).to.deep.equal({o: "p", ba: "ba"});
        });

        it("should ignore the redirect target if inside quotation marks", () => {
            console.log(new InputArgs("command '> file'").args);
            expect(new InputArgs("command '> file'").redirectTarget).to.have.members(["default"]);
        });

        it("should ignore the redirect target if the operator is escaped", () => {
            const inputArgs = new InputArgs("command \\> file");
            expect(inputArgs.redirectTarget).to.have.members(["default"]);
            expect(inputArgs.args).to.have.members([">", "file"]);
        });
    });
});
