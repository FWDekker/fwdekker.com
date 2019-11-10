/**
 * A buffer that can be written to and read from.
 */
export class Buffer implements InputStream, OutputStream {
    protected buffer = "";


    has(count: number): boolean {
        return this.buffer.length >= count;
    }

    read(count: number | undefined): string {
        const input = this.peek(count ?? this.buffer.length);
        this.buffer = this.buffer.slice(input.length);
        return input;
    }

    readLine(): string {
        return this.read(this.buffer.indexOf("\n") + 1);
    }

    peek(count: number | undefined): string {
        return this.buffer.slice(0, count ?? this.buffer.length);
    }

    peekLine(): string {
        return this.peek(this.buffer.indexOf("\n") + 1);
    }

    write(string: string): void {
        this.buffer += string;
    }

    writeLine(string: string): void {
        this.write(string + "\n");
    }
}

/**
 * Something that can be read from.
 */
export interface InputStream {
    /**
     * Returns `true` if and only if this stream has the given number of bytes to read.
     *
     * @param count the number of bytes to check
     */
    has(count: number): boolean;

    /**
     * Reads the given number of bytes from the stream.
     *
     * @param count the number of bytes to read, or `undefined` if all bytes should be read
     */
    read(count: number | undefined): string;

    /**
     * Reads the stream until and including the next newline character.
     */
    readLine(): string;

    /**
     * Same as `#read` but without consuming the bytes.
     *
     * @param count the number of bytes to peek, or `undefined` if all bytes should be peeked
     */
    peek(count: number | undefined): string;

    /**
     * Same as `#readLine` but without consuming the bytes.
     */
    peekLine(): string;
}

/**
 * Something that can be written to.
 */
export interface OutputStream {
    /**
     * Writes a sequence of bytes.
     *
     * @param string the sequence of bytes to write
     */
    write(string: string): void;

    /**
     * Writes a sequence of bytes followed by a newline character.
     *
     * @param string the sequence of bytes to write, excluding the newline character
     */
    writeLine(string: string): void;
}

/**
 * A set of streams.
 *
 * Since stream sets are mutable, keep in mind that giving this object to a callee might have the callee change some
 * of the streams. Consider using the `#copy` method in that case.
 */
export class StreamSet {
    /**
     * The input stream.
     */
    ins: InputStream;
    /**
     * The output stream.
     */
    out: OutputStream;
    /**
     * The error output stream.
     */
    err: OutputStream;


    /**
     * Constructs a new stream set.
     *
     * @param ins the input stream
     * @param out the output stream
     * @param err the error output stream
     */
    constructor(ins: InputStream, out: OutputStream, err: OutputStream) {
        this.ins = ins;
        this.out = out;
        this.err = err;
    }


    /**
     * Returns a copy of this stream set.
     */
    copy(): StreamSet {
        return new StreamSet(this.ins, this.out, this.err);
    }
}
