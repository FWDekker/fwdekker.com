import {emptyFunction, getFileExtension, IllegalStateError} from "./Shared";


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
    private _cwd: Path;


    /**
     * Constructs a new file system.
     *
     * @param root the directory to set as the root
     */
    constructor(root: Directory | undefined = undefined) {
        if (root === undefined) {
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
            this.root = root;
        }

        this._cwd = new Path("/");
        this.files = this.root;
    }


    /**
     * Returns the current working directory.
     *
     * @return the current working directory
     */
    get cwd(): string {
        return this._cwd.toString();
    }

    /**
     * Sets the current working directory.
     *
     * @param cwd the desired current working directory
     * @throws if the desired current working directory does not point to an existing directory
     */
    set cwd(cwd: string) {
        const path = new Path(cwd);

        const target = this.getNode(path);
        if (!(target instanceof Directory))
            throw `The directory \`${path}\` does not exist.`;

        this._cwd = path;
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
     * Converts a string to a path.
     *
     * @param path the string to convert; strings starting with `/` are interpreted as absolute paths and other strings
     * s strings relative to the current working directory
     * @return the path corresponding to the given string
     */
    getPathTo(path: string): Path {
        if (path.startsWith("/"))
            return new Path(path);

        return this._cwd.getChild(path);
    }

    /**
     * Returns the node at the given path.
     *
     * @param target the path of the node to return; strings starting with `/` are interpreted as absolute paths and
     * other strings as strings relative to the current working directory
     * @return the node at the given path
     */
    getNode(target: string | Path): Node {
        if (typeof target === "string")
            target = this.getPathTo(target);

        const parts = target.toString().split("/");
        let node: Node = this.root;
        parts.forEach(part => {
            if (part === "" || node === undefined || node instanceof File)
                return;

            if (node instanceof Directory)
                node = node.getNode(part);
            else
                throw new IllegalStateError("Node must be file or directory.");
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

        const path = this.getPathTo(pathString);

        const node = this.getNode(path);
        if (node === undefined)
            return `The directory '${path}' does not exist`;
        if (!(node instanceof Directory))
            return `'${path}' is not a directory.`;

        this.cwd = path.toString();
        return "";
    }

    /**
     * Creates an empty file at `path` if it does not exist.
     *
     * @param pathString the path to create a file at if it does not exist
     * @return an empty string if the removal was successful, or a message explaining what went wrong
     */
    private createFile(pathString: string): string {
        const path = this.getPathTo(pathString);

        const parent = this.getNode(path.parent);
        if (parent === undefined)
            return `The directory '${path.parent}' does not exist`;
        if (!(parent instanceof Directory))
            return `${path.parent} is not a directory`;
        if (parent.hasNode(path.fileName))
            return ""; // File already exists

        parent.addNode(path.fileName, new File());
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
        const sourcePath = this.getPathTo(sourceString);
        const sourceNode = this.getNode(sourcePath);

        const destinationPath = this.getPathTo(destinationString);
        const destinationNode = this.getNode(destinationPath);
        const destinationParentNode = this.getNode(destinationPath.parent);

        if (sourceNode === undefined)
            return `The file '${sourcePath}' does not exist`;
        if (!(sourceNode instanceof File) && !isRecursive)
            return `Cannot copy directory.`;
        if (destinationParentNode === undefined)
            return `The directory '${destinationPath.parent}' does not exist`;

        let targetPath: Path;
        let targetParentNode: Directory;
        if (destinationNode === undefined) {
            // Target does not exist, so user wants to copy into target, not retaining the source's name
            if (!(destinationParentNode instanceof Directory))
                return `The path '${destinationPath.parent}' does not point to a directory`;

            targetParentNode = destinationParentNode;
            targetPath = destinationPath;
        } else {
            // Target exists, so user wants to copy into child of target, retaining the source's name
            if (!(destinationNode instanceof Directory))
                return `The path '${destinationPath}' does not point to a directory`;

            targetParentNode = destinationNode;
            targetPath = destinationPath.getChild(sourcePath.fileName);
        }

        if (targetParentNode.hasNode(targetPath.fileName))
            return `The file '${targetPath}' already exists`;

        targetParentNode.addNode(targetPath.fileName, sourceNode.copy());

        return "";
    }

    /**
     * Returns the contents of the directory at the given path, or the current directory if no path is given.
     *
     * @param pathString the absolute or relative path to the directory to return
     * @param showHiddenFiles `true` if and only files starting with a `.` should be shown
     * @return the contents of the directory at the given path, or the current directory if no path is given
     */
    ls(pathString: string, showHiddenFiles: boolean): string {
        const path = this.getPathTo(pathString);

        const node = this.getNode(path);
        if (node === undefined)
            return `The directory '${path}' does not exist`;
        if (!(node instanceof Directory))
            return `'${path}' is not a directory`;

        const dirList = [new Directory({}).nameString("./", path), new Directory({}).nameString("../", path.parent)];
        const fileList: string[] = [];

        const nodes = node.nodes;
        Object.keys(nodes)
            .sortAlphabetically((x) => x, false)
            .forEach(name => {
                const node = nodes[name];
                if (!showHiddenFiles && name.startsWith("."))
                    return;

                if (node instanceof Directory)
                    dirList.push(node.nameString(name + "/", path.getChild(name)));
                else if (node instanceof File)
                    fileList.push(node.nameString(name, path.getChild(name)));
                else
                    throw new IllegalStateError(`'${path.getChild(name)}' is neither a file nor a directory.`);
            });

        return dirList.concat(fileList).join("\n");
    }

    /**
     * Creates an empty directory in the file system.
     *
     * @param pathString the absolute or relative path to the directory to create
     * @param createParents `true` if and only intermediate directories that do not exist should be created
     * @return an empty string if the removal was successful, or a message explaining what went wrong
     */
    private mkdir(pathString: string, createParents: boolean): string {
        const path = this.getPathTo(pathString);
        if (createParents && path.toString() !== "/")
            this.mkdir(path.parent.toString(), true);

        const parentNode = this.getNode(path.parent);
        if (parentNode === undefined)
            return `The directory '${path.parent}' does not exist`;
        if (!(parentNode instanceof Directory))
            return `'${path.parent}' is not a directory`;
        if (parentNode.hasNode(path.fileName))
            return `The directory '${path}' already exists`;

        parentNode.addNode(path.fileName, new Directory());
        return "";
    }

    /**
     * Calls `mkdir` on all elements in `paths`.
     *
     * @param paths the absolute or relative paths to the directories to create
     * @param createParents `true` if and only intermediate directories that do not exist should be created
     * @return the warnings generated during creation of the directories
     */
    mkdirs(paths: string[], createParents: boolean): string {
        return this.executeForEach(paths, path => this.mkdir(path, createParents));
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
        const result = this.cp(sourceString, destinationString, true);
        if (result === "")
            this.rm(sourceString, true, true, true);
        return result;
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
        const path = this.getPathTo(pathString);

        const parentNode = this.getNode(path.parent);
        if (parentNode === undefined)
            return force
                ? ""
                : `The directory '${path.parent}' does not exist`;
        if (!(parentNode instanceof Directory))
            return force
                ? ""
                : `'${path.parent}' is not a directory`;

        const childNode = this.getNode(path);
        if (childNode === undefined)
            return force
                ? ""
                : `The file '${path}' does not exist`;

        if (recursive) {
            if (path.toString() === "/")
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
                    : `'${path.fileName}' is not a file`;

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
        return this.executeForEach(paths, path => this.rm(path, force, recursive, noPreserveRoot));
    }

    /**
     * Removes a directory from the file system.
     *
     * @param pathString the absolute or relative path to the directory to be removed
     * @return an empty string if the removal was successful, or a message explaining what went wrong
     */
    private rmdir(pathString: string): string {
        const path = this._cwd.getChild(pathString);

        if (path.toString() === "/") {
            if (this.root.nodeCount > 0)
                return `The directory is not empty.`;
            else
                return "";
        }

        const parentDir = this.getNode(path.parent);
        if (parentDir === undefined)
            return `The directory '${path.parent}' does not exist`;
        if (!(parentDir instanceof Directory))
            return `'${path.parent}' is not a directory`;

        const childDir = parentDir.getNode(path.fileName);
        if (childDir === undefined)
            return `The directory '${path.fileName}' does not exist`;
        if (!(childDir instanceof Directory))
            return `'${path.fileName}' is not a directory`;
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
     * @param path a string that describes the path
     */
    constructor(path: string) {
        this.path = `/${path}/`
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
     * Returns the path describing the parent directory.
     *
     * @return the path describing the parent directory
     */
    get parent(): Path {
        return new Path(this._parent);
    }


    /**
     * Returns a path describing the path to the desired child node of `this` path.
     *
     * @param child the path to the desired node relative to `this` path
     * @return a path describing the path to the desired child node of `this` path
     */
    getChild(child: string): Path {
        return new Path(this.path + "/" + child);
    }

    /**
     * Returns the string representation of this path.
     *
     * @param escape `true` if and only if special characters should be escaped for use inside strings
     * @return the string representation of this path
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
     * @return a string representation of this node given the name of and path to this node
     */
    abstract nameString(name: string, path: Path): string;

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
     * Returns `true` if and only if this directory contains a node with the given name or the name refers to this
     * directory.
     *
     * @param name the name to check
     * @return `true` if and only if this directory contains a node with the given name or the name refers to this
     * directory
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
     * @param path the path to this node
     * @return a string that contains an HTML hyperlink that runs a command to `cd` to this directory
     */
    nameString(name: string, path: Path): string {
        return `<a href="#" class="dirLink" onclick="execute('cd ${path.toString(true)}');execute('ls')">${name}</a>`;
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
                return `<a href="#" class="fileLink" onclick="execute('open ${path.toString(true)}')">${name}</a>`;
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
