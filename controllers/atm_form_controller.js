myapp.controller("atm_form_controller", function($scope, $http) {
  $scope.atmData = {
    connectionType: "",
    username: "",
    password: "",
    mac_address: "",
    mtu_size: 1492,
    macCloneEnabled: false,
    enableVlan: "0",
    ipv6enable: "0",
    defaultGateway: "1",
    linkType: "",
    encapsulation: "LLC",
    atmQosClass: "UBR",
    peakCellRate: 1414,
    maximumBSize: 11,
    sustainableCellRate: 1121,
    vpiVci: "",
  };

  ($scope.connectionTypes = []),
    ($scope.encapsulationOptions = ["LLC", "VCMUX"]),
    ($scope.atmQosClassOptions = ["UBR", "CBR", "NRT-VBR", "RT-VBR", "UBR+"]),
    ($scope.linkTypeOptions = ["EoA", "PPPoA"]);

  $scope.vpiVciOptions = []; // filled from CGI

  $scope.connectionTypeOptionsMap = {
    EoA: ["PPPoE", "Bridge"],
    PPPoA: ["PPPoA"],
  };
  $scope.bridgeConnections = [];

  //onInit or on parent changes the selectioMode
  if ($scope.$parent.form.selectionMode === "ATM") {
    loadExistingVpiVci();
  }

  // Password visibility toggle
  $scope.Passwordfieldstatus = false;
  $scope.lowerPTM_link = "";

  // Validation patterns
  $scope.patterns = {
    username: /^\d+$/, // Only numbers
    password: /^\d+$/, // Only numbers
    macAddress: /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/, // MAC address
    mtuSize: /^\d+$/, // Only numbers
  };

  // Watcher to update connectionTypes dynamically
  $scope.$watch("atmData.linkType", function(newVal) {
    $scope.connectionTypes = $scope.connectionTypeOptionsMap[newVal] || [];
    $scope.atmData.connectionType = $scope.connectionTypes[0];
    $scope.updateParent();
  });

  // Emit changes to the parent when atmData is updated
  $scope.updateParent = function() {
    $scope.$emit("atmDataChanged", $scope.atmData);
  };

  $scope.selectVpiVci = function(vpiVci) {
    $scope.atmData.vpiVci = vpiVci;
    $scope.updateParent();
  };

  // Function to reset the form fields
  $scope.resetForm = function() {
    $scope.atmData = {
      connectionType: "",
      username: "",
      password: "",
      mac_address: "",
      mtu_size: 1492,
      macCloneEnabled: false,
      enableVlan: "0",
      ipv6enable: "0",
      defaultGateway: "1",
      linkType: "",
      encapsulation: "LLC",
      atmQosClass: "UBR",
      peakCellRate: 1414,
      maximumBSize: 11,
      sustainableCellRate: 1121,
    };
    $scope.updateParent(); // Notify parent of reset
  };

  //function to load VPI/VCI
  async function loadExistingVpiVci() {
    try {
      const response = await $http.get(
        URL + "cgi_get_fillparams?Object=Device.ATM.Link&DestinationAddress="
      );

      if (response.data?.Objects?.length) {
        $scope.vpiVciOptions = response.data.Objects.map((obj) => {
          const addrParam = obj.Param.find(
            (p) => p.ParamName === "DestinationAddress"
          );
          return addrParam?.ParamValue;
        }).filter(Boolean); // remove null/undefined
      } else {
        $scope.vpiVciOptions = [];
      }
    } catch (err) {
      console.error("Failed to load existing VPI/VCI list", err);
      $scope.vpiVciOptions = [];
    }
  }

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

        $scope.lowerPTM_link = pppObj.Param.find(
          (x) => x.ParamName === "LowerLayers"
        )?.ParamValue;

        const userPassResponse = await $http.get(
          URL + "cgi_get_nosubobj?Object=" + $scope.lowerPTM_link
        );

        const userPassData = userPassResponse.data["Objects"][0];

        setTimeout(() => {
          $scope.$apply(() => {
            $scope.atmData.username =
              userPassData.Param.find(
                (x) => x.ParamName === "Username"
              )?.ParamValue.split("@")[0] || "";
            $scope.atmData.password =
              userPassData.Param.find((x) => x.ParamName === "Password")
                ?.ParamValue || "";
            $scope.atmData.mtu_size =
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
  $scope.$on("resetAtmForm", function() {
    $scope.resetForm();
  });

  // Add this property to store the bridge object name
  $scope.bridgeObjectName = "";

  // Update the loadBridgeConnections function to store the bridge object name
  async function loadBridgeConnections() {
    debugger;
    if ($scope.atmData.connectionType !== "Bridge") {
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

  $scope.addNewConnection = async function() {
    try {
      const randomNumber = parseInt(localStorage.getItem("randomvalue"));
      const dslLowerLayer = "Device.DSL.Line.1."; // Assuming fixed DSL line

      // ATM Layer
      const atmAlias = `cpe-WEB-ATMLink-${randomNumber}`;
      const qosPath = `Device.ATM.Link.${atmAlias}.QoS`;

      // Ethernet Link
      const ethAlias = `cpe-WEB-EthernetLink-${randomNumber}`;

      // PPP Interface
      const pppAlias = `cpe-WEB-PPPInterface-${randomNumber}`;
      const pppUsername = encodeURIComponent(
        `${$scope.atmData.username}@tedata.com.eg`
      );
      const pppPassword = encodeURIComponent($scope.atmData.password);

      // IP Interface
      const ipAlias = `cpe-WEB-IPInterface-${randomNumber}`;

      // 1. Start request string
      let connectionRequest = "";

      // 2. ATM Link Layer
      connectionRequest += `Object=Device.ATM.Link&Operation=Add&Enable=true&Alias=${atmAlias}`;
      connectionRequest += `&LowerLayers=${dslLowerLayer}`;
      connectionRequest += `&DestinationAddress=${$scope.atmData.vpiVci}`;
      connectionRequest += `&Encapsulation=${$scope.atmData.encapsulation}`;
      connectionRequest += `&LinkType=${$scope.atmData.linkType}`;

      // 3. QoS Settings
      connectionRequest += `Object=Device.ATM.Link.${atmAlias}.QoS&Operation=Modify`;
      connectionRequest += `&QoSClass=${$scope.atmData.atmQosClass}`;
      connectionRequest += `&PeakCellRate=${$scope.atmData.peakCellRate}`;
      connectionRequest += `&MaximumBurstSize=${$scope.atmData.maximumBSize}`;
      connectionRequest += `&SustainableCellRate=${$scope.atmData.sustainableCellRate}`;

      // 4. IP Interface
      connectionRequest += `Object=Device.IP.Interface&Operation=Add&Enable=true&Alias=${ipAlias}`;
      connectionRequest += `&LowerLayers=Device.PPP.Interface.${pppAlias}`;
      connectionRequest += `&X_LANTIQ_COM_DefaultGateway=${$scope.atmData.defaultGateway}`;

      // 5. Ethernet Link
      connectionRequest += `Object=Device.Ethernet.Link&Operation=Add&Enable=true&Alias=${ethAlias}`;
      connectionRequest += `&LowerLayers=Device.ATM.Link.${atmAlias}`;

      // 6. PPP Interface
      connectionRequest += `Object=Device.PPP.Interface&Operation=Add&Enable=true&Alias=${pppAlias}`;
      connectionRequest += `&LowerLayers=Device.Ethernet.Link.${ethAlias}`;
      connectionRequest += `&MaxMRUSize=${$scope.atmData.mtu_size}`;
      connectionRequest += `&Username=${pppUsername}&Password=${pppPassword}`;

      // 7. Send request
      const result = await $http.post(URL + "cgi_set", connectionRequest);

      if (result.status === 200) {
        $scope.$emit("connectionAdded", true);
      } else {
        alert(
          result.data?.Objects?.[0]?.Param?.[0]?.ParamValue ||
            "Something went wrong."
        );
      }
    } catch (err) {
      console.error("Error adding ATM connection:", err);
      alert("Failed to add ATM connection.");
    } finally {
      $("#ajaxLoaderSection").hide();
    }
  };

  $scope.$on("addNewConnection", function() {
    $scope.addNewConnection();
  });

  loadUserPassData();

  // Watch for changes in connectionType and load data accordingly
  $scope.$watch("atmData.connectionType", function(newValue) {
    debugger;
    if (newValue === "Bridge") {
      loadBridgeConnections();
    } else {
      loadUserPassData();
    }
  });
});
