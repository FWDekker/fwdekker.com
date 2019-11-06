import "mocha";
import {expect} from "chai";

import {Environment} from "../main/js/Environment";


describe("environment", () => {
    let environment: Environment;
    let roEnvironment: Environment;


    beforeEach(() => {
        environment = new Environment();
        roEnvironment = new Environment(["readonly"]);
    });


    describe("constructor", () => {
        it("sets the given default variables", () => {
            expect(new Environment([], {key: "value"}).get("key")).to.equal("value");
        });
    });

    describe("get variables", () => {
        it("returns a copy", () => {
            environment.set("key", "old");

            environment.variables["key"] = "new";

            expect(environment.get("key")).to.equal("old");
        });
    });

    describe("clear", () => {
        it("removes all values", () => {
            environment.load({
                key1: "value1",
                key2: "value2"
            });

            environment.clear();

            expect(environment.has("key1")).to.be.false;
            expect(environment.has("key2")).to.be.false;
        });

        it("removes read-only values", () => {
            roEnvironment.set("readonly", "value");

            roEnvironment.clear();

            expect(roEnvironment.has("readonly")).to.be.false;
        });
    });

    describe("delete", () => {
        it("removes the given key", () => {
            environment.set("key", "value");

            environment.delete("key");

            expect(environment.has("key")).to.be.false;
        });

        it("removes a read-only key", () => {
            roEnvironment.set("readonly", "value");

            environment.delete("readonly");

            expect(environment.has("readonly")).to.be.false;
        });

        it("throws an exception if the key is invalid", () => {
            expect(() => environment.delete("in-valid")).to.throw;
        });

        describe("safe", () => {
            it("removes the given key", () => {
                environment.set("key", "value");

                environment.safeDelete("key");

                expect(environment.has("key")).to.be.false;
            });

            it("throws an exception if the key is read-only", () => {
                expect(() => roEnvironment.safeDelete("readonly")).to.throw;
            });
        });
    });

    describe("get", () => {
        it("returns the value that was set", () => {
            environment.set("key", "value");

            expect(environment.get("key")).to.equal("value");
        });

        it("overwrites an existing value", () => {
            environment.set("key", "old");
            environment.set("key", "new");

            expect(environment.get("key")).to.equal("new");
        });

        it("sets a read-only value", () => {
            roEnvironment.set("readonly", "value");

            expect(roEnvironment.get("readonly")).to.equal("value");
        });

        it("throws an exception if the variable does not exist", () => {
            expect(() => environment.get("invalid")).to.throw;
        });

        describe("or default", () => {
            it("returns the value if the variable exists", () => {
                environment.set("key", "value");

                expect(environment.getOrDefault("key", "default")).to.equal("value");
            });

            it("returns the default value if the variable does not exist", () => {
                expect(environment.getOrDefault("key", "default")).to.equal("default");
            });
        });
    });

    describe("load", () => {
        it("loads the given variables", () => {
            environment.load({
                key1: "value1",
                key2: "value2"
            });

            expect(environment.get("key1")).to.equal("value1");
            expect(environment.get("key2")).to.equal("value2");
        });

        it("overwrites existing variables", () => {
            environment.set("key1", "old1");

            environment.load({
                key1: "new1",
                key2: "value2"
            });

            expect(environment.get("key1")).to.equal("new1");
        });

        it("loads the given read-only variables", () => {
            environment.load({readonly: "value"});

            expect(environment.get("readonly")).to.equal("value");
        });

        it("overwrites read-only variables", () => {
            environment.set("readonly", "old");

            environment.load({readonly: "new"});

            expect(environment.get("readonly")).to.equal("new");
        });
    });

    describe("set", () => {
        it("sets the given variable", () => {
            environment.set("key", "value");

            expect(environment.get("key")).to.equal("value");
        });

        it("overwrites an existing variable", () => {
            environment.set("key", "old");

            environment.set("key", "new");

            expect(environment.get("key")).to.equal("new");
        });

        it("sets the given read-only variable", () => {
            environment.set("readonly", "value");

            expect(environment.get("readonly")).to.equal("value");
        });

        it("overwrites a read-only variable", () => {
            environment.set("readonly", "old");

            environment.set("readonly", "new");

            expect(environment.get("readonly")).to.equal("new");
        });

        it("throws an error if the key is invalid", () => {
            expect(() => environment.set("in-valid", "value")).to.throw;
        });

        describe("safe", () => {
            it("sets the given variable", () => {
                environment.safeSet("key", "value");

                expect(environment.get("key")).to.equal("value");
            });

            it("throws an error if the key is read-only", () => {
                expect(() => roEnvironment.safeSet("readonly", "value")).to.throw;
            });
        });
    });
});
