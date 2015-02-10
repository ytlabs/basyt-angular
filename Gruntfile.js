module.exports = function (grunt) {

    var sources = ['module.js', 'services/*.js', 'controllers/*.js', 'directives/*.js'];
    grunt.initConfig({
        concat: {
            sources: {
                src: sources,
                dest: 'dist/basyt.angular.js'
            }
        },
        uglify: {
            sources: {
                options: {
                    mangle: true
                },
                src: ['<%= concat.sources.dest %>'],
                dest: 'dist/basyt.angular.min.js'
            }
        },
        watch: {
            project: {
                options: {
                    atBegin: true
                },
                files: sources,
                tasks: ['concat:sources', 'uglify:sources']
            }
        }
    });

    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-watch');

    grunt.registerTask('build', ['concat', 'uglify']);
};