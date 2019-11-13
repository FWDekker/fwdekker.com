import {emptyFunction, getFileExtension, IllegalArgumentError} from "./Shared";
import {Stream} from "./Stream";


/**
 * A file system.
 */
export class FileSystem {
    /**
     * The root directory.
     */
    readonly root: Directory;


    /**
     * Constructs a new file system.
     *
     * @param root the directory to set as the root
     */
    constructor(root: Directory | undefined = undefined) {
        if (root === undefined)
            this.root =
                new Directory({
                    "dev": new Directory({
                        "null": new NullFile()
                    }),
                    "home": new Directory({
                        "felix": new Directory({
                            "personal": new Directory({
                                "steam.lnk": new File("https://steamcommunity.com/id/Waflix"),
                                "nukapedia.lnk": new File("https://fallout.wikia.com/wiki/User:FDekker"),
                                "blog.lnk": new File("https://blog.fwdekker.com/"),
                            }),
                            "projects": new Directory({
                                "randomness.lnk": new File("https://github.com/FWDekker/intellij-randomness"),
                                "schaapi.lnk": new File("https://cafejojo.org/schaapi"),
                                "gitea.lnk": new File("https://git.fwdekker.com/explore/"),
                                "github.lnk": new File("https://github.com/FWDekker/"),
                            }),
                            "social": new Directory({
                                "github.lnk": new File("https://github.com/FWDekker/"),
                                "stackoverflow.lnk": new File("https://stackoverflow.com/u/3307872"),
                                "linkedin.lnk": new File("https://www.linkedin.com/in/fwdekker/")
                            }),
                            "resume.pdf": new File("https://static.fwdekker.com/misc/resume.pdf")
                        })
                    }),
                    "root": new Directory()
                });
        else
            this.root = root;
    }


    /**
     * Adds the given node at the given path.
     *
     * @param target the path to add the node at
     * @param node the node to add
     * @param createParents `true` if and only if intermediate directories should be created if they do not exist yet
     * @throws if the parent directory does not exist and `createParents` is `false`, if the parent is not a directory,
     * or if there already exists a node at the given location
     */
    add(target: Path, node: Node, createParents: boolean): void {
        if (target.isDirectory && !(node instanceof Directory))
            throw new IllegalArgumentError(`Cannot add non-directory at '${target}/'.`);

        if (!this.has(target.parent)) {
            if (createParents)
                this.add(target.parent, new Directory(), true);
            else
                throw new IllegalArgumentError(`The directory '${target.parent}' does not exist.`);
        }

        const parent = this.get(target.parent);
        if (!(parent instanceof Directory))
            throw new IllegalArgumentError(`'${target.parent}' is not a directory.`);
        if (parent.has(target.fileName))
            throw new IllegalArgumentError(`A file or directory already exists at '${target}'.`);

        parent.add(target.fileName, node);
    }

    /**
     * Copies `source` to `destination`.
     *
     * @param source the path to the file or directory to copy
     * @param destination the path to the destination
     * @param isRecursive if copying should happen recursively if the source is a directory
     * @throws if the source is a directory and `isRecursive` is `false`, if the source does not exist, if the target's
     * parent does not exist, if the target's parent is not a directory, or if the target already exists
     */
    copy(source: Path, destination: Path, isRecursive: boolean): void {
        if (source.isAncestorOf(destination))
            throw new IllegalArgumentError("Cannot copy directory into itself.");

        const sourceNode = this.get(source);
        if (sourceNode === undefined)
            throw new IllegalArgumentError(`File or directory '${source}' does not exist.`);
        if (sourceNode instanceof Directory && !isRecursive)
            throw new IllegalArgumentError(`'${source}' is a directory.`);

        this.add(destination, sourceNode.copy(), false);
    }

    /**
     * Returns the node at the given path, or `undefined` if the node does not exist.
     *
     * @param target the path of the node to return
     */
    get(target: Path): Node | undefined {
        if (target.toString() === "/")
            return this.root;

        const parent = this.get(target.parent);
        if (!(parent instanceof Directory))
            return undefined;

        const node = parent.get(target.fileName);
        if (target.isDirectory && !(node instanceof Directory))
            return undefined;

        return parent.get(target.fileName);
    }

    /**
     * Returns `true` if and only if there exists a node at the given path.
     *
     * @param target the path to check for node presence
     */
    has(target: Path): boolean {
        return this.get(target) !== undefined;
    }

    /**
     * Moves `source` to `destination`.
     *
     * @param source the path to the file or directory to move
     * @param destination the path to the destination
     * @throws if there is no node at `source`, if `destination` already exist, or if `destination`'s parent does not
     * exist
     */
    move(source: Path, destination: Path): void {
        if (source.isAncestorOf(destination))
            throw new IllegalArgumentError("Cannot move directory into itself.");

        const sourceNode = this.get(source);
        if (sourceNode === undefined)
            throw new IllegalArgumentError(`File or directory '${source}' does not exist.`);

        this.add(destination, sourceNode, false);
        this.remove(source);
    }

    /**
     * Opens a file stream to the file at the given path.
     *
     * @param target the path to the file to open a stream to
     * @param mode the mode to open the file with
     * @throws if the target or its parent does not exist, or if the target is not a file
     */
    open(target: Path, mode: FileMode): FileStream {
        if (!this.has(target.parent))
            throw new IllegalArgumentError(`Directory '${target.parent}' does not exist.`);

        if (!this.has(target)) {
            if (mode === "append" || mode === "write")
                this.add(target, new File(), false);
            else
                throw new IllegalArgumentError(`File '${target}' does not exist.`);
        }

        const targetNode = this.get(target);
        if (!(targetNode instanceof File))
            throw new IllegalArgumentError(`Cannot open directory '${target}'.`);

        return targetNode.open(mode);
    }

    /**
     * Removes a node from the file system.
     *
     * If the node in question does not exist, the function will return successfully.
     *
     * @param target the path to the node to be removed
     */
    remove(target: Path): void {
        const parent = this.get(target.parent);
        if (!(parent instanceof Directory))
            return;

        const node = this.get(target);
        if (target.isDirectory && !(node instanceof Directory))
            return;

        parent.remove(target.fileName);
    }
}


/**
 * A path to a node in the file system.
 */
export class Path {
    /**
     * The full absolute path to the node described by this path.
     */
    private readonly path: string;
    /**
     * The absolute path to the parent node of the node described by this path.
     */
    private readonly _parent: string;
    /**
     * The name of the node described by this path.
     */
    readonly fileName: string;
    /**
     * `true` if and only if the path necessarily points to a directory.
     */
    readonly isDirectory: boolean;


    /**
     * Constructs a new path.
     *
     * @param paths a set of strings that describe the path
     */
    constructor(...paths: string[]) {
        const path = `/${paths.join("/")}/`;

        const parts = [];
        let part = "";
        for (let i = 0; i < path.length; i++) {
            const char = path[i];
            if (char !== "/") {
                part += char;
                continue;
            }

            if (part === ".") {
                // Do nothing
            } else if (part === "..") {
                parts.pop();
            } else if (part !== "") {
                parts.push(part);
            }
            part = "";
        }
        if (part !== "")
            parts.push(part);

        this.path = "/" + parts.join("/");
        this._parent = parts.slice(0, -1).join("/");
        this.fileName = parts.slice(-1).join("");
        this.isDirectory = paths[paths.length - 1].endsWith("/");
    }

    /**
     * Interprets a (set of) paths that may or may not be absolute.
     *
     * If only `cwd` is given, a path to the `cwd` is returned.
     * If the first path in `paths` starts with a `/`, a new path is returned using only `paths` and not `cwd` is
     * returned.
     * Otherwise, a path using first `cwd` and then `paths` is returned.
     *
     * @param cwd the current working directory, used as a baseline
     * @param paths the paths that may or may not be absolute
     */
    static interpret(cwd: string, ...paths: string[]): Path {
        if (paths.length === 0)
            return new Path(cwd);
        if (paths[0].startsWith("/"))
            return new Path(...paths);

        return new Path(cwd, ...paths);
    }


    /**
     * Returns the path describing the parent directory.
     */
    get parent(): Path {
        return new Path(this._parent);
    }

    /**
     * Returns all ancestors of this path, starting at the parent and ending at the root.
     */
    get ancestors(): Path[] {
        const parents: Path[] = [];

        let path: Path = this.parent;
        while (path.path !== "/") {
            parents.push(path);
            path = path.parent;
        }
        if (this.path !== "/")
            parents.push(path);

        return parents;
    }


    /**
     * Returns a path describing the path to the desired child node of `this` path.
     *
     * @param child the path to the desired node relative to `this` path
     */
    getChild(child: string): Path {
        return new Path(this.path + "/" + child);
    }

    /**
     * Returns all ancestors up to and including the given ancestor.
     *
     * If the given ancestor is this path, an empty array is returned.
     *
     * @param ancestor the last ancestor to return
     */
    getAncestorsUntil(ancestor: Path): Path[] {
        if (ancestor.path === this.path)
            return [];
        if (!ancestor.isAncestorOf(this))
            throw new IllegalArgumentError("Cannot determine intermediate directories to non-ancestor.");

        return this.ancestors.filter(it => !it.isAncestorOf(ancestor));
    }

    /**
     * Returns `true` if and only if this path is an ancestor of the given path.
     *
     * @param path the path to check for ancestorness
     */
    isAncestorOf(path: Path): boolean {
        return path.ancestors.some(path => path.path === this.path);
    }

    /**
     * Returns the string representation of this path.
     *
     * @param escape `true` if and only if special characters should be escaped for use inside strings
     */
    toString(escape: boolean = false): string {
        if (!escape)
            return this.path;

        return this.path
            .replace(/'/g, "&#92;&#92;&#92;&#39;")
            .replace(/"/g, "&#92;&#92;&#92;&#34;")
            .replace(/\s/g, "&#92;&#92;&#32;");
    }
}


/**
 * A node in the file system.
 *
 * Nodes do not know their own name, instead they are similar to how real file systems manage nodes. The name of a node
 * is determined by the directory it is in.
 */
export abstract class Node {
    /**
     * A string describing what kind of node this is.
     *
     * This string is used to determine how to deserialize a JSON string. Yes, this violates the open/closed principle.
     */
    protected abstract type: string;


    /**
     * Returns a deep copy of this node.
     */
    abstract copy(): Node;

    /**
     * Returns a string representation of this node given the name of and path to this node.
     *
     * @param name the name of this node
     * @param path the path to this node
     */
    abstract nameString(name: string, path: Path): string;

    /**
     * Recursively visits all nodes contained within this node.
     *
     * @param path the path to the current node
     * @param fun the function to apply to each node, including this node
     * @param pre the function to apply to the current node before applying the first `fun`
     * @param post the function to apply to the current node after applying the last `fun`
     */
    abstract visit(path: string,
                   fun: (node: Node, path: string) => void,
                   pre: (node: Node, path: string) => void,
                   post: (node: Node, path: string) => void): void;


    /**
     * Returns the JSON deserialization of the given string as a node.
     *
     * This method will automatically detect what kind of node is described by the string and will call the
     * corresponding parse method for that type.
     *
     * @param json a JSON string or object describing a node
     */
    static deserialize(json: string | any): Node {
        if (typeof json === "string") {
            return this.deserialize(JSON.parse(json));
        } else {
            switch (json["type"]) {
                case "Directory":
                    return Directory.parse(json);
                case "File":
                    return File.parse(json);
                case "NullFile":
                    return NullFile.parse(json);
                default:
                    throw `Unknown node type '${json["type"]}'.`;
            }
        }
    }
}

/**
 * A directory that can contain other nodes.
 */
export class Directory extends Node {
    protected type: string = "Directory";

    /**
     * The nodes contained in this directory, indexed by name.
     *
     * The reflexive directory (`"."`) and parent directory (`".."`) are not stored in this field.
     */
    private readonly _nodes: { [name: string]: Node };


    /**
     * Constructs a new directory with the given nodes.
     *
     * @param nodes the nodes the directory should contain; the directory stores a shallow copy of this object
     */
    constructor(nodes: { [name: string]: Node } = {}) {
        super();

        this._nodes = nodes;
    }


    /**
     * Returns a copy of all nodes contained in this directory.
     */
    get nodes(): { [name: string]: Node } {
        return Object.assign({}, this._nodes);
    }

    /**
     * Returns the number of nodes in this directory.
     */
    get nodeCount(): number {
        return Object.keys(this._nodes).length;
    }


    /**
     * Returns the node with the given name, or `undefined` if there is no such node.
     *
     * @param name the name of the node to return
     */
    get(name: string): Node | undefined {
        return this._nodes[name];
    }

    /**
     * Returns `true` if and only if this directory contains a node with the given name.
     *
     * @param name the name to check
     */
    has(name: string): boolean {
        return this._nodes.hasOwnProperty(name);
    }

    /**
     * Adds the given node with the given name to this directory.
     *
     * @param name the name of the node in this directory
     * @param node the node to add to this directory
     */
    add(name: string, node: Node): void {
        if (new Path(`/${name}`).toString() === "/" || name.indexOf("/") >= 0)
            throw new IllegalArgumentError(`Cannot add node with name '${name}'.`);

        this._nodes[name] = node;
    }

    /**
     * Removes the node with the given name.
     *
     * @param name the name of the node to remove
     * @throws if the given node is not contained in this directory
     */
    remove(name: string): void {
        if (name === "" || name === ".") {
            Object.keys(this._nodes).forEach(node => this.remove(node));
            return;
        }

        delete this._nodes[name];
    }


    copy(): Directory {
        const nodes: { [name: string]: Node } = {};
        for (const name in this._nodes)
            nodes[name] = this._nodes[name].copy();

        return new Directory(nodes);
    }

    /**
     * Returns a string that contains an HTML hyperlink that runs a command to `cd` to this directory.
     *
     * @param name the name of this node
     * @param path the path to this node
     */
    nameString(name: string, path: Path): string {
        return `<a href="#" class="dirLink" onclick="execute('cd ${path.toString(true)}');execute('ls')">${name}</a>`;
    }

    visit(path: string,
          fun: (node: Node, path: string) => void,
          pre: (node: Node, path: string) => void = emptyFunction,
          post: (node: Node, path: string) => void = emptyFunction) {
        pre(this, path);

        fun(this, path);
        Object.keys(this._nodes).forEach(name => this._nodes[name].visit(`${path}/${name}`, fun, pre, post));

        post(this, path);
    }


    /**
     * Parses the given object into a directory.
     *
     * The nodes inside the directory of the given object are also recursively parsed by this method.
     *
     * @param obj the object that describes a directory
     */
    static parse(obj: any): Directory {
        if (obj["type"] !== "Directory")
            throw `Cannot deserialize node of type '${obj["type"]}'.`;

        const nodes: { [name: string]: Node } = {};
        for (const name of Object.getOwnPropertyNames(obj["_nodes"]))
            nodes[name] = Node.deserialize(obj["_nodes"][name]);

        return new Directory(nodes);
    }
}

/**
 * A simple file without contents.
 */
export class File extends Node {
    protected type: string = "File";

    /**
     * The contents of this file. !!Do not use this field directly!!
     */
    _contents: string;


    /**
     * Constructs a new file.
     *
     * @param contents the contents of this file
     */
    constructor(contents: string = "") {
        super();

        this._contents = contents;
    }


    /**
     * Returns the contents of this file.
     */
    get contents(): string {
        return this._contents;
    }


    /**
     * Opens an in- and output stream to this file.
     *
     * @param mode the mode in which to open the file
     */
    open(mode: FileMode): FileStream {
        switch (mode) {
            case "append":
                return new FileStream(this, this.contents.length);
            case "read":
                return new FileStream(this, 0);
            case "write":
                this._contents = "";
                return new FileStream(this, 0);
        }
    }


    copy(): File {
        return new File(this.contents);
    }

    nameString(name: string, path: Path): string {
        const extension = getFileExtension(name);
        switch (extension) {
            case "lnk":
            case "pdf":
                const script = `execute('open ${path.toString(true)}'); return false`;
                return `<a href="${this.contents}" class="fileLink" onclick="${script}">${name}</a>`;
            default:
                return name;
        }
    }

    visit(path: string,
          fun: (node: Node, path: string) => void,
          pre: (node: Node, path: string) => void = emptyFunction,
          post: (node: Node, path: string) => void = emptyFunction) {
        pre(this, path);
        fun(this, path);
        post(this, path);
    }


    /**
     * Parses the given object into a file.
     *
     * @param obj the object that describes a file
     */
    static parse(obj: any): File {
        if (obj["type"] !== "File")
            throw `Cannot deserialize node of type '${obj["type"]}'.`;

        return new File(obj["_contents"]);
    }
}

/**
 * A file that cannot have contents.
 */
export class NullFile extends File {
    protected type: string = "NullFile";


    open(mode: "append" | "read" | "write"): FileStream {
        return new class extends FileStream {
            constructor(file: File, pointer: number) {
                super(file, pointer);
            }


            read(count: number | undefined = undefined): string {
                return "";
            }

            write(string: string): void {
                // Do nothing
            }
        }(this, 0);
    }


    /**
     * Parses the given object into a null file.
     *
     * @param obj the object that describes a file
     */
    static parse(obj: any): NullFile {
        if (obj["type"] !== "File")
            throw `Cannot deserialize node of type '${obj["type"]}'.`;

        return new NullFile();
    }
}


/**
 * The mode to open a file in.
 */
export type FileMode = "append" | "read" | "write";

/**
 * An in- and output stream for a file.
 */
export class FileStream extends Stream {
    private readonly file: File;
    private pointer: number;


    /**
     * A stream to interact with the contents of a file.
     *
     * @param file the file to open a stream to
     * @param pointer the index in the file to start the stream at
     */
    constructor(file: File, pointer: number = 0) {
        if (pointer < 0)
            throw new IllegalArgumentError("File pointer must be non-negative.");
        if (pointer > file.contents.length)
            throw new IllegalArgumentError("File pointer should not exceed file's size.");

        super();

        this.file = file;
        this.pointer = pointer;
    }


    protected get buffer(): string {
        return this.file.contents.slice(this.pointer);
    }


    read(count: number | undefined = undefined): string {
        const input = this.peek(count ?? this.buffer.length);
        this.pointer += input.length;
        return input;
    }

    write(string: string): void {
        const pre = this.file.contents.slice(0, this.pointer);
        const post = this.buffer.slice(string.length);

        this.file._contents = pre + string + post;
    }
}
