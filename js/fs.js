class FileSystem {
    constructor() {
        this.pwd = "/";
        this._root = new Directory({
            personal: new Directory({
                steam: new UrlFile("https://steamcommunity.com/id/Waflix"),
                nukapedia: new UrlFile("http://fallout.wikia.com/wiki/User:FDekker")
            }),
            projects: new Directory({
                minor: new Directory({
                    dice: new UrlFile("https://fwdekker.com/dice")
                }),
                randomness: new UrlFile("https://github.com/FWDekker/intellij-randomness"),
                schaapi: new UrlFile("http://cafejojo.org/schaapi")
            }),
            social: new Directory({
                github: new UrlFile("https://github.com/FWDekker/"),
                stackoverflow: new UrlFile("https://stackoverflow.com/u/3307872"),
                linkedin: new UrlFile("https://www.linkedin.com/in/fwdekker/")
            }),
            "resume.pdf": new UrlFile("resume.pdf")
        });
    }


    _getFile(pathString) {
        const path = new Path(this.pwd, pathString);

        let file = this._root;
        path.parts.forEach(part => {
            if (part === "") {
                return;
            }
            if (file === undefined) {
                return;
            }
            if (FileSystem.isFile(file)) {
                file = undefined;
                return;
            }

            file = file.getNode(part);
        });

        return file;
    }


    _executeForEach(inputs, fun) {
        const outputs = [];

        inputs.forEach(input => {
            const output = fun(input);

            if (output !== "") {
                outputs.push(output);
            }
        });

        return outputs.join("\n");
    }


    /**
     * Returns true iff {@code node} represents a directory.
     *
     * @param node {Object} a node from the file system
     * @returns {boolean} true iff {@code node} represents a directory
     */
    static isDirectory(node) {
        return node instanceof Directory;
    }

    /**
     * Returns true iff {@code node} represents a file.
     *
     * @param node {Object} an object from the file system
     * @returns {boolean} true iff {@code node} represents a file
     */
    static isFile(node) {
        return node instanceof File;
    }


    /**
     * Changes the current directory to {@code path}, if it exists.
     *
     * @param pathString the absolute or relative path to change the current directory to
     * @returns {string} an empty string if the change was successful, or an error message explaining what went wrong
     */
    cd(pathString) {
        if (pathString === undefined) {
            return "";
        }

        const path = new Path(this.pwd, pathString);

        const file = this._getFile(path.path);
        if (file === undefined) {
            return `The directory '${path.path}' does not exist`;
        }
        if (!FileSystem.isDirectory(file)) {
            return `'${path.path}' is not a directory`;
        }

        this.pwd = path.path;
        this.files = file;

        return "";
    }

    /**
     * Creates an empty file at {@code path} if it does not exist.
     *
     * @param path the path to create a file at if it does not exist
     * @returns {string} an empty string if the removal was successful, or a message explaining what went wrong
     */
    createFile(path) {
        path = new Path(this.pwd, path);

        const headNode = this._getFile(path.head);
        if (headNode === undefined) {
            return `The directory '${path.head}' does not exist`;
        }
        if (!FileSystem.isDirectory(headNode)) {
            return `${path.head} is not a directory`;
        }

        const tailNode = headNode.getNode(path.tail);
        if (tailNode !== undefined) {
            return "";
        }

        headNode.addNode(path.tail, new File(path.tail));
        return "";
    }

    /**
     * Calls {@link createFile} on all elements in {@code paths}.
     *
     * @param paths {string[]} the absolute or relative paths to the files to be created
     * @returns {string} the warnings generated during creation of the files
     */
    createFiles(paths) {
        return this._executeForEach(paths, path => {
            return this.createFile(path);
        });
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
    cp(sourceString, destinationString) {
        const sourcePath = new Path(this.pwd, sourceString);
        const sourceTailNode = this._getFile(sourcePath.path);

        const destinationPath = new Path(this.pwd, destinationString);
        const destinationHeadNode = this._getFile(destinationPath.head);
        const destinationTailNode = this._getFile(destinationPath.path);

        if (sourceTailNode === undefined) {
            return `The file '${sourcePath.path}' does not exist`;
        }
        if (!(sourceTailNode instanceof File)) {
            return `Cannot copy directory.`;
        }
        if (destinationHeadNode === undefined) {
            return `The directory '${destinationPath.head}' does not exist`;
        }

        let targetNode;
        let targetName;
        if (destinationTailNode === undefined) {
            targetNode = destinationHeadNode;
            targetName = destinationPath.tail;
        } else {
            targetNode = destinationTailNode;
            targetName = sourcePath.tail;
        }

        if (targetNode.getNode(targetName) !== undefined) {
            return `The file '${targetName}' already exists`;
        }

        targetNode.addNode(targetName, sourceTailNode.copy());

        return "";
    }

    /**
     * Returns the directory at {@code path}, or the current directory if no path is given.
     *
     * @param pathString {string} the absolute or relative path to the directory to return
     * @returns {Object} the directory at {@code path}, or the current directory if no path is given
     */
    ls(pathString) {
        const path = new Path(this.pwd, pathString);

        const dir = this._getFile(path.path);
        if (dir === undefined) {
            return `The directory '${path.path}' does not exist`;
        }
        if (!FileSystem.isDirectory(dir)) {
            return `'${path.path}' is not a directory`;
        }

        const dirList = [new Directory({}).nameString("."), new Directory({}).nameString("..")];
        const fileList = [];

        const nodes = dir.getNodes();
        Object.keys(nodes)
            .sortAlphabetically()
            .forEach(name => {
                const node = nodes[name];

                if (FileSystem.isDirectory(node)) {
                    dirList.push(node.nameString(name));
                } else if (FileSystem.isFile(node)) {
                    fileList.push(node.nameString(name));
                } else {
                    throw `${name} is neither a file nor a directory!`;
                }
            });

        return dirList.concat(fileList).join("\n");
    }

    /**
     * Creates an empty directory in the file system.
     *
     * @param pathString {string} the absolute or relative path to the directory to create
     * @returns {string} an empty string if the removal was successful, or a message explaining what went wrong
     */
    mkdir(pathString) {
        const path = new Path(pathString);

        const headNode = this._getFile(path.head);
        if (headNode === undefined) {
            return `The directory '${path.head}' does not exist`;
        }
        if (!FileSystem.isDirectory(headNode)) {
            return `'${path.head}' is not a directory`;
        }
        if (headNode.getNode(path.tail)) {
            return `The directory '${path.tail}' already exists`;
        }

        headNode.addNode(path.tail, new Directory());
        return "";
    }

    /**
     * Calls {@link mkdir} on all elements in {@code paths}.
     *
     * @param paths {string[]} the absolute or relative paths to the directories to create
     * @returns {string} the warnings generated during creation of the directories
     */
    mkdirs(paths) {
        return this._executeForEach(paths, this.mkdir.bind(this));
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
    mv(sourceString, destinationString) {
        const sourcePath = new Path(sourceString);
        const sourceHeadNode = this._getFile(sourcePath.head);
        const sourceTailNode = this._getFile(sourcePath.path);

        const destinationPath = new Path(destinationString);
        const destinationHeadNode = this._getFile(destinationPath.head);
        const destinationTailNode = this._getFile(destinationPath.path);

        if (sourceTailNode === undefined) {
            return `The file '${sourcePath.path}' does not exist`;
        }
        if (destinationHeadNode === undefined) {
            return `The directory '${destinationPath.head}' does not exist`;
        }

        let targetNode;
        let targetName;
        if (destinationTailNode === undefined) {
            targetNode = destinationHeadNode;
            targetName = destinationPath.tail;
        } else {
            targetNode = destinationTailNode;
            targetName = sourcePath.tail;
        }

        if (targetNode.getNode(targetName) !== undefined) {
            return `The file '${targetName}' already exists`;
        }

        sourceHeadNode.removeNode(sourceTailNode);
        targetNode.addNode(sourceTailNode);
        sourceTailNode.name = targetName;

        return "";
    }

    /**
     * Resets navigation in the file system.
     */
    reset() {
        this.pwd = "/";
        this.files = this._root;
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
    rm(pathString, force = false, recursive = false, noPreserveRoot = false) {
        const path = new Path(pathString);

        const parentNode = this._getFile(path.head);
        if (parentNode === undefined) {
            return force
                ? ""
                : `The directory '${path.head}' does not exist`;
        }
        if (!FileSystem.isDirectory(parentNode)) {
            return force
                ? ""
                : `'${path.head}' is not a directory`;
        }

        const childNode = this._getFile(path.path);
        if (childNode === undefined) {
            return force
                ? ""
                : `The file '${path.path}' does not exist`;
        }

        if (recursive) {
            if (path.path === "/") {
                if (noPreserveRoot) {
                    this._root = new Directory();
                } else {
                    return "'/' cannot be removed";
                }
            } else {
                parentNode.removeNode(childNode);
            }
        } else {
            if (!(childNode instanceof File)) {
                return force
                    ? ""
                    : `'${path.tail}' is not a file`;
            }

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
    rms(paths, force = false, recursive = false, noPreserveRoot = false) {
        return this._executeForEach(paths, path => {
            return this.rm(path, force, recursive, noPreserveRoot);
        });
    }

    /**
     * Removes a directory from the file system.
     *
     * @param pathString {string} the absolute or relative path to the directory to be removed
     * @returns {string} an empty string if the removal was successful, or a message explaining what went wrong
     */
    rmdir(pathString) {
        const path = new Path(pathString);

        if (path.path === "/") {
            if (this._root.getNodeCount() > 0) {
                return `The directory is not empty.`;
            } else {
                return "";
            }
        }

        const parentDir = this._getFile(path.head);
        if (parentDir === undefined) {
            return `The directory '${path.head}' does not exist`;
        }
        if (!FileSystem.isDirectory(parentDir)) {
            return `'${path.head}' is not a directory`;
        }

        const childDir = parentDir.getNode(path.tail);
        if (childDir === undefined) {
            return `The directory '${path.tail}' does not exist`;
        }
        if (!FileSystem.isDirectory(childDir)) {
            return `'${path.tail}' is not a directory`;
        }
        if (childDir.getNodeCount() > 0) {
            return `The directory is not empty`;
        }

        parentDir.removeNode(childDir);
        return "";
    }

    /**
     * Calls {@link rmdir} on all elements in {@code paths}.
     *
     * @param paths {string[]} the absolute or relative paths to the directories to be removed
     * @returns {string} the warnings generated during removal of the directories
     */
    rmdirs(paths) {
        return this._executeForEach(paths, path => {
            return this.rmdir(path);
        });
    }
}


class Path {
    constructor(currentPath, relativePath) {
        let path;
        if (relativePath === undefined) {
            path = currentPath;
        } else if (relativePath.startsWith("/")) {
            path = relativePath;
        } else {
            path = `${currentPath}/${relativePath}`;
        }


        this._path = `${path}/`
            .replaceAll(/\/\.\//, "/")
            .replaceAll(/(\/+)([^./]+)(\/+)(\.\.)(\/+)/, "/")
            .replaceAll(/\/{2,}/, "/")
            .replace(/^\/?\.?\.\/$/, "/")
            .toString();

        this._parts = this._path.split("/");
        this._head = this._parts.slice(0, -2).join("/");
        this._tail = this._parts.slice(0, -1).slice(-1).join("/");
    }


    get path() {
        return this._path;
    }

    get parts() {
        return this._parts.slice();
    }

    get head() {
        return this._head;
    }

    get tail() {
        return this._tail;
    }
}

class Node {
    copy() {
        throw "Cannot execute abstract method!";
    }

    nameString(name) {
        throw "Cannot execute abstract method!";
    }

    visit(fun, pre, post) {
        throw "Cannot execute abstract method!";
    }
}

class Directory extends Node {
    constructor(nodes = {}) {
        super();

        this._parent = this;
        this._nodes = nodes;

        Object.keys(this._nodes).forEach(name => {
            this._nodes[name]._parent = this
        });
    }


    getNodes() {
        return Object.assign({}, this._nodes);
    }

    getNodeCount() {
        return Object.keys(this._nodes).length;
    }

    getNode(name) {
        switch (name) {
            case ".":
                return this;
            case "..":
                return this._parent;
            default:
                return this._nodes[name];
        }
    }

    addNode(name, node) {
        if (node instanceof Directory) {
            node._parent = this;
        }

        this._nodes[name] = node;
    }

    removeNode(nodeOrName) {
        if (nodeOrName instanceof Node) {
            const name = Object.keys(this._nodes).find(key => this._nodes[key] === nodeOrName);
            delete this._nodes[name];
        } else {
            delete this._nodes[name];
        }
    }


    copy() {
        const copy = new Directory(Object.assign({}, this._nodes));
        copy._parent = undefined;
        return copy;
    }

    nameString(name) {
        return `<a href="#" class="dirLink" onclick="run('cd ${relToAbs(name)}/');run('ls');">${name}/</a>`;
    }

    visit(fun, pre = emptyFunction, post = emptyFunction) {
        pre(this);

        fun(this);
        Object.keys(this._nodes).forEach(name => {
            this._nodes[name].visit(fun, pre, post);
        });

        post(this);
    }
}

class File extends Node {
    constructor() {
        super();
    }


    copy() {
        return new File();
    }

    nameString(name) {
        return name;
    }

    visit(fun, pre = emptyFunction, post = emptyFunction) {
        pre(this);
        fun(this);
        post(this);
    }
}

class UrlFile extends File {
    constructor(url) {
        super();

        this.url = url;
    }


    copy() {
        return new UrlFile(this.url);
    }

    nameString(name) {
        return `<a href="${this.url}" class="fileLink">${name}</a>`;
    }
}
