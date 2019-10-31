const path = require('path');

module.exports = grunt => {
    grunt.initConfig({
        pkg: grunt.file.readJSON("package.json"),
        clean: {
            default: ["build/"]
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
            }
        },
        webpack: {
            options: {
                entry: "./src/main/js/main.ts",
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
    grunt.loadNpmTasks("grunt-webpack");

    grunt.registerTask("dev", [
        // Pre
        "clean",
        // Copy files
        "copy:images",
        "copy:html",
        "copy:css",
        // Compile
        "webpack:dev"
    ]);
    grunt.registerTask("deploy", [
        // Pre
        "clean",
        // Copy files
        "copy:images",
        "copy:html",
        "copy:css",
        // Compile JS
        "webpack:deploy"
    ]);

    grunt.registerTask("default", ["dev"]);
};
