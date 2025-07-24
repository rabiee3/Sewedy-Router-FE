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

  // Function to reset the form fields
  $scope.resetForm = function() {
    debugger;
    $scope.ptmData.username = "";
    $scope.ptmData.password = "";
    $scope.ptmData.mac_address = "";
    $scope.ptmData.mtu_size = 1492;
    $scope.ptmData.macCloneEnabled = false;
    $scope.ptmData.enableVlan = "0";
    $scope.ptmData.ipv6enable = "0";
    $scope.ptmData.defaultGateway = "1";
    $scope.ptmData.connectionType = "PPPoE";
  };

  $scope.$on("resetPtmForm", function() {
    $scope.resetForm();
  });

  $scope.bridgeConnections = [];

  // Function to load bridge connections
  async function loadBridgeConnections() {
    if ($scope.$parent.ptmData.connectionType !== "Bridge") {
      return; // Don't load PTM data for Bridge connections
    }
    try {
      const response = await $http.get(
        URL +
          "cgi_get_fillparams?Object=Device.Bridging.Bridge&X_LANTIQ_COM_Name="
      );
      $scope.bridgeConnections = response.data["Objects"][0].Param;
    } catch (error) {
      console.error("Error loading bridge connections:", error);
    }
  }

  // Only fetch PTM-specific data using parent context
  async function loadPPPoEData() {
    if ($scope.$parent.ptmData.connectionType === "Bridge") {
      return; // Don't load PTM data for Bridge connections
    }

    const deviceIPInterface = $scope.$parent.DeviceIpInterface;
    if (!deviceIPInterface) return;

    //get PPP interface data //res1
    const pppInterfaceData = await $http.get(
      URL + "cgi_get_nosubobj?Object=" + deviceIPInterface
    );
    const pppObj = pppInterfaceData.data["Objects"][0];

    const aliasRes1 = pppObj.Param.find((x) => x.ParamName === "Alias")
      ?.ParamValue;
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
    const usernameRaw =
      userObj.Param.find((x) => x.ParamName === "Username")?.ParamValue || "";
    const password =
      userObj.Param.find((x) => x.ParamName === "Password")?.ParamValue || "";
    const mtuSize = userObj.Param.find((x) => x.ParamName === "MaxMRUSize")
      ?.ParamValue;
    const mtu = parseInt(mtuSize) || 1492;
    $scope.$evalAsync(function() {
      $scope.ptmData.username = usernameRaw.split("@")[0];
      $scope.ptmData.password = password;
      $scope.ptmData.mtu_size = mtu;
    });
  }

  //defaulted to load the

  // Watch for parent DeviceIpInterface and connectionType to be set, then load data
  $scope.$watchGroup(
    [
      function() {
        return $scope.$parent.DeviceIpInterface;
      },
      function() {
        return $scope.$parent.ptmData.connectionType;
      },
    ],
    function(newValues) {
      const deviceIpInterface = newValues[0];
      const connectionType = newValues[1];

      if (connectionType === "Bridge") {
        loadBridgeConnections();
      } else if (deviceIpInterface) {
        loadPPPoEData();
      }
    }
  );
});
