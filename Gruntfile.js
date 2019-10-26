module.exports = grunt => {
    grunt.initConfig({
        pkg: grunt.file.readJSON("package.json"),
        clean: {
            before: ["build/"],
            after: [".tscache/"]
        },
        copy: {
            images: {
                files: [{expand: true, cwd: "src/", src: ["**/*.png", "**/*.ico"], dest: "build/"}]
            },
            html: {
                files: [{expand: true, cwd: "src/", src: "**/*.html", dest: "build/"}]
            },
            css: {
                files: [{expand: true, cwd: "src/", src: "**/*.css", dest: "build/"}]
            }
        },
        cssmin: {
            default: {
                files: [{expand: true, cwd: "build/", src: "**/*.css", dest: "build/"}]
            }
        },
        htmlmin: {
            default: {
                files: [{expand: true, cwd: "build/", src: "**/*.html", dest: "build/"}],
                options: {
                    removeComments: true,
                    collapseWhitespace: true
                }
            }
        },
        terser: {
            default: {
                files: [{expand: true, cwd: "build/js/", src: "*.js", dest: "build/js/"}],
                options: {
                    compress: true,
                    mangle: false,
                    module: true
                }
            }
        },
        ts: {
            dev: {
                tsconfig: "./tsconfig.json"
            },
            deploy: {
                tsconfig: "./tsconfig.json",
                options: {
                    sourceMap: false
                }
            }
        }
    });

    grunt.loadNpmTasks("grunt-contrib-clean");
    grunt.loadNpmTasks("grunt-contrib-copy");
    grunt.loadNpmTasks("grunt-contrib-cssmin");
    grunt.loadNpmTasks("grunt-contrib-htmlmin");
    grunt.loadNpmTasks("grunt-terser");
    grunt.loadNpmTasks("grunt-ts");

    grunt.registerTask("default", [
        // Pre
        "clean:before",
        // Copy files
        "copy:images",
        "copy:html",
        "copy:css",
        // Compile
        "ts:dev",
        // Post
        "clean:after"
    ]);
    grunt.registerTask("deploy", [
        // Pre
        "clean:before",
        // Copy files
        "copy:images",
        "copy:html",
        "copy:css",
        // Compile JS
        "ts:deploy",
        // Minify
        "terser",
        "cssmin",
        "htmlmin",
        // Post
        "clean:after"
    ]);
};
