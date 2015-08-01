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
