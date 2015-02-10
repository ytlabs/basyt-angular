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
