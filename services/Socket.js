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