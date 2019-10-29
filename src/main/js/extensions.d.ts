interface String {
    trimLines(): string;

    replaceAll(regex: RegExp, replacement: string): string;
}


interface Array<T> {
    sortAlphabetically(transform: (element: T) => string, caseSensitive: boolean): T[];
}
