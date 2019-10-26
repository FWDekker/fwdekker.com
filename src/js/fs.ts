import {emptyFunction} from "./shared.js";


export class FileSystem {
    private _pwd: string;
    private root: Directory;
    private files: Directory;


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


    get pwd(): string {
        return this._pwd;
    }


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
     * Resets navigation in the file system.
     */
    reset(): void {
        this._pwd = "/";
        this.files = this.root;
    }


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
            .sortAlphabetically((x) => x)
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


export class Path {
    private readonly _parts: string[];
    readonly path: string;
    readonly head: string;
    readonly tail: string;


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
        this.head = this.parts.slice(0, -2).join("/");
        this.tail = this.parts.slice(0, -1).slice(-1).join("/");
    }


    get parts(): string[] {
        return this._parts.slice();
    }
}

export abstract class Node {
    abstract copy(): Node;

    abstract nameString(name: string): string;

    abstract visit(fun: (node: Node) => void, pre: (node: Node) => void, post: (node: Node) => void): void;
}

export class Directory extends Node {
    private readonly _nodes: { [key: string]: Node };
    // noinspection TypeScriptFieldCanBeMadeReadonly: False positive
    private _parent: Directory;


    constructor(nodes: { [key: string]: Node } = {}) {
        super();

        this._parent = this;
        this._nodes = nodes;

        Object.values(this._nodes)
            .forEach(node => {
                if (node instanceof Directory) node._parent = this;
            });
    }


    get nodes(): { [key: string]: Node } {
        return Object.assign({}, this._nodes);
    }

    get nodeCount(): number {
        return Object.keys(this._nodes).length;
    }

    get parent(): Directory {
        return this._parent;
    }


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

    addNode(name: string, node: Node) {
        if (node instanceof Directory)
            node._parent = this;

        this._nodes[name] = node;
    }

    removeNode(nodeOrName: Node | string) {
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

export class File extends Node {
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

export class UrlFile extends File {
    readonly url: string;


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
