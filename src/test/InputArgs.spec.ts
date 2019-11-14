import "mocha";
import {expect} from "chai";

import {InputArgs} from "../main/js/InputArgs";


describe("input args", () => {
    describe("command", () => {
        it("returns the given command", () => {
            expect(new InputArgs("command", {}, []).command).to.equal("command");
        });
    });

    describe("options", () => {
        function inputOptions(options: InputArgs.Options): InputArgs {
            return new InputArgs("command", options, []);
        }


        describe("get", () => {
            it("returns an empty object of options", () => {
                expect(inputOptions({}).options).to.deep.equal({});
            });

            it("returns the given options", () => {
                const options = {a: "a", b: "b"};
                expect(inputOptions(options).options).to.deep.equal(options);
            });

            it("returns a copy of the given options", () => {
                const options = {a: "old"};

                const inputArgs = inputOptions(options);
                options["a"] = "new";

                expect(inputArgs.options["a"]).to.equal("old");
            });
        });

        describe("has", () => {
            it("returns false if the option is absent", () => {
                expect(inputOptions({key: "value"}).hasAnyOption("err")).to.be.false;
            });

            it("returns false if all options are absent", () => {
                expect(inputOptions({key: "value"}).hasAnyOption("err1", "err2")).to.be.false;
            });

            it("returns true if the option is present", () => {
                expect(inputOptions({key: "value"}).hasAnyOption("key")).to.be.true;
            });

            it("returns true if at least one option is present", () => {
                expect(inputOptions({key: "value"}).hasAnyOption("err1", "key", "err2")).to.be.true;
            });

            it("returns true even if the present option's value is an empty string", () => {
                expect(inputOptions({key: ""}).hasAnyOption("key")).to.be.true;
            });
        });
    });

    describe("args", () => {
        function inputArgs(args: string[]): InputArgs {
            return new InputArgs("command", {}, args);
        }


        describe("argv", () => {
            it("returns the given arguments", () => {
                const args = ["a", "b"];
                expect(inputArgs(args).args).to.have.members(args);
            });

            it("returns a copy of the given arguments", () => {
                const args = ["old"];

                const input = inputArgs(args);
                args[0] = "new";

                expect(input.args[0]).to.equal("old");
            });
        });

        describe("argc", () => {
            it("returns 0 if there are no arguments", () => {
                expect(inputArgs([]).argc).to.equal(0);
            });

            it("returns the number of arguments", () => {
                expect(inputArgs(["a", "b"]).argc).to.equal(2);
            });
        });
    });

    describe("redirection", () => {
        describe("output", () => {
            it("returns the given output target", () => {
                const inputArgs = new InputArgs("command", {}, [], {type: "default"});
                expect(inputArgs.outTarget).to.deep.equal({type: "default"});
            });

            it("returns a copy of the given output target", () => {
                const target: InputArgs.RedirectTarget = {type: "write", target: "old"};

                const inputArgs = new InputArgs("command", {}, [], target);
                target.target = "new";

                expect(inputArgs.outTarget).to.deep.equal({type: "write", target: "old"});
            });
        });

        describe("error", () => {
            it("returns the given error target", () => {
                const inputArgs = new InputArgs("command", {}, [], {type: "default"}, {type: "default"});
                expect(inputArgs.errTarget).to.deep.equal({type: "default"});
            });

            it("returns a copy of the given error target", () => {
                const target: InputArgs.RedirectTarget = {type: "write", target: "old"};

                const inputArgs = new InputArgs("command", {}, [], {type: "default"}, target);
                target.target = "new";

                expect(inputArgs.errTarget).to.deep.equal({type: "write", target: "old"});
            });
        });
    });
});
