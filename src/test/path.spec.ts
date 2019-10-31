import "mocha";
import {expect} from "chai";

import "../main/js/extensions"
import {Path} from "../main/js/fs";


describe("Hello function", () => {
    it("should return hello world", () => {
        expect(new Path("/", "/").path).to.equal("/");
    });
});
