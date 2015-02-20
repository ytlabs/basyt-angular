angular.module('basyt.angular', ['ui.router'])
    .config(['$httpProvider', function ($httpProvider) {
        $httpProvider.interceptors.push('AuthInterceptor');
    }])
    .run(['$rootScope', 'Auth', '$state',function($rootScope, Auth, $state){
        $rootScope.$on("$stateChangeStart", function(event, next) {
            if (next.role) {
                if (!Auth.isAuthenticated(next.role)) {
                    $state.go('login');
                    event.preventDefault();
                }
                else {
                    var user = Auth.getUser();
                    if (next.requireFullAuth && (angular.isUndefined(user) || !user.isFullAuth)) {
                        $state.go('login');
                        event.preventDefault();
                    }
                }
            }
        });
        $rootScope.$on('user:anonymous', function(){
            if(angular.isDefined($state.current.role) && ($state.current.role !== 'ANON'))
                $state.go('login');
        });
    }]);