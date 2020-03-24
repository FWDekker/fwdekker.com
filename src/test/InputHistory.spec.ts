import {expect} from "chai";
import "mocha";

import {InputHistory} from "../main/js/InputHistory";


describe("input history", () => {
    let history: InputHistory;


    beforeEach(() => {
        history = new InputHistory();
    });


    describe("entries", () => {
        it("returns a copy of the entries", () => {
            history.add("old");

            history.entries[0] = "new";

            expect(history.entries[0]).to.equal("old");
        });
    });

    describe("add", () => {
        it("does not add empty entries", () => {
            history.add("");

            expect(history.entries.length).to.equal(0);
        });

        it("does not add duplicate entries", () => {
            history.add("command");
            history.add("command");

            expect(history.entries.length).to.equal(1);
        });

        it("does not add duplicate entries, ignoring leading and trailing whitespace", () => {
            history.add("command ");
            history.add(" command");

            expect(history.entries.length).to.equal(1);
        });

        it("adds entries including leading and trailing whitespace", () => {
            history.add(" command ");

            expect(history.entries[0]).to.equal(" command ");
        });

        it("resets the index", () => {
            history.add("command1");
            history.add("command2");
            history.previous();

            history.add("command3");

            expect(history.previous()).to.equal("command3");
        });
    });

    describe("clear", () => {
        it("removes all entries", () => {
            history.add("command1");
            history.add("command2");

            history.clear();

            expect(history.entries).to.have.length(0);
        });

        it("resets the index", () => {
            history.add("command1");
            history.add("command2");
            history.previous();
            history.previous();

            history.clear();

            expect(history.previous()).to.equal("");
        });
    });

    describe("get", () => {
        it("throws an error if the index is below -1", () => {
            expect(() => history.get(-2)).to.throw();
        });

        it("throws an error if the index is greater than or equal to the history size", () => {
            history.add("command1");
            history.add("command2");

            expect(() => history.get(2)).to.throw();
        });

        it("returns an empty string if the index is -1 and the history is empty", () => {
            expect(history.get(-1)).to.equal("");
        });

        it("returns an empty string if the index is -1 and the history is non-empty", () => {
            history.add("command1");
            history.add("command2");

            expect(history.get(-1)).to.equal("");
        });

        it("returns the most recent entry at index 0", () => {
            history.add("command1");
            history.add("command2");

            expect(history.get(0)).to.equal("command2");
        });

        it("returns the least recent entry at the highest index", () => {
            history.add("command1");
            history.add("command2");

            expect(history.get(1)).to.equal("command1");
        });
    });

    describe("next", () => {
        beforeEach(() => {
            history.add("command1");
            history.add("command2");
            history.add("command3");
        });


        it("returns an empty string at the first call", () => {
            expect(history.next()).to.equal("");
        });

        it("returns an empty string if the index is -1", () => {
            history.next();
            history.next();
            history.next();

            expect(history.next()).to.equal("");
        });

        it("returns an empty string if the index is currently at the most recent entry", () => {
            history.previous();

            expect(history.next()).to.equal("");
        });

        it("returns the most recent entry if the index is currently at the second-most recent", () => {
            history.previous();
            history.previous();

            expect(history.next()).to.equal("command3");
        });
    });

    describe("previous", () => {
        beforeEach(() => {
            history.add("command1");
            history.add("command2");
            history.add("command3");
        });


        it("returns the newest entry at the first call", () => {
            expect(history.previous()).to.equal("command3");
        });

        it("returns the second-newest entry at the second call", () => {
            history.previous();

            expect(history.previous()).to.equal("command2");
        });

        it("always returns the oldest entry once the index has reached the oldest entry", () => {
            history.previous();
            history.previous();
            history.previous();
            history.previous();

            expect(history.previous()).to.equal("command1");
        });
    });

    describe("resetIndex", () => {
        // Covered indirectly in `add`
    });
});
