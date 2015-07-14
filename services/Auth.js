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