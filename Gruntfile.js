const path = require('path');

module.exports = grunt => {
    grunt.initConfig({
        pkg: grunt.file.readJSON("package.json"),
        clean: {
            default: [".nyc_output/", "build/"]
        },
        copy: {
            images: {
                files: [{expand: true, cwd: "src/main/", src: ["**/*.png", "**/*.ico"], dest: "build/"}]
            },
            html: {
                files: [{expand: true, cwd: "src/main/", src: "**/*.html", dest: "build/"}]
            },
            css: {
                files: [{expand: true, cwd: "src/main/", src: "**/*.css", dest: "build/"}]
            },
            pwa: {
                files: [{expand: true, cwd: "src/main/", src: ["manifest.json", "sw.js"], dest: "build/"}]
            }
        },
        replace: {
            default: {
                src: ["./build/*.js"],
                replacements: [
                    {
                        from: "%%VERSION_NUMBER%%",
                        to: "<%= pkg.version %>"
                    }
                ],
                overwrite: true
            }
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
                    path: path.resolve(__dirname, "build/"),
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
        "replace"
    ]);
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
        "replace"
    ]);

    grunt.registerTask("default", ["dev"]);
};
