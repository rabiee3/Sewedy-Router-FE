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
    isUserDefinedDNS: false,
    primaryDNS: "",
    secondaryDNS: "",
    ipaddress: "",
    subnetmask: "",
    gatewayaddress: "",
  };

  $scope.connectionTypes = ["PPPoE", "Bridge", "DHCP", "Static"];
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
    ipv4: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
  };

  // Emit changes to the parent when ptmData is updated
  $scope.updateParent = function() {
    $scope.$emit("ptmDataChanged", $scope.ptmData);
  };

  $scope.showDNSFields = function() {
    return (
      $scope.ptmData.isUserDefinedDNS &&
      $scope.ptmData.connectionType !== "Bridge"
    );
  };

  $scope.isPrimaryDNSValid = function() {
    return $scope.patterns.ipv4.test($scope.ptmData.primaryDNS);
  };

  $scope.isSecondaryDNSValid = function() {
    if (!$scope.ptmData.secondaryDNS) return true;
    if ($scope.ptmData.secondaryDNS === $scope.ptmData.primaryDNS) return false;
    return $scope.patterns.ipv4.test($scope.ptmData.secondaryDNS);
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

        $scope.ptmData.ipv6enable =
          pppObj.Param.find((x) => x.ParamName === "IPv6Enable")?.ParamValue ===
          "true"
            ? "1"
            : "0";

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
    return await $http.post(URL + "cgi_set", DELETE_Request);
  }

  // Function to fetch DNS data specific to the current Device.IP.Interface during edit mode
  async function loadStaticDNSData() {
    if ($scope.ptmData.connectionType !== "Static") {
      return;
    }
    try {
      const response = await $http.get(
        "https://192.168.1.1/cgi/cgi_get?Object=Device.DNS.Client.Server"
      );

      if (response.data && response.data.Objects) {
        const currentInterface = $scope.editIPInterface.replace(/\.$/, ""); // Remove trailing dot if present
        if (!currentInterface) {
          localStorage.setItem(
            "staticDNSData",
            ""
          );
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

  // Function to fetch user-defined DNS data during edit mode
  async function loadUserDefinedDNS() {
    try {
      const response = await $http.get(URL + "cgi_get_dns");
      const dnsData = response.data.split("\n");

      dnsData.forEach((line) => {
        const [key, value] = line.split("=");
        if (key === "UsrDefDNS1") {
          $scope.ptmData.primaryDNS = value || "";
        } else if (key === "UsrDefDNS2") {
          $scope.ptmData.secondaryDNS = value || "";
        }
      });

      $scope.updateParent();
    } catch (error) {
      console.error("Error loading user-defined DNS data:", error);
    }
  }

  // Include static DNS data in the apply request
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
      } else if ($scope.ptmData.connectionType === "Static") {
        const dnsEntries = $scope.staticDNSData
          .map((dns, index) => {
            return `Object=Device.DNS.Client.Server&Operation=Add&Enable=true&Alias=StaticDNS-${randomNumber}-${index}&DNSServer=${dns.ip}`;
          })
          .join("&");

        connectionRequest = `Object=Device.IP.Interface&Operation=Add&Enable=true&Alias=cpe-WEB-IPInterface-${randomNumber}&LowerLayers=${WanGroupMappingLayer}&IPv6Enable=${$scope.ptmData.ipv6enable}&MaxMTUSize=${$scope.ptmData.mtu_size}&X_LANTIQ_COM_DefaultGateway=${$scope.ptmData.defaultGateway}&${dnsEntries}`;
      } else if ($scope.ptmData.connectionType === "DHCP") {
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
        // Post user-defined DNS data
        const dnsRequest = `UsrDefDNS1=${$scope.ptmData.primaryDNS}&UsrDefDNS2=${$scope.ptmData.secondaryDNS}`;
        const dnsResult = await $http.post(
          URL + "cgi_setUserDefinedDNS",
          dnsRequest
        );
        if (dnsResult.status !== 200) {
          alert("Failed to set user-defined DNS.");
        }
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

  // Ensure connectionType is set correctly during edit mode
  async function initializeConnectionType() {
    try {
      if ($scope.$parent.internetObject) {
        $scope.editIPInterface = $scope.$parent.internetObject.split(",")[0];
        const response = await $http.get(
          URL + `/cgi_get?Object=${$scope.editIPInterface}`
        );

        const ipInterfaceData = response.data["Objects"][1];

        if (ipInterfaceData) {
          const addressingType = ipInterfaceData.Param.find(
            (x) => x.ParamName === "AddressingType"
          )?.ParamValue;

          if (addressingType) {
            switch (addressingType) {
              case "X_LANTIQ_COM_PPPoE":
                $scope.ptmData.connectionType = "PPPoE";
                loadUserPassData();
                break;
              case "Bridge":
                $scope.ptmData.connectionType = "Bridge";
                loadBridgeConnections();
                break;
              case "Static":
                $scope.ptmData.connectionType = "Static";
                $scope.ptmData.subnetmask =
                  ipInterfaceData.Param.find(
                    (x) => x.ParamName === "SubnetMask"
                  )?.ParamValue || "";
                $scope.ptmData.ipaddress =
                  ipInterfaceData.Param.find((x) => x.ParamName === "IPAddress")
                    ?.ParamValue || "";
                loadStaticDNSData();
                break;
              default:
                $scope.ptmData.connectionType = "DHCP";
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

  // Refine $watch logic to prevent unnecessary calls
  $scope.$watch("ptmData.connectionType", function(newValue, oldValue) {
    if (newValue === oldValue) return;

    if (newValue === "Static") {
      loadStaticDNSData();
    } else if (newValue === "Bridge") {
      loadBridgeConnections();
    } else {
      loadUserPassData();
    }
  });

  $scope.validateDNSForm = function() {
    if (!$scope.ptmForm) return;

    const same =
      $scope.ptmData.secondaryDNS &&
      $scope.ptmData.secondaryDNS === $scope.ptmData.primaryDNS;

    $scope.ptmForm.$setValidity("dnsConflict", !same);
  };
});
