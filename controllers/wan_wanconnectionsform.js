myapp.controller("wan_wanconnectionsform", function(
  $scope,
  $http,
  $location,
  $routeParams,
  helperService
) {
  // ------------------------------------------------------------
  // Unified form model
  // ------------------------------------------------------------
  $scope.form = {
    // Basic Information
    accessType: "PTM",
    encapsulationMode: "IPoE",
    protocolType: "IPv4",
    wanMode: "RoutedWan",
    serviceType: "TR069_Internet",
    enableVlan: "0",
    vlanId: "",
    mtu_mru_size: "1492",
    macCloneEnabled: "0",
    mac_address: "",
    defaultGateway: "1",

    // IP Configuration
    ipAcqMode: "DHCP",
    enableNAT: "0",
    natType: "Port Restricted Cone NAT",

    // Static IP fields
    ipaddress: "",
    subnetmask: "",
    gatewayaddress: "",

    // PPPoE fields
    username: "",
    password: "",
    isUserDefinedDNS: false,
    primaryDNS: "",
    secondaryDNS: "",

    // ATM-specific fields
    vpiVci: "",
    encapsulation: "LLC",
    linkType: "EoA",
    atmQosClass: "UBR",
    peakCellRate: null,
    maximumBSize: null,
    sustainableCellRate: null,

    // Bridge fields
    selectedBridge: null,

    // Internal tracking
    selectedATMLink: null,
  };

  // Options for dropdowns
  $scope.serviceTypes = ["TR069_Internet"];
  $scope.policies802 = ["Custom", "From IP", "DSCP"];
  $scope.encapsulationOptions = ["LLC", "VCMUX"];
  $scope.atmQosClassOptions = ["UBR", "CBR", "NRT-VBR", "RT-VBR", "UBR+"];
  $scope.ipAcqModes = ["DHCP", "Static"];
  $scope.values802 = [0, 1, 2, 3, 4, 5, 6, 7];
  $scope.linkTypeOptions = ["EoA", "PPPoA"];

  // Data lists
  $scope.atmLinks = [];
  $scope.atmLinksQos = [];
  $scope.vpiVciOptions = [];
  $scope.bridgeConnections = [];
  $scope.staticDNSData = [];

  // State
  $scope.internetObject = $routeParams.id;
  $scope.isEditMode = !!$scope.internetObject;
  $scope.dataReady = false;
  $scope.Passwordfieldstatus = false;
  $scope.editIPInterface = "";
  $scope.loadingBridgeConnections = false;
  $scope.macAddressLoading = false;

  // Validation patterns
  $scope.patterns = {
    username: /^\d+$/,
    password: /^\d+$/,
    macAddress: /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/,
    mtu_mru_size: /^\d+$/,
    ipv4: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
  };

  // ------------------------------------------------------------
  // Helper functions
  // ------------------------------------------------------------
  function getAtmParamValue(obj, paramName) {
    const param = obj?.Param?.find((p) => p.ParamName === paramName);
    return param ? param.ParamValue : "";
  }

  function encodeParam(value) {
    return encodeURIComponent(
      value === undefined || value === null ? "" : value.toString()
    );
  }

  function generateRandomValue() {
    let randomValue = localStorage.getItem("randomvalue");
    if (!randomValue) {
      randomValue = Math.floor(Math.random() * 9990 + 10).toString();
      localStorage.setItem("randomvalue", randomValue);
    }
    return randomValue;
  }

  $scope.isExistingVpiVci = function(vpiVci) {
    if (!vpiVci || !$scope.vpiVciOptions.length) return false;
    return $scope.vpiVciOptions.includes(vpiVci);
  };

  $scope.selectVpiVci = function(vpiVci) {
    $scope.form.vpiVci = vpiVci;

    // Check if this is an existing VPI/VCI
    const linkObj = $scope.atmLinks.find((obj) => {
      const addrParam = obj.Param.find(
        (p) => p.ParamName === "DestinationAddress"
      );
      return addrParam && addrParam.ParamValue === vpiVci;
    });

    $scope.form.selectedATMLink = linkObj;

    if (linkObj) {
      // Existing link - load its QoS settings
      loadQoSDataForLink(linkObj);

      // Load other ATM link properties (for display only, not for modification)
      const existingEncapsulation = getAtmParamValue(linkObj, "Encapsulation");
      const existingLinkType = getAtmParamValue(linkObj, "LinkType");

      // Set form values for display
      $scope.form.encapsulation = existingEncapsulation || "LLC";
      $scope.form.linkType = existingLinkType || "EoA";

      // Mark ATM properties as read-only for existing links
      $scope.atmPropertiesReadOnly = true;
    } else {
      // New VPI/VCI - set default values
      $scope.form.selectedATMLink = null;
      $scope.form.atmQosClass = "UBR";
      $scope.form.peakCellRate = "";
      $scope.form.maximumBSize = "";
      $scope.form.sustainableCellRate = "";
      $scope.form.encapsulation = "LLC";
      $scope.form.linkType = "EoA";
      $scope.atmPropertiesReadOnly = false;
    }
  };

  function loadQoSDataForLink(linkObj) {
    if (!linkObj) return;

    const linkNumMatch = linkObj.ObjName.match(/Device\.ATM\.Link\.(\d+)$/);
    if (linkNumMatch) {
      const linkNum = linkNumMatch[1];

      // Only look for the main QoS object (not .0, .1, etc.)
      const qosObj = $scope.atmLinksQos.find(
        (obj) => obj.ObjName === `Device.ATM.Link.${linkNum}.QoS`
      );

      if (qosObj) {
        $scope.form.atmQosClass = getAtmParamValue(qosObj, "QoSClass") || "UBR";
        $scope.form.peakCellRate =
          parseInt(getAtmParamValue(qosObj, "PeakCellRate")) || "";
        $scope.form.maximumBSize =
          parseInt(getAtmParamValue(qosObj, "MaximumBurstSize")) || "";
        $scope.form.sustainableCellRate =
          parseInt(getAtmParamValue(qosObj, "SustainableCellRate")) || "";
      } else {
        // Default values for existing link without QoS
        $scope.form.atmQosClass = "UBR";
        $scope.form.peakCellRate = "";
        $scope.form.maximumBSize = "";
        $scope.form.sustainableCellRate = "";
      }
    }
  }

  async function loadStaticGatewayAddress(ipInterface) {
    try {
      // Normalize the interface name (remove trailing dot if present)
      const normalizedInterface = ipInterface.replace(/\.$/, "");

      // Get all IPv4Forwarding entries
      const response = await $http.get(
        URL + "cgi_get?Object=Device.Routing.Router.1.IPv4Forwarding"
      );

      console.log(
        "Loading IPv4Forwarding entries for interface:",
        normalizedInterface
      );
      console.log("Original interface:", ipInterface);

      if (response.data?.Objects?.length > 0) {
        // Find the forwarding entry for this IP interface
        const forwardingEntry = response.data.Objects.find((obj) => {
          const interfaceParam = getAtmParamValue(obj, "Interface");
          if (!interfaceParam) return false;

          // Normalize the interface parameter too (remove trailing dot)
          const normalizedParam = interfaceParam.replace(/\.$/, "");

          console.log("Checking forwarding entry:", {
            objName: obj.ObjName,
            interfaceParam: interfaceParam,
            normalizedParam: normalizedParam,
            normalizedInterface: normalizedInterface,
            matches: normalizedParam === normalizedInterface,
          });

          return normalizedParam === normalizedInterface;
        });

        if (forwardingEntry) {
          const gateway = getAtmParamValue(forwardingEntry, "GatewayIPAddress");
          console.log("Found forwarding entry:", {
            objName: forwardingEntry.ObjName,
            gateway: gateway,
          });

          if (gateway) {
            $scope.form.gatewayaddress = gateway;
            console.log("Loaded static gateway address:", gateway);

            // Also check if this forwarding rule is enabled
            const enabled = getAtmParamValue(forwardingEntry, "Enable");
            console.log("Forwarding rule enabled:", enabled);
          } else {
            console.log("No gateway found in forwarding entry");
            $scope.form.gatewayaddress = "";
          }
        } else {
          console.log(
            "No IPv4Forwarding entry found for interface:",
            normalizedInterface
          );
          $scope.form.gatewayaddress = "";
        }
      } else {
        console.log("No IPv4Forwarding objects found");
        $scope.form.gatewayaddress = "";
      }
    } catch (error) {
      console.error("Error loading static gateway address:", error);
      $scope.form.gatewayaddress = "";
    }
  }

  $scope.resetFormValidation = function() {
    if ($scope.customWanForm) {
      // Reset touched state
      $scope.customWanForm.$setUntouched();
      $scope.customWanForm.$setPristine();

      // Reset ATM form if it exists
      if ($scope.customWanForm.atmForm) {
        $scope.customWanForm.atmForm.$setUntouched();
        $scope.customWanForm.atmForm.$setPristine();
      }
    }
  };

  $scope.resetATMValidation = function() {
    if ($scope.customWanForm && $scope.customWanForm.atmForm) {
      $scope.customWanForm.atmForm.$setValidity("required", true);
      $scope.customWanForm.atmForm.$setUntouched();
      $scope.customWanForm.atmForm.$setPristine();
    }
  };

  // ------------------------------------------------------------
  // Watch for WAN Mode changes to handle Bridge mode
  // ------------------------------------------------------------
  $scope.$watch("form.wanMode", async function(newVal, oldVal) {
    if (newVal === "BridgedWan") {
      // When WAN mode is Bridged, clear IP Acquisition Mode
      $scope.form.ipAcqMode = "";
      // Load bridge connections
      await loadBridgeConnections();
    } else if (!$scope.form.ipAcqMode || newVal !== oldVal) {
      // If switching away from Bridge mode and no IP mode is set, default to DHCP
      // Also reset if we're changing modes
      if ($scope.form.encapsulationMode === "PPPoE") {
        $scope.form.ipAcqMode = "PPPoE";
      } else {
        $scope.form.ipAcqMode = "DHCP";
      }
    }
  });

  // ------------------------------------------------------------
  // Watch for Encapsulation Mode changes
  // ------------------------------------------------------------
  $scope.$watch("form.encapsulationMode", function(newVal) {
    if (newVal === "PPPoE") {
      // For PPPoE, IP Acquisition Mode should be PPPoE
      $scope.form.ipAcqMode = "PPPoE";
    } else if ($scope.form.ipAcqMode === "PPPoE" && newVal !== "PPPoE") {
      // If switching away from PPPoE, reset to DHCP
      $scope.form.ipAcqMode = "DHCP";
    }
  });

  // ------------------------------------------------------------
  // Watch for VPI/VCI Input
  // ------------------------------------------------------------
  $scope.$watch("form.vpiVci", function(newVal, oldVal) {
    if (newVal && newVal !== oldVal && $scope.form.accessType === "ATM") {
      // Check if this is a manual entry (not from dropdown selection)
      if (!$scope.isExistingVpiVci(newVal)) {
        // Manual entry of new VPI/VCI - treat as new link
        $scope.form.selectedATMLink = null;
        // Keep current form values for encapsulation, linkType, etc.
        // or set defaults if empty
        if (!$scope.form.encapsulation) $scope.form.encapsulation = "LLC";
        if (!$scope.form.linkType) $scope.form.linkType = "EoA";
        if (!$scope.form.atmQosClass) $scope.form.atmQosClass = "UBR";
      }
    }
  });

  // Add this function to handle manual VPI/VCI changes
  $scope.onVpiVciChange = function() {
    if ($scope.form.accessType === "ATM" && $scope.form.vpiVci) {
      if (!$scope.isExistingVpiVci($scope.form.vpiVci)) {
        // This is a new VPI/VCI, not in the dropdown
        $scope.form.selectedATMLink = null;
      }
    }
  };

  // ------------------------------------------------------------
  // Show/hide logic
  // ------------------------------------------------------------
  $scope.showDNSFields = function() {
    return (
      $scope.form.isUserDefinedDNS &&
      $scope.form.wanMode !== "BridgedWan" &&
      $scope.form.encapsulationMode === "PPPoE"
    );
  };

  $scope.showPPPoEFields = function() {
    return $scope.form.encapsulationMode === "PPPoE";
  };

  $scope.shouldShowIPAcqMode = function() {
    return (
      $scope.form.encapsulationMode !== "PPPoE" &&
      $scope.form.wanMode !== "BridgedWan"
    );
  };

  $scope.showStaticFields = function() {
    return (
      $scope.form.ipAcqMode === "Static" && $scope.form.wanMode !== "BridgedWan"
    );
  };

  $scope.showBridgeFields = function() {
    if ($scope.form.wanMode === "BridgedWan") {
      // Ensure bridge connections are loaded when showing bridge fields
      if (!$scope.bridgeConnections.length) {
        loadBridgeConnections();
      }
      return true;
    }
    return false;
  };

  $scope.showNATType = function() {
    return $scope.form.enableNAT === "1";
  };

  $scope.showVlanId = function() {
    return $scope.form.enableVlan === "1";
  };

  $scope.showMacAddress = function() {
    return $scope.form.macCloneEnabled == "1" ? true : false;
  };

  $scope.showATMLinkInfo = function() {
    return $scope.form.accessType === "ATM";
  };

  $scope.isPPPoERequired = function() {
    return $scope.form.encapsulationMode === "PPPoE";
  };

  // ------------------------------------------------------------
  // DNS Management
  // ------------------------------------------------------------
  $scope.staticDNSData =
    JSON.parse(localStorage.getItem("staticDNSData")) || [];

  $scope.addStaticDNSRow = function() {
    $scope.staticDNSData.push({ id: null, ip: "", editable: true });
  };

  $scope.confirmStaticDNSRow = function(index) {
    const dns = $scope.staticDNSData[index];
    if ($scope.patterns.ipv4.test(dns.ip)) {
      dns.editable = false;
      localStorage.setItem(
        "staticDNSData",
        JSON.stringify($scope.staticDNSData)
      );
    } else {
      alert("Please enter a valid IPv4 address.");
    }
  };

  $scope.removeStaticDNSRow = function(index) {
    $scope.staticDNSData.splice(index, 1);
    localStorage.setItem("staticDNSData", JSON.stringify($scope.staticDNSData));
  };

  $scope.validateDNSForm = function() {
    if (!$scope.customWanForm) return;
    const same =
      $scope.form.secondaryDNS &&
      $scope.form.secondaryDNS === $scope.form.primaryDNS;
    $scope.customWanForm.$setValidity("dnsConflict", !same);
  };

  // ------------------------------------------------------------
  // Data loading functions
  // ------------------------------------------------------------
  async function loadAtmLinksAndQos() {
    if ($scope.form.accessType !== "ATM") return;

    $scope.dataReady = false;

    try {
      const response = await $http.get(URL + "cgi_get?Object=Device.ATM.Link");
      const objects = response.data.Objects || [];
      $scope.atmLinks = objects.filter((obj) =>
        /^Device\.ATM\.Link\.\d+$/.test(obj.ObjName)
      );
      $scope.atmLinksQos = objects.filter((obj) =>
        /^Device\.ATM\.Link\.\d+\.QoS$/.test(obj.ObjName)
      );
      $scope.vpiVciOptions = $scope.atmLinks
        .map((obj) => {
          const addrParam = obj.Param.find(
            (p) => p.ParamName === "DestinationAddress"
          );
          return addrParam ? addrParam.ParamValue : null;
        })
        .filter(Boolean);

      // Don't auto-select first VPI/VCI in edit mode - let traceAndLoadATMLinkData handle it
      if (
        !$scope.isEditMode &&
        $scope.vpiVciOptions.length > 0 &&
        !$scope.form.vpiVci
      ) {
        $scope.selectVpiVci($scope.vpiVciOptions[0]);
      }

      // Ensure form has default values for required ATM fields
      if (!$scope.form.encapsulation) $scope.form.encapsulation = "LLC";
      if (!$scope.form.linkType) $scope.form.linkType = "EoA";
      if (!$scope.form.atmQosClass) $scope.form.atmQosClass = "UBR";
    } catch (err) {
      console.error("Failed to load ATM Link/QoS objects", err);
      $scope.vpiVciOptions = [];
    } finally {
      $scope.dataReady = true;
    }
  }

  async function loadBridgeConnections() {
    // Don't reload if already loading or loaded
    if (
      $scope.loadingBridgeConnections ||
      $scope.bridgeConnections.length > 0
    ) {
      return;
    }

    $scope.loadingBridgeConnections = true;
    try {
      const response = await $http.get(
        URL +
          "cgi_get_fillparams?Object=Device.Bridging.Bridge&X_LANTIQ_COM_Name="
      );
      if (response.data?.Objects?.length > 0) {
        $scope.bridgeConnections = response.data.Objects.map((bridge) => {
          const nameParam = bridge.Param.find(
            (x) => x.ParamName === "X_LANTIQ_COM_Name"
          );
          const match = bridge.ObjName.match(/Device\.Bridging\.Bridge\.(\d+)/);
          const id = match ? parseInt(match[1], 10) : null;
          return {
            id,
            objName: bridge.ObjName,
            name: nameParam ? nameParam.ParamValue : bridge.ObjName,
          };
        });

        // Select first bridge if none selected
        if (
          !$scope.form.selectedBridge &&
          $scope.bridgeConnections.length > 0
        ) {
          $scope.form.selectedBridge = $scope.bridgeConnections[0];
        }
      } else {
        $scope.bridgeConnections = [];
      }
    } catch (error) {
      console.error("Error loading bridge connections:", error);
      $scope.bridgeConnections = [];
    } finally {
      $scope.loadingBridgeConnections = false;
      $scope.$applyAsync();
    }
  }

  function getParamFromObject(obj, paramName) {
    if (!obj || !obj.Param) return "";
    const param = obj.Param.find((x) => x.ParamName === paramName);
    return param ? param.ParamValue : "";
  }

  async function loadMACAddressFromEthernetLink(ipInterface) {
    $scope.macAddressLoading = true;
    try {
      // Trace down to find the Ethernet Link
      const ethLinkObj = await traceToEthernetLink(ipInterface);

      if (ethLinkObj) {
        // Check if MAC cloning is enabled
        const macCloningEnabled = getAtmParamValue(
          ethLinkObj,
          "X_INTEL_COM_MACCloning"
        );

        if (macCloningEnabled === "true" || macCloningEnabled === true) {
          $scope.form.macCloneEnabled = "1";

          // Load the MAC address
          const macAddress = getAtmParamValue(ethLinkObj, "MACAddress");

          if (macAddress) {
            $scope.form.mac_address = macAddress;
          } else {
            $scope.form.mac_address = "";
          }
        } else {
          $scope.form.macCloneEnabled = "0";
          $scope.form.mac_address = "";
        }
      } else {
        $scope.form.macCloneEnabled = "0";
        $scope.form.mac_address = "";
      }
    } catch (error) {
      $scope.form.macCloneEnabled = "0";
      $scope.form.mac_address = "";
    } finally {
      $scope.macAddressLoading = false;
      $scope.$applyAsync();
    }
  }

  async function traceToEthernetLink(objPath, visited = []) {
    try {
      if (!objPath || visited.includes(objPath)) return null;
      visited.push(objPath);

      const res = await $http.get(`${URL}cgi_get_nosubobj?Object=${objPath}`);
      const obj = res.data.Objects?.[0];
      if (!obj) return null;

      // Check if this is an Ethernet Link
      if (obj.ObjName.includes("Device.Ethernet.Link")) {
        return obj;
      }

      // Check LowerLayers to trace down
      const lowerParam = obj.Param.find((p) => p.ParamName === "LowerLayers");
      if (!lowerParam || !lowerParam.ParamValue) return null;

      const lower = lowerParam.ParamValue.replace(/\.$/, "");
      return await traceToEthernetLink(lower, visited);
    } catch (err) {
      console.error("Error tracing to Ethernet Link:", err);
      return null;
    }
  }

  async function loadEditModeData() {
    if (!$scope.isEditMode) return;

    try {
      $scope.editIPInterface = $scope.internetObject.split(",")[0];
      const response = await $http.get(
        URL + "cgi_get?Object=" + $scope.editIPInterface
      );

      if (response.data?.Objects?.length > 0) {
        const ipObj = response.data.Objects[0];

        // Determine access type from description and addressing type
        let description = "";
        let addressingType = "";

        // Look through ALL objects in the response
        for (let obj of response.data.Objects) {
          const desc = getParamFromObject(obj, "X_LANTIQ_COM_Description");
          if (desc && !description) {
            description = desc;
          }

          const addrType = getParamFromObject(obj, "AddressingType");
          if (addrType && !addressingType) {
            addressingType = addrType;
          }
        }

        // Set access type based on description
        if (description.includes("ATM")) {
          $scope.form.accessType = "ATM";
        } else if (description.includes("PTM")) {
          $scope.form.accessType = "PTM";
        } else if (description.includes("ETH")) {
          $scope.form.accessType = "ETH";
        }

        // Check for PPPoE in the addressing type
        if (addressingType === "X_LANTIQ_COM_PPPoE") {
          console.log("Setting encapsulation mode to PPPoE");
          $scope.form.encapsulationMode = "PPPoE";
          $scope.form.ipAcqMode = "PPPoE";

          // Try to load PPP interface to get username/password
          try {
            // Get the IP interface name to find matching PPP interface
            const ipInterfaceName = getParamFromObject(ipObj, "Name") || "";
            console.log(
              "Looking for PPP interface with name:",
              ipInterfaceName
            );

            // Load all PPP interfaces
            const pppResponse = await $http.get(
              URL + "cgi_get?Object=Device.PPP.Interface"
            );

            if (pppResponse.data?.Objects?.length > 0) {
              console.log(
                "Found PPP interfaces:",
                pppResponse.data.Objects.length
              );

              // Find the PPP interface by matching the name
              const pppInterface = pppResponse.data.Objects.find((pppObj) => {
                const pppName = getParamFromObject(pppObj, "Name");
                return pppName === ipInterfaceName;
              });

              if (pppInterface) {
                // Extract username without domain
                let username =
                  getParamFromObject(pppInterface, "Username") || "";
                if (username.includes("@")) {
                  username = username.split("@")[0];
                }

                $scope.form.username = username;
                $scope.form.password =
                  getParamFromObject(pppInterface, "Password") || "";
                $scope.form.mtu_mru_size =
                  getParamFromObject(pppInterface, "MaxMRUSize") || "1492";

                console.log("Loaded PPPoE credentials:", {
                  username: $scope.form.username,
                  passwordLength: $scope.form.password
                    ? $scope.form.password.length
                    : 0,
                  mru: $scope.form.mtu_mru_size,
                });
              } else {
                console.log(
                  "No matching PPP interface found for name:",
                  ipInterfaceName
                );
              }
            }
          } catch (pppError) {
            console.error("Error loading PPP interface:", pppError);
          }
        } else if (addressingType === "DHCP") {
          $scope.form.encapsulationMode = "IPoE";
          $scope.form.ipAcqMode = "DHCP";
        } else if (addressingType === "Static") {
          $scope.form.encapsulationMode = "IPoE";
          $scope.form.ipAcqMode = "Static";
          // Load static IP fields
          const ipv4Obj = response.data.Objects.find((obj) =>
            obj.ObjName.includes(".IPv4Address")
          );
          if (ipv4Obj) {
            $scope.form.ipaddress =
              getAtmParamValue(ipv4Obj, "IPAddress") || "";
            $scope.form.subnetmask =
              getAtmParamValue(ipv4Obj, "SubnetMask") || "";
          }
          // Load gateway address from IPv4Forwarding
          await loadStaticGatewayAddress($scope.editIPInterface);
        } else if (addressingType === "X_LANTIQ_COM_Bridged") {
          $scope.form.encapsulationMode = "IPoE";
          $scope.form.wanMode = "BridgedWan";
          $scope.form.ipAcqMode = "Bridge";
        } else {
          // Default if addressing type not found
          console.log("No addressing type found, defaulting to IPoE/DHCP");
          $scope.form.encapsulationMode = "IPoE";
          $scope.form.ipAcqMode = "DHCP";
        }

        // Load other basic form fields
        $scope.form.protocolType =
          getParamFromObject(ipObj, "X_LANTIQ_COM_ProtocolType") || "IPv4";
        $scope.form.wanMode =
          getParamFromObject(ipObj, "X_LANTIQ_COM_WANMode") === "Bridged"
            ? "BridgedWan"
            : "RoutedWan";
        $scope.form.serviceType =
          getParamFromObject(ipObj, "X_LANTIQ_COM_ServiceType") ||
          "TR069_Internet";
        $scope.form.defaultGateway =
          getParamFromObject(ipObj, "X_LANTIQ_COM_DefaultGateway") === "true"
            ? "1"
            : "0";

        // Only set MTU if not already set by PPPoE
        if (!$scope.form.mtu_mru_size) {
          $scope.form.mtu_mru_size =
            getParamFromObject(ipObj, "MaxMTUSize") || "1492";
        }

        // Load NAT settings
        await loadNATSettings();

        // If this is an ATM connection, trace and load the ATM link data
        if ($scope.form.accessType === "ATM") {
          await traceAndLoadATMLinkData($scope.editIPInterface);
        }

        // Load VLAN information
        await loadVLANInformation(ipObj);

        // Load DNS information
        await loadDNSInformation(ipObj);

        // Load MAC address from Ethernet Link
        await loadMACAddressFromEthernetLink($scope.editIPInterface);

        // Load static gateway address if static IP
        if ($scope.form.ipAcqMode === "Static") {
          await loadStaticGatewayAddress($scope.editIPInterface);
        }
      }
    } catch (error) {
      console.error("Error loading edit mode data:", error);
    }
  }

  async function loadNATSettings() {
    if (!$scope.editIPInterface) return;

    try {
      const response = await $http.get(
        URL + "cgi_get?Object=Device.NAT.InterfaceSetting"
      );

      if (response.data?.Objects) {
        const interfaceNatSetting = response.data.Objects.find((nat) => {
          const interfaceParam = nat.Param.find(
            (p) => p.ParamName === "Interface"
          );
          return (
            interfaceParam &&
            interfaceParam.ParamValue === $scope.editIPInterface
          );
        });

        if (interfaceNatSetting) {
          const enableParam = interfaceNatSetting.Param.find(
            (p) => p.ParamName === "Enable"
          );
          const natTypeParam = interfaceNatSetting.Param.find(
            (p) => p.ParamName === "X_LANTIQ_COM_NATType"
          );

          if (enableParam) {
            $scope.form.enableNAT =
              enableParam.ParamValue === "true" ||
              enableParam.ParamValue === "1"
                ? "1"
                : "0";
          }
          if (natTypeParam && $scope.form.enableNAT === "1") {
            $scope.form.natType = natTypeParam.ParamValue;
          }
        }
      }
    } catch (error) {
      console.error("Error loading NAT settings:", error);
    }
  }

  async function traceAndLoadATMLinkData(ipInterface) {
    try {
      // Trace the connection chain to find the ATM link
      const atmLinkObj = await traceToATMLink(ipInterface);

      if (atmLinkObj) {
        // Load the ATM link properties
        const vpiVci = getAtmParamValue(atmLinkObj, "DestinationAddress");
        const encapsulation = getAtmParamValue(atmLinkObj, "Encapsulation");
        const linkType = getAtmParamValue(atmLinkObj, "LinkType");

        // Set form values
        $scope.form.vpiVci = vpiVci || "";
        $scope.form.encapsulation = encapsulation || "LLC";
        $scope.form.linkType = linkType || "EoA";

        // Find this link in our loaded ATM links
        const existingLink = $scope.atmLinks.find((link) => {
          const addr = getAtmParamValue(link, "DestinationAddress");
          return addr === vpiVci;
        });

        if (existingLink) {
          $scope.form.selectedATMLink = existingLink;

          // Load QoS data for this link
          const linkNumMatch = existingLink.ObjName.match(
            /Device\.ATM\.Link\.(\d+)$/
          );
          if (linkNumMatch) {
            const qosObjName = `Device.ATM.Link.${linkNumMatch[1]}.QoS`;
            const qosObj = $scope.atmLinksQos.find(
              (obj) => obj.ObjName === qosObjName
            );

            if (qosObj) {
              $scope.form.atmQosClass =
                getAtmParamValue(qosObj, "QoSClass") || "UBR";
              $scope.form.peakCellRate =
                parseInt(getAtmParamValue(qosObj, "PeakCellRate")) || "";
              $scope.form.maximumBSize =
                parseInt(getAtmParamValue(qosObj, "MaximumBurstSize")) || "";
              $scope.form.sustainableCellRate =
                parseInt(getAtmParamValue(qosObj, "SustainableCellRate")) || "";
            }
          }
        }
      }
    } catch (error) {
      console.error("Error tracing ATM link data:", error);
    }
  }

  async function traceToATMLink(objPath, visited = []) {
    try {
      if (!objPath || visited.includes(objPath)) return null;
      visited.push(objPath);

      const res = await $http.get(`${URL}cgi_get_nosubobj?Object=${objPath}`);
      const obj = res.data.Objects?.[0];
      if (!obj) return null;

      // Check if this is an ATM link
      if (
        obj.ObjName.includes("Device.ATM.Link") &&
        !obj.ObjName.includes(".QoS")
      ) {
        return obj;
      }

      // Check LowerLayers to trace down
      const lowerParam = obj.Param.find((p) => p.ParamName === "LowerLayers");
      if (!lowerParam || !lowerParam.ParamValue) return null;

      const lower = lowerParam.ParamValue.replace(/\.$/, "");
      return await traceToATMLink(lower, visited);
    } catch (err) {
      console.error("Error tracing to ATM link:", err);
      return null;
    }
  }

  async function loadVLANInformation(ipObj) {
    try {
      // Trace down to find VLAN information
      const vlanLayer = await traceToVLAN(ipObj.ObjName);

      if (vlanLayer) {
        $scope.form.enableVlan = "1";

        // Get VLAN ID
        const vlanRes = await $http.get(
          `${URL}cgi_get_nosubobj?Object=${vlanLayer}`
        );
        const vlanObj = vlanRes.data.Objects?.[0];

        if (vlanObj) {
          const vlanId = getAtmParamValue(vlanObj, "VLANID");
          if (vlanId) {
            $scope.form.vlanId = vlanId;
          }
        }
      } else {
        $scope.form.enableVlan = "0";
      }
    } catch (error) {
      console.error("Error loading VLAN information:", error);
      $scope.form.enableVlan = "0";
    }
  }

  async function traceToVLAN(objPath, visited = []) {
    try {
      if (!objPath || visited.includes(objPath)) return null;
      visited.push(objPath);

      const res = await $http.get(`${URL}cgi_get_nosubobj?Object=${objPath}`);
      const obj = res.data.Objects?.[0];
      if (!obj) return null;

      // Check if this is a VLAN termination
      if (obj.ObjName.includes("Device.Ethernet.VLANTermination")) {
        return obj.ObjName;
      }

      // Check LowerLayers to trace down
      const lowerParam = obj.Param.find((p) => p.ParamName === "LowerLayers");
      if (!lowerParam || !lowerParam.ParamValue) return null;

      const lower = lowerParam.ParamValue.replace(/\.$/, "");
      return await traceToVLAN(lower, visited);
    } catch (err) {
      console.error("Error tracing to VLAN:", err);
      return null;
    }
  }

  async function loadDNSInformation() {
    try {
      // Get user-defined DNS settings using the correct endpoint
      const response = await $http.get(URL + "cgi_get_dns");

      console.log("DNS Response:", response.data);

      if (response.data) {
        const dnsData = response.data.split("\n");
        let primaryDNS = "";
        let secondaryDNS = "";

        dnsData.forEach((line) => {
          const [key, value] = line.split("=");
          if (key === "UsrDefDNS1" && value && value.trim() !== "") {
            primaryDNS = value.trim();
          } else if (key === "UsrDefDNS2" && value && value.trim() !== "") {
            secondaryDNS = value.trim();
          }
        });

        // Check if DNS is configured
        if (primaryDNS) {
          $scope.form.isUserDefinedDNS = true;
          $scope.form.primaryDNS = primaryDNS;
          $scope.form.secondaryDNS = secondaryDNS;
        } else {
          $scope.form.isUserDefinedDNS = false;
          $scope.form.primaryDNS = "";
          $scope.form.secondaryDNS = "";
        }

        console.log("Loaded DNS settings:", {
          isUserDefinedDNS: $scope.form.isUserDefinedDNS,
          primaryDNS: $scope.form.primaryDNS,
          secondaryDNS: $scope.form.secondaryDNS,
        });
      }
    } catch (error) {
      console.error("Error loading DNS information:", error);
      // Default to not using user-defined DNS on error
      $scope.form.isUserDefinedDNS = false;
      $scope.form.primaryDNS = "";
      $scope.form.secondaryDNS = "";
    }
  }

  // ------------------------------------------------------------
  // Request Building Functions
  // ------------------------------------------------------------

  function buildRequest() {
    const randomValue = generateRandomValue();
    let request = "";
    const ethAlias = `cpe-WEB-EthernetLink-${randomValue}`;
    const ipAlias = `cpe-WEB-IPInterface-${randomValue}`;
    const pppAlias = `cpe-WEB-PPPInterface-${randomValue}`;

    // Determine WAN layer and ATM-specific settings
    let wanLayer = "";
    let isATM = $scope.form.accessType === "ATM";

    if (isATM) {
      // Check if we should create a new ATM link or use existing
      const isNewVpiVci = !$scope.isExistingVpiVci($scope.form.vpiVci);

      if (isNewVpiVci || !$scope.form.selectedATMLink) {
        // CREATE NEW ATM LINK
        const atmAlias = `cpe-WEB-ATMLink-${randomValue}`;
        request += `Object=Device.ATM.Link&Operation=Add&Enable=true&Alias=${encodeParam(
          atmAlias
        )}`;
        request += `&LowerLayers=Device.DSL.Line.1.`;
        request += `&DestinationAddress=${encodeParam($scope.form.vpiVci)}`;
        request += `&Encapsulation=${encodeParam($scope.form.encapsulation)}`;
        request += `&LinkType=${encodeParam($scope.form.linkType)}`;
        request += `&`;

        wanLayer = `Device.ATM.Link.${atmAlias}`;

        // Add QoS for new link
        request += `Object=Device.ATM.Link.${atmAlias}.QoS&Operation=Modify`;

        // Add QoS parameters for new link
        request += `&QoSClass=${encodeParam($scope.form.atmQosClass)}`;
        if ($scope.form.peakCellRate)
          request += `&PeakCellRate=${encodeParam($scope.form.peakCellRate)}`;
        if ($scope.form.maximumBSize)
          request += `&MaximumBurstSize=${encodeParam(
            $scope.form.maximumBSize
          )}`;
        if ($scope.form.sustainableCellRate)
          request += `&SustainableCellRate=${encodeParam(
            $scope.form.sustainableCellRate
          )}`;
        request += `&`;
      } else {
        // USE EXISTING ATM LINK
        wanLayer = $scope.form.selectedATMLink.ObjName;

        // Only modify QoS if parameters are provided (and not default UBR with no rates)
        const hasQoSParams =
          $scope.form.atmQosClass !== "UBR" ||
          $scope.form.peakCellRate ||
          $scope.form.maximumBSize ||
          $scope.form.sustainableCellRate;

        if (hasQoSParams) {
          // Modify QoS for existing link
          const linkNumMatch = $scope.form.selectedATMLink.ObjName.match(
            /Device\.ATM\.Link\.(\d+)$/
          );
          if (linkNumMatch) {
            request += `Object=Device.ATM.Link.${linkNumMatch[1]}.QoS&Operation=Modify`;
          } else {
            request += `Object=${$scope.form.selectedATMLink.ObjName}.QoS&Operation=Modify`;
          }

          request += `&QoSClass=${encodeParam($scope.form.atmQosClass)}`;
          if ($scope.form.peakCellRate)
            request += `&PeakCellRate=${encodeParam($scope.form.peakCellRate)}`;
          if ($scope.form.maximumBSize)
            request += `&MaximumBurstSize=${encodeParam(
              $scope.form.maximumBSize
            )}`;
          if ($scope.form.sustainableCellRate)
            request += `&SustainableCellRate=${encodeParam(
              $scope.form.sustainableCellRate
            )}`;
          request += `&`;
        }
      }
    } else if ($scope.form.accessType === "PTM") {
      wanLayer = "Device.PTM.Link.1.";
    } else if ($scope.form.accessType === "ETH") {
      wanLayer = "Device.Ethernet.Interface.5.";
    }

    // ==================== IP Interface ====================
    // Always create IP Interface, even for BridgedWan mode
    request += `Object=Device.IP.Interface&Operation=Add&Enable=true&Alias=${encodeParam(
      ipAlias
    )}`;

    if ($scope.form.wanMode === "BridgedWan") {
      // For bridged mode, IP Interface connects to Ethernet Link
      request += `&LowerLayers=Device.Ethernet.Link.${ethAlias}`;
    } else {
      // For routed mode, handle based on connection type
      if ($scope.form.enableVlan == "1") {
        const vlanAlias = `cpe-WEB-EthernetVLANTermination-${randomValue}`;
        if ($scope.form.ipAcqMode === "PPPoE") {
          request += `&LowerLayers=Device.PPP.Interface.${pppAlias}`;
        } else {
          request += `&LowerLayers=Device.Ethernet.VLANTermination.${vlanAlias}`;
        }
      } else {
        if ($scope.form.ipAcqMode === "PPPoE") {
          request += `&LowerLayers=Device.PPP.Interface.${pppAlias}`;
        } else {
          request += `&LowerLayers=Device.Ethernet.Link.${ethAlias}`;
        }
      }
    }

    // Handle IPv6 based on protocolType
    if ($scope.form.protocolType === "IPv4/IPv6") {
      request += `&IPv6Enable=1`; // Use "1" instead of "true"
      console.log("Setting IPv6 enabled for IPv4/IPv6 protocol type");
    } else {
      request += `&IPv6Enable=false`;
    }

    // Add routing parameters only for RoutedWan mode
    if ($scope.form.wanMode !== "BridgedWan") {
      request += `&X_LANTIQ_COM_DefaultGateway=${
        $scope.form.defaultGateway === "1" ? "true" : "false"
      }`;

      // Add MTU size for non-ATM connections, MRU for ATM is in PPP section
      if (!isATM) {
        request += `&MaxMTUSize=${encodeParam($scope.form.mtu_mru_size)}`;
      }
    } else {
      // For bridged mode, disable routing features
      request += `&X_LANTIQ_COM_DefaultGateway=false`;
      // Don't set MTU for bridged mode - it's handled at lower layers
    }
    request += `&`;

    // ==================== Ethernet Link ====================
    request += `Object=Device.Ethernet.Link&Operation=Add&Enable=true&Alias=${encodeParam(
      ethAlias
    )}`;

    if ($scope.form.wanMode === "BridgedWan") {
      // For bridged mode, connect to bridge port
      const bridgeId = $scope.form.selectedBridge?.id || 1;
      const bridgePortAlias = `cpe-WEB-BridgingBridge${bridgeId}Port-${randomValue}`;
      request += `&LowerLayers=${encodeParam(
        $scope.form.selectedBridge.objName
      )}.Port.${bridgePortAlias}`;
    } else {
      // For non-bridged modes, connect to WAN layer
      request += `&LowerLayers=${encodeParam(wanLayer)}`;
    }

    if ($scope.form.macCloneEnabled && $scope.form.mac_address) {
      request += `&X_INTEL_COM_MACCloning=true&MACAddress=${encodeParam(
        $scope.form.mac_address
      )}`;
    } else {
      request += `&X_INTEL_COM_MACCloning=false&MACAddress=`;
    }
    request += `&`;

    // ==================== VLAN ====================
    if ($scope.form.enableVlan == "1" && $scope.form.vlanId) {
      const vlanAlias = `cpe-WEB-EthernetVLANTermination-${randomValue}`;
      request += `Object=Device.Ethernet.VLANTermination&Operation=Add`;
      request += `&LowerLayers=Device.Ethernet.Link.${ethAlias}`;
      request += `&Alias=${encodeParam(
        vlanAlias
      )}&Enable=1&VLANID=${encodeParam($scope.form.vlanId)}`;
      request += `&`;
    }

    // ==================== PPPoE ====================
    if (
      $scope.form.ipAcqMode === "PPPoE" &&
      $scope.form.wanMode !== "BridgedWan"
    ) {
      request += `Object=Device.PPP.Interface&Operation=Add&Enable=true&Alias=${encodeParam(
        pppAlias
      )}`;
      request += `&MaxMRUSize=${encodeParam($scope.form.mtu_mru_size)}`;
      request += `&Username=${encodeParam(
        $scope.form.username + "@tedata.net.eg"
      )}`;
      request += `&Password=${encodeParam($scope.form.password)}`;

      if ($scope.form.enableVlan == "1" && $scope.form.vlanId) {
        request += `&LowerLayers=Device.Ethernet.VLANTermination.cpe-WEB-EthernetVLANTermination-${randomValue}`;
      } else {
        request += `&LowerLayers=Device.Ethernet.Link.${ethAlias}`;
      }
      request += `&`;
    }

    // ==================== Bridge Port ====================
    if ($scope.form.wanMode === "BridgedWan") {
      const bridgeId = $scope.form.selectedBridge?.id || 1;
      const bridgePortAlias = `cpe-WEB-BridgingBridge${bridgeId}Port-${randomValue}`;
      request += `Object=${encodeParam(
        $scope.form.selectedBridge.objName
      )}.Port&Operation=Add`;
      request += `&Enable=true&Alias=${encodeParam(bridgePortAlias)}`;
      request += `&LowerLayers=${encodeParam(wanLayer)}`;
      request += `&`;
    }

    // ==================== DHCP ====================
    if (
      $scope.form.ipAcqMode === "DHCP" &&
      $scope.form.wanMode !== "BridgedWan"
    ) {
      // DHCPv4 Client
      request += `Object=Device.DHCPv4.Client&Operation=Add`;
      request += `&Interface=Device.IP.Interface.${ipAlias}`;
      request += `&`;

      // DHCPv6 Client if IPv6 is enabled
      if ($scope.form.protocolType === "IPv4/IPv6") {
        request += `Object=Device.DHCPv6.Client&Operation=Add`;
        request += `&Interface=Device.IP.Interface.${ipAlias}`;
        request += `&`;
      }
    }

    // ==================== Static IP ====================
    if (
      $scope.form.ipAcqMode === "Static" &&
      $scope.form.wanMode !== "BridgedWan"
    ) {
      // IPv4 Address
      request += `Object=Device.IP.Interface.${ipAlias}.IPv4Address&Operation=Add`;
      request += `&IPAddress=${encodeParam($scope.form.ipaddress)}`;
      request += `&SubnetMask=${encodeParam($scope.form.subnetmask)}`;
      request += `&`;

      // IPv4 Forwarding
      request += `Object=Device.Routing.Router.1.IPv4Forwarding&Operation=Add`;
      request += `&Interface=Device.IP.Interface.${ipAlias}&Enable=true`;
      request += `&GatewayIPAddress=${encodeParam($scope.form.gatewayaddress)}`;
      request += `&`;

      // IPv6 Forwarding (for ATM or when IPv6 is enabled)
      if (isATM || $scope.form.protocolType === "IPv4/IPv6") {
        request += `Object=Device.Routing.Router.1.IPv6Forwarding&Operation=Add`;
        request += `&Interface=Device.IP.Interface.${ipAlias}`;
        request += `&`;
      }

      // Static DNS entries
      if ($scope.staticDNSData.length > 0) {
        $scope.staticDNSData.forEach((dns, idx) => {
          request += `Object=Device.DNS.Client.Server&Operation=Add`;
          request += `&DNSServer=${encodeParam(dns.ip)}&Enable=1`;
          request += `&Interface=Device.IP.Interface.${ipAlias}`;
          request += `&`;
        });
      }
    }

    // ==================== NAT ====================
    if ($scope.form.enableNAT === "1" && $scope.form.wanMode !== "BridgedWan") {
      request += `Object=Device.NAT.InterfaceSetting&Operation=Add`;
      request += `&Interface=Device.IP.Interface.${ipAlias}`;
      request += `&Enable=true`;
      request += `&X_LANTIQ_COM_NATType=${encodeParam($scope.form.natType)}`;
      request += `&`;
    }

    // Debug logging
    console.log("Built request for:", {
      accessType: $scope.form.accessType,
      encapsulationMode: $scope.form.encapsulationMode,
      ipAcqMode: $scope.form.ipAcqMode,
      wanMode: $scope.form.wanMode,
      enableVlan: $scope.form.enableVlan,
      vpiVci: $scope.form.vpiVci,
      isEditMode: $scope.isEditMode,
      selectedATMLink: $scope.form.selectedATMLink?.ObjName,
      requestParts: request.split("&").filter((p) => p.includes("Object=")),
    });

    return request;
  }

  async function deleteOldConnection() {
    if (!$scope.isEditMode || !$scope.editIPInterface) return "";

    let deleteRequest = "";

    try {
      // Get the exact object to delete
      const res = await $http.get(
        `${URL}cgi_get_nosubobj?Object=${$scope.editIPInterface}`
      );
      const mainObj = res.data.Objects?.[0];

      if (mainObj) {
        // Get all lower layers recursively
        const layersToDelete = [];
        async function collectLowerLayers(obj) {
          if (!obj || !obj.ObjName) return;

          // Skip system/interface objects
          if (
            obj.ObjName.includes("Device.ATM.Link") ||
            obj.ObjName.includes("Device.PTM.Link") ||
            obj.ObjName.includes("Device.DSL.Line") ||
            obj.ObjName.includes("Device.Ethernet.Interface")
          ) {
            return;
          }

          layersToDelete.push(obj.ObjName);

          // Check for LowerLayers
          const lowerParam = obj.Param?.find(
            (p) => p.ParamName === "LowerLayers"
          );
          if (lowerParam?.ParamValue) {
            const cleanLower = lowerParam.ParamValue.replace(/\.$/, "");
            try {
              const lowerRes = await $http.get(
                `${URL}cgi_get_nosubobj?Object=${cleanLower}`
              );
              const lowerObj = lowerRes.data.Objects?.[0];
              if (lowerObj) {
                await collectLowerLayers(lowerObj);
              }
            } catch (err) {
              console.warn("Failed to get lower layer:", cleanLower, err);
            }
          }
        }

        await collectLowerLayers(mainObj);

        // Also look for associated objects
        const associatedObjects = await findAssociatedObjects(mainObj);
        layersToDelete.push(...associatedObjects);

        // Remove duplicates
        const uniqueLayers = [...new Set(layersToDelete)];

        // Build delete request (delete in reverse order)
        for (let i = uniqueLayers.length - 1; i >= 0; i--) {
          deleteRequest += `Object=${encodeParam(
            uniqueLayers[i]
          )}&Operation=Del&`;
        }
      }
    } catch (error) {
      console.error("Error in deleteOldConnection:", error);
    }

    return deleteRequest;
  }

  async function findAssociatedObjects(mainObj) {
    const associated = [];
    const mainName = getAtmParamValue(mainObj, "Name");
    const mainAlias = getAtmParamValue(mainObj, "Alias");
    const mainObjName = mainObj.ObjName;
    // Normalize the object name (remove trailing dot)
    const normalizedMainObjName = mainObjName.replace(/\.$/, "");

    try {
      // Find PPP interface with same name
      const pppRes = await $http.get(
        URL + "cgi_get?Object=Device.PPP.Interface"
      );
      const pppObjects = pppRes.data.Objects || [];

      for (const pppObj of pppObjects) {
        const pppName = getAtmParamValue(pppObj, "Name");
        if (pppName === mainName) {
          associated.push(pppObj.ObjName);
          break;
        }
      }

      // Find Ethernet Link
      const ethRes = await $http.get(
        URL + "cgi_get?Object=Device.Ethernet.Link"
      );
      const ethObjects = ethRes.data.Objects || [];

      for (const ethObj of ethObjects) {
        const ethAlias = getAtmParamValue(ethObj, "Alias");
        if (ethAlias === mainAlias) {
          associated.push(ethObj.ObjName);
          break;
        }
      }

      // Find IPv4Forwarding entries
      const forwardingRes = await $http.get(
        URL + "cgi_get?Object=Device.Routing.Router.1.IPv4Forwarding"
      );
      const forwardingObjects = forwardingRes.data.Objects || [];

      for (const fwdObj of forwardingObjects) {
        const interfaceParam = getAtmParamValue(fwdObj, "Interface");
        if (interfaceParam) {
          // Normalize both for comparison
          const normalizedParam = interfaceParam.replace(/\.$/, "");
          if (normalizedParam === normalizedMainObjName) {
            associated.push(fwdObj.ObjName);
          }
        }
      }

      // Find NAT settings
      const natRes = await $http.get(
        URL + "cgi_get?Object=Device.NAT.InterfaceSetting"
      );
      const natObjects = natRes.data.Objects || [];

      for (const natObj of natObjects) {
        const interfaceParam = getAtmParamValue(natObj, "Interface");
        if (interfaceParam) {
          const normalizedParam = interfaceParam.replace(/\.$/, "");
          if (normalizedParam === normalizedMainObjName) {
            associated.push(natObj.ObjName);
          }
        }
      }

      // Find DHCP client
      const dhcpRes = await $http.get(
        URL + "cgi_get?Object=Device.DHCPv4.Client"
      );
      const dhcpObjects = dhcpRes.data.Objects || [];

      for (const dhcpObj of dhcpObjects) {
        const interfaceParam = getAtmParamValue(dhcpObj, "Interface");
        if (interfaceParam) {
          const normalizedParam = interfaceParam.replace(/\.$/, "");
          if (normalizedParam === normalizedMainObjName) {
            associated.push(dhcpObj.ObjName);
          }
        }
      }
    } catch (error) {
      console.error("Error finding associated objects:", error);
    }

    return associated;
  }

  // ------------------------------------------------------------
  // Submit function
  // ------------------------------------------------------------
  $scope.submit = async function() {
    if (!$scope.customWanForm.$valid) {
      alert("Please fix all errors before submitting.");
      return;
    }

    // Validate ATM-specific fields when ATM is selected
    if ($scope.form.accessType === "ATM") {
      // Check ATM form validity if it exists
      if (
        $scope.customWanForm.atmForm &&
        !$scope.customWanForm.atmForm.$valid
      ) {
        alert("Please fix ATM configuration errors.");
        return;
      }

      if (!$scope.form.vpiVci) {
        alert("Please select a VPI/VCI for ATM connection.");
        return;
      }

      if (!$scope.form.vpiVci) {
        alert("Please select a VPI/VCI for ATM connection.");
        return;
      }
      if (!$scope.form.encapsulation) {
        alert("Please select encapsulation mode for ATM connection.");
        return;
      }
      if (!$scope.form.linkType) {
        alert("Please select link type for ATM connection.");
        return;
      }
    }

    // Validate bridge selection when Bridge mode is selected
    if ($scope.form.wanMode === "BridgedWan") {
      if (!$scope.form.selectedBridge || !$scope.form.selectedBridge.objName) {
        alert("Please select a bridge connection.");
        return;
      }
    }

    // Validate VLAN ID when VLAN is enabled
    if ($scope.form.enableVlan === "1" && !$scope.form.vlanId) {
      alert("Please enter a VLAN ID.");
      return;
    }

    // Validate static IP fields when Static mode is selected
    if ($scope.form.ipAcqMode === "Static") {
      if (
        !$scope.form.ipaddress ||
        !$scope.form.subnetmask ||
        !$scope.form.gatewayaddress
      ) {
        alert(
          "Please fill all static IP fields (IP Address, Subnet Mask, Gateway Address)."
        );
        return;
      }
    }

    // Validate PPPoE fields when PPPoE is selected
    if ($scope.form.ipAcqMode === "PPPoE") {
      if (!$scope.form.username || !$scope.form.password) {
        alert("Please enter PPPoE username and password.");
        return;
      }
    }

    // In the submit() function, update the MAC cloning validation:
    if ($scope.form.macCloneEnabled === "1" && $scope.form.mac_address) {
      if (!$scope.validateMACAddress($scope.form.mac_address)) {
        alert("Invalid MAC address. Please enter a valid unicast MAC address.");
        return;
      }
    }

    // Show loader
    if (window.$ && $("#ajaxLoaderSection").length) {
      $("#ajaxLoaderSection").show();
    }

    try {
      // Remove existing connections if needed
      await helperService.removeExistingIPTVConnection();

      // Delete old connection in edit mode
      if ($scope.isEditMode) {
        const deleteRequest = await deleteOldConnection();
        if (deleteRequest) {
          await $http.post(URL + "cgi_set", deleteRequest);
        }
      }

      // Build and send new connection request
      const requestData = buildRequest();
      const result = await $http.post(URL + "cgi_set", requestData);

      if (result.status === 200) {
        // Handle user-defined DNS if needed (ONLY for PPPoE)
        if ($scope.form.encapsulationMode === "PPPoE") {
          if ($scope.form.isUserDefinedDNS && $scope.form.primaryDNS) {
            const dnsRequest = `UsrDefDNS1=${encodeParam(
              $scope.form.primaryDNS
            )}`;

            if (
              $scope.form.secondaryDNS &&
              $scope.form.secondaryDNS.trim() !== ""
            ) {
              dnsRequest += `&UsrDefDNS2=${encodeParam(
                $scope.form.secondaryDNS
              )}`;
            }

            console.log("Setting user-defined DNS:", dnsRequest);
            try {
              await $http.post(URL + "cgi_setUserDefinedDNS", dnsRequest, {
                headers: {
                  "Content-Type": "application/x-www-form-urlencoded",
                },
              });
              console.log("User-defined DNS set successfully");
            } catch (dnsError) {
              console.error("Failed to set user-defined DNS:", dnsError);
              // Don't fail the whole operation if DNS setting fails
            }
          } else {
            // Clear user-defined DNS if checkbox is unchecked or no primary DNS
            console.log("Clearing user-defined DNS");
            try {
              await $http.post(
                URL + "cgi_setUserDefinedDNS",
                "UsrDefDNS1=&UsrDefDNS2=",
                {
                  headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                  },
                }
              );
            } catch (clearError) {
              console.error("Failed to clear user-defined DNS:", clearError);
            }
          }
        }

        // Success - redirect
        $location.path("/tableform/wan_wanconnections");
        $scope.$applyAsync();
      } else {
        const errorMsg =
          result.data?.Objects?.[0]?.Param?.[0]?.ParamValue ||
          "Something went wrong.";
        alert(errorMsg);
      }
    } catch (error) {
      console.error("Error during submit:", error);
      alert("Failed to save connection: " + error.message);
    } finally {
      // Hide loader
      if (window.$ && $("#ajaxLoaderSection").length) {
        $("#ajaxLoaderSection").hide();
      }
    }
  };

  $scope.cancel = function() {
    $location.path("/tableform/wan_wanconnections");
    $scope.$applyAsync();
  };

  // ------------------------------------------------------------
  // Initialize
  // ------------------------------------------------------------
  async function initialize() {
    // Load ATM links first (for both new and edit modes)
    if ($scope.form.accessType === "ATM") {
      await loadAtmLinksAndQos();
    }

    // Load edit mode data if editing
    if ($scope.isEditMode) {
      await loadEditModeData();
    } else {
      $scope.dataReady = true; // For new connections, we're ready
    }

    // Load bridge connections if needed
    if ($scope.form.wanMode === "BridgedWan") {
      await loadBridgeConnections();
    }
  }

  // Watch for access type changes
  $scope.$watch("form.accessType", async function(newVal, oldVal) {
    // Reset ATM validation when switching away from ATM
    if (oldVal === "ATM" && newVal !== "ATM") {
      $scope.resetATMValidation();
    }

    // Reset dataReady while loading new data
    $scope.dataReady = false;

    // Reset form validation state
    $scope.resetFormValidation();

    if (newVal === "ATM") {
      await loadAtmLinksAndQos();
    } else {
      // Clear ATM-specific data when switching away from ATM
      $scope.atmLinks = [];
      $scope.atmLinksQos = [];
      $scope.vpiVciOptions = [];
      $scope.form.vpiVci = "";
      $scope.form.selectedATMLink = null;
      $scope.form.encapsulation = "LLC"; // Reset to default
      $scope.form.linkType = "EoA"; // Reset to default
      $scope.form.atmQosClass = "UBR"; // Reset to default
    }

    // Reset form based on access type
    if (newVal === "PTM" || newVal === "ETH") {
      $scope.form.mtu_mru_size = "1492"; // MTU for PTM/ETH
    } else if (newVal === "ATM") {
      $scope.form.mtu_mru_size = "1492"; // MRU for ATM
    }

    // Mark data as ready after everything is loaded
    $scope.dataReady = true;
  });

  // Initialize the controller
  initialize();
});
