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
