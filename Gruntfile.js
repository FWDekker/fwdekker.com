const path = require('path');

module.exports = grunt => {
    grunt.initConfig({
        pkg: grunt.file.readJSON("package.json"),
        clean: {
            default: [".nyc_output/", "dist/"]
        },
        copy: {
            css: {
                files: [{expand: true, cwd: "src/main/", src: "**/*.css", dest: "dist/"}]
            },
            html: {
                files: [{expand: true, cwd: "src/main/", src: "**/*.html", dest: "dist/"}]
            },
            images: {
                files: [{expand: true, cwd: "src/main/", src: ["**/*.png"], dest: "dist/"}]
            },
            pwa: {
                files: [{expand: true, cwd: "src/main/", src: ["manifest.json", "sw.js"], dest: "dist/"}]
            },
        },
        focus: {
            dev: {
                include: ["css", "html", "link", "ts"],
            },
        },
        replace: {
            dev: {
                src: ["./dist/*.html", "./dist/*.js"],
                replacements: [
                    {
                        from: "%%VERSION_NUMBER%%",
                        to: "<%= pkg.version %>+" + new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "")
                    }
                ],
                overwrite: true
            },
            deploy: {
                src: ["./dist/*.html", "./dist/*.js"],
                replacements: [
                    {
                        from: "%%VERSION_NUMBER%%",
                        to: "<%= pkg.version %>"
                    }
                ],
                overwrite: true
            }
        },
        watch: {
            css: {
                files: ["src/main/**/*.css"],
                tasks: ["copy:css"],
            },
            html: {
                files: ["src/main/**/*.html"],
                tasks: ["copy:html"],
            },
            link: {
                files: ["node_modules/@fwdekker/*/dist/**"],
                tasks: ["webpack:dev", "replace:dev"],
            },
            ts: {
                files: ["src/main/**/*.ts"],
                tasks: ["webpack:dev", "replace:dev"],
            },
        },
        webpack: {
            options: {
                entry: "./src/main/js/Main.ts",
                module: {
                    rules: [
                        {
                            test: /\.ts$/,
                            use: "ts-loader",
                            exclude: /node_modules/,
                        },
                    ],
                },
                resolve: {
                    extensions: [".ts"],
                },
                output: {
                    filename: "bundle.js",
                    path: path.resolve(__dirname, "dist/"),
                }
            },
            dev: {
                mode: "development",
                devtool: "inline-source-map"
            },
            deploy: {
                mode: "production"
            }
        }
    });

    grunt.loadNpmTasks("grunt-contrib-clean");
    grunt.loadNpmTasks("grunt-contrib-copy");
    grunt.loadNpmTasks("grunt-contrib-watch");
    grunt.loadNpmTasks("grunt-focus");
    grunt.loadNpmTasks("grunt-text-replace");
    grunt.loadNpmTasks("grunt-webpack");

    grunt.registerTask("dev", [
        // Pre
        "clean",
        // Copy files
        "copy:images",
        "copy:html",
        "copy:css",
        "copy:pwa",
        // Compile
        "webpack:dev",
        // Post
        "replace:dev"
    ]);
    grunt.registerTask("dev:server", ["dev", "focus:dev"]);
    grunt.registerTask("deploy", [
        // Pre
        "clean",
        // Copy files
        "copy:images",
        "copy:html",
        "copy:css",
        "copy:pwa",
        // Compile JS
        "webpack:deploy",
        // Post
        "replace:deploy"
    ]);

    grunt.registerTask("default", ["dev"]);
};
