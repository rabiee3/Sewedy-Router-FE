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
  $scope.passwords = {
    userpassword: "",
    confirmpassword: "",
  };

  $scope.checkPasswordsAreSame = function() {
    if ($scope.changePassword.userpassword.$error.pattern) {
      $scope.passwordmismatch = false;
      return false;
    }

    if (!$scope.passwords.userpassword || !$scope.passwords.confirmpassword) {
      $scope.passwordmismatch = false;
      return false;
    }

    $scope.passwordmismatch =
      $scope.passwords.userpassword !== $scope.passwords.confirmpassword;
    return !$scope.passwordmismatch;
  };

  $scope.Apply = function(event) {
    $scope.formsubmitted = true;
    var formObj = $scope.changePassword;
    var formIsValid = !(formObj && formObj.$invalid);

    if ($scope.checkPasswordsAreSame() && formIsValid) {
      var url = URL + "cgi_action";
      // Change this line:
      var payload =
        "Newpassword=" + encodeURIComponent($scope.passwords.userpassword);

      $http({
        method: "POST",
        url: url,
        data: payload,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      })
        .success(function(responseData, status) {
          var formname =
            event &&
            event.currentTarget &&
            event.currentTarget.attributes &&
            event.currentTarget.attributes["formname"]
              ? event.currentTarget.attributes["formname"].value
              : "changePassword";
          errorResponseDisplay(formname, responseData, status, event);
          console.log(status);
          $location.path("/quicksetup");
        })
        .error(function(error) {});
    }
  };

  $scope.Skip = function() {
    $scope.formsubmitted = true;
    var url = URL + "cgi_action";
    var payload = "Newpassword=" + encodeURIComponent("V1120004");

    $http({
      method: "POST",
      url: url,
      data: payload,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    })
      .success(function(responseData, status) {
        $location.path("/quicksetup");
      })
      .error(function(error) {
        alert("Something Wrong happened, please try again");
      });
  };

  function errorResponseDisplay(formname, response, status, event) {
    var formname = formname;
    $("#ajaxLoaderSection").hide();
    if (status == 200) {
      $rootScope.$broadcast("rootScope:language_changed");
    } else if (500 <= status && status < 600) {
      $scope[formname + "popup"] = true;
      $scope[formname + "popupval"] =
        response &&
        response.Objects &&
        response.Objects[0] &&
        response.Objects[0].Param &&
        response.Objects[0].Param[0]
          ? response.Objects[0].Param[0].ParamValue
          : undefined;
    } else if (status == 207) {
      localStorage.setItem("multistatus", true);
      localStorage.setItem(
        "multistatusmessage",
        response &&
          response.Objects &&
          response.Objects[0] &&
          response.Objects[0].Param &&
          response.Objects[0].Param[0]
          ? response.Objects[0].Param[0].ParamValue
          : undefined
      );
      if (elementstatus != undefined) {
        $scope.Add(elementstatus);
      } else {
        $route.reload();
      }
    } else if (400 <= status && status < 500) {
      angular.forEach((response && response.Objects) || [], function(object) {
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
