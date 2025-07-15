/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

myapp.controller("logoutController", function ($rootScope, $scope, $location,localStorageService) {
    $scope.submit = function (username, password) {
        $rootScope.disableHome = false;
        $location.path('/tabHead/adv_homepage');
        $rootScope.$broadcast('rootScope:language_changed');
        localStorage.setItem('logout', 'true');
    };
});


