import {emptyFunction} from "./shared.js";


/**
 * A file system.
 */
export class FileSystem {
    /**
     * The current working directory.
     */
    private _pwd: string;
    /**
     * The root directory.
     */
    private root: Directory;
    /**
     * The current directory.
     */
    private files: Directory;


    /**
     * Constructs a new file system.
     */
    constructor() {
        this._pwd = "/";
        this.root = new Directory({
            personal: new Directory({
                steam: new UrlFile("https://steamcommunity.com/id/Waflix"),
                nukapedia: new UrlFile("http://fallout.wikia.com/wiki/User:FDekker"),
                blog: new UrlFile("https://blog.fwdekker.com/"),
            }),
            projects: new Directory({
                randomness: new UrlFile("https://github.com/FWDekker/intellij-randomness"),
                schaapi: new UrlFile("http://cafejojo.org/schaapi"),
                gitea: new UrlFile("https://git.fwdekker.com/explore/"),
                github: new UrlFile("https://github.com/FWDekker/"),
            }),
            social: new Directory({
                github: new UrlFile("https://github.com/FWDekker/"),
                stackoverflow: new UrlFile("https://stackoverflow.com/u/3307872"),
                linkedin: new UrlFile("https://www.linkedin.com/in/fwdekker/")
            }),
            "resume.pdf": new UrlFile("https://static.fwdekker.com/misc/resume.pdf")
        });
        this.files = this.root;
    }


    /**
     * Returns the current working directory.
     *
     * @return the current working directory
     */
    get pwd(): string {
        return this._pwd;
    }


    /**
     * Returns the node at the given path.
     *
     * @param pathString the path of the node to return; interpreted as a relative path unless it starts with a `/`
     * @return the node at the given path
     */
    getNode(pathString: string): Node {
        const path = new Path(this._pwd, pathString);

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
     * Sets the current working directory to the root directory.
     */
    reset(): void {
        this._pwd = "/";
        this.files = this.root;
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
     * @returns {string} an empty string if the change was successful, or an error message explaining what went wrong
     */
    cd(pathString: string): string {
        if (pathString === undefined)
            return "";

        const path = new Path(this._pwd, pathString);

        const node = this.getNode(path.path);
        if (node === undefined)
            return `The directory '${path.path}' does not exist`;
        if (!(node instanceof Directory))
            return `'${path.path}' is not a directory.`;

        this._pwd = path.path;
        this.files = node;
        return "";
    }

    /**
     * Creates an empty file at {@code path} if it does not exist.
     *
     * @param pathString the path to create a file at if it does not exist
     * @returns {string} an empty string if the removal was successful, or a message explaining what went wrong
     */
    private createFile(pathString: string): string {
        const path = new Path(this._pwd, pathString);

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
     * @returns {string} the warnings generated during creation of the files
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
     * @param sourceString {string} the absolute or relative path to the file or directory to copy
     * @param destinationString {string} the absolute or relative path to the destination
     * @returns {string} an empty string if the copy was successful, or a message explaining what went wrong
     */
    cp(sourceString: string, destinationString: string): string {
        const sourcePath = new Path(this._pwd, sourceString);
        const sourceTailNode = this.getNode(sourcePath.path);

        const destinationPath = new Path(this._pwd, destinationString);
        const destinationHeadNode = this.getNode(destinationPath.head);
        const destinationTailNode = this.getNode(destinationPath.path);

        if (sourceTailNode === undefined)
            return `The file '${sourcePath.path}' does not exist`;
        if (!(sourceTailNode instanceof File))
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
     * @returns {Object} the directory at {@code path}, or the current directory if no path is given
     */
    ls(pathString: string): string {
        const path = new Path(this._pwd, pathString);

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
     * @returns {string} an empty string if the removal was successful, or a message explaining what went wrong
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
     * @returns {string} the warnings generated during creation of the directories
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
     * @returns {string} an empty string if the move was successful, or a message explaining what went wrong
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
     * @returns {string} an empty string if the removal was successful, or a message explaining what went wrong
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
     * @returns {string} the warnings generated during removal of the directories
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
     * @returns {string} an empty string if the removal was successful, or a message explaining what went wrong
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
     * @returns {string} the warnings generated during removal of the directories
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
}

// TODO Remove the parent directory because directories should be true "nodes" just like files are!
/**
 * A directory that can contain other nodes.
 */
export class Directory extends Node {
    /**
     * The nodes contained in this directory, indexed by name.
     *
     * The reflexive directory (`"."`) and parent directory (`".."`) are not stored in this field.
     */
    private readonly _nodes: { [key: string]: Node };
    // noinspection TypeScriptFieldCanBeMadeReadonly
    /**
     * The parent directory of this node.
     */
    private _parent: Directory;


    /**
     * Constructs a new directory with the given nodes.
     *
     * The parent of each given node is set to this directory. The parent of this directory is itself by default.
     *
     * @param nodes the nodes the directory should contain
     */
    constructor(nodes: { [key: string]: Node } = {}) {
        super();

        this._parent = this;
        this._nodes = nodes;

        Object.values(this._nodes)
            .forEach(node => {
                if (node instanceof Directory) node._parent = this;
            });
    }


    /**
     * Returns a copy of all nodes contained in this directory.
     *
     * @return a copy of all nodes contained in this directory
     */
    get nodes(): { [key: string]: Node } {
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
     * Returns the parent directory of this node.
     *
     * @return the parent directory of this node
     */
    get parent(): Directory {
        return this._parent;
    }


    /**
     * Returns the node with the given name.
     *
     * @param name the name of the node to return
     * @throws when there is no node with the given name in this directory
     */
    getNode(name: string): Node {
        switch (name) {
            case ".":
                return this;
            case "..":
                return this._parent;
            default:
                return this._nodes[name];
        }
    }

    /**
     * Adds the given node with the given name to this directory.
     *
     * If the given node is a directory, its parent is set to this directory.
     *
     * @param name the name of the node in this directory
     * @param node the node to add to this directory
     */
    addNode(name: string, node: Node): void {
        if (node instanceof Directory)
            node._parent = this;

        this._nodes[name] = node;
    }

    // TODO Check if this one works
    /**
     * Removes the given node or the node with the given name.
     *
     * @param nodeOrName the node to remove or the name of the node to remove
     * @throws if the given node is not contained in this directory
     */
    removeNode(nodeOrName: Node | string): void {
        if (nodeOrName instanceof Node) {
            const name = Object.keys(this._nodes).find(key => this._nodes[key] === nodeOrName);
            if (name === undefined)
                throw `Could not remove node '${nodeOrName}'.`;

            delete this._nodes[name];
        } else {
            delete this._nodes[name];
        }
    }


    copy(): Directory {
        return new Directory(this.nodes);
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
}

/**
 * A simple file without contents.
 */
export class File extends Node {
    /**
     * Constructs a new file.
     */
    constructor() {
        super();
    }


    copy(): File {
        return new File();
    }

    nameString(name: string): string {
        return name;
    }

    visit(fun: (node: Node) => void,
          pre: (node: Node) => void = emptyFunction,
          post: (node: Node) => void = emptyFunction) {
        pre(this);
        fun(this);
        post(this);
    }
}

/**
 * A file that contains a link to an external resource.
 */
export class UrlFile extends File {
    /**
     * The link to the external resource.
     */
    readonly url: string;


    /**
     * Constructs a new link.
     *
     * @param url the link to the external resource
     */
    constructor(url: string) {
        super();

        this.url = url;
    }


    copy(): UrlFile {
        return new UrlFile(this.url);
    }

    nameString(name: string): string {
        return `<a href="${this.url}" class="fileLink">${name}</a>`;
    }
}
