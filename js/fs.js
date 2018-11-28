class FileSystem {
    constructor() {
        this._root = {
            personal: {
                steam: `<a href="https://steamcommunity.com/id/Waflix">steam</a>`,
                nukapedia: `<a href="http://fallout.wikia.com/wiki/User:FDekker">nukapedia</a>`
            },
            projects: {
                minor: {
                    dice: `<a href="https://fwdekker.com/dice">dice_probabilities</a>`
                },
                randomness: `<a href="https://github.com/FWDekker/intellij-randomness">randomness</a>`,
                schaapi: `<a href="http://cafejojo.org/schaapi">schaapi</a>`
            },
            social: {
                github: `<a href="https://github.com/FWDekker/">github</a>`,
                stackoverflow: `<a href="https://stackoverflow.com/u/3307872">stackoverflow</a>`,
                linkedin: `<a href="https://www.linkedin.com/in/fwdekker/">linkedin</a>`
            },
            "resume.pdf": `<a href="https://fwdekker.com/resume.pdf">resume.pdf</a>`
        };
        this.pwd = `/`;


        const visited = [];
        const queue = [this._root];

        this._root[`.`] = this._root;

        while (queue.length !== 0) {
            const next = queue.pop();
            if (visited.indexOf(next) >= 0) {
                continue;
            }

            visited.push(next);
            for (const key in next) {
                if (key === `.` || key === `..` || FileSystem.isFile(next[key])) {
                    continue;
                }

                next[key][`.`] = next[key];
                next[key][`..`] = next;
                queue.push(next[key]);
            }
        }
    }


    _absolutePath(path) {
        if (path.startsWith(`/`)) {
            return path;
        } else {
            return `${this.pwd}/${path}`;
        }
    }

    _filePath(path) {
        return this._normalisePath(path).split(`/`).slice(0, -1).slice(-1).join(`/`);
    }

    _getFile(path) {
        path = this._normalisePath(path);

        let file = this._root;
        path.split(`/`).forEach(part => {
            if (part === ``) {
                return;
            }
            if (file === undefined) {
                return;
            }

            file = file[part];
        });

        return file;
    }

    _normalisePath(path) {
        return FileSystem._sanitisePath(this._absolutePath(path));
    }

    _parentPath(path) {
        return this._normalisePath(path).split(`/`).slice(0, -1).join(`/`);
    }

    static _sanitisePath(path) {
        const selfRegex = /\/\.\//; // Match `./`
        const upRegex = /(\/+)([^./]+)(\/+)(\.\.)(\/+)/; // Match `/directory/../
        const doubleRegex = /\/{2,}/; // Match `///`

        return path
            .replaceAll(selfRegex, `/`)
            .replaceAll(upRegex, `/`)
            .replaceAll(doubleRegex, `/`)
            .toString();
    }


    /**
     * Returns true iff {@code file} represents a directory.
     *
     * @param file {Object} an object from the file system
     * @returns {boolean} true iff {@code file} represents a directory
     */
    static isDirectory(file) {
        return (file !== undefined && typeof file !== `string`);
    }

    /**
     * Returns true iff {@code file} represents a file.
     *
     * @param file {Object} an object from the file system
     * @returns {boolean} true iff {@code file} represents a file
     */
    static isFile(file) {
        return (file !== undefined && typeof file === `string`);
    }


    /**
     * Changes the current directory to {@code path}, if it exists.
     *
     * @param path the absolute or relative path to change the current directory to
     * @returns {string} an empty string if the change was successful, or an error message explaining what went wrong
     */
    cd(path) {
        if (path === undefined) {
            return ``;
        }

        const file = this._getFile(path);
        if (file === undefined || !FileSystem.isDirectory(file)) {
            return `The directory '${path}' does not exist`;
        }

        this.pwd = this._normalisePath(path);
        this.files = file;

        return ``;
    }

    /**
     * Returns the directory at {@code path}, or the current directory if no path is given.
     *
     * @param path {string} the absolute or relative path to the directory to return
     * @returns {Object} the directory at {@code path}, or the current directory if no path is given
     */
    ls(path) {
        path = (path || this.pwd);

        return this._getFile(path);
    }

    /**
     * Creates an empty directory in the file system.
     *
     * @param path {string} the absolute or relative path to the directory to create
     * @returns {string} an empty string if the removal was successful, or a message explaining what went wrong
     */
    mkdir(path) {
        const parentDirName = this._parentPath(path);
        const childDirName = this._filePath(path);

        const parentDir = this._getFile(parentDirName);
        if (!FileSystem.isDirectory(parentDir)) {
            return `The directory '${parentDirName}' does not exist`;
        }
        if (parentDir[childDirName] !== undefined) {
            return `The directory '${childDirName}' already exists`;
        }

        parentDir[childDirName] = {};
        parentDir[childDirName][`.`] = parentDir[childDirName];
        parentDir[childDirName][`..`] = parentDir;
        return ``;
    }

    /**
     * Resets navigation in the file system.
     */
    reset() {
        this.pwd = `/`;
        this.files = this._root;
    }

    /**
     * Removes a file from the file system.
     *
     * @param path {string} the absolute or relative path to the file to be removed
     * @returns {string} an empty string if the removal was successful, or a message explaining what went wrong
     */
    rm(path) {
        const dirName = this._parentPath(path);
        const fileName = this._filePath(path);

        const dir = this._getFile(dirName);
        if (!FileSystem.isDirectory(dir)) {
            return `The directory '${dirName}' does not exist`;
        }

        const file = dir[fileName];
        if (!FileSystem.isFile(file)) {
            return `The file '${fileName}' does not exist`;
        }

        delete dir[fileName];
        return ``;
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

        const parentDirName = this._parentPath(path);
        const childDirName = this._filePath(path);

        const parentDir = this._getFile(parentDirName);
        if (!FileSystem.isDirectory(parentDir)) {
            return `The directory '${parentDirName}' does not exist`;
        }

        const childDir = parentDir[childDirName];
        if (!FileSystem.isDirectory(childDir)) {
            return `The directory '${childDirName}' does not exist`;
        }
        if (!force && Object.keys(childDir).length > 2) {
            return `The directory is not empty`;
        }

        delete parentDir[childDirName];
        return ``;
    }
}
