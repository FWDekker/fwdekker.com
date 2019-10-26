interface String {
    trimLines(): string;

    replaceAll(regex: RegExp, replacement: string): string;
}

String.prototype.trimLines = function (): string {
    return this.split("\n").map(it => it.trim()).join("\n");
};

String.prototype.replaceAll = function (regex, replacement) {
    let string = this.toString();

    while (regex.test(string))
        string = string.replace(regex, replacement);

    return "" + string;
};


interface Array<T> {
    sortAlphabetically(transform: (element: T) => string): T[];
}

Array.prototype.sortAlphabetically = function (transform: (_: any) => string = (it) => it) {
    return this.sort((a, b) => {
        const aName = transform(a).toLowerCase();
        const bName = transform(b).toLowerCase();

        if (aName < bName)
            return -1;
        else if (aName > bName)
            return 1;
        else
            return 0;
    });
};
