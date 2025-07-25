myapp.controller("ptm_form_controller", function($scope, $http) {
  // Initialize local ptmData for the child controller
  $scope.ptmData = {
    connectionType: "PPPoE",
    username: "",
    password: "",
    mac_address: "",
    mtu_size: 1492,
    macCloneEnabled: false,
    enableVlan: "0",
    ipv6enable: "0",
    defaultGateway: "1",
  };

  $scope.connectionTypes = ["PPPoE", "Bridge"];
  $scope.bridgeConnections = [];
  //set defulat to PPPoE
  //$scope.ptmData.connectionType = "PPPoE";

  // Password visibility toggle
  $scope.Passwordfieldstatus = false;

  // Validation patterns
  $scope.patterns = {
    username: /^\d+$/, // Only numbers
    password: /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,}/, // Complex password
    macAddress: /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/, // MAC address
    mtuSize: /^\d+$/, // Only numbers
  };

  // Emit changes to the parent when ptmData is updated
  $scope.updateParent = function() {
    $scope.$emit("ptmDataChanged", $scope.ptmData);
  };

  // Function to reset the form fields
  $scope.resetForm = function() {
    $scope.ptmData = {
      connectionType: "PPPoE",
      username: "",
      password: "",
      mac_address: "",
      mtu_size: 1492,
      macCloneEnabled: false,
      enableVlan: "0",
      ipv6enable: "0",
      defaultGateway: "1",
    };
    $scope.updateParent(); // Notify parent of reset
  };

  // Function to fetch and populate user_pass data in edit mode
  async function loadUserPassData() {
    try {
      if ($scope.$parent.internetObject) {
        const DeviceIpInterface = $scope.$parent.internetObject.split(",")[0];
        //get PPP interface data //res1
        const pppInterfaceData = await $http.get(
          URL + "cgi_get_nosubobj?Object=" + DeviceIpInterface
        );
        const pppObj = pppInterfaceData.data["Objects"][0];

        const lowerLayerRes1 = pppObj.Param.find(
          (x) => x.ParamName === "LowerLayers"
        )?.ParamValue;

        const userPassResponse = await $http.get(
          URL + "cgi_get_nosubobj?Object=" + lowerLayerRes1
        );

        const userPassData = userPassResponse.data["Objects"][0];

        setTimeout(() => {
          $scope.$apply(() => {
            $scope.ptmData.username =
              userPassData.Param.find(
                (x) => x.ParamName === "Username"
              )?.ParamValue.split("@")[0] || "";
            $scope.ptmData.password =
              userPassData.Param.find((x) => x.ParamName === "Password")
                ?.ParamValue || "";
            $scope.ptmData.mtu_size =
              parseInt(
                userPassData.Param.find((x) => x.ParamName === "MaxMRUSize")
                  ?.ParamValue
              ) || 1492;
          });
        }, 200);

        $scope.updateParent(); // Notify parent of updated data
      }
    } catch (error) {
      console.error("Error loading user_pass data:", error);
    }
  }

  // Listen for reset event from parent
  $scope.$on("resetPtmForm", function() {
    $scope.resetForm();
  });

  // Function to load bridge connections

  async function loadBridgeConnections() {
    if ($scope.ptmData.connectionType !== "Bridge") {
      return; // Don't load PTM data for Bridge connections
    }
    try {
      const response = await $http.get(
        URL +
          "cgi_get_fillparams?Object=Device.Bridging.Bridge&X_LANTIQ_COM_Name="
      );
      // Ensure the response contains the expected structure
      if (response.data && response.data.Objects) {
        // Extract ParamValue from each object
        $scope.bridgeConnections = response.data.Objects.map((bridge) => {
          const param = bridge.Param.find(
            (x) => x.ParamName === "X_LANTIQ_COM_Name"
          );
          return param ? param.ParamValue : null;
        }).filter((value) => value !== null); // Remove null values
      } else {
        $scope.bridgeConnections = []; // Fallback to an empty array if no data
      }
    } catch (error) {
      console.error("Error loading bridge connections:", error);
    }
  }

  loadUserPassData();

  // Watch for changes in connectionType and load data accordingly
  $scope.$watch("ptmData.connectionType", function(newValue) {
    debugger;
    if (newValue === "Bridge") {
      loadBridgeConnections();
    } else {
      loadUserPassData();
    }
  });
});
