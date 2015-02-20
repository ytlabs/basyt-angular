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