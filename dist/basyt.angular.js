angular.module('basyt-angular', ['ui.router'])
    .config(['$httpProvider', function ($httpProvider) {
        $httpProvider.interceptors.push('BasytAuthInterceptor');
    }])
    .value('BasytAnonState', 'login')
    .value('BasytAuthMessages', {
        loginRequired: 'Login Required',
        loginSuccess: 'Login Successful',
        loginFailed: 'Login Failed',
        logoutSuccess: 'Logout Successful',
        authFailed: 'Authorization Failed'
    })
    .value('BasytServer', {
        host: window.API_URL,
        socket: window.SOCKET_URL,
        socketOptions: window.SOCKET_OPTS
    })
    .run(['$rootScope', '$state', '$injector', 'BasytAuth', 'BasytAnonState', 'BasytAuthMessages', function($rootScope, $state, BasytAuth, $injector, BasytAnonState, BasytAuthMessages){
        var $alert = $injector.get('$alert');
        $rootScope.$on("$stateChangeStart", function(event, next) {
            if (next.role) {
                if (!BasytAuth.isAuthenticated(next.role)) {
                    if($alert) {
                        $alert({
                            title: BasytAuthMessages.authFailed,
                            type: 'danger',
                            duration: 6
                        })
                    }
                    $state.go(BasytAnonState);
                    event.preventDefault();
                }
            }
        });
        $rootScope.$on('user:anonymous', function(){
            if(angular.isDefined($state.current.role) && ($state.current.role !== 'ANON'))
                if($alert) {
                    $alert({
                        title: BasytAuthMessages.loginRequired,
                        type: 'danger',
                        duration: 6
                    })
                }
                $state.go(BasytAnonState);
        });
    }]);

angular.module('basyt-angular')
    .factory('BasytAuth', ['BasytLocalStore',  'BasytRequest', '$q', '$rootScope', '$injector', 'BasytAuthMessages', function (BasytLocalStore, BasytRequest, $q, $rootScope, $injector, BasytAuthMessages) {
        var AnonUser = {
                user_state: 'ANON'
            },
            User = AnonUser,
            $alert = $injector.get('$alert'),
            login = function (data) {
                BasytLocalStore.set('auth_token', data.result.token);
                delete data.result.token;
                BasytLocalStore.set('auth_user', JSON.stringify(data.result));
                User = data.result;
                $rootScope.activeUser = User;
                $rootScope.activeUser.user_state = Auth.isLord()
                    ? 'LORD'
                    : Auth.isAdmin()
                    ? 'ADMIN'
                    : 'USER';
                if($alert) {
                    $alert({
                        title: BasytAuthMessages.loginSuccess,
                        type: 'info',
                        duration: 3
                    })
                }
                $rootScope.$broadcast('user:login', data.result);
                return User;
            },
            logout = function (silent) {
                BasytLocalStore.unset('auth_token');
                BasytLocalStore.unset('auth_user');
                User = AnonUser;
                $rootScope.activeUser = User;
                if(!silent && $alert) {
                    $alert({
                        title: BasytAuthMessages.logoutSuccess,
                        type: 'info',
                        duration: 3
                    })
                }
                $rootScope.$broadcast('user:logout');
            },
            logoutReject = function (err) {
                var deferred = $q.defer();
                logout(true);
                deferred.reject(err);
                if($alert) {
                    $alert({
                        title: BasytAuthMessages.loginFailed,
                        type: 'danger',
                        duration: 6
                    })
                }
                return deferred.promise;
            },
            Auth = {
                isAuthenticated: function (access, remote) {
                    if (BasytLocalStore.get('auth_token')) {
                        if (remote) Auth.authenticate();
                        if (angular.isUndefined(User.id)) {
                            var stored = BasytLocalStore.get('auth_user');
                            if (stored) {
                                User = angular.fromJson(stored);
                                if (angular.isUndefined(User.id))
                                    return false;
                                $rootScope.activeUser = User;
                                $rootScope.activeUser.user_state = Auth.isLord()
                                    ? 'LORD'
                                    : Auth.isAdmin()
                                    ? 'ADMIN'
                                    : 'USER';
                            }
                            else
                                return false;
                        }
                        if (access != 'USER') {
                            if (angular.isUndefined(User.id))
                                return false;
                            return angular.isDefined(User.roles) ? (User.roles.indexOf(access) > -1) : false;
                        }
                        return true;
                    }
                    else
                        return false;
                },
                getUser: function () {
                    return User;
                },
                isLord: function () {
                    return angular.isDefined(User.roles) ? (User.roles.indexOf('LORD') > -1) : false;
                },
                isAdmin: function () {
                    return angular.isDefined(User.roles) ? (User.roles.indexOf('ADMIN') > -1 || User.roles.indexOf('LORD') > -1) : false;
                },
                login: function (credentials, rememberMe) {
                    logout(true);
                    //if(rememberMe)
                    return BasytRequest('user:login', {data: credentials}).then(login, logoutReject);
                },
                logout: logout,
                register: function (formData) {
                    logout(true);
                    return BasytRequest('user:register', {user: formData}).then(login, logoutReject);
                },
                authenticate: function () {
                    return BasytRequest('user:authenticate').then(function () {
                    }, logout);
                }
            };
        $rootScope.activeUser = User;
        return Auth;
    }]);

angular.module('basyt-angular')
    .factory('BasytAuthInterceptor', ['$q', 'BasytLocalStore', '$rootScope', function ($q, BasytLocalStore, $rootScope) {
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

angular.module('basyt-angular')
    .factory('BasytEntityBridge', ['BasytRequest', 'BasytSocket', '$rootScope', 'filterFilter', '$q', function (BasytRequest, BasytSocket, $rootScope, filterFilter, $q) {
        var EntityBridge = function (entityName, map) {
            var that = this;
            this.endpoint = entityName + ':list';
            this.socketChannel = 'entity:' + entityName;
            this.map = map;
            this.isLoaded = false;
            this.listeners = [];
            this.value = [];
            BasytSocket.on('entity:update:' + entityName, function (message) {
                that.reload(false);
            });
            this.reload(true);
        };

        EntityBridge.prototype.bind = function () {
            var deferred = $q.defer(), that = this, promise = deferred.promise;
            this.listeners.push(deferred);
            promise.list = this.value;
            promise.item = function (item) {
                var filtered = filterFilter(that.value, {id: item});
                return angular.isArray(filtered) ? filtered[0] : null;
            };
            promise.unbind = function () {
                deferred.resolve(true);
                that.listeners.splice(that.listeners.indexOf(deferred), 1);
            };
            promise.listen = function (notifyCallback) {
                return deferred.promise.then(function () {
                }, function () {
                }, notifyCallback);
            };
            return promise;
        };
        EntityBridge.prototype.reload = function (subscribe) {
            var that = this;
            BasytRequest(this.endpoint, {params: {deep: true}})
                .then(function (data) {
                    if (that.map) {
                        angular.forEach(data.result, that.map);
                    }
                    that.value = data.result;
                    that.isLoaded = true;
                    angular.forEach(that.listeners, function (deferred) {
                        deferred.notify(that.value);
                    });
                    if (subscribe) {
                        BasytSocket.subscribe(that.socketChannel);
                    }
                },
                function () {
                    that.value = [];
                    that.isLoaded = true;
                });
        };

        return EntityBridge;
    }]);

angular.module('basyt-angular')
    .factory('BasytLocalStore', ['$window', function($window) {
        return {
            get: function(key) {
                return $window.localStorage.getItem(key);
            },
            set: function(key, val) {
                return $window.localStorage.setItem(key, val);
            },
            unset: function(key) {
                return $window.localStorage.removeItem(key);
            }
        };
    }]);

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

angular.module('basyt-angular')
    .factory('BasytSocket', ['$rootScope', '$q', 'BasytServer', 'BasytLocalStore', function ($rootScope, $q, BasytServer, BasytLocalStore) {
        var connection, future = $q.defer();
        connect = function () {
            connection = io.connect(BasytServer.socket, BasytServer.socketOptions);
            connection
                .on('authenticated', function () {
                    future.resolve(true);
                    $rootScope.$broadcast('basyt:socket:ready');
                })
                .emit('authenticate', {token: BasytLocalStore.get('auth_token')}); //send the jwt

        };
        if(angular.isDefined(io))
          connect();
        return {
            on: function (event, cb) {
                if (connection) {
                    connection.on(event, cb);
                }
                future.promise.then(function () {
                    connection.on(event, cb);
                });
            },
            off: function (event, cb) {
                if (connection) {
                    connection.removeAllListeners(event, cb);
                }
            },
            subscribe: function (channel, data) {
                connection.emit('subscribe', {resource: channel, data: data});
            },
            unsubscribe: function (channel, data) {
                connection.emit('unsubscribe', {resource: channel, data: data});
            },
            emit: function (label, data) {
                connection.emit(label, data);
            },
            connect: connect
        };
    }]);

angular.module('basyt-angular')
    .factory('BasytUserSettings', ['$rootScope', 'BasytRequest', 'BasytAuth', function ($rootScope, BasytRequest, BasytAuth) {
        var settings, ready = false,
            service = {
                isReady: function () {
                    return ready;
                },
                getSettings: function () {
                    return ready ? settings : {};
                },
                reload: function () {
                    BasytRequest('user_settings:get')
                        .then(function (data) {
                            settings = data.result || {};
                            ready = true;
                            $rootScope.$broadcast('basyt:user_settings:ready');
                        });
                }
            };
        if(BasytAuth.isAuthenticated) {
            service.reload();
        }
        $rootScope.$on('user:login', function(){
          service.reload();
        });
        $rootScope.$on('user:logout', function(){
          ready = false;
        });
        $rootScope.$on('user:anonymous', function(){
          ready = false;
        });
        return service;
    }]);
