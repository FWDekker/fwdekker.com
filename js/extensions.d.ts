interface String {
    trimLines(): string;
}

interface Array<T> {
    sortAlphabetically(transform: (element: T) => string);
}
