import {expect} from "chai";
import "mocha";

import {InputValidator} from "../main/js/Commands";
import {InputArgs} from "../main/js/InputArgs";


describe("input validator", () => {
    function input(args: string[]): InputArgs {
        return new InputArgs("commands", {}, args, []);
    }


    describe("argument count", () => {
        function validator(min: number, max: number): InputValidator {
            return new InputValidator(({minArgs: min, maxArgs: max}));
        }


        describe("constructor", () => {
            it("throws an error if minArgs is greater than maxArgs", () => {
                expect(() => validator(3, 2)).to.throw();
            });

            it("throws an error if minArgs is negative", () => {
                expect(() => validator(-1, 2)).to.throw();
            });

            it("throws an error if maxArgs is negative", () => {
                expect(() => validator(2, -3)).to.throw();
            });
        });

        describe("validate", () => {
            it("returns false if there are too few arguments", () => {
                expect(validator(2, 3).validate(input(["1"])))
                    .to.have.members([false, "Expected at least 2 arguments but got 1."]);
            });

            it("returns false if there are too many arguments", () => {
                expect(validator(0, 1).validate(input(["1", "2", "3"])))
                    .to.have.members([false, "Expected at most 1 argument but got 3."]);
            });

            it("returns false if the number of arguments is not the exact number of required arguments", () => {
                expect(validator(1, 1).validate(input(["1", "2"])))
                    .to.have.members([false, "Expected 1 argument but got 2."]);
            });

            it("returns true if the minimum number of arguments is present", () => {
                expect(validator(2, 5).validate(input(["1", "2"])))
                    .to.have.members([true]);
            });

            it("returns true if the maximum number of arguments is present", () => {
                expect(validator(2, 3).validate(input(["1", "2", "3"])))
                    .to.have.members([true]);
            });

            it("returns true if the exact required number of arguments is present", () => {
                expect(validator(1, 1).validate(input(["1"])))
                    .to.have.members([true]);
            });
        });
    });
});
