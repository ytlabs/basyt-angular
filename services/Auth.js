angular.module('basyt.angular')
    .factory('Auth', ['LocalStore', 'AccessLevels', 'Request', '$q', '$rootScope', function (LocalStore, AccessLevels, Request, $q, $rootScope) {
        var User,
            login = function (data) {
                LocalStore.set('auth_token', data.result.token);
                delete data.result.token;
                LocalStore.set('auth_user', JSON.stringify(data.result));
                $rootScope.$broadcast('user:login', data.result);
                User = data.result;
                $rootScope.activeUser = User;
                return User;
            },
            logout = function () {
                LocalStore.unset('auth_token');
                LocalStore.unset('auth_user');
                $rootScope.$broadcast('user:logout');
                User = null;
                $rootScope.activeUser = User;
            },
            logoutReject = function (err) {
                var deferred = $q.defer();
                logout();
                deferred.reject(err);
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
                    if (LocalStore.get('auth_token')) {
                        if (remote) Auth.authenticate();
                        if (!User) {
                            var stored = LocalStore.get('auth_user');
                            if (stored) {
                                User = angular.fromJson(stored);
                                $rootScope.activeUser = User;
                            }
                        }
                        if (access != 'USER') {
                            if (!User)
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
                    return angular.isDefined(User) && angular.isDefined(User.roles) ? User.roles.indexOf('LORD') > -1 : false;
                },
                isAdmin: function () {
                    return angular.isDefined(User) && angular.isDefined(User.roles) ? User.roles.indexOf('ADMIN') > -1 || User.roles.indexOf('LORD') > -1 : false;
                },
                login: function (credentials, rememberMe) {
                    logout();
                    //if(rememberMe)
                    return Request('user:login', {data: credentials}).then(login, logoutReject);
                },
                logout: logout,
                register: function (formData) {
                    logout();
                    return Request('user:register', {user: formData}).then(login, logoutReject);
                },
                authenticate: function () {
                    return Request('user:authorize').then(function () {
                    }, logout);
                }
            };
        return Auth;
    }]);
