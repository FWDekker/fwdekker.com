import {IllegalArgumentError} from "./Shared";


/**
 * A history of inputs that grows downwards and can be accessed in sequence relative to the newest entry.
 *
 * An input history keeps a "read index" that starts at `-1`. After entries have been added, calling `previous` will
 * increase the read index to `0` and return the newest entry. Calling `previous` again will increase the read index to
 * `1` and return the first-to-last entry. Calling `next` at this point will decrease the read index to `0` and will
 * return the last entry again. Adding a new entry to the history resets the read index to `-1`. Calling `next` while
 * the read index is at `-1` will return an empty string without decrementing the read index further. Calling `previous`
 * at the highest possible index will return the first entry without incrementing the read index further.
 */
export class InputHistory {
    /**
     * The list of previous input.
     */
    private readonly _entries: string[];
    /**
     * The current index that the history is being read from.
     */
    private index: number;


    /**
     * Constructs a new input history.
     *
     * @param history the records currently in the history
     */
    constructor(history: string[] = []) {
        this._entries = history;
        this.index = -1;
    }


    /**
     * Returns a copy of the entries in this history.
     */
    get entries(): string[] {
        return this._entries.slice();
    }


    /**
     * Adds a new input to the bottom of the history and resets the read index.
     *
     * @param entry the entry to add
     */
    add(entry: string): void {
        if (entry.trim() !== "" && entry.trim() !== this._entries[0]?.trim())
            this._entries.unshift(entry);

        this.resetIndex();
    }

    /**
     * Removes all entries from the history and resets the read index.
     */
    clear(): void {
        this._entries.length = 0;
        this.resetIndex();
    }

    /**
     * Returns the entry at the given index, or an empty string if the index is negative.
     *
     * @param index the index to return the entry of, where `0` is the newest entry and `-1` returns an empty string
     * @throws if the index is out of bounds and not `-1`
     */
    get(index: number): string {
        if (index < -1 || index >= this._entries.length)
            throw new IllegalArgumentError(`Index '${index}' is out of bounds.`);

        if (index === -1)
            return "";

        return this._entries[index];
    }

    /**
     * Returns the next (newer) entry in the history, or an empty string if the read index has gone past the newest
     * entry.
     *
     * The read counter is decremented if possible.
     */
    next(): string {
        this.index--;
        if (this.index < -1)
            this.index = -1;

        return this.get(this.index);
    }

    /**
     * Returns the previous (older) entry in the history, or the oldest entry if the read index is already at the oldest
     * entry.
     *
     * The read counter is incremented if possible.
     */
    previous(): string {
        this.index++;
        if (this.index >= this._entries.length)
            this.index = this._entries.length - 1;

        return this.get(this.index);
    }

    /**
     * Resets the read index without changing any entries.
     */
    resetIndex(): void {
        this.index = -1;
    }
}
