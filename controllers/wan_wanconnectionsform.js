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
    policy802: "Custom",
    value802: 0,
    macCloneEnabled: false,
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
  $scope.serviceTypes = ["TR069_Internet", "IPTV"];
  $scope.policies802 = ["Custom", "From IP", "DSCP"];
  $scope.encapsulationOptions = ["LLC", "VCMUX"];
  $scope.atmQosClassOptions = ["UBR", "CBR", "NRT-VBR", "RT-VBR", "UBR+"];
  $scope.ipAcqModes = ["DHCP", "Static", "Bridge"];
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

  $scope.selectVpiVci = function(vpiVci) {
    $scope.form.vpiVci = vpiVci;
    const linkObj = $scope.atmLinks.find((obj) => {
      const addrParam = obj.Param.find(
        (p) => p.ParamName === "DestinationAddress"
      );
      return addrParam && addrParam.ParamValue === vpiVci;
    });
    $scope.form.selectedATMLink = linkObj;

    let qosObj = null;
    if (linkObj) {
      const linkNumMatch = linkObj.ObjName.match(/Device\.ATM\.Link\.(\d+)$/);
      if (linkNumMatch) {
        const qosObjName = `Device.ATM.Link.${linkNumMatch[1]}.QoS`;
        qosObj = $scope.atmLinksQos.find((obj) => obj.ObjName === qosObjName);
      }
    }
    if (qosObj) {
      $scope.form.atmQosClass = getAtmParamValue(qosObj, "QoSClass");
      $scope.form.peakCellRate =
        parseInt(getAtmParamValue(qosObj, "PeakCellRate")) || "";
      $scope.form.maximumBSize =
        parseInt(getAtmParamValue(qosObj, "MaximumBurstSize")) || "";
      $scope.form.sustainableCellRate =
        parseInt(getAtmParamValue(qosObj, "SustainableCellRate")) || "";
    } else {
      $scope.form.atmQosClass = "UBR";
      $scope.form.peakCellRate = "";
      $scope.form.maximumBSize = "";
      $scope.form.sustainableCellRate = "";
    }
  };

  // ------------------------------------------------------------
  // Watch for WAN Mode changes to handle Bridge mode
  // ------------------------------------------------------------
  $scope.$watch("form.wanMode", function(newVal) {
    if (newVal === "BridgedWan") {
      // When WAN mode is Bridged, force IP Acquisition Mode to Bridge
      $scope.form.ipAcqMode = "Bridge";
    } else if ($scope.form.ipAcqMode === "Bridge") {
      // If switching from Bridge mode, reset to DHCP
      $scope.form.ipAcqMode = "DHCP";
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
  // Show/hide logic
  // ------------------------------------------------------------
  $scope.showDNSFields = function() {
    return (
      $scope.form.isUserDefinedDNS &&
      $scope.form.ipAcqMode !== "Bridge" &&
      $scope.form.encapsulationMode === "PPPoE"
    );
  };

  $scope.showPPPoEFields = function() {
    return $scope.form.encapsulationMode === "PPPoE";
  };

  $scope.showStaticFields = function() {
    return $scope.form.ipAcqMode === "Static";
  };

  $scope.showBridgeFields = function() {
    return $scope.form.ipAcqMode === "Bridge";
  };

  $scope.showNATType = function() {
    return $scope.form.enableNAT === "1";
  };

  $scope.showVlanId = function() {
    return $scope.form.enableVlan === "1";
  };

  $scope.showMacAddress = function() {
    return $scope.form.macCloneEnabled;
  };

  $scope.showATMLinkInfo = function() {
    return $scope.form.accessType === "ATM";
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

    try {
      const response = await $http.get(URL + "cgi_get?Object=Device.ATM.Link");
      const objects = response.data.Objects || [];
      $scope.atmLinks = objects.filter((obj) =>
        /^Device\.ATM\.Link\.\d+$/.test(obj.ObjName)
      );
      $scope.atmLinksQos = objects.filter((obj) => /\.QoS$/.test(obj.ObjName));
      $scope.vpiVciOptions = $scope.atmLinks
        .map((obj) => {
          const addrParam = obj.Param.find(
            (p) => p.ParamName === "DestinationAddress"
          );
          return addrParam ? addrParam.ParamValue : null;
        })
        .filter(Boolean);

      // Select first VPI/VCI if available
      if ($scope.vpiVciOptions.length > 0 && !$scope.form.vpiVci) {
        $scope.selectVpiVci($scope.vpiVciOptions[0]);
      }
    } catch (err) {
      console.error("Failed to load ATM Link/QoS objects", err);
      $scope.vpiVciOptions = [];
    }
  }

  async function loadBridgeConnections() {
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
        const getParam = (name) =>
          ipObj.Param.find((x) => x.ParamName === name)?.ParamValue || "";

        // Determine access type from description
        let description = "";
        for (let obj of response.data.Objects) {
          const descParam = obj.Param.find(
            (x) => x.ParamName === "X_LANTIQ_COM_Description"
          );
          if (descParam && descParam.ParamValue) {
            description = descParam.ParamValue;
            break;
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

        // Load basic form fields
        $scope.form.encapsulationMode =
          getParam("X_LANTIQ_COM_EncapsulationMode") || "IPoE";
        $scope.form.protocolType =
          getParam("X_LANTIQ_COM_ProtocolType") || "IPv4";
        $scope.form.wanMode =
          getParam("X_LANTIQ_COM_WANMode") === "Bridged"
            ? "BridgedWan"
            : "RoutedWan";
        $scope.form.serviceType =
          getParam("X_LANTIQ_COM_ServiceType") || "TR069_Internet";
        $scope.form.defaultGateway =
          getParam("X_LANTIQ_COM_DefaultGateway") === "true" ? "1" : "0";
        $scope.form.mtu_mru_size = getParam("MaxMTUSize") || "1492";

        // Load addressing type to determine IP acquisition mode
        const addressingType = getParam("AddressingType");
        if (addressingType === "DHCP") {
          $scope.form.ipAcqMode = "DHCP";
        } else if (addressingType === "Static") {
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
        } else if (addressingType === "X_LANTIQ_COM_Bridged") {
          $scope.form.ipAcqMode = "Bridge";
        } else if (addressingType === "X_LANTIQ_COM_PPPoE") {
          $scope.form.ipAcqMode = "PPPoE";
        }

        // Load NAT settings
        await loadNATSettings();
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

  // ------------------------------------------------------------
  // Request Building Functions
  // ------------------------------------------------------------
  function buildRequestData() {
    const randomValue = generateRandomValue();
    let request = "";

    if ($scope.form.accessType === "ATM") {
      request = buildATMRequest(randomValue);
    } else if (
      $scope.form.accessType === "PTM" ||
      $scope.form.accessType === "ETH"
    ) {
      request = buildPTMRequest(randomValue);
    }

    return request;
  }

  function buildATMRequest(randomValue) {
    let request = "";
    const atmAlias = `cpe-WEB-ATMLink-${randomValue}`;
    const ethAlias = `cpe-WEB-EthernetLink-${randomValue}`;
    const pppAlias = `cpe-WEB-PPPInterface-${randomValue}`;
    const ipAlias = `cpe-WEB-IPInterface-${randomValue}`;

    // Create ATM Link if not selected from existing
    if (!$scope.form.selectedATMLink) {
      request += `Object=Device.ATM.Link&Operation=Add&Enable=true&Alias=${encodeParam(
        atmAlias
      )}`;
      request += `&LowerLayers=Device.DSL.Line.1.`;
      request += `&DestinationAddress=${encodeParam($scope.form.vpiVci)}`;
      request += `&Encapsulation=${encodeParam($scope.form.encapsulation)}`;
      request += `&LinkType=${encodeParam($scope.form.linkType)}`;
      request += `&`;
    }

    // ATM QoS Settings
    const qosObjName = $scope.form.selectedATMLink
      ? `${$scope.form.selectedATMLink.ObjName}.QoS`
      : `Device.ATM.Link.${atmAlias}.QoS`;

    request += `Object=${encodeParam(qosObjName)}&Operation=Modify`;
    request += `&QoSClass=${encodeParam($scope.form.atmQosClass)}`;
    if ($scope.form.peakCellRate)
      request += `&PeakCellRate=${encodeParam($scope.form.peakCellRate)}`;
    if ($scope.form.maximumBSize)
      request += `&MaximumBurstSize=${encodeParam($scope.form.maximumBSize)}`;
    if ($scope.form.sustainableCellRate)
      request += `&SustainableCellRate=${encodeParam(
        $scope.form.sustainableCellRate
      )}`;
    request += `&`;

    // IP Interface
    request += `Object=Device.IP.Interface&Operation=Add&Enable=true&Alias=${encodeParam(
      ipAlias
    )}`;

    // Lower layers based on connection type
    if ($scope.form.enableVlan == "1" && $scope.form.ipAcqMode === "Bridge") {
      request += `&LowerLayers=Device.Ethernet.VLANTermination.cpe-WEB-EthernetVLANTermination-${randomValue}`;
    } else if (
      $scope.form.ipAcqMode === "DHCP" ||
      $scope.form.ipAcqMode === "Static"
    ) {
      request += `&LowerLayers=Device.Ethernet.Link.${ethAlias}`;
    } else if ($scope.form.ipAcqMode === "PPPoE") {
      request += `&LowerLayers=Device.PPP.Interface.${pppAlias}`;
    }

    request += `&X_LANTIQ_COM_DefaultGateway=${
      $scope.form.defaultGateway === "1" ? "true" : "false"
    }`;
    request += `&IPv6Enable=false`;
    request += `&`;

    // Ethernet Link
    request += `Object=Device.Ethernet.Link&Operation=Add&Enable=true&Alias=${encodeParam(
      ethAlias
    )}`;
    if ($scope.form.ipAcqMode === "Bridge") {
      request += `&LowerLayers=${encodeParam(
        $scope.form.selectedBridge.objName
      )}.Port.cpe-WEB-BridgingBridge${
        $scope.form.selectedBridge.id
      }Port-${randomValue}`;
    } else {
      const atmLayer = $scope.form.selectedATMLink
        ? $scope.form.selectedATMLink.ObjName
        : `Device.ATM.Link.${atmAlias}`;
      request += `&LowerLayers=${encodeParam(atmLayer)}`;
    }

    if ($scope.form.macCloneEnabled && $scope.form.mac_address) {
      request += `&X_INTEL_COM_MACCloning=true&MACAddress=${encodeParam(
        $scope.form.mac_address
      )}`;
    }
    request += `&`;

    // VLAN if enabled
    if ($scope.form.enableVlan == "1") {
      const vlanAlias = `cpe-WEB-EthernetVLANTermination-${randomValue}`;
      request += `Object=Device.Ethernet.VLANTermination&Operation=Add&LowerLayers=Device.Ethernet.Link.${ethAlias}`;
      request += `&Alias=${encodeParam(
        vlanAlias
      )}&Enable=1&VLANID=${encodeParam($scope.form.vlanId)}`;
      request += `&`;
    }

    // PPPoE Configuration
    if ($scope.form.ipAcqMode === "PPPoE") {
      request += `Object=Device.PPP.Interface&Operation=Add&Enable=true&Alias=${encodeParam(
        pppAlias
      )}`;
      request += `&MaxMRUSize=${encodeParam($scope.form.mtu_mru_size)}`;
      request += `&Username=${encodeParam(
        $scope.form.username + "@tedata.net.eg"
      )}`;
      request += `&Password=${encodeParam($scope.form.password)}`;

      if ($scope.form.enableVlan == "1") {
        request += `&LowerLayers=Device.Ethernet.VLANTermination.cpe-WEB-EthernetVLANTermination-${randomValue}`;
      } else {
        request += `&LowerLayers=Device.Ethernet.Link.${ethAlias}`;
      }
      request += `&`;
    }

    // Bridge Configuration
    if ($scope.form.ipAcqMode === "Bridge") {
      if ($scope.form.selectedATMLink) {
        request += `Object=${encodeParam(
          $scope.form.selectedBridge.objName
        )}.Port&Operation=Add`;
        request += `&Enable=true&Alias=cpe-WEB-BridgingBridge${$scope.form.selectedBridge.id}Port-${randomValue}`;
        const atmLayer = $scope.form.selectedATMLink.ObjName;
        request += `&LowerLayers=${encodeParam(atmLayer)}`;
        request += `&`;
      }
    }

    // DHCP Configuration
    if ($scope.form.ipAcqMode === "DHCP") {
      request += `Object=Device.DHCPv4.Client&Operation=Add&Interface=Device.IP.Interface.${ipAlias}`;
      request += `&`;
    }

    // Static IP Configuration
    if ($scope.form.ipAcqMode === "Static") {
      request += `Object=Device.IP.Interface.${ipAlias}.IPv4Address&Operation=Add`;
      request += `&IPAddress=${encodeParam($scope.form.ipaddress)}`;
      request += `&SubnetMask=${encodeParam($scope.form.subnetmask)}`;
      request += `&`;

      request += `Object=Device.Routing.Router.1.IPv4Forwarding&Operation=Add`;
      request += `&Interface=Device.IP.Interface.${ipAlias}&Enable=true`;
      request += `&GatewayIPAddress=${encodeParam($scope.form.gatewayaddress)}`;
      request += `&`;

      request += `Object=Device.Routing.Router.1.IPv6Forwarding&Operation=Add`;
      request += `&Interface=Device.IP.Interface.${ipAlias}`;
      request += `&`;

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

    // NAT Configuration
    if ($scope.form.enableNAT === "1") {
      request += `Object=Device.NAT.InterfaceSetting&Operation=Add`;
      request += `&Interface=Device.IP.Interface.${ipAlias}`;
      request += `&Enable=true`;
      request += `&X_LANTIQ_COM_NATType=${encodeParam($scope.form.natType)}`;
      request += `&`;
    }

    return request;
  }

  function buildPTMRequest(randomValue) {
    let request = "";
    const ipAlias = `cpe-WEB-IPInterface-${randomValue}`;
    const ethAlias = `cpe-WEB-EthernetLink-${randomValue}`;
    const pppAlias = `cpe-WEB-PPPInterface-${randomValue}`;

    // Determine WAN layer
    let wanLayer = "Device.PTM.Link.1.";
    if ($scope.form.accessType === "ETH") {
      wanLayer = "Device.Ethernet.Interface.5.";
    }

    // IP Interface
    request += `Object=Device.IP.Interface&Operation=Add&Enable=true&Alias=${encodeParam(
      ipAlias
    )}`;

    // Lower layers based on connection type
    if ($scope.form.enableVlan == "1" && $scope.form.vlanId) {
      const vlanAlias = `cpe-WEB-EthernetVLANTermination-${randomValue}`;
      if ($scope.form.ipAcqMode === "PPPoE") {
        request += `&LowerLayers=Device.PPP.Interface.${pppAlias}`;
      } else if ($scope.form.ipAcqMode === "Bridge") {
        request += `&LowerLayers=Device.Ethernet.VLANTermination.${vlanAlias}`;
      } else {
        request += `&LowerLayers=Device.Ethernet.VLANTermination.${vlanAlias}`;
      }
    } else {
      if ($scope.form.ipAcqMode === "PPPoE") {
        request += `&LowerLayers=Device.PPP.Interface.${pppAlias}`;
      } else if ($scope.form.ipAcqMode === "Bridge") {
        request += `&LowerLayers=Device.Ethernet.Link.${ethAlias}`;
      } else {
        request += `&LowerLayers=Device.Ethernet.Link.${ethAlias}`;
      }
    }

    request += `&X_LANTIQ_COM_DefaultGateway=${
      $scope.form.defaultGateway === "1" ? "true" : "false"
    }`;
    request += `&IPv6Enable=false&MaxMTUSize=${encodeParam(
      $scope.form.mtu_mru_size
    )}`;
    request += `&`;

    // Ethernet Link
    request += `Object=Device.Ethernet.Link&Operation=Add&Enable=true&Alias=${encodeParam(
      ethAlias
    )}`;
    if ($scope.form.ipAcqMode === "Bridge") {
      const bridgePortAlias = `cpe-WEB-BridgingBridge1Port-${randomValue}`;
      request += `&LowerLayers=${encodeParam(
        $scope.form.selectedBridge.objName
      )}.Port.${bridgePortAlias}`;
    } else {
      request += `&LowerLayers=${encodeParam(wanLayer)}`;
    }

    if ($scope.form.macCloneEnabled && $scope.form.mac_address) {
      request += `&X_INTEL_COM_MACCloning=true&MACAddress=${encodeParam(
        $scope.form.mac_address
      )}`;
    }
    request += `&`;

    // VLAN if enabled
    if ($scope.form.enableVlan == "1" && $scope.form.vlanId) {
      const vlanAlias = `cpe-WEB-EthernetVLANTermination-${randomValue}`;
      request += `Object=Device.Ethernet.VLANTermination&Operation=Add`;
      request += `&LowerLayers=Device.Ethernet.Link.${ethAlias}`;
      request += `&Alias=${encodeParam(
        vlanAlias
      )}&Enable=1&VLANID=${encodeParam($scope.form.vlanId)}`;
      request += `&`;
    }

    // PPPoE Configuration
    if ($scope.form.ipAcqMode === "PPPoE") {
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

    // Bridge Configuration
    if ($scope.form.ipAcqMode === "Bridge") {
      const bridgePortAlias = `cpe-WEB-BridgingBridge1Port-${randomValue}`;
      request += `Object=${encodeParam(
        $scope.form.selectedBridge.objName
      )}.Port&Operation=Add`;
      request += `&Enable=true&Alias=${encodeParam(bridgePortAlias)}`;
      request += `&LowerLayers=${encodeParam(wanLayer)}`;
      request += `&`;
    }

    // DHCP Configuration
    if ($scope.form.ipAcqMode === "DHCP") {
      request += `Object=Device.DHCPv4.Client&Operation=Add`;
      request += `&Interface=Device.IP.Interface.${ipAlias}`;
      request += `&`;
    }

    // Static IP Configuration
    if ($scope.form.ipAcqMode === "Static") {
      request += `Object=Device.IP.Interface.${ipAlias}.IPv4Address&Operation=Add`;
      request += `&IPAddress=${encodeParam($scope.form.ipaddress)}`;
      request += `&SubnetMask=${encodeParam($scope.form.subnetmask)}`;
      request += `&`;

      request += `Object=Device.Routing.Router.1.IPv4Forwarding&Operation=Add`;
      request += `&Interface=Device.IP.Interface.${ipAlias}&Enable=true`;
      request += `&GatewayIPAddress=${encodeParam($scope.form.gatewayaddress)}`;
      request += `&`;

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

    // NAT Configuration
    if ($scope.form.enableNAT === "1") {
      request += `Object=Device.NAT.InterfaceSetting&Operation=Add`;
      request += `&Interface=Device.IP.Interface.${ipAlias}`;
      request += `&Enable=true`;
      request += `&X_LANTIQ_COM_NATType=${encodeParam($scope.form.natType)}`;
      request += `&`;
    }

    return request;
  }

  async function deleteOldConnection() {
    if (!$scope.isEditMode || !$scope.editIPInterface) return "";

    let deleteRequest = "";

    // Traverse and delete old connection objects
    async function traceAndDelete(layer) {
      if (!layer) return;
      const cleanLayer = layer.replace(/\.$/, "");

      try {
        const res = await $http.get(
          `${URL}cgi_get_nosubobj?Object=${cleanLayer}`
        );
        const obj = res.data.Objects?.[0];

        // Add to delete request if it's not ATM/PTM/DSL physical layer
        if (
          !cleanLayer.includes("ATM") &&
          !cleanLayer.includes("PTM") &&
          !cleanLayer.includes("DSL")
        ) {
          deleteRequest += `Object=${encodeParam(cleanLayer)}&Operation=Del&`;
        }

        // Recursively trace lower layers
        if (obj?.Param) {
          const nextLayer = obj.Param.find((p) => p.ParamName === "LowerLayers")
            ?.ParamValue;
          if (nextLayer) {
            await traceAndDelete(nextLayer);
          }
        }
      } catch (err) {
        console.warn("Failed to fetch layer for deletion:", layer, err);
      }
    }

    await traceAndDelete($scope.editIPInterface);
    return deleteRequest;
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
    if ($scope.form.ipAcqMode === "Bridge") {
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
      const requestData = buildRequestData();
      const result = await $http.post(URL + "cgi_set", requestData);

      if (result.status === 200) {
        // Handle user-defined DNS if needed
        if ($scope.form.isUserDefinedDNS && $scope.form.primaryDNS) {
          const dnsRequest = `UsrDefDNS1=${encodeParam(
            $scope.form.primaryDNS
          )}&UsrDefDNS2=${encodeParam($scope.form.secondaryDNS || "")}`;
          await $http.post(URL + "cgi_setUserDefinedDNS", dnsRequest);
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
    // Load initial data
    await loadEditModeData();

    // Load data based on access type
    if ($scope.form.accessType === "ATM") {
      await loadAtmLinksAndQos();
    }

    // Load bridge connections if needed
    if ($scope.form.ipAcqMode === "Bridge") {
      await loadBridgeConnections();
    }

    $scope.dataReady = true;
  }

  // Watch for access type changes
  $scope.$watch("form.accessType", async function(newVal, oldVal) {
    if (newVal !== oldVal) {
      if (newVal === "ATM") {
        await loadAtmLinksAndQos();
      } else {
        // Clear ATM-specific data when switching away from ATM
        $scope.atmLinks = [];
        $scope.atmLinksQos = [];
        $scope.vpiVciOptions = [];
        $scope.form.vpiVci = "";
        $scope.form.selectedATMLink = null;
      }

      // Reset form based on access type
      if (newVal === "PTM" || newVal === "ETH") {
        $scope.form.mtu_mru_size = "1492"; // MTU for PTM/ETH
      } else if (newVal === "ATM") {
        $scope.form.mtu_mru_size = "1492"; // MRU for ATM
      }
    }
  });

  // Watch for IP acquisition mode changes
  $scope.$watch("form.ipAcqMode", async function(newVal) {
    if (newVal === "Bridge") {
      await loadBridgeConnections();
    }
  });

  // Initialize the controller
  initialize();
});
