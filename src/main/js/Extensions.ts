interface String {
    trimLines(): string;

    trimMultiLines(): string;
}

/**
 * Returns this string with all leading and trailing whitespace removed from each line.
 */
String.prototype.trimLines = function(): string {
    return this.split("\n").map(it => it.trimStart()).join("\n");
};

/**
 * Returns this string with all leading and trailing whitespace removed from each line, and from lines that are split
 * using a the `\\` symbol.
 *
 * That is, when writing multilines, write `\\\` at the end for this method to recognise where the string has been
 * split.
 */
String.prototype.trimMultiLines = function(): string {
    return this.trimLines().split("\\").map(it => it.trimStart()).join("");
};


interface Array<T> {
    sortAlphabetically(transform: (element: T) => string, caseSensitive: boolean): T[];
}

/**
 * Returns a comparator that compares elements of an array based on their string representation.
 *
 * @param transform transforms elements of the array into a string that is used for comparing
 * @param caseSensitive `true` if and only if the comparator should be sensitive to the case of characters
 */
Array.prototype.sortAlphabetically = function(transform: (_: any) => string = (it) => it,
                                              caseSensitive: boolean = true) {
    return this.sort((a, b) => {
        const aName = caseSensitive ? transform(a) : transform(a).toLowerCase();
        const bName = caseSensitive ? transform(b) : transform(b).toLowerCase();

        if (aName < bName)
            return -1;
        else if (aName > bName)
            return 1;
        else
            return 0;
    });
};
