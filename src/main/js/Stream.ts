/**
 * Something that can be read from.
 */
export interface InputStream {
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
}
