import {emptyFunction, getFileExtension, IllegalArgumentError, IllegalStateError} from "./Shared";


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
            this.root = new Directory({
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
        if (!this.has(target.parent)) {
            if (createParents)
                this.add(target.parent, new Directory(), true);
            else
                throw new IllegalArgumentError(`The directory '${target.parent}' does not exist.`);
        }

        const parent = this.get(target.parent);
        if (!(parent instanceof Directory))
            throw new IllegalArgumentError(`'${target.parent}' is not a directory.`);
        if (parent.hasNode(target.fileName))
            throw new IllegalArgumentError(`A file or directory already exists at '${target}'.`);

        parent.addNode(target.fileName, node);
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
        if (destination.ancestors.indexOf(source) >= 0)
            throw new IllegalArgumentError("Cannot move directory into itself.");

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
        if (!(parent instanceof Directory) || !parent.hasNode(target.fileName))
            return undefined;

        return parent.getNode(target.fileName);
    }

    /**
     * Returns `true` if and only if there exists a node at the given path.
     *
     * @param target the path to check for node presence
     */
    has(target: Path): boolean {
        if (target.toString() === "/")
            return true;

        const parent = this.get(target.parent);
        if (!(parent instanceof Directory))
            return false;

        return parent.hasNode(target.fileName);
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
        if (destination.ancestors.indexOf(source) >= 0)
            throw new IllegalArgumentError("Cannot move directory into itself.");

        const sourceNode = this.get(source);
        if (sourceNode === undefined)
            throw new IllegalArgumentError(`File or directory '${source}' does not exist.`);

        this.add(destination, sourceNode, false);
        this.remove(source, true, true, false);
    }

    /**
     * Removes a node from the file system.
     *
     * @param targetPath the path to the node to be removed
     * @param force if inability to remove a file should be ignored
     * @param recursive if the target should be deleted even if it's a non-empty directory
     * @param noPreserveRoot `true` if and only if the root directory should be deletable
     * @throws if the node to remove does not exist and `force` is `false`
     */
    remove(targetPath: Path, force: boolean, recursive: boolean, noPreserveRoot: boolean): void {
        const target = this.get(targetPath);
        if (target === undefined) {
            if (force)
                return;
            else
                throw new IllegalArgumentError(`The file or directory '${targetPath}' does not exist.`);
        }

        const parent = this.get(targetPath.parent);
        if (!(parent instanceof Directory))
            throw new IllegalStateError(`'${targetPath.parent}' is not a directory, but its child exists.`);

        if (target instanceof Directory) {
            if (targetPath.toString() === "/" && !noPreserveRoot)
                throw new IllegalArgumentError(`Cannot remove root directory.`);
            if (target.nodeCount !== 0 && !recursive)
                throw new IllegalArgumentError(`'${targetPath} is a non-empty directory.'`);
        }

        parent.removeNode(targetPath.fileName);
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
     * Constructs a new path.
     *
     * @param paths a string that describes the path
     */
    constructor(...paths: string[]) {
        this.path = `/${paths.join("/")}/`
            .replaceAll(/\/\.\//, "/") // Replace `/./` with `/`
            .replaceAll(/(\/+)([^./]+)(\/+)(\.\.)(\/+)/, "/") // Replace `/x/../` with `/`
            .replaceAll(/\/{2,}/, "/") // Replace `//` with `/`
            .replaceAll(/^\/\.\.\//, "/") // Replace `/../` at start with `/`
            .replace(/(.)\/$/, "$1"); // Remove trailing `/` if not last character

        const parts = this.path.split("/");
        this._parent = parts.slice(0, -1).join("/");
        this.fileName = parts.slice(-1).join("");
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
     * Returns the string representation of this path.
     *
     * @param escape `true` if and only if special characters should be escaped for use inside strings
     */
    toString(escape: boolean = false): string {
        if (!escape)
            return this.path;

        return this.path
            .replaceAll(/'/, "&#92;&#92;&#92;&#39;")
            .replaceAll(/"/, "&#92;&#92;&#92;&#34;")
            .replaceAll(/\s/, "&#92;&#92;&#32;");
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
     * Returns the node with the given name.
     *
     * @param name the name of the node to return
     * @throws when there is no node with the given name in this directory
     */
    getNode(name: string): Node {
        if (!this.hasNode(name))
            throw new IllegalArgumentError(`Directory does not have a node with name '${name}'.`);

        return this._nodes[name];
    }

    /**
     * Returns `true` if and only if this directory contains a node with the given name or the name refers to this
     * directory.
     *
     * @param name the name to check
     */
    hasNode(name: string): boolean {
        if (name === "." || name === ".." || new Path(`/${name}`).toString() === "/")
            return true;

        return this._nodes.hasOwnProperty(name);
    }

    /**
     * Adds the given node with the given name to this directory.
     *
     * @param name the name of the node in this directory
     * @param node the node to add to this directory
     */
    addNode(name: string, node: Node): void {
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
    removeNode(name: string): void {
        if (name === "" || name === ".") {
            Object.keys(this._nodes).forEach(node => this.removeNode(node));
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
     * The link to the external resource.
     */
    contents: string;


    /**
     * Constructs a new file.
     */
    constructor(contents: string = "") {
        super();

        this.contents = contents;
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

        return new File(obj["contents"]);
    }
}
