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
                .on('connect_error', function () {
                    $rootScope.$broadcast('basyt:socket:disconnected');
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
                else {
                    future.promise.then(function () {
                        connection.on(event, cb);
                    });
                }
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
            isConected: function () {
                return connection.connected;
            },
            connect: connect
        };
    }]);