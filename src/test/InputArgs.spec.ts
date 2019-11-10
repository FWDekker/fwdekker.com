import "mocha";
import {expect} from "chai";

import {InputArgs} from "../main/js/Shell";


describe("input args", () => {
    describe("command", () => {
        it("returns the given command", () => {
            expect(new InputArgs("command", {}, [], ["default"]).command).to.equal("command");
        });
    });

    describe("options", () => {
        describe("get", () => {
            it("returns an empty object of options", () => {
                expect(new InputArgs("command", {}, [], ["default"]).options).to.deep.equal({});
            });

            it("returns the given options", () => {
                const options = {a: "a", b: "b"};
                expect(new InputArgs("command", options, [], ["default"]).options).to.deep.equal(options);
            });

            it("returns a copy of the given options", () => {
                const options = {a: "old"};

                const inputArgs  = new InputArgs("command", options, [], ["default"]);
                options["a"] = "new";

                expect(inputArgs.options["a"]).to.equal("old");
            });
        });

        describe("has", () => {
            it("returns false if the option is absent", () => {
                const options = {key: "value"};

                expect(new InputArgs("command", options, [], ["default"]).hasAnyOption("err")).to.be.false;
            });

            it("returns false if all options are absent", () => {
                const options = {key: "value"};

                expect(new InputArgs("command", options, [], ["default"]).hasAnyOption("err1", "err2")).to.be.false;
            });

            it("returns true if the option is present", () => {
                const options = {key: "value"};

                expect(new InputArgs("command", options, [], ["default"]).hasAnyOption("key")).to.be.true;
            });

            it("returns true if at least one option is present", () => {
                const options = {key: "value"};

                expect(new InputArgs("command", options, [], ["default"]).hasAnyOption("err1", "key", "err2")).to.be.true;
            });

            it("returns true even if the present option's value is an empty string", () => {
                const options = {key: ""};

                expect(new InputArgs("command", options, [], ["default"]).hasAnyOption("key")).to.be.true;
            });
        });
    });

    describe("args", () => {
        describe("argv", () =>{
            it("returns the given arguments", () => {
                const args = ["a", "b"];
                expect(new InputArgs("command", {}, args, ["default"]).args).to.have.members(args);
            });

            it("returns a copy of the given arguments", () => {
                const args = ["old"];

                const inputArgs = new InputArgs("command", {}, args, ["default"]);
                args[0] = "new";

                expect(inputArgs.args[0]).to.equal("old");
            });
        });

        describe("argc", () => {
            it("returns 0 if there are no arguments", () => {
                expect(new InputArgs("command", {}, [], ["default"]).argc).to.equal(0);
            });

            it("returns the number of arguments", () => {
                expect(new InputArgs("command", {}, ["a", "b"], ["default"]).argc).to.equal(2);
            });
        });
    });

    describe("redirect target", () => {
        it("returns the given redirect target", () => {
            expect(new InputArgs("command", {}, [], ["default"]).redirectTarget).to.have.members(["default"]);
        });

        it("returns a copy of the given redirect target", () => {
            const target: InputArgs.RedirectTarget = ["write", "old"];

            const inputArgs = new InputArgs("command", {}, [], target);
            target[1] = "new";

            expect(inputArgs.redirectTarget).to.have.members(["write", "old"]);
        });
    });
});
