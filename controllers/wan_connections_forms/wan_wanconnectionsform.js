myapp.controller("wan_wanconnectionsform", function($scope) {
  console.log("controller started");
  // Initialize main form data
  $scope.form = {
    selectionMode: "PTM",
  };

  // Initial template selection
  $scope.loadForm = function() {
    switch ($scope.form.selectionMode) {
      case "ATM":
        $scope.currentFormTemplate = "wan_connections_views/atm-form.html";
        $scope.activeFormName = "atmForm";
        break;
      case "PTM":
        $scope.currentFormTemplate = "wan_connections_views/ptm-form.html";
        $scope.activeFormName = "ptmForm";
        break;
      case "ETH":
      default:
        $scope.currentFormTemplate = "wan_connections_views/eth-form.html";
        $scope.activeFormName = "ethForm";
        break;
    }
  };

  $scope.patterns = {
    username: /^\d+$/, // Only numbers
    password: /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,}/, // Complex password
    macAddress: /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/, // MAC address
    mtuSize: /^\d+$/ // Exactly 1492
  };

  $scope.loadForm();

  // Form submission
  $scope.submit = function() {
    // if ($scope.customWanForm.$valid) {
    //   alert("Form submitted successfully!\n" + JSON.stringify($scope.form, null, 2));
    //   console.log($scope.form);
    //   // Here you would typically make an API call
    // } else {
    //   alert("Please fix all errors before submitting.");
    // }
  };

  // Cancel button action
  $scope.cancel = function() {
    // $scope.form = {
    //   username: "",
    //   password: "",
    //   mac_address: "",
    //   mtu_size: "1492",
    //   macCloneEnabled: false,
    //   enableVlan: '0',
    //   connectionType: 'PPPoE',
    //   selectionMode: 'ETH',
    //   ipv6enable: '0',
    //   defaultGateway: '0'
    // };
    // $scope.customWanForm.$setPristine();
    // $scope.Passwordfieldstatus = false;
  };
});
