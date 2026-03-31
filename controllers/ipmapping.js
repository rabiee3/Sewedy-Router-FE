myapp.controller("ipmapping", function($scope) {
  // Load rules from localStorage
  function loadRules() {
    console.log("controller init")
    const data = localStorage.getItem("ipMappingRules");
    $scope.ipMappingRules = data ? JSON.parse(data) : [];
  }

  function saveRules() {
    localStorage.setItem("ipMappingRules", JSON.stringify($scope.ipMappingRules));
  }

  // Initial form state
  $scope.form = {
    priority: 1,
    mode: "One-to-One",
    wanName: "7_TR069_INTERNET_R_VDSL_VID_",
    startPrivateIpAddress: "",
    endPrivateIpAddress: "",
    startPublicIpAddress: "",
    endPublicIpAddress: ""
  };

  // IP address validation
  function isValidIp(ip) {
    if (!ip) return false;
    // Simple IPv4 regex
    return /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(ip);
  }

  $scope.onModeChange = function() {
    // You can add logic here to enable/disable fields based on mode if needed
    // For now, all fields are enabled
  };

  $scope.addRule = function() {
    debugger;
    // Validation
    if (!$scope.form.priority || $scope.form.priority < 1 || $scope.form.priority > 16) {
      alert("Priority must be between 1 and 16.");
      return;
    }
    if (!$scope.form.startPrivateIpAddress || !isValidIp($scope.form.startPrivateIpAddress)) {
      alert("Enter a valid Start Private IP Address.");
      return;
    }
    if ($scope.form.endPrivateIpAddress && !isValidIp($scope.form.endPrivateIpAddress)) {
      alert("Enter a valid End Private IP Address.");
      return;
    }
    if (!$scope.form.startPublicIpAddress || !isValidIp($scope.form.startPublicIpAddress)) {
      alert("Enter a valid Start Public IP Address.");
      return;
    }
    if ($scope.form.endPublicIpAddress && !isValidIp($scope.form.endPublicIpAddress)) {
      alert("Enter a valid End Public IP Address.");
      return;
    }
    $scope.ipMappingRules.push({
      priority: $scope.form.priority,
      mode: $scope.form.mode,
      wanName: $scope.form.wanName,
      startPrivateIpAddress: $scope.form.startPrivateIpAddress,
      endPrivateIpAddress: $scope.form.endPrivateIpAddress,
      startPublicIpAddress: $scope.form.startPublicIpAddress,
      endPublicIpAddress: $scope.form.endPublicIpAddress
    });
    saveRules();
    // Reset form
    $scope.form.priority = 1;
    $scope.form.mode = "One-to-One";
    $scope.form.wanName = "7_TR069_INTERNET_R_VDSL_VID_";
    $scope.form.startPrivateIpAddress = "";
    $scope.form.endPrivateIpAddress = "";
    $scope.form.startPublicIpAddress = "";
    $scope.form.endPublicIpAddress = "";
    $scope.onModeChange();
  };

  $scope.deleteRule = function(idx) {
    $scope.ipMappingRules.splice(idx, 1);
    saveRules();
  };

  // Initial load
  loadRules();
  $scope.onModeChange();
});
