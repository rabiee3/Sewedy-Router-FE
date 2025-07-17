myapp.controller("wan_wanconnectionsform", function(
  $rootScope,
  $scope,
  $route,
  $http,
  $location,
  localStorageService,
  modifyService,
  $q,
  $http,
  languageService,
  TOKEN_MISMATCH_CODE
) {

  $scope.form = {
    username: "",
    password: "",
    // add more fields as needed
  };

  $scope.submit = function() {
    // handle form submission
    alert("Submitted: " + JSON.stringify($scope.form));
  };

  $scope.homefun = function() {
    if (breadcrumbsdata[$route.current.params.param2] == undefined)
      bdata = JSON.parse(localStorage.getItem("breadcrumbarray"));
    else bdata = breadcrumbsdata[$route.current.params.param2];

    if (bdata[0]["name"] == "Advanced") tab = "profile";
    else tab = "home";

    $rootScope.accordian(
      tab + "-" + bdata[1]["name"] + "-" + bdata[1]["index"],
      true
    );
  };
});
