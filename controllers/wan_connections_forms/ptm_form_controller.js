myapp.controller("ptm_form_controller", function($scope) {
  // Bind ptmData to parent scope for shared access
  $scope.ptmData = $scope.$parent.ptmData;

  // Password visibility toggle
  $scope.Passwordfieldstatus = false;

  $scope.patterns = {
    username: /^\d+$/, // Only numbers
    password: /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,}/, // Complex password
    macAddress: /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/, // MAC address
    mtuSize: /^\d+$/ // Only numbers
  };

});
