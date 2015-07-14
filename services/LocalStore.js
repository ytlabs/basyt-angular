angular.module('basyt.angular')
    .factory('BasytLocalStore', function() {
        return {
            get: function(key) {
                return localStorage.getItem(key);
            },
            set: function(key, val) {
                return localStorage.setItem(key, val);
            },
            unset: function(key) {
                return localStorage.removeItem(key);
            }
        };
    });