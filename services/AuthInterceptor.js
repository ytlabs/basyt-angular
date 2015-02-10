angular.module('basyt.angular')
    .factory('AuthInterceptor', ['$q', '$injector', function ($q, $injector) {
        var LocalStore = $injector.get('LocalStore');
        return {
            request: function (config) {
                var token;
                if (LocalStore.get('auth_token')) {
                    token = LocalStore.get('auth_token');
                }
                if (token) {
                    config.headers.Authorization = 'Bearer ' + token;
                }
                return config;
            },
            responseError: function (response) {
                if (response.status === 401 || response.status === 403) {
                    //LocalStore.unset('auth_token');
                    //LocalStore.unset('auth_user');
                }
                return $q.reject(response);
            }
        };
    }]);