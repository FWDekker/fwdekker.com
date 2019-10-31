import {emptyFunction, getFileExtension} from "./shared.js";


/**
 * A file system.
 */
export class FileSystem {
    /**
     * The root directory.
     */
    private root: Directory;
    /**
     * The current directory.
     */
    private files: Directory;
    /**
     * The current working directory.
     */
    private _cwd: string;


    /**
     * Constructs a new file system.
     *
     * @param json a serialization of the root node that should be parsed and used as the file system's contents
     * @param cwd the desired initial current working directory
     * @throws if the given serialization string is invalid or the desired initial current working directory does not
     * point to an existing directory
     */
    constructor(json: string | undefined = undefined, cwd: string | undefined = undefined) {
        if (json === undefined) {
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
        } else {
            const parsedJson = Node.deserialize(json);
            if (!(parsedJson instanceof Directory))
                throw "Cannot set non-directory as file system root.";
            this.root = parsedJson;
        }

        this._cwd = "/";
        this.files = this.root;

        if (cwd !== undefined)
            this.cwd = cwd; // Overwrites defaults above
    }


    /**
     * Returns the current working directory.
     *
     * @return the current working directory
     */
    get cwd(): string {
        return this._cwd;
    }

    /**
     * Sets the current working directory.
     *
     * @param cwd the desired current working directory
     * @throws if the desired current working directory does not point to an existing directory
     */
    set cwd(cwd: string) {
        cwd = new Path(cwd).path; // Shorten path

        const target = this.getNode(cwd);
        if (!(target instanceof Directory))
            throw `The directory \`${cwd}\` does not exist.`;

        this._cwd = cwd;
        this.files = target;
    }

    /**
     * Returns the JSON serialization of the root node.
     *
     * @return the JSON serialization of the root node
     */
    get serializedRoot(): string {
        return this.root.serialize();
    }


    /**
     * Returns the node at the given path.
     *
     * @param pathString the path of the node to return; interpreted as a relative path unless it starts with a `/`
     * @return the node at the given path
     */
    getNode(pathString: string): Node {
        const path = new Path(this._cwd, pathString);

        let node: Node = this.root;
        path.parts.forEach(part => {
            if (part === "" || node === undefined || node instanceof File)
                return;

            if (node instanceof Directory)
                node = node.getNode(part);
            else
                throw "Node must be file or directory.";
        });

        return node;
    }


    /**
     * Executes the given function for each string in the given array.
     *
     * @param inputs the inputs to process using the given function
     * @param fun the function to execute on each string in the given array
     * @return the concatenation of outputs of the given function, separated by newlines
     */
    private executeForEach(inputs: string[], fun: (_: string) => string): string {
        const outputs: string[] = [];

        inputs.forEach(input => {
            const output = fun(input);

            if (output !== "")
                outputs.push(output);
        });

        return outputs.join("\n");
    }

    /**
     * Changes the current directory to {@code path}, if it exists.
     *
     * @param pathString the absolute or relative path to change the current directory to
     * @return an empty string if the change was successful, or an error message explaining what went wrong
     */
    cd(pathString: string | undefined): string {
        if (pathString === undefined)
            return "";

        const path = new Path(this._cwd, pathString);

        const node = this.getNode(path.path);
        if (node === undefined)
            return `The directory '${path.path}' does not exist`;
        if (!(node instanceof Directory))
            return `'${path.path}' is not a directory.`;

        this._cwd = path.path;
        this.files = node;
        return "";
    }

    /**
     * Creates an empty file at {@code path} if it does not exist.
     *
     * @param pathString the path to create a file at if it does not exist
     * @return an empty string if the removal was successful, or a message explaining what went wrong
     */
    private createFile(pathString: string): string {
        const path = new Path(this._cwd, pathString);

        const headNode = this.getNode(path.head);
        if (headNode === undefined)
            return `The directory '${path.head}' does not exist`;
        if (!(headNode instanceof Directory))
            return `${path.head} is not a directory`;

        const tailNode = headNode.getNode(path.tail);
        if (tailNode !== undefined)
            return ""; // File already exists

        headNode.addNode(path.tail, new File());
        return "";
    }

    /**
     * Calls {@link createFile} on all elements in {@code paths}.
     *
     * @param paths {string[]} the absolute or relative paths to the files to be created
     * @return the warnings generated during creation of the files
     */
    createFiles(paths: string[]): string {
        return this.executeForEach(paths, path => this.createFile(path));
    }

    /**
     * Copies {@code source} to {@code destination}.
     *
     * If the destination does not exist, the source will be copied to that exact location. If the destination exists
     * and is a directory, the source will be copied into the directory. If the destination exists but is not a
     * directory, the copy will fail.
     *
     * @param sourceString the absolute or relative path to the file or directory to copy
     * @param destinationString the absolute or relative path to the destination
     * @param isRecursive if copying should happen recursively if the source is a directory
     * @return an empty string if the copy was successful, or a message explaining what went wrong
     */
    cp(sourceString: string, destinationString: string, isRecursive: boolean): string {
        const sourcePath = new Path(this._cwd, sourceString);
        const sourceTailNode = this.getNode(sourcePath.path);

        const destinationPath = new Path(this._cwd, destinationString);
        const destinationHeadNode = this.getNode(destinationPath.head);
        const destinationTailNode = this.getNode(destinationPath.path);

        if (sourceTailNode === undefined)
            return `The file '${sourcePath.path}' does not exist`;
        if (!(sourceTailNode instanceof File) && !isRecursive)
            return `Cannot copy directory.`;
        if (destinationHeadNode === undefined)
            return `The directory '${destinationPath.head}' does not exist`;

        let targetNode;
        let targetName;
        if (destinationTailNode === undefined) {
            if (!(destinationHeadNode instanceof Directory))
                return `The path '${destinationPath.head}' does not point to a directory`;

            targetNode = destinationHeadNode;
            targetName = destinationPath.tail;
        } else {
            if (!(destinationTailNode instanceof Directory))
                return `The path '${destinationPath.tail}' does not point to a directory`;

            targetNode = destinationTailNode;
            targetName = sourcePath.tail;
        }

        if (targetNode.getNode(targetName) !== undefined)
            return `The file '${targetName}' already exists`;

        targetNode.addNode(targetName, sourceTailNode.copy());

        return "";
    }

    /**
     * Returns the directory at {@code path}, or the current directory if no path is given.
     *
     * @param pathString {string} the absolute or relative path to the directory to return
     * @return the directory at {@code path}, or the current directory if no path is given
     */
    ls(pathString: string): string {
        const path = new Path(this._cwd, pathString);

        const node = this.getNode(path.path);
        if (node === undefined)
            return `The directory '${path.path}' does not exist`;
        if (!(node instanceof Directory))
            return `'${path.path}' is not a directory`;

        const dirList = [new Directory({}).nameString("."), new Directory({}).nameString("..")];
        const fileList: string[] = [];

        const nodes = node.nodes;
        Object.keys(nodes)
            .sortAlphabetically((x) => x, false)
            .forEach(name => {
                const node = nodes[name];

                if (node instanceof Directory)
                    dirList.push(node.nameString(name));
                else if (node instanceof File)
                    fileList.push(node.nameString(name));
                else
                    throw `${name} is neither a file nor a directory!`;
            });

        return dirList.concat(fileList).join("\n");
    }

    /**
     * Creates an empty directory in the file system.
     *
     * @param pathString {string} the absolute or relative path to the directory to create
     * @return an empty string if the removal was successful, or a message explaining what went wrong
     */
    private mkdir(pathString: string): string {
        const path = new Path(pathString);

        const headNode = this.getNode(path.head);
        if (headNode === undefined)
            return `The directory '${path.head}' does not exist`;
        if (!(headNode instanceof Directory))
            return `'${path.head}' is not a directory`;
        if (headNode.getNode(path.tail))
            return `The directory '${path.tail}' already exists`;

        headNode.addNode(path.tail, new Directory());
        return "";
    }

    /**
     * Calls {@link mkdir} on all elements in {@code paths}.
     *
     * @param paths {string[]} the absolute or relative paths to the directories to create
     * @return the warnings generated during creation of the directories
     */
    mkdirs(paths: string[]): string {
        return this.executeForEach(paths, this.mkdir.bind(this));
    }

    /**
     * Moves {@code source} to {@code destination}.
     *
     * If the destination does not exist, the source will be moved to that exact location. If the destination exists and
     * is a directory, the source will be moved into the directory. If the destination exists but is not a directory,
     * the move will fail.
     *
     * @param sourceString {string} the absolute or relative path to the file or directory to move
     * @param destinationString {string} the absolute or relative path to the destination
     * @return an empty string if the move was successful, or a message explaining what went wrong
     */
    mv(sourceString: string, destinationString: string): string {
        const sourcePath = new Path(sourceString);
        const sourceHeadNode = this.getNode(sourcePath.head);
        const sourceTailNode = this.getNode(sourcePath.path);

        const destinationPath = new Path(destinationString);
        const destinationHeadNode = this.getNode(destinationPath.head);
        const destinationTailNode = this.getNode(destinationPath.path);

        if (!(sourceHeadNode instanceof Directory))
            return `The path '${sourcePath.head}' does not point to a directory`;
        if (sourceTailNode === undefined)
            return `The file '${sourcePath.path}' does not exist`;
        if (destinationHeadNode === undefined)
            return `The directory '${destinationPath.head}' does not exist`;

        let targetNode;
        let targetName;
        if (destinationTailNode === undefined) {
            if (!(destinationHeadNode instanceof Directory))
                return `The path '${destinationPath.head}' does not point to a directory`;

            targetNode = destinationHeadNode;
            targetName = destinationPath.tail;
        } else {
            if (!(destinationTailNode instanceof Directory))
                return `The path '${destinationPath.tail}' does not point to a directory`;

            targetNode = destinationTailNode;
            targetName = sourcePath.tail;
        }

        if (targetNode.getNode(targetName) !== undefined)
            return `The file '${targetName}' already exists`;

        sourceHeadNode.removeNode(sourceTailNode);
        targetNode.addNode(targetName, sourceTailNode);

        return "";
    }

    /**
     * Removes a file from the file system.
     *
     * @param pathString {string} the absolute or relative path to the file to be removed
     * @param force {boolean} true if no warnings should be given if removal is unsuccessful
     * @param recursive {boolean} true if files and directories should be removed recursively
     * @param noPreserveRoot {boolean} false if the root directory should not be removed
     * @return an empty string if the removal was successful, or a message explaining what went wrong
     */
    private rm(pathString: string, force: boolean = false, recursive: boolean = false, noPreserveRoot: boolean = false): string {
        const path = new Path(pathString);

        const parentNode = this.getNode(path.head);
        if (parentNode === undefined)
            return force
                ? ""
                : `The directory '${path.head}' does not exist`;
        if (!(parentNode instanceof Directory))
            return force
                ? ""
                : `'${path.head}' is not a directory`;

        const childNode = this.getNode(path.path);
        if (childNode === undefined)
            return force
                ? ""
                : `The file '${path.path}' does not exist`;

        if (recursive) {
            if (path.path === "/")
                if (noPreserveRoot)
                    this.root = new Directory();
                else
                    return "'/' cannot be removed";
            else
                parentNode.removeNode(childNode);
        } else {
            if (!(childNode instanceof File))
                return force
                    ? ""
                    : `'${path.tail}' is not a file`;

            parentNode.removeNode(childNode);
        }
        return "";
    }

    /**
     * Calls {@link rm} on all elements in {@code paths}.
     *
     * @param paths {string} the absolute or relative paths to the files to be removed
     * @param force {boolean} true if no warnings should be given if removal is unsuccessful
     * @param recursive {boolean} true if files and directories should be removed recursively
     * @param noPreserveRoot {boolean} false if the root directory should not be removed
     * @return the warnings generated during removal of the directories
     */
    rms(paths: string[], force: boolean = false, recursive: boolean = false, noPreserveRoot: boolean = false): string {
        return this.executeForEach(paths, path => {
            return this.rm(path, force, recursive, noPreserveRoot);
        });
    }

    /**
     * Removes a directory from the file system.
     *
     * @param pathString {string} the absolute or relative path to the directory to be removed
     * @return an empty string if the removal was successful, or a message explaining what went wrong
     */
    private rmdir(pathString: string): string {
        const path = new Path(pathString);

        if (path.path === "/") {
            if (this.root.nodeCount > 0)
                return `The directory is not empty.`;
            else
                return "";
        }

        const parentDir = this.getNode(path.head);
        if (parentDir === undefined)
            return `The directory '${path.head}' does not exist`;
        if (!(parentDir instanceof Directory))
            return `'${path.head}' is not a directory`;

        const childDir = parentDir.getNode(path.tail);
        if (childDir === undefined)
            return `The directory '${path.tail}' does not exist`;
        if (!(childDir instanceof Directory))
            return `'${path.tail}' is not a directory`;
        if (childDir.nodeCount > 0)
            return `The directory is not empty`;

        parentDir.removeNode(childDir);
        return "";
    }

    /**
     * Calls {@link rmdir} on all elements in {@code paths}.
     *
     * @param paths {string[]} the absolute or relative paths to the directories to be removed
     * @return the warnings generated during removal of the directories
     */
    rmdirs(paths: string[]): string {
        return this.executeForEach(paths, path => this.rmdir(path));
    }
}


// TODO Write tests for this class
/**
 * A path to a node in the file system.
 */
export class Path {
    /**
     * The parts of the absolute path, resulting from splitting `this.path` by `/`.
     */
    private readonly _parts: string[];
    /**
     * The full absolute path to the node.
     */
    readonly path: string;
    /**
     * The name of the parent, i.e. the part before the last `/` in `this.path`.
     */
    readonly head: string;
    /**
     * The name of the node, i.e. the part after the last `/` in `this.path`.
     */
    readonly tail: string;


    /**
     * Constructs a new path.
     *
     * @param currentPath the absolute path
     * @param relativePath the relative path to append to `currentPath`, or an absolute path if it starts with a `/`,
     * in which case `currentPath` is ignored
     */
    constructor(currentPath: string, relativePath: string | undefined = undefined) {
        let path;
        if (relativePath === undefined)
            path = currentPath;
        else if (relativePath.startsWith("/"))
            path = relativePath;
        else
            path = `${currentPath}/${relativePath}`;

        this.path = `${path}/`
            .replaceAll(/\/\.\//, "/")
            .replaceAll(/(\/+)([^./]+)(\/+)(\.\.)(\/+)/, "/")
            .replaceAll(/\/{2,}/, "/")
            .replace(/^\/?\.?\.\/$/, "/")
            .toString();

        this._parts = this.path.split("/");
        this.head = this.parts.slice(0, -2).join("/"); // TODO Turn this into a getter
        this.tail = this.parts.slice(0, -1).slice(-1).join("/"); // TODO Turn this into a getter
    }


    /**
     * Returns a copy of the parts of the path.
     *
     * @return a copy of the parts of the path
     */
    get parts(): string[] {
        return this._parts.slice();
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
     * Returns a string representation of this node given the name of this node.
     *
     * @param name the name of this node
     * @return a string representation of this node given the name of this node
     */
    abstract nameString(name: string): string;

    /**
     * Recursively visits all nodes contained within this node.
     *
     * @param fun the function to apply to each node, including this node
     * @param pre the function to apply to the current node before applying the first `fun`
     * @param post the function to apply to the current node after applying the last `fun`
     */
    abstract visit(fun: (node: Node) => void, pre: (node: Node) => void, post: (node: Node) => void): void;


    /**
     * Returns the JSON serialization of this node.
     *
     * @return the JSON serialization of this node
     */
    serialize(): string {
        return JSON.stringify(this);
    }

    /**
     * Returns the JSON deserialization of the given string as a node.
     *
     * This method will automatically detect what kind of node is described by the string and will call the
     * corresponding parse method for that type.
     *
     * @param json a JSON string or object describing a node
     * @return the JSON deserialization of the given string as a node
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
                    throw `Unknown node type \`${json["type"]}\`.`;
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

        this._nodes = Object.assign({}, nodes);
    }


    /**
     * Returns a copy of all nodes contained in this directory.
     *
     * @return a copy of all nodes contained in this directory
     */
    get nodes(): { [name: string]: Node } {
        return Object.assign({}, this._nodes);
    }

    /**
     * Returns the number of nodes in this directory.
     *
     * @return the number of nodes in this directory
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
        return this._nodes[name];
    }

    /**
     * Adds the given node with the given name to this directory.
     *
     * @param name the name of the node in this directory
     * @param node the node to add to this directory
     */
    addNode(name: string, node: Node): void {
        this._nodes[name] = node;
    }

    /**
     * Removes the given node or the node with the given name.
     *
     * @param nodeOrName the node to remove or the name of the node to remove
     * @throws if the given node is not contained in this directory
     */
    removeNode(nodeOrName: Node | string): void {
        if (nodeOrName instanceof Node) {
            const name = Object.keys(this._nodes).find(name => this._nodes[name] === nodeOrName);
            if (name === undefined)
                throw `Could not remove node '${nodeOrName}'.`;

            delete this._nodes[name];
        } else {
            delete this._nodes[name];
        }
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
     * @return a string that contains an HTML hyperlink that runs a command to `cd` to this directory
     */
    nameString(name: string): string {
        // @ts-ignore: Defined in `terminal.ts`
        return `<a href="#" class="dirLink" onclick="run('cd ${relToAbs(name)}/');run('ls');">${name}/</a>`;
    }

    visit(fun: (node: Node) => void,
          pre: (node: Node) => void = emptyFunction,
          post: (node: Node) => void = emptyFunction) {
        pre(this);

        fun(this);
        Object.keys(this._nodes).forEach(name => this._nodes[name].visit(fun, pre, post));

        post(this);
    }


    /**
     * Parses the given object into a directory.
     *
     * The nodes inside the directory of the given object are also recursively parsed by this method.
     *
     * @param obj the object that describes a directory
     * @return the directory described by the given object
     */
    static parse(obj: any): Directory {
        if (obj["type"] !== "Directory")
            throw `Cannot deserialize node of type \`${obj["type"]}\`.`;

        const nodes: { [name: string]: Node } = {};
        for (const name in obj["_nodes"])
            if (obj["_nodes"].hasOwnProperty(name))
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
    readonly contents: string;


    /**
     * Constructs a new file.
     */
    constructor(contents: string = "") {
        super();

        this.contents = contents;
    }


    copy(): File {
        return new File();
    }

    nameString(name: string): string {
        const extension = getFileExtension(name);
        switch (extension) {
            case "lnk":
            case "pdf":
                return `<a href="${this.contents}" class="fileLink">${name}</a>`;
            default:
                return name;
        }
    }

    visit(fun: (node: Node) => void,
          pre: (node: Node) => void = emptyFunction,
          post: (node: Node) => void = emptyFunction) {
        pre(this);
        fun(this);
        post(this);
    }


    /**
     * Parses the given object into a file.
     *
     * @param obj the object that describes a file
     * @return the file described by the given object
     */
    static parse(obj: any): File {
        if (obj["type"] !== "File")
            throw `Cannot deserialize node of type \`${obj["type"]}\`.`;

        return new File(obj["contents"]);
    }
}
