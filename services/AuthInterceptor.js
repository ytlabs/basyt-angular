angular.module('basyt.angular')
    .factory('AuthInterceptor', ['$q', 'BasytLocalStore', '$rootScope', function ($q, BasytLocalStore, $rootScope) {
        return {
            request: function (config) {
                var token;
                if (BasytLocalStore.get('auth_token')) {
                    token = BasytLocalStore.get('auth_token');
                }
                if (token) {
                    config.headers.Authorization = 'Bearer ' + token;
                }
                return config;
            },
            responseError: function (response) {
                if (response.status === 401 || response.status === 403) {
                    BasytLocalStore.unset('auth_token');
                    BasytLocalStore.unset('auth_user');
                    $rootScope.$broadcast('user:anonymous');
                }
                return $q.reject(response);
            }
        };
    }]);