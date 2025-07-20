myapp.controller("ptm_form_controller", function($scope, $http) {
  // Bind ptmData to parent scope for shared access
  $scope.ptmData = $scope.$parent.ptmData;
  $scope.ptmData.defaultGateway = "1";

  // Password visibility toggle
  $scope.Passwordfieldstatus = false;

  $scope.patterns = {
    username: /^\d+$/, // Only numbers
    password: /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,}/, // Complex password
    macAddress: /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/, // MAC address
    mtuSize: /^\d+$/, // Only numbers
  };

  // Only fetch PTM-specific data using parent context
  async function loadPTMData() {
    const deviceIPInterface = $scope.$parent.DeviceIpInterface;
    if (!deviceIPInterface) return;

    //get PPP interface data //res1
    const pppInterfaceData = await $http.get(
      URL + "cgi_get_nosubobj?Object=" + deviceIPInterface
    );
    const pppObj = pppInterfaceData.data["Objects"][0];
    const aliasRes1 = pppObj.Param.find(
      (x) => x.ParamName === "Alias"
    )?.ParamValue;
    $scope.$parent.PPP_Interface = aliasRes1;

    const lowerLayerRes1 = pppObj.Param.find(
      (x) => x.ParamName === "LowerLayers"
    )?.ParamValue;
    $scope.$parent.LowerLayers = lowerLayerRes1;

    //get username & password
    const user_pass = await $http.get(
      URL + "cgi_get_nosubobj?Object=" + $scope.$parent.LowerLayers
    );
    const userObj = user_pass.data["Objects"][0];
    const usernameRaw = userObj.Param.find((x) => x.ParamName === "Username")?.ParamValue || "";
    const password = userObj.Param.find((x) => x.ParamName === "Password")?.ParamValue || "";
    const mtuSize = userObj.Param.find((x) => x.ParamName === "MaxMRUSize")?.ParamValue;
    const mtu = parseInt(mtuSize) || 1492;
    $scope.$evalAsync(function() {
      $scope.ptmData.username = usernameRaw.split('@')[0];;
      $scope.ptmData.password = password;
      $scope.ptmData.mtu_size = mtu;
    });
  }

  // Watch for parent DeviceIpInterface to be set, then load PTM data
  $scope.$watch(
    function() {
      return $scope.$parent.DeviceIpInterface;
    },
    function(newVal) {
      if (newVal) {
        loadPTMData();
      }
    }
  );
});
