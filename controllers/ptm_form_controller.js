myapp.controller("ptm_form_controller", function($scope, $http) {
  // Initialize local ptmData for the child controller
  $scope.ptmData = {
    connectionType: "PPPoE",
    username: "",
    password: "",
    mac_address: "",
    mtu_size: "1492",
    macCloneEnabled: false,
    enableVlan: "0",
    ipv6enable: "0",
    defaultGateway: "1",
  };

  $scope.connectionTypes = ["PPPoE", "Bridge"];
  $scope.bridgeConnections = [];

  $scope.editEthernetInterface = "";
  $scope.editPPPInterface = "";
  $scope.editIPInterface = "";
  $scope.editAlias = "";

  // Password visibility toggle
  $scope.Passwordfieldstatus = false;

  // Validation patterns
  $scope.patterns = {
    username: /^\d+$/, // Only numbers
    password: /^\d+$/, // Only numbers
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
      mtu_size: "1492",
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
        $scope.editIPInterface = $scope.$parent.internetObject.split(",")[0];
        //get PPP interface data //res1
        const pppInterfaceData = await $http.get(
          URL + "cgi_get_nosubobj?Object=" + $scope.editIPInterface
        );
        const pppObj = pppInterfaceData.data["Objects"][0];

        $scope.editPPPInterface = pppObj.Param.find(
          (x) => x.ParamName === "LowerLayers"
        )?.ParamValue;

        const userPassResponse = await $http.get(
          URL + "cgi_get_nosubobj?Object=" + $scope.editPPPInterface
        );

        $scope.ptmData.defaultGateway =
          pppObj.Param.find(
            (x) => x.ParamName === "X_LANTIQ_COM_DefaultGateway"
          )?.ParamValue === "true"
            ? "1"
            : "0";

        $scope.ptmData.mtu_size = pppObj.Param.find(
          (x) => x.ParamName === "MaxMTUSize"
        )?.ParamValue;

        const userPassData = userPassResponse.data["Objects"][0];

        $scope.editEthernetInterface = userPassData.Param.find(
          (x) => x.ParamName === "LowerLayers"
        )?.ParamValue;

        setTimeout(() => {
          $scope.$apply(() => {
            $scope.ptmData.username =
              userPassData.Param.find(
                (x) => x.ParamName === "Username"
              )?.ParamValue.split("@")[0] || "";
            $scope.ptmData.password =
              userPassData.Param.find((x) => x.ParamName === "Password")
                ?.ParamValue || "";
          });
        }, 200);

        $scope.updateParent();
      }
    } catch (error) {
      console.error("Error loading user_pass data:", error);
    }
  }

  // Listen for reset event from parent
  $scope.$on("resetPtmForm", function() {
    $scope.resetForm();
  });

  // Add this property to store the bridge object name
  $scope.bridgeObjectName = "";

  // Update the loadBridgeConnections function to store the bridge object name
  async function loadBridgeConnections() {
    if ($scope.ptmData.connectionType !== "Bridge") {
      return;
    }
    try {
      const response = await $http.get(
        URL +
          "cgi_get_fillparams?Object=Device.Bridging.Bridge&X_LANTIQ_COM_Name="
      );

      if (
        response.data &&
        response.data.Objects &&
        response.data.Objects.length > 0
      ) {
        // Store the bridge object name (e.g. "Device.Bridging.Bridge.1")
        $scope.bridgeObjectName = response.data.Objects[0].ObjName;

        // Extract bridge connections as before
        $scope.bridgeConnections = response.data.Objects.map((bridge) => {
          const param = bridge.Param.find(
            (x) => x.ParamName === "X_LANTIQ_COM_Name"
          );
          return param ? param.ParamValue : null;
        }).filter((value) => value !== null);
      } else {
        $scope.bridgeConnections = [];
        $scope.bridgeObjectName = "";
      }
    } catch (error) {
      console.error("Error loading bridge connections:", error);
    }
  }

  // Function to delete the old connection in edit mode
  async function deleteOldPtmConnection() {
    const DELETE_Request = `Object=${$scope.editIPInterface}&Operation=Del&Object=${$scope.editPPPInterface}&Operation=Del&Object=${$scope.editEthernetInterface}&Operation=Del`;
    debugger;
    return await $http.post(URL + "cgi_set", DELETE_Request);
  }

  $scope.addNewConnection = async function() {
    try {
      const randomNumber = parseInt(localStorage.getItem("randomvalue"));

      const lowerLayer = await $http.get(
        URL +
          `cgi_get_fillparams?Object=Device.X_LANTIQ_COM_NwHardware.WANGroup.${
            $scope.$parent.form.selectionMode === "PTM" ? 1 : 3
          }&MappingLowerLayer=`
      );

      const WanGroupMappingLayer =
        lowerLayer.data["Objects"][0].Param[0].ParamValue;

      let connectionRequest = "";

      if ($scope.ptmData.connectionType === "PPPoE") {
        connectionRequest = `Object=Device.IP.Interface&Operation=Add&Enable=true&Alias=cpe-WEB-IPInterface-${randomNumber}&LowerLayers=Device.PPP.Interface.cpe-WEB-PPPInterface-${randomNumber}&IPv6Enable=${$scope.ptmData.ipv6enable}&MaxMTUSize=${$scope.ptmData.mtu_size}&X_LANTIQ_COM_DefaultGateway=${$scope.ptmData.defaultGateway}&Object=Device.Ethernet.Link&Operation=Add&Enable=true&Alias=cpe-WEB-EthernetLink-${randomNumber}&LowerLayers=${WanGroupMappingLayer}&Object=Device.PPP.Interface&Operation=Add&Enable=true&Alias=cpe-WEB-PPPInterface-${randomNumber}&Username=${$scope.ptmData.username}%40tedata.net.eg&Password=${$scope.ptmData.password}&LowerLayers=Device.Ethernet.Link.cpe-WEB-EthernetLink-${randomNumber}`;
      } else if ($scope.ptmData.connectionType === "Bridge") {
        if (!$scope.bridgeObjectName) {
          throw new Error("Bridge object name not found");
        }

        connectionRequest = `Object=Device.IP.Interface&Operation=Add&Enable=true&Alias=cpe-WEB-IPInterface-${randomNumber}&LowerLayers=Device.Ethernet.Link.cpe-WEB-EthernetLink-${randomNumber}&Object=Device.Ethernet.Link&Operation=Add&Enable=true&Alias=cpe-WEB-EthernetLink-${randomNumber}&LowerLayers=${$scope.bridgeObjectName}.Port.cpe-WEB-BridgingBridge1Port-${randomNumber}&Object=${$scope.bridgeObjectName}.Port&Operation=Add&Enable=true&Alias=cpe-WEB-BridgingBridge1Port-${randomNumber}&LowerLayers=${WanGroupMappingLayer}`;
      }

      let deleteRes = 1;
      if ($scope.$parent.isEditMode) {
        deleteRes = await deleteOldPtmConnection();
        if (!deleteRes || deleteRes.status !== 200) {
          alert("Problem Deleting Old PTM Connection");
          throw new Error("Problem Deleting Old PTM Connection");
        }
      }

      const addResult = await $http.post(URL + "cgi_set", connectionRequest);

      if (addResult.status === 200) {
        $scope.$emit("connectionAdded", true);
      } else {
        // Check if result contains error details
        if (addResult.data?.Objects?.[0]?.Param?.[0]?.ParamValue) {
          alert(addResult.data.Objects[0].Param[0].ParamValue);
        } else {
          alert("Something wrong happened");
        }
      }
    } catch (error) {
      console.error("Error adding new connection:", error);
      alert("Failed to add connection.");
    } finally {
      $("#ajaxLoaderSection").hide();
    }
  };

  $scope.$on("addPtmConnection", function() {
    $scope.addNewConnection();
  });

  loadUserPassData();

  // Watch for changes in connectionType and load data accordingly
  $scope.$watch("ptmData.connectionType", function(newValue) {
    if (newValue === "Bridge") {
      loadBridgeConnections();
    } else {
      loadUserPassData();
    }
  });
});
