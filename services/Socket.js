angular.module('basyt.angular')
    .factory('Socket', ['BasytServer', 'LocalStore', '$rootScope', '$q', 'Auth', function (BasytServer, LocalStore, $rootScope, $q) {
        var connection, future = $q.defer();
        connect = function () {
            connection = io.connect(BasytServer.socket, BasytServer.socketOptions);
            connection
                .on('authenticated', function () {
                    future.resolve(true);
                    $rootScope.$broadcast('basyt:socket:ready');
                })
                .emit('authenticate', {token: LocalStore.get('auth_token')}); //send the jwt

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
            subscribe: function (event, company_id) {
                connection.emit('subscribe', {resource: event, company_id: company_id});
            },
            unsubscribe: function (event, company_id) {
                connection.emit('unsubscribe', {resource: event, company_id: company_id});
            },
            connect: connect
        };
    }]);