angular.module('basyt.angular', ['ui.router'])
    .config(['$httpProvider', function ($httpProvider) {
        $httpProvider.interceptors.push('AuthInterceptor');
    }])
    .value('BasytAnonState', 'login')
    .value('BasytAuthMessages', {
        'loginRequired': 'Login Required',
        'loginSuccess': 'Login Successful',
        'loginFailed': 'Login Failed',
        'logoutSuccess': 'Logout Successful',
        'authFailed': 'Authorization Failed'
    })
    .run(['$rootScope', 'Auth', '$state','BasytAnonState', '$injector', 'BasytAuthMessages', function($rootScope, Auth, $state, BasytAnonState, $injector, BasytAuthMessages){
        var $alert = $injector.get('$alert');
        $rootScope.$on("$stateChangeStart", function(event, next) {
            if (next.role) {
                if (!Auth.isAuthenticated(next.role)) {
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
angular.module('basyt.angular')
    .factory('Auth', ['BasytLocalStore',  'Request', '$q', '$rootScope', '$injector', 'BasytAuthMessages', function (BasytLocalStore, Request, $q, $rootScope, $injector, BasytAuthMessages) {
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
                authorize: function (access) {
                    if (access) {
                        return this.isAuthenticated(access);
                    } else {
                        return true;
                    }
                },
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
                    return Request('user:login', {data: credentials}).then(login, logoutReject);
                },
                logout: logout,
                register: function (formData) {
                    logout(true);
                    return Request('user:register', {user: formData}).then(login, logoutReject);
                },
                authenticate: function () {
                    return Request('user:authorize').then(function () {
                    }, logout);
                }
            };
        $rootScope.activeUser = User;
        return Auth;
    }]);
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
angular.module('basyt.angular')
    .service('DataSource', ['Request', '$rootScope', 'filterFilter', 'Socket', '$q', function (Request, $rootScope, filterFilter, Socket, $q) {
        var DataSource = function (entityName, map) {
            var that = this;
            this.endpoint = entityName + ':list';
            this.socketChannel = 'entity:' + entityName;
            this.map = map;
            this.isLoaded = false;
            this.listeners = [];
            this.value = [];
            Socket.on('entity:update:' + entityName, function (message) {
                that.reload(false);
            });
            this.reload(true);
        };

        DataSource.prototype.bind = function () {
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
        DataSource.prototype.reload = function (subscribe) {
            var that = this;
            Request(this.endpoint, {params: {deep: true}})
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
                        Socket.subscribe(that.socketChannel);
                    }
                },
                function () {
                    that.value = [];
                    that.isLoaded = true;
                });
        };

        return DataSource;
    }]);

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
angular.module('basyt.angular')
    .constant('BasytServer', {
        host: window.API_URL,
        socket: window.SOCKET_URL,
        socketOptions: window.SOCKET_OPTS
    })
    .factory('Request', ['$http', 'BasytServer', '$q', '$rootScope', '$urlMatcherFactory', function ($http, BasytServer, $q, $rootScope, $urlMatcherFactory) {
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
angular.module('basyt.angular')
    .factory('Socket', ['BasytServer', 'BasytLocalStore', '$rootScope', '$q', 'Auth', function (BasytServer, BasytLocalStore, $rootScope, $q) {
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
            subscribe: function (event, data) {
                connection.emit('subscribe', {resource: event, data: data});
            },
            unsubscribe: function (event, data) {
                connection.emit('unsubscribe', {resource: event, data: data});
            },
            emit: function (label, data) {
                connection.emit(label, data);
            },
            connect: connect
        };
    }]);
angular.module('basyt.angular')
    .factory('UserSettings', ['Request', '$rootScope', function (Request, $rootScope) {
        var settings, ready = false,
            service = {
                isReady: function () {
                    return ready;
                },
                getSettings: function () {
                    return ready ? settings : {};
                },
                reload: function () {
                    Request('user_settings:get')
                        .then(
                        function (data) {
                            settings = data.result || {};
                            ready = true;
                            $rootScope.$broadcast('user:registered');
                        },
                        function(){
                            $rootScope.$broadcast('user:anonymous');
                        });
                }
            };

        service.reload();

        return service;
    }]);