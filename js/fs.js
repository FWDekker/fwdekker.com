class FileSystem {
    constructor() {
        this.pwd = "/";
        this._root = new Directory("", undefined, [
            new Directory("personal", undefined, [
                new LinkFile("steam", "https://steamcommunity.com/id/Waflix"),
                new LinkFile("nukapedia", "http://fallout.wikia.com/wiki/User:FDekker")
            ]),
            new Directory("projects", undefined, [
                new Directory("minor", undefined, [
                    new LinkFile("dice", "https://fwdekker.com/dice")
                ]),
                new LinkFile("randomness", "https://github.com/FWDekker/intellij-randomness"),
                new LinkFile("schaapi", "http://cafejojo.org/schaapi")
            ]),
            new Directory("social", undefined, [
                new LinkFile("github", "https://github.com/FWDekker/"),
                new LinkFile("stackoverflow", "https://stackoverflow.com/u/3307872"),
                new LinkFile("linkedin", "https://www.linkedin.com/in/fwdekker/")
            ]),
            new LinkFile("resume.pdf", "resume.pdf")
        ]);
    }


    static _sanitisePath(path) {
        const selfRegex = /\/\.\//; // Match "./"
        const upRegex = /(\/+)([^./]+)(\/+)(\.\.)(\/+)/; // Match "/directory/../"
        const doubleRegex = /\/{2,}/; // Match "///"

        return `${path}/`
            .replaceAll(selfRegex, "/")
            .replaceAll(upRegex, "/")
            .replaceAll(doubleRegex, "/")
            .toString();
    }

    _absolutePath(path) {
        if (path.startsWith("/")) {
            return path;
        } else {
            return `${this.pwd}/${path}`;
        }
    }

    _normalisePath(path) {
        return FileSystem._sanitisePath(this._absolutePath(path));
    }


    _childPath(path) {
        const childPath = this._normalisePath(path).split("/").slice(0, -1).slice(-1).join("/");
        return (childPath === "")
            ? "."
            : childPath;
    }

    _parentPath(path) {
        const parentPath = this._normalisePath(path).split("/").slice(0, -2).join("/");
        return (parentPath === "")
            ? "/"
            : parentPath;
    }


    _getFile(path) {
        path = this._normalisePath(path);

        let file = this._root;
        path.split("/").forEach(part => {
            if (part === "") {
                return;
            }
            if (file === undefined) {
                return;
            }
            if (FileSystem.isFile(file)) {
                file = undefined;
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
     * @param path the absolute or relative path to change the current directory to
     * @returns {string} an empty string if the change was successful, or an error message explaining what went wrong
     */
    cd(path) {
        if (path === undefined) {
            return "";
        }

        const file = this._getFile(path);
        if (file === undefined) {
            return `The directory '${path}' does not exist`;
        }
        if (!FileSystem.isDirectory(file)) {
            return `'${path}' is not a directory`;
        }

        this.pwd = this._normalisePath(path);
        this.files = file;

        return "";
    }

    /**
     * Returns the directory at {@code path}, or the current directory if no path is given.
     *
     * @param path {string} the absolute or relative path to the directory to return
     * @returns {Object} the directory at {@code path}, or the current directory if no path is given
     */
    ls(path) {
        path = (path || this.pwd);

        const node = this._getFile(path);
        if (node === undefined) {
            return `The directory '${path}' does not exist`;
        }
        if (!FileSystem.isDirectory(node)) {
            return `'${path}' is not a directory`;
        }

        const dirList = ["./", "../"];
        const fileList = [];

        node.getNodes()
            .sortAlphabetically(node => node.name)
            .forEach(node => {
                    if (FileSystem.isDirectory(node)) {
                        dirList.push(node.toString());
                    } else if (FileSystem.isFile(node)) {
                        fileList.push(node.toString());
                    } else {
                        throw `${node.name} is neither a file nor a directory!`;
                    }
                }
            );

        return dirList.concat(fileList).join("\n");
    }

    /**
     * Creates an empty directory in the file system.
     *
     * @param path {string} the absolute or relative path to the directory to create
     * @returns {string} an empty string if the removal was successful, or a message explaining what went wrong
     */
    mkdir(path) {
        const parentDirName = this._parentPath(path);
        const childDirName = this._childPath(path);

        const parentDir = this._getFile(parentDirName);
        if (parentDir === undefined) {
            return `The directory '${parentDirName}' does not exist`;
        }
        if (!FileSystem.isDirectory(parentDir)) {
            return `'${parentDirName}' is not a directory`;
        }
        if (parentDir[childDirName] !== undefined) {
            return `The directory '${childDirName}' already exists`;
        }

        parentDir.addNode(new Directory(childDirName, parentDir, []));
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
     * Resets navigation in the file system.
     */
    reset() {
        this.pwd = "/";
        this.files = this._root;
    }

    /**
     * Removes a file from the file system.
     *
     * @param path {string} the absolute or relative path to the file to be removed
     * @param force {boolean} true if no warnings should be given if removal is unsuccessful
     * @returns {string} an empty string if the removal was successful, or a message explaining what went wrong
     */
    rm(path, force) {
        const dirName = this._parentPath(path);
        const fileName = this._childPath(path);

        const dir = this._getFile(dirName);
        if (dir === undefined) {
            return force
                ? ""
                : `The directory '${dirName}' does not exist`;
        }
        if (!FileSystem.isDirectory(dir)) {
            return force
                ? ""
                : `'${dirName}' is not a directory`;
        }

        const file = dir.getNode(fileName);
        if (file === undefined) {
            return force
                ? ""
                : `The file '${fileName}' does not exist`;
        }
        if (!FileSystem.isFile(file)) {
            return force
                ? ""
                : `'${fileName}' is not a file`;
        }

        dir.removeNode(file);
        return "";
    }

    /**
     * Calls {@link rm} on all elements in {@code paths}.
     *
     * @param paths {string} the absolute or relative paths to the files to be removed
     * @param force {boolean} true if no warnings should be given if removal is unsuccessful
     * @returns {string} the warnings generated during removal of the directories
     */
    rms(paths, force) {
        return this._executeForEach(paths, path => {
            return this.rm(path, force);
        });
    }

    /**
     * Removes a directory from the file system.
     *
     * @param path {string} the absolute or relative path to the directory to be removed
     * @param force {boolean} true iff the directory should be removed regardless of whether it is empty
     * @returns {string} an empty string if the removal was successful, or a message explaining what went wrong
     */
    rmdir(path, force) {
        force = (force || false);

        if (this._normalisePath(path) === "/") {
            if (!force && this._root.getNodeCount() > 0) {
                return `The directory is not empty.`;
            } else {
                this._root = new Directory("/", undefined, []);
                return "";
            }
        }

        const parentDirName = this._parentPath(path);
        const childDirName = this._childPath(path);

        const parentDir = this._getFile(parentDirName);
        if (parentDir === undefined) {
            return force
                ? ""
                : `The directory '${parentDirName}' does not exist`;
        }
        if (!FileSystem.isDirectory(parentDir)) {
            return force
                ? ""
                : `'${parentDirName}' is not a directory`;
        }

        const childDir = parentDir.getNode(childDirName);
        if (childDir === undefined) {
            return force
                ? ""
                : `The directory '${childDirName}' does not exist`;
        }
        if (!FileSystem.isDirectory(childDir)) {
            return force
                ? ""
                : `'${childDirName}' is not a directory`;
        }
        if (!force && childDir.getNodeCount() > 0) {
            return `The directory is not empty`;
        }

        parentDir.removeNode(childDir);
        return "";
    }

    /**
     * Calls {@link rmdir} on all elements in {@code paths}.
     *
     * @param paths {string[]} the absolute or relative paths to the directories to be removed
     * @param force {boolean} true iff the directories should be removed regardless of whether they are empty
     * @returns {string} the warnings generated during removal of the directories
     */
    rmdirs(paths, force) {
        return this._executeForEach(paths, path => {
            return this.rmdir(path, force);
        });
    }
}


class Node {
    constructor(name) {
        this.name = name;
    }


    copy() {
        throw "Cannot execute abstract method!";
    }

    toString() {
        throw "Cannot execute abstract method!";
    }

    visit(fun, pre, post) {
        throw "Cannot execute abstract method!";
    }
}

class Directory extends Node {
    constructor(name, parent, nodes) {
        super(name);

        this._parent = (parent || this);
        this._nodes = (nodes || []);

        this._nodes.forEach(node => {
            node._parent = this;
        });
    }


    getNodes() {
        return this._nodes.slice();
    }

    getNodeCount() {
        return this._nodes.length;
    }

    getNode(name) {
        switch (name) {
            case ".":
                return this;
            case "..":
                return this._parent;
            default:
                return this._nodes.find(it => it.name === name);
        }
    }

    addNode(node) {
        this._nodes.push(node);
    }

    removeNode(node) {
        const index = this._nodes.indexOf(node);

        if (index >= 0) {
            this._nodes.splice(index, 1);
            return true;
        } else {
            return false;
        }
    }


    copy() {
        return new Directory(this.name, this._parent, this._nodes);
    }

    toString() {
        return `${this.name}/`;
    }

    visit(fun, pre = emptyFunction, post = emptyFunction) {
        pre(this);

        fun(this);
        this._nodes.forEach(node => node.visit(fun, pre, post));

        post(this);
    }
}

class File extends Node {
    constructor(name) {
        super(name);
    }


    copy() {
        return new File(this.name);
    }

    toString() {
        return name;
    }

    visit(fun, pre = emptyFunction, post = emptyFunction) {
        pre(this);
        fun(this);
        post(this);
    }
}

class LinkFile extends File {
    constructor(name, url) {
        super(name);

        this.url = url;
    }


    copy() {
        return new LinkFile(this.name, this.url);
    }

    toString() {
        return `<a href="${this.url}">${this.name}</a>`;
    }
}
