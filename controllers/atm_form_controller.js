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

  // Store all ATM Link and QoS objects
  $scope.atmLinks = [];
  $scope.atmLinksQos = [];

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

  // Load ATM links and QoS objects on init if ATM mode
  if ($scope.$parent.form.selectionMode === "ATM") {
    loadAtmLinksAndQos();
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
    // Find the selected link object
    const linkObj = $scope.atmLinks.find(obj => {
      const addrParam = obj.Param.find(p => p.ParamName === "DestinationAddress");
      return addrParam && addrParam.ParamValue === vpiVci;
    });
    // Find the corresponding QoS object
    let qosObj = null;
    if (linkObj) {
      const linkNumMatch = linkObj.ObjName.match(/Device\.ATM\.Link\.(\d+)$/);
      if (linkNumMatch) {
        const qosObjName = `Device.ATM.Link.${linkNumMatch[1]}.QoS`;
        qosObj = $scope.atmLinksQos.find(obj => obj.ObjName === qosObjName);
      }
    }
    // Fill fields from linkObj and qosObj
    if (qosObj) {
      $scope.atmData.atmQosClass = getParamValue(qosObj, "QoSClass");
      $scope.atmData.peakCellRate = parseInt(getParamValue(qosObj, "PeakCellRate")) || "";
      $scope.atmData.maximumBSize = parseInt(getParamValue(qosObj, "MaximumBurstSize")) || "";
      $scope.atmData.sustainableCellRate = parseInt(getParamValue(qosObj, "SustainableCellRate")) || "";
    } else {
      $scope.atmData.atmQosClass = "";
      $scope.atmData.peakCellRate = "";
      $scope.atmData.maximumBSize = "";
      $scope.atmData.sustainableCellRate = "";
    }
    $scope.updateParent();
  };

  // Helper to get param value from object
  function getParamValue(obj, paramName) {
    const param = obj.Param.find(p => p.ParamName === paramName);
    return param ? param.ParamValue : "";
  }

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

  // Load all ATM Link and QoS objects, fill VPI/VCI dropdown
  async function loadAtmLinksAndQos() {
    try {
      const response = await $http.get(
        URL + "cgi_get?Object=Device.ATM.Link"
      );
      const objects = response.data.Objects || [];
      $scope.atmLinks = objects.filter(obj => /^Device\.ATM\.Link\.\d+$/.test(obj.ObjName));
      $scope.atmLinksQos = objects.filter(obj => /\.QoS$/.test(obj.ObjName));
      $scope.vpiVciOptions = $scope.atmLinks.map(obj => {
        const addrParam = obj.Param.find(p => p.ParamName === "DestinationAddress");
        return addrParam ? addrParam.ParamValue : null;
      }).filter(Boolean);
    } catch (err) {
      console.error("Failed to load ATM Link/QoS objects", err);
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
    debugger;
    try {
      // If edit mode, delete old connection first
      
      if ($scope.$parent.isEditMode) {
        await $scope.deleteConnection();
      }

      let randomNumber = parseInt(localStorage.getItem("randomvalue"));
      if (isNaN(randomNumber)) {
        randomNumber = Math.floor(Math.random() * 1000); // fallback
      }
      const dslLowerLayer = "Device.DSL.Line.1."; // Assuming fixed DSL line

      // ATM Layer
      const atmAlias = `cpe-WEB-ATMLink-${randomNumber}`;
      const qosPath = `Device.ATM.Link.${atmAlias}.QoS`;

      // Ethernet Link
      const ethAlias = `cpe-WEB-EthernetLink-${randomNumber}`;

      // PPP Interface
      const pppAlias = `cpe-WEB-PPPInterface-${randomNumber}`;
      const pppUsername = encodeURIComponent(
        `${$scope.atmData.username}@tedata.net.eg`
      );
      const pppPassword = encodeURIComponent($scope.atmData.password);

      // IP Interface
      const ipAlias = `cpe-WEB-IPInterface-${randomNumber}`;

      // 1. Start request string
      let connectionRequest = "";

      // 2. ATM Link Layer
      connectionRequest += `&Object=Device.ATM.Link&Operation=Add&Enable=true&Alias=${atmAlias}`;
      connectionRequest += `&LowerLayers=${dslLowerLayer}`;
      connectionRequest += `&DestinationAddress=${$scope.atmData.vpiVci}`;
      connectionRequest += `&Encapsulation=${$scope.atmData.encapsulation}`;
      connectionRequest += `&LinkType=${$scope.atmData.linkType}`;

      // 3. QoS Settings
      connectionRequest += `&Object=Device.ATM.Link.${atmAlias}.QoS&Operation=Modify`;
      connectionRequest += `&QoSClass=${$scope.atmData.atmQosClass}`;
      if ($scope.atmData.peakCellRate !== undefined && $scope.atmData.peakCellRate !== "" && $scope.atmData.peakCellRate !== null) {
        connectionRequest += `&PeakCellRate=${$scope.atmData.peakCellRate}`;
      }
      if ($scope.atmData.maximumBSize !== undefined && $scope.atmData.maximumBSize !== "" && $scope.atmData.maximumBSize !== null) {
        connectionRequest += `&MaximumBurstSize=${$scope.atmData.maximumBSize}`;
      }
      if ($scope.atmData.sustainableCellRate !== undefined && $scope.atmData.sustainableCellRate !== "" && $scope.atmData.sustainableCellRate !== null) {
        connectionRequest += `&SustainableCellRate=${$scope.atmData.sustainableCellRate}`;
      }

      // 4. IP Interface
      connectionRequest += `&Object=Device.IP.Interface&Operation=Add&Enable=true&Alias=${ipAlias}`;
      connectionRequest += `&LowerLayers=Device.PPP.Interface.${pppAlias}`;
      connectionRequest += `&X_LANTIQ_COM_DefaultGateway=${$scope.atmData.defaultGateway === '1' ? 'true' : 'false'}`;

      // 5. Ethernet Link
      connectionRequest += `&Object=Device.Ethernet.Link&Operation=Add&Enable=true&Alias=${ethAlias}`;
      connectionRequest += `&LowerLayers=Device.ATM.Link.${atmAlias}`;

      // 6. PPP Interface
      connectionRequest += `&Object=Device.PPP.Interface&Operation=Add&Enable=true&Alias=${pppAlias}`;
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

  $scope.$on("addAtmConnection", function() {
    debugger;
    $scope.addNewConnection();
  });

  loadUserPassData();

  // Watch for changes in connectionType and load data accordingly
  $scope.$watch("atmData.connectionType", function(newValue) {
    if (newValue === "Bridge") {
      loadBridgeConnections();
    } else {
      loadUserPassData();
    }
  });

  async function getAtmConnectionObjects(ipInterface) {
    let objectsToDelete = [];
    try {
      // 1. IP Interface
      objectsToDelete.push(ipInterface);

      // 2. Get PPP Interface from IP's LowerLayers
      const ipData = await $http.get(URL + "cgi_get_nosubobj?Object=" + ipInterface);
      const ipObj = ipData.data.Objects[0];
      const pppInterface = ipObj.Param.find(x => x.ParamName === "LowerLayers")?.ParamValue;
      if (pppInterface) objectsToDelete.push(pppInterface);

      // 3. Get Ethernet Interface from PPP's LowerLayers
      const pppData = await $http.get(URL + "cgi_get_nosubobj?Object=" + pppInterface);
      const pppObj = pppData.data.Objects[0];
      const ethInterface = pppObj.Param.find(x => x.ParamName === "LowerLayers")?.ParamValue;
      if (ethInterface) objectsToDelete.push(ethInterface);

      // 4. Get ATM Link from Ethernet's LowerLayers
      const ethData = await $http.get(URL + "cgi_get_nosubobj?Object=" + ethInterface);
      const ethObj = ethData.data.Objects[0];
      const atmLink = ethObj.Param.find(x => x.ParamName === "LowerLayers")?.ParamValue;
      if (atmLink) objectsToDelete.push(atmLink);

      return objectsToDelete;
    } catch (err) {
      console.error("Error traversing ATM connection chain", err);
      return objectsToDelete;
    }
  }

  $scope.deleteConnection = async function() {
    try {
      let objects = await getAtmConnectionObjects($scope.$parent.internetObject.split(",")[0]);
      let deleteRequest = "";
      objects.forEach(objName => {
        if (objName) deleteRequest += `Object=${objName}&Operation=Del&`;
      });
      if (deleteRequest) {
        await $http.post(URL + "cgi_set", deleteRequest);
      }
    } catch (err) {
      console.error("Error deleting ATM connection:", err);
    }
  };
});
