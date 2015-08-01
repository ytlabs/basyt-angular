angular.module('basyt-angular')
    .factory('BasytRequest', ['$http', '$q', '$rootScope', '$urlMatcherFactory', 'BasytServer', function ($http, $q, $rootScope, $urlMatcherFactory, BasytServer) {
        var endpoints, initialized = false, future,
            deferred = $q.defer();
        $http.get(BasytServer.host)
            .then(
            function (res) {
                endpoints = res.data.routes;
                initialized = true;
                $rootScope.$broadcast('basyt:request:ready');
                deferred.resolve(endpoints);

                return endpoints;
            },
            function (data, status) {
                deferred.reject(false);
            }
        );
        future = deferred.promise;

        return function (endpoint, parameters) {
            return future.then(
                function (ep) {
                    if (endpoints.hasOwnProperty(endpoint)) {
                        var reqParams = angular.copy(parameters) || {};
                        if (reqParams.hasOwnProperty('urlParams')) {
                            reqParams.url = BasytServer.host + $urlMatcherFactory.compile(endpoints[endpoint].path).format(reqParams.urlParams);
                            delete reqParams.urlParams;
                        }
                        else {
                            reqParams.url = BasytServer.host + endpoints[endpoint].path;
                        }
                        var httpArgs = angular.extend({}, endpoints[endpoint], reqParams);
                        return $http(httpArgs)
                            .error(function (result) {
                                var deferred = $q.defer();
                                if (result.data)
                                    deferred.reject(result.data.err);
                                else
                                    deferred.reject(false);
                                return deferred.promise;
                            })
                            .then(function (result) {
                                var deferred = $q.defer();
                                if (result.data && result.data.success) {
                                    deferred.resolve(result.data);
                                }
                                else {
                                    deferred.reject(result.data ? result.data.err : false);
                                }
                                return deferred.promise;
                            });
                    }
                    return null;
                },
                function () {
                    return null;
                }
            );
        };
    }]);
