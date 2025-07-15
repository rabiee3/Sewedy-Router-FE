myapp.controller("changePasswordController", function(
  $scope,
  $http,
  $route,
  $routeParams,
  $interval,
  $translate,
  $rootScope,
  TOKEN_MISMATCH_CODE,
  modifyService,
  $location
) {
  //$("#ajaxLoaderSection").show();
  pageloadiconstatus = true;
  var previoousmessages = [];
  $scope.formsubmitted = false;

  $scope.checkPasswordsAreSame = function() {
    if ($scope.userpassword !== undefined) {
      if ($scope.userpassword === $scope.confirmpassword) {
        $scope.passwordmismatch = false;
        return true;
      } else {
        $scope.passwordmismatch = true;
        return false;
      }
    }
  };

  $scope.Apply = function(event) {
    $scope.formsubmitted = true;
    if ($scope.checkPasswordsAreSame()) {
      var post = "";
      var url = URL + "cgi_action";
      var data = "Newpassword=" + $scope.userpassword;
      //var user = $rootScope.userDetails;
      var postobject = "";

      $http
        .post(url, data)
        .success(function(responseData, status) {
          var formname = event.currentTarget.attributes["formname"].value;
          errorResponseDisplay(formname, responseData, status, event);
        })
        .error(function(error) {});
    }
  };

  function errorResponseDisplay(formname, response, status, event) {
    var formname = formname;
    $("#ajaxLoaderSection").hide();
    if (status == 200) {
      $rootScope.$broadcast("rootScope:language_changed");
      $location.path("/");
    } else if (500 <= status && status < 600) {
      $scope[formname + "popup"] = true;
      $scope[formname + "popupval"] = data.Objects[0].Param[0].ParamValue;
    } else if (status == 207) {
      localStorage.setItem("multistatus", true);
      localStorage.setItem(
        "multistatusmessage",
        data.Objects[0].Param[0].ParamValue
      );
      if (elementstatus != undefined) {
        $scope.Add(elementstatus);
      } else {
        $route.reload();
      }
    } else if (400 <= status && status < 500) {
      angular.forEach(data.Objects, function(object) {
        var respobject = object.ObjName.replace(/\./g, "").replace(/\*/g, "");
        angular.forEach(object.Param, function(param) {
          $scope[respobject + "_" + param.ParamName + "responsestatus"] = true;
          $scope[respobject + "_" + param.ParamName + "val"] = param.ParamValue;
        });
      });
    } else if (status == TOKEN_MISMATCH_CODE) {
      $scope.Apply(event);
    }
    $scope.formsubmitted = false;
  }
});
