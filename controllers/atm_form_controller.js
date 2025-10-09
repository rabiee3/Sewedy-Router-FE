myapp.controller("atm_form_controller", function($scope, $http, $timeout) {
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
    isUserDefinedDNS: false,
    primaryDNS: "",
    secondaryDNS: "",
    ipaddress: "",
    subnetmask: "",
    gatewayaddress: "",
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
    EoA: ["PPPoE", "Bridge", "DHCP", "Static"],
    PPPoA: ["PPPoA"],
  };
  $scope.bridgeConnections = [];
  $scope.editEthernetInterface = "";
  $scope.editPPPInterface = "";
  $scope.editIPInterface = "";
  $scope.editAlias = "";
  $scope.ipInterfaceData = "";

  // Load ATM links and QoS objects on init if ATM mode
  if ($scope.$parent.form.selectionMode === "ATM") {
    loadAtmLinksAndQos();
  }

  $scope.Passwordfieldstatus = false;
  $scope.lowerPTM_link = "";
  $scope.ethInterfaceLink = "";

  // Validation patterns
  $scope.patterns = {
    username: /^\d+$/, // Only numbers
    password: /^\d+$/, // Only numbers
    macAddress: /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/, // MAC address
    mtuSize: /^\d+$/, // Only numbers
    ipv4: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
  };

  // Watcher to update connectionTypes dynamically
  $scope.$watch("atmData.linkType", function(newVal, oldVal) {
    if (newVal !== oldVal) {
      $scope.connectionTypes = $scope.connectionTypeOptionsMap[newVal] || [];
      if (
        !$scope.atmData.connectionType ||
        !$scope.connectionTypes.includes($scope.atmData.connectionType)
      ) {
        $scope.atmData.connectionType = $scope.connectionTypes[0]; // Set default only if empty or invalid
      }
      $scope.updateParent();
    }
  });

  // Emit changes to the parent when atmData is updated
  $scope.updateParent = function() {
    $scope.$emit("atmDataChanged", $scope.atmData);
  };

  $scope.showDNSFields = function() {
    return (
      $scope.atmData.isUserDefinedDNS &&
      $scope.atmData.connectionType !== "Bridge"
    );
  };

  $scope.isPrimaryDNSValid = function() {
    return $scope.patterns.ipv4.test($scope.atmData.primaryDNS);
  };

  $scope.isSecondaryDNSValid = function() {
    if (!$scope.atmData.secondaryDNS) return true;
    if ($scope.atmData.secondaryDNS === $scope.atmData.primaryDNS) return false;
    return $scope.patterns.ipv4.test($scope.atmData.secondaryDNS);
  };

  $scope.selectVpiVci = function(vpiVci) {
    $scope.atmData.vpiVci = vpiVci;
    // Find the selected link object
    const linkObj = $scope.atmLinks.find((obj) => {
      const addrParam = obj.Param.find(
        (p) => p.ParamName === "DestinationAddress"
      );
      return addrParam && addrParam.ParamValue === vpiVci;
    });
    // Find the corresponding QoS object
    let qosObj = null;
    if (linkObj) {
      const linkNumMatch = linkObj.ObjName.match(/Device\.ATM\.Link\.(\d+)$/);
      if (linkNumMatch) {
        const qosObjName = `Device.ATM.Link.${linkNumMatch[1]}.QoS`;
        qosObj = $scope.atmLinksQos.find((obj) => obj.ObjName === qosObjName);
      }
    }
    // Fill fields from linkObj and qosObj
    if (qosObj) {
      $scope.atmData.atmQosClass = getParamValue(qosObj, "QoSClass");
      $scope.atmData.peakCellRate =
        parseInt(getParamValue(qosObj, "PeakCellRate")) || "";
      $scope.atmData.maximumBSize =
        parseInt(getParamValue(qosObj, "MaximumBurstSize")) || "";
      $scope.atmData.sustainableCellRate =
        parseInt(getParamValue(qosObj, "SustainableCellRate")) || "";
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
    const param = obj.Param.find((p) => p.ParamName === paramName);
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
    if (window.$ && $("#ajaxLoaderSection").length) {
      $("#ajaxLoaderSection").show();
    }
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
      $("#ajaxLoaderSection").hide();
    } catch (err) {
      console.error("Failed to load ATM Link/QoS objects", err);
      $scope.vpiVciOptions = [];
      $("#ajaxLoaderSection").hide();
    }
  }

  async function fetchVpiVciName(atmLinkObjName) {
    try {
      const response = await $http.get(
        URL + `cgi_get_fillparams?Object=${atmLinkObjName}`
      );

      const resObj = response.data["Objects"][0];

      const getParam = (name) => {
        const param = resObj.Param.find((p) => p.ParamName === name);
        return param ? param.ParamValue : "";
      };

      $scope.selectVpiVci(getParam("DestinationAddress"));
      $scope.atmData.linkType = getParam("LinkType");
      $scope.atmData.encapsulation = getParam("Encapsulation");
      $("#ajaxLoaderSection").hide();
    } catch (err) {
      console.error("Error fetching VPI/VCI name:", err);
      $("#ajaxLoaderSection").hide();
    }
  }

  // Function to fetch DNS data specific to the current Device.IP.Interface during edit mode
  async function loadStaticDNSData() {
    if ($scope.atmData.connectionType !== "Static") {
      return;
    }
    try {
      const response = await $http.get(
        "https://192.168.1.1/cgi/cgi_get?Object=Device.DNS.Client.Server"
      );

      if (response.data && response.data.Objects) {
        const currentInterface = $scope.editIPInterface.replace(/\.$/, ""); // Remove trailing dot if present

        if (!currentInterface) {
          localStorage.setItem("staticDNSData", "");
          return;
        }

        $scope.staticDNSData = response.data.Objects.filter((dns) => {
          const interfaceParam = dns.Param.find(
            (x) => x.ParamName === "Interface"
          );
          return (
            interfaceParam &&
            interfaceParam.ParamValue.replace(/\.$/, "") === currentInterface // Remove trailing dot for comparison
          );
        }).map((dns) => {
          const serverParam = dns.Param.find(
            (x) => x.ParamName === "DNSServer"
          );
          return {
            id: dns.ObjName,
            ip: serverParam ? serverParam.ParamValue : "",
            editable: false, // Mark as non-editable for existing entries
          };
        });

        // Save to localStorage
        localStorage.setItem(
          "staticDNSData",
          JSON.stringify($scope.staticDNSData)
        );
      } else {
        $scope.staticDNSData = [];
      }
    } catch (error) {
      console.error("Error loading static DNS data:", error);
    }
  }

  // Function to fetch user-defined DNS data during edit mode
  async function loadUserDefinedDNS() {
    try {
      const response = await $http.get(URL + "cgi_get_dns");
      const dnsData = response.data.split("\n");

      dnsData.forEach((line) => {
        const [key, value] = line.split("=");
        if (key === "UsrDefDNS1") {
          $scope.atmData.primaryDNS = value || "";
        } else if (key === "UsrDefDNS2") {
          $scope.atmData.secondaryDNS = value || "";
        }
      });

      $scope.updateParent();
    } catch (error) {
      console.error("Error loading user-defined DNS data:", error);
    }
  }

  // Ensure connectionType is set correctly during edit mode
  async function initializeConnectionType() {
    try {
      if ($scope.$parent.internetObject) {
        $scope.editIPInterface = $scope.$parent.internetObject.split(",")[0];
        const response = await $http.get(
          URL + `/cgi_get?Object=${$scope.editIPInterface}`
        );

        $scope.ipInterfaceData = response.data["Objects"][1];

        if ($scope.ipInterfaceData) {
          const addressingType = $scope.ipInterfaceData.Param.find(
            (x) => x.ParamName === "AddressingType"
          )?.ParamValue;

          if (addressingType) {
            switch (addressingType) {
              case "X_LANTIQ_COM_PPPoE":
                $scope.atmData.connectionType = "PPPoE";
                loadUserPassData();
                break;
              case "Bridge":
                $scope.atmData.connectionType = "Bridge";
                loadBridgeConnections();
                break;
              case "Static":
                $scope.atmData.connectionType = "Static";
                $scope.atmData.subnetmask =
                  $scope.ipInterfaceData.Param.find(
                    (x) => x.ParamName === "SubnetMask"
                  )?.ParamValue || "";
                $scope.atmData.ipaddress =
                  $scope.ipInterfaceData.Param.find(
                    (x) => x.ParamName === "IPAddress"
                  )?.ParamValue || "";
                loadStaticDNSData();
                break;
              default:
                $scope.atmData.connectionType = "DHCP";
            }
          }
        }
      }

      // Load user-defined DNS data
      await loadUserDefinedDNS();
    } catch (error) {
      console.error("Error initializing connection type:", error);
    }
  }

  // Call initializeConnectionType during controller initialization
  initializeConnectionType();

  // Initialize static DNS data
  $scope.staticDNSData =
    JSON.parse(localStorage.getItem("staticDNSData")) || [];

  // Add a new row for static DNS entry
  $scope.addStaticDNSRow = function() {
    $scope.staticDNSData.push({ id: null, ip: "", editable: true });
  };

  // Confirm a static DNS row (make it non-editable)
  $scope.confirmStaticDNSRow = function(index) {
    const dns = $scope.staticDNSData[index];
    if ($scope.patterns.ipv4.test(dns.ip)) {
      dns.editable = false;
      // Save updated data to localStorage
      localStorage.setItem(
        "staticDNSData",
        JSON.stringify($scope.staticDNSData)
      );
    } else {
      alert("Please enter a valid IPv4 address.");
    }
  };

  // Remove a static DNS row
  $scope.removeStaticDNSRow = function(index) {
    $scope.staticDNSData.splice(index, 1);
    // Save updated data to localStorage
    localStorage.setItem("staticDNSData", JSON.stringify($scope.staticDNSData));
  };

  async function loadUserPassData() {
    try {
      if ($scope.$parent.internetObject) {
        const DeviceIpInterface = $scope.$parent.internetObject.split(",")[0];
        // Get PPP interface data
        const pppInterfaceData = await $http.get(
          URL + "cgi_get_nosubobj?Object=" + DeviceIpInterface
        );
        const pppObj = pppInterfaceData.data["Objects"][0];

        $scope.lowerPTM_link = pppObj.Param.find(
          (x) => x.ParamName === "LowerLayers"
        )?.ParamValue;

        // Get ATM Link data (LinkType, Encapsulation, DestinationAddress)
        if ($scope.lowerPTM_link) {
          const atmLinkResponse = await $http.get(
            URL + "cgi_get_nosubobj?Object=" + $scope.lowerPTM_link
          );
          const atmLinkObj = atmLinkResponse.data["Objects"][0];

          if (atmLinkObj && atmLinkObj.Param) {
            $scope.ethInterfaceLink = atmLinkObj.Param.find(
              (x) => x.ParamName === "LowerLayers"
            )?.ParamValue;

            const ethLinkRes = await $http.get(
              URL + "cgi_get_nosubobj?Object=" + $scope.ethInterfaceLink
            );

            const atmLink = ethLinkRes.data["Objects"][0].Param.find(
              (x) => x.ParamName === "LowerLayers"
            )?.ParamValue;

            await fetchVpiVciName(atmLink);
          }
        }

        const userPassResponse = await $http.get(
          URL + "cgi_get_nosubobj?Object=" + $scope.lowerPTM_link
        );
        const userPassData = userPassResponse.data["Objects"][0];

        setTimeout(() => {
          $scope.$apply(() => {
            $scope.atmData.username =
              userPassData.Param.find(
                (x) => x.ParamName === "Username"
              )?.ParamValue?.split("@")[0] || "";
            $scope.atmData.password =
              userPassData.Param.find((x) => x.ParamName === "Password")
                ?.ParamValue || "";
            $scope.atmData.mtu_size =
              parseInt(
                userPassData.Param.find((x) => x.ParamName === "MaxMRUSize")
                  ?.ParamValue
              ) || 1492;

            $scope.atmData.ipv6enable = pppObj.Param.find(
              (x) => x.ParamName === "IPv6Enable"
            )?.ParamValue;

            $scope.atmData.defaultGateway =
              pppObj.Param.find(
                (x) => x.ParamName === "X_LANTIQ_COM_DefaultGateway"
              )?.ParamValue === "true"
                ? "1"
                : "0";
          });
          $("#ajaxLoaderSection").hide();
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

  // Helper: safely get string values
  function safe(v) {
    return v === undefined || v === null ? "" : v;
  }

  async function getDefaultGatewayInterface() {
    try {
      const res = await $http.get(URL + "cgi_get?Object=Device.IP.Interface");
      const interfaces = res.data.Objects || [];

      // Find the interface where DefaultGateway flag is true
      const gwInterface = interfaces.find((iface) => {
        const gwParam = iface.Param.find(
          (p) => p.ParamName === "X_LANTIQ_COM_DefaultGateway"
        );
        return gwParam && gwParam.ParamValue === "true";
      });

      if (!gwInterface) return null;

      const nameParam = gwInterface.ObjName;
      const lowerLayerParam = gwInterface.Param.find(
        (p) => p.ParamName === "LowerLayers"
      )?.ParamValue;

      return {
        objName: nameParam,
        lowerLayer: lowerLayerParam,
        params: gwInterface.Param,
      };
    } catch (err) {
      console.error("Error fetching default gateway interface:", err);
      return null;
    }
  }

  $scope.addNewConnection = async function() {
    $("#ajaxLoaderSection").show();
    try {
      // --- Handle edit mode ---
      if ($scope.$parent.isEditMode) {
        await $scope.deleteConnection();
      }

      // --- Generate unique suffix ---
      let randomNumber = parseInt(localStorage.getItem("randomvalue"));
      if (isNaN(randomNumber)) {
        randomNumber = Math.floor(Math.random() * 1000);
        localStorage.setItem("randomvalue", randomNumber);
      }

      // --- Common Aliases ---
      const atmAlias = `cpe-WEB-ATMLink-${randomNumber}`;
      const ethAlias = `cpe-WEB-EthernetLink-${randomNumber}`;
      const pppAlias = `cpe-WEB-PPPInterface-${randomNumber}`;
      const ipAlias = `cpe-WEB-IPInterface-${randomNumber}`;
      const dnsAlias = `StaticDNS-${randomNumber}-0`;

      const dslLowerLayer = "Device.DSL.Line.1.";

      let connectionRequest = "";

      // --- 1. ATM Link ---
      connectionRequest += `&Object=Device.ATM.Link&Operation=Add&Enable=true&Alias=${atmAlias}`;
      connectionRequest += `&LowerLayers=${dslLowerLayer}`;
      connectionRequest += `&DestinationAddress=${$scope.atmData.vpiVci ||
        "0/35"}`;
      connectionRequest += `&LinkType=${$scope.atmData.linkType || "EoA"}`;
      connectionRequest += `&Encapsulation=${$scope.atmData.encapsulation ||
        "LLC"}`;

      // --- 2. QoS ---
      connectionRequest += `&Object=Device.ATM.Link.${atmAlias}.QoS&Operation=Modify`;
      connectionRequest += `&QoSClass=${$scope.atmData.atmQosClass || "UBR"}`;
      if ($scope.atmData.peakCellRate)
        connectionRequest += `&PeakCellRate=${$scope.atmData.peakCellRate}`;
      if ($scope.atmData.maximumBSize)
        connectionRequest += `&MaximumBurstSize=${$scope.atmData.maximumBSize}`;
      if ($scope.atmData.sustainableCellRate)
        connectionRequest += `&SustainableCellRate=${$scope.atmData.sustainableCellRate}`;

      // --- 3. Ethernet Link ---
      connectionRequest += `&Object=Device.Ethernet.Link&Operation=Add&Enable=true`;
      connectionRequest += `&Alias=${ethAlias}`;
      connectionRequest += `&LowerLayers=Device.ATM.Link.${atmAlias}`;

      // --- 4. PPP Interface (if applicable) ---
      if ($scope.atmData.connectionType === "PPPoE") {
        const username = encodeURIComponent(
          `${$scope.atmData.username}@tedata.net.eg`
        );
        const password = encodeURIComponent($scope.atmData.password || "");

        connectionRequest += `&Object=Device.PPP.Interface&Operation=Add&Enable=true`;
        connectionRequest += `&Alias=${pppAlias}`;
        connectionRequest += `&LowerLayers=Device.Ethernet.Link.${ethAlias}`;
        connectionRequest += `&MaxMRUSize=${$scope.atmData.mtu_size || 1492}`;
        connectionRequest += `&Username=${username}&Password=${password}`;
      }

      // --- 5. IP Interface ---
      connectionRequest += `&Object=Device.IP.Interface&Operation=Add&Enable=true`;
      connectionRequest += `&Alias=${ipAlias}`;
      const lowerLayer =
        $scope.atmData.connectionType === "PPPoE"
          ? `Device.PPP.Interface.${pppAlias}`
          : `Device.Ethernet.Link.${ethAlias}`;
      connectionRequest += `&LowerLayers=${lowerLayer}`;
      connectionRequest += `&X_LANTIQ_COM_DefaultGateway=${
        $scope.atmData.defaultGateway === "1" ? "true" : "false"
      }`;
      connectionRequest += `&IPv6Enable=${$scope.atmData.ipv6enable || 0}`;

      // --- 6. IPv4 Address / Routing / DNS Handling ---
      if ($scope.atmData.connectionType === "Static") {
        // IPv4 Address
        if ($scope.atmData.static_ip && $scope.atmData.static_mask) {
          connectionRequest += `&Object=Device.IP.Interface.${ipAlias}.IPv4Address&Operation=Add`;
          connectionRequest += `&IPAddress=${$scope.atmData.static_ip}`;
          connectionRequest += `&SubnetMask=${$scope.atmData.static_mask}`;
        } else {
          // fallback to DHCP if not provided
          connectionRequest += `&Object=Device.IP.Interface.${ipAlias}.IPv4Address&Operation=Add`;
        }

        // Routing (IPv4)
        connectionRequest += `&Object=Device.Routing.Router.1.IPv4Forwarding&Operation=Add`;
        connectionRequest += `&Interface=Device.IP.Interface.${ipAlias}`;
        connectionRequest += `&Enable=true`;
        if ($scope.atmData.static_gw)
          connectionRequest += `&GatewayIPAddress=${$scope.atmData.static_gw}`;

        // Routing (IPv6)
        connectionRequest += `&Object=Device.Routing.Router.1.IPv6Forwarding&Operation=Add`;
        connectionRequest += `&Interface=Device.IP.Interface.${ipAlias}`;

        // Static DNS
        if (
          Array.isArray($scope.staticDNSData) &&
          $scope.staticDNSData.length > 0
        ) {
          $scope.staticDNSData.forEach((dns, index) => {
            if (dns.ip) {
              connectionRequest += `&Object=Device.DNS.Client.Server&Operation=Add`;
              connectionRequest += `&Enable=1`;
              connectionRequest += `&Alias=StaticDNS-${randomNumber}-${index}`;
              connectionRequest += `&DNSServer=${dns.ip}`;
              connectionRequest += `&Interface=Device.IP.Interface.${ipAlias}`;
            }
          });
        } else if ($scope.atmData.static_dns) {
          connectionRequest += `&Object=Device.DNS.Client.Server&Operation=Add&Enable=1`;
          connectionRequest += `&Alias=${dnsAlias}`;
          connectionRequest += `&DNSServer=${$scope.atmData.static_dns}`;
          connectionRequest += `&Interface=Device.IP.Interface.${ipAlias}`;
        }
      }

      console.log("📡 CGI Request:", connectionRequest);

      // --- 7. Send request ---
      const response = await $http.post(URL + "cgi_set", connectionRequest, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      // --- 8. Router Response Validation ---
      if (
        response.data &&
        (response.data.status === 422 ||
          response.data.Status === "Error" ||
          (typeof response.data === "string" &&
            response.data.toLowerCase().includes("unprocessable")))
      ) {
        throw new Error("Router rejected CGI request: Unprocessable entry");
      }

      // --- 9. Optional user-defined DNS ---
      if ($scope.atmData.isUserDefinedDNS) {
        const dnsRequest = `UsrDefDNS1=${$scope.atmData.primaryDNS}&UsrDefDNS2=${$scope.atmData.secondaryDNS}`;
        const dnsResult = await $http.post(
          URL + "cgi_setUserDefinedDNS",
          dnsRequest
        );
        if (dnsResult.status !== 200) {
          alert("Failed to set user-defined DNS.");
        }
      }

      alert("✅ Connection created successfully!");
      $scope.$emit("connectionAdded", true);
    } catch (err) {
      console.error("❌ Error adding connection:", err);
      alert(err.message || "Failed to add connection.");
    } finally {
      $("#ajaxLoaderSection").hide();
    }
  };

  $scope.$on("addAtmConnection", function() {
    $scope.addNewConnection();
  });

  // Watch for changes in connectionType and load data accordingly
  $scope.$watch("atmData.connectionType", function(newValue, oldValue) {
    if (newValue === oldValue) return;

    if (newValue === "Static") {
      if ($scope.ipInterfaceData) {
        $scope.atmData.subnetmask =
          $scope.ipInterfaceData.Param.find((x) => x.ParamName === "SubnetMask")
            ?.ParamValue || "";
        $scope.atmData.ipaddress =
          $scope.ipInterfaceData.Param.find((x) => x.ParamName === "IPAddress")
            ?.ParamValue || "";
      }

      loadStaticDNSData();
    } else if (newValue === "Bridge") {
      loadBridgeConnections();
    } else if (newValue === "PPPoE") {
      loadUserPassData();
    }

    $timeout(function() {
      $scope.connectionTypes = angular.copy($scope.connectionTypes); // Force re-render
    });
  });

  $scope.validateDNSForm = function() {
    if (!$scope.atmForm) return;

    const same =
      $scope.atmData.secondaryDNS &&
      $scope.atmData.secondaryDNS === $scope.atmData.primaryDNS;

    $scope.atmForm.$setValidity("dnsConflict", !same);
  };

  async function getAtmConnectionObjects(ipInterface) {
    let objectsToDelete = [];
    try {
      // 1. IP Interface
      objectsToDelete.push(ipInterface);

      // 2. Get PPP Interface from IP's LowerLayers
      const ipData = await $http.get(
        URL + "cgi_get_nosubobj?Object=" + ipInterface
      );
      const ipObj = ipData.data.Objects[0];
      const pppInterface = ipObj.Param.find(
        (x) => x.ParamName === "LowerLayers"
      )?.ParamValue;
      if (pppInterface) objectsToDelete.push(pppInterface);

      // 3. Get Ethernet Interface from PPP's LowerLayers
      const pppData = await $http.get(
        URL + "cgi_get_nosubobj?Object=" + pppInterface
      );
      const pppObj = pppData.data.Objects[0];
      const ethInterface = pppObj.Param.find(
        (x) => x.ParamName === "LowerLayers"
      )?.ParamValue;
      if (ethInterface) objectsToDelete.push(ethInterface);

      // 4. Get ATM Link from Ethernet's LowerLayers
      const ethData = await $http.get(
        URL + "cgi_get_nosubobj?Object=" + ethInterface
      );
      const ethObj = ethData.data.Objects[0];
      const atmLink = ethObj.Param.find((x) => x.ParamName === "LowerLayers")
        ?.ParamValue;
      if (atmLink) objectsToDelete.push(atmLink);

      return objectsToDelete;
    } catch (err) {
      console.error("Error traversing ATM connection chain", err);
      return objectsToDelete;
    }
  }

  $scope.deleteConnection = async function() {
    try {
      let objects = await getAtmConnectionObjects(
        $scope.$parent.internetObject.split(",")[0]
      );
      let deleteRequest = "";
      objects.forEach((objName) => {
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
