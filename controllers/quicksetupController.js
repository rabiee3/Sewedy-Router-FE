myapp.controller("quicksetupController", function(
  $rootScope,
  $scope,
  $route,
  $http,
  $location,
  $routeParams,
  localStorageService,
  modifyService,
  $q,
  $http,
  languageService,
  TOKEN_MISMATCH_CODE
) {
  $scope.step = 1;

  // Default values
  $scope.credentials = {
    username: 111111,
    password: "00000000",
  };

  $scope.wifiSettings = {
    enable2_4G: true,
    enable5G: true,
    ssid2_4G: "WE_F771A0",
    security_modes2_4: ["WPA-Personal", "WPA2-Personal", "WPA-WPA2-Personal"],
    selected_security_2_4G: "WPA-Personal",
    encription_modes2_4: ["TKIP", "AES", "TKIP/AES"],
    selected_encryption_2_4G: "TKIP",
    password2_4G: "c789d000",
    ssid5G: "WE_F771A0",
    security_modes5G: ["WPA-Personal", "WPA2-Personal", "WPA-WPA2-Personal"],
    selected_security_5G: "WPA-Personal",
    encription_modes5G: ["TKIP", "AES", "TKIP/AES"],
    selected_encryption_5G: "TKIP",
    password5G: "c789d000",
    band_steering: false,
  };

  // Security to Encryption mapping
  const securityToEncryptionMap = {
    "WPA-Personal": "TKIP",
    "WPA2-Personal": "AES",
    "WPA-WPA2-Personal": "TKIP/AES",
  };

  loadExistingCredentials();

  // Watch for 2.4G security mode changes
  $scope.$watch("wifiSettings.selected_security_2_4G", function(newVal) {
    if (newVal && securityToEncryptionMap[newVal]) {
      $scope.wifiSettings.selected_encryption_2_4G =
        securityToEncryptionMap[newVal];
    }
  });

  // Watch for 5G security mode changes
  $scope.$watch("wifiSettings.selected_security_5G", function(newVal) {
    if (newVal && securityToEncryptionMap[newVal]) {
      $scope.wifiSettings.selected_encryption_5G =
        securityToEncryptionMap[newVal];
    }
  });

  // Validation functions
  $scope.isUsernameValid = function() {
    return /^\d+$/.test($scope.credentials.username);
  };

  $scope.isPasswordValid = function() {
    return $scope.credentials.password.length === 8;
  };

  $scope.is24GWifiValid = function() {
    if ($scope.wifiSettings.enable2_4G) {
      if (!$scope.wifiSettings.ssid2_4G || !$scope.wifiSettings.password2_4G) {
        return false;
      }
    }
    return true;
  };

  $scope.is5GWifiValid = function() {
    if ($scope.wifiSettings.enable5G) {
      if (!$scope.wifiSettings.ssid5G || !$scope.wifiSettings.password5G) {
        return false;
      }
    }
    return true;
  };

  // Navigation functions
  $scope.nextStep = function() {
    if (
      $scope.step === 2 &&
      (!$scope.is24GWifiValid() || !$scope.is5GWifiValid())
    ) {
      return;
    }
    $scope.step++;
  };

  $scope.prevStep = function() {
    if ($scope.step > 1) {
      $scope.step--;
    }
  };

  $scope.skip = async function() {
    var getAllPVCs = `Object=Device.IP.Interface&X_LANTIQ_COM_DefaultGateway=true`;
    let res;
    //Get ALL PVC Request
    res = await $http.get(URL + "cgi_get_filterbyparamval?" + getAllPVCs);
    if (res.status == 200) {
      $location.path("/");
      $scope.$apply();
      window.location.reload();
    } else {
      console.log("Something wrong happened");
    }
  };

  $scope.isFormValid = function() {
    return $scope.isUsernameValid() && $scope.isPasswordValid();
  };

  $scope.toggle2_4G = function() {
    return $http.post(
      URL + "cgi_set",
      `Object=Device.WiFi.Radio.1&Operation=Modify&Enable=${$scope.wifiSettings.enable2_4G}`
    );
  };

  $scope.toggle5G = function() {
    return $http.post(
      URL + "cgi_set",
      `Object=Device.WiFi.Radio.2&Operation=Modify&Enable=${$scope.wifiSettings.enable5G}`
    );
  };

  $scope.getInterfacesToDelete = function(interfaces) {
    const regex = /(ptm|wan|eth|pppoe)/i;
    let interfacesToDelete = [];

    if (!interfaces || !interfaces.Objects || interfaces.Objects.length <= 0) {
      return [];
    }

    // Loop through all objects
    for (let object of interfaces.Objects) {
      // Only process main IP Interface objects (not .Stats, .IPv4Address, etc.)
      if (!/^Device\.IP\.Interface\.\d+$/.test(object.ObjName)) {
        continue;
      }

      let lowerLayer = null;
      let interfaceName = "";
      let alias = "";

      // Extract parameters
      for (let param of object.Param) {
        if (param.ParamName === "LowerLayers") {
          lowerLayer = param.ParamValue;
        }
        if (param.ParamName === "Name") {
          interfaceName = param.ParamValue;
        }
        if (param.ParamName === "Alias") {
          alias = param.ParamValue;
        }
      }

      interfacesToDelete.push({
        interfaceObj: object.ObjName,
        lowerLayer: lowerLayer,
        name: interfaceName,
        alias: alias,
      });
    }

    return interfacesToDelete;
  };

  async function loadExistingCredentials() {
    try {
      let DeviceIpInterface = null;

      const dafaultGatewayRes = await $http.get(
        URL +
          "cgi_get?Object=Device.IP.Interface&X_LANTIQ_COM_DefaultGateway=true"
      );

      if (
        dafaultGatewayRes.data &&
        dafaultGatewayRes.data.Objects &&
        dafaultGatewayRes.data.Objects.length > 0
      ) {
        // Find the main interface object (not .Stats or .IPv4Address etc.)
        const mainObj = dafaultGatewayRes.data.Objects.find((obj) =>
          /^Device\.IP\.Interface\.\d+$/.test(obj.ObjName)
        );
        if (mainObj) {
          DeviceIpInterface = mainObj.ObjName;
        }
      }

      if (!DeviceIpInterface) {
        console.error("No Default Device Ip Interface found.");
        return;
      }

      const user_pass = await loadUserPassData(DeviceIpInterface);

      setTimeout(() => {
        $scope.$apply(() => {
          $scope.credentials.username = Number(user_pass.Username);
          if (user_pass.Password) {
            $scope.credentials.password = user_pass.Password;
          }
        });
      }, 200);

      // Get WiFi 2_4G SSID data
      const ssidResponse = await $http.get(
        URL + "cgi_get_nosubobj?Object=Device.WiFi.SSID.1"
      );

      if (ssidResponse.data?.Objects?.[0]?.Param) {
        const ssidParam = ssidResponse.data.Objects[0].Param.find(
          (x) => x.ParamName === "SSID"
        );
        if (ssidParam) {
          $scope.wifiSettings.ssid2_4G = ssidParam.ParamValue;
        }
      }

      // Get WiFi 2_4G Password data
      const securityResponse = await $http.get(
        URL + "cgi_get_nosubobj?Object=Device.WiFi.AccessPoint.1.Security"
      );

      if (securityResponse.data?.Objects?.[0]?.Param) {
        const passwordParam = securityResponse.data.Objects[0].Param.find(
          (x) => x.ParamName === "KeyPassphrase"
        );
        if (passwordParam && passwordParam.ParamValue != "") {
          $scope.wifiSettings.password2_4G = passwordParam.ParamValue;
        }

        const securityMode24G = securityResponse.data.Objects[0].Param.find(
          (x) => x.ParamName === "ModeEnabled"
        );
        if (securityMode24G && securityMode24G.ParamValue != "") {
          $scope.wifiSettings.selected_security_2_4G = securityMode24G.ParamValue;
        }
      }

      // Get WiFi 5G SSID data
      const ssidResponse5g = await $http.get(
        URL + "cgi_get_nosubobj?Object=Device.WiFi.SSID.2"
      );

      if (ssidResponse5g.data?.Objects?.[0]?.Param) {
        const ssidParam = ssidResponse5g.data.Objects[0].Param.find(
          (x) => x.ParamName === "SSID"
        );
        if (ssidParam) {
          $scope.wifiSettings.ssid5G = ssidParam.ParamValue;
        }
      }

      // Get WiFi 5G Password data
      const securityResponse5G = await $http.get(
        URL + "cgi_get_nosubobj?Object=Device.WiFi.AccessPoint.2.Security"
      );

      if (securityResponse5G.data?.Objects?.[0]?.Param) {
        const passwordParam = securityResponse5G.data.Objects[0].Param.find(
          (x) => x.ParamName === "KeyPassphrase"
        );
        if (passwordParam && passwordParam.ParamValue != "") {
          $scope.wifiSettings.password5G = passwordParam.ParamValue;
        }

        const securityMode5G = securityResponse5G.data.Objects[0].Param.find(
          (x) => x.ParamName === "ModeEnabled"
        );
        if (securityMode5G && securityMode5G.ParamValue != "") {
          $scope.wifiSettings.selected_security_5G = securityMode5G.ParamValue;
        }
      }
    } catch (error) {
      console.error("Error loading existing credentials:", error);
    }
  }

  async function getConnectionObjects(
    objPath,
    includePhysical = false,
    visited = []
  ) {
    try {
      if (!objPath || visited.includes(objPath)) return [];
      visited.push(objPath);

      const res = await $http.get(`${URL}cgi_get_nosubobj?Object=${objPath}`);
      const obj = res.data.Objects?.[0];
      if (!obj) return [];

      const lowerParam = obj.Param.find((p) => p.ParamName === "LowerLayers");
      if (!lowerParam || !lowerParam.ParamValue) {
        // If no lower layer, we reached physical layer
        return [objPath];
      }

      const lower = lowerParam.ParamValue.replace(/\.$/, "");

      if (
        lower.includes("ATM.Link") ||
        lower.includes("PTM.Link") ||
        lower.includes("DSL.Channel")
      ) {
        return includePhysical ? [objPath, lower] : [objPath];
      }

      // Recurse deeper
      const deeper = await getConnectionObjects(
        lower,
        includePhysical,
        visited
      );
      return [objPath, ...deeper];
    } catch (err) {
      console.error("Error traversing connection chain:", err);
      return [objPath];
    }
  }

  async function loadUserPassData(deviceIpInterface) {
    try {
      // --- Step 1: Get the full connection chain ---
      const connectionChain = await getConnectionObjects(
        deviceIpInterface,
        true
      );
      if (!Array.isArray(connectionChain) || connectionChain.length === 0)
        return;

      // --- Step 2: Identify PPP interface ---
      const pppInterface = connectionChain.find((x) =>
        x.includes("PPP.Interface")
      );
      if (!pppInterface) return;

      // --- Step 3: Get PPP Interface object ---
      const pppRes = await $http.get(
        `${URL}cgi_get_nosubobj?Object=${pppInterface}`
      );
      const pppObj = pppRes.data.Objects?.[0];
      if (!pppObj) return;

      // --- Step 4: Load PPPoE credentials & MTU ---
      const usernameParam = pppObj.Param.find(
        (p) => p.ParamName === "Username"
      );
      const passwordParam = pppObj.Param.find(
        (p) => p.ParamName === "Password"
      );

      return {
        Username: usernameParam.ParamValue.split("@")[0],
        Password: passwordParam.ParamValue,
      };
    } catch (error) {
      console.error("Error loading PPPoE user/pass data:", error);
    }
  }

  $scope.submit = async function() {
    $("#ajaxLoaderSection").show();

    let randomNumber1 = Math.floor(Math.random() * 100);
    let randomNumber2 = Math.floor(Math.random() * 100);
    let randomNumber3 = Math.floor(Math.random() * 100);

    var PPPoE_Request = `Object=Device.IP.Interface&Operation=Add&Enable=true&Alias=cpe-WEB-IPInterface-basic-${randomNumber1}&LowerLayers=Device.PPP.Interface.cpe-WEB-PPPInterface-basic-${randomNumber1}&IPv6Enable=true&X_LANTIQ_COM_DefaultGateway=true&Object=Device.Ethernet.Link&Operation=Add&Enable=true&Alias=cpe-WEB-EthernetLink-basic-${randomNumber1}&LowerLayers=Device.PTM.Link.1.&Object=Device.PPP.Interface&Operation=Add&Enable=true&Alias=cpe-WEB-PPPInterface-basic-${randomNumber1}&Username=${$scope.credentials.username}%40tedata.net.eg&Password=${$scope.credentials.password}&MaxMRUSize=1492&LowerLayers=Device.Ethernet.Link.cpe-WEB-EthernetLink-basic-${randomNumber1}`;
    var WIFI24G_Request = `Object=Device.WiFi.SSID.1&Operation=Modify&Enable=${$scope.wifiSettings.enable2_4G}&SSID=${$scope.wifiSettings.ssid2_4G}&Object=Device.WiFi.AccessPoint.1.Security&Operation=Modify&ModeEnabled=${$scope.wifiSettings.selected_security_2_4G}&KeyPassphrase=${$scope.wifiSettings.password2_4G}&RekeyingInterval=3600`;

    // When band_steering is enabled, duplicate 2.4G settings for 5G
    var WIFI5G_Request;
    if (!$scope.wifiSettings.band_steering) {
      WIFI5G_Request = `Object=Device.WiFi.SSID.2&Operation=Modify&Enable=${$scope.wifiSettings.enable5G}&SSID=${$scope.wifiSettings.ssid5G}&Object=Device.WiFi.AccessPoint.2.Security&Operation=Modify&ModeEnabled=${$scope.wifiSettings.selected_security_5G}&KeyPassphrase=${$scope.wifiSettings.password5G}&RekeyingInterval=3600`;
    } else {
      // Enable 5G & Duplicate 2.4G settings to 5G
      $scope.wifiSettings.enable5G = true;
      WIFI5G_Request = `Object=Device.WiFi.SSID.2&Operation=Modify&Enable=${$scope.wifiSettings.enable2_4G}&SSID=${$scope.wifiSettings.ssid2_4G}&Object=Device.WiFi.AccessPoint.2.Security&Operation=Modify&ModeEnabled=${$scope.wifiSettings.selected_security_2_4G}&KeyPassphrase=${$scope.wifiSettings.password2_4G}&RekeyingInterval=3600`;
    }

    //Delete old connections
    await deleteOldConnections();

    //ATM PPoE request'
    const atm_request = `Object=Device.ATM.Link&Operation=Add&Enable=true&Alias=cpe-WEB-ATMLink-basic-${randomNumber2}&LowerLayers=Device.DSL.Line.1.&DestinationAddress=0%2F35&Encapsulation=LLC&LinkType=EoA&Object=Device.ATM.Link.cpe-WEB-ATMLink-basic-${randomNumber2}.QoS&Operation=Modify&QoSClass=UBR&Object=Device.IP.Interface&Operation=Add&Enable=true&Alias=cpe-WEB-IPInterface-basic-${randomNumber2}&LowerLayers=Device.PPP.Interface.cpe-WEB-PPPInterface-basic-${randomNumber2}&IPv6Enable=true&X_LANTIQ_COM_DefaultGateway=false&Object=Device.Ethernet.Link&Operation=Add&Enable=true&Alias=cpe-WEB-EthernetLink-basic-${randomNumber2}&LowerLayers=Device.ATM.Link.cpe-WEB-ATMLink-basic-${randomNumber2}&Object=Device.PPP.Interface&Operation=Add&Enable=true&Alias=cpe-WEB-PPPInterface-basic-${randomNumber2}&LowerLayers=Device.Ethernet.Link.cpe-WEB-EthernetLink-basic-${randomNumber2}&MaxMRUSize=1492&Username=${$scope.credentials.username}%40tedata.net.eg&Password=${$scope.credentials.password}`;
    const res_atm = await $http.post(URL + "cgi_set", atm_request);

    //PTM PPoE Request
    const result = await $http.post(URL + "cgi_set", PPPoE_Request);

    //ETH PPoE Request with Vlan id = 10
    const eth_request = `Object=Device.IP.Interface&Operation=Add&Enable=true&Alias=cpe-WEB-IPInterface-basic-${randomNumber3}&LowerLayers=Device.PPP.Interface.cpe-WEB-PPPInterface-basic-${randomNumber3}&IPv6Enable=0&MaxMTUSize=1492&X_LANTIQ_COM_DefaultGateway=0&Object=Device.Ethernet.Link&Operation=Add&Enable=true&Alias=cpe-WEB-EthernetLink-basic-${randomNumber3}&LowerLayers=Device.Ethernet.Interface.5.&Object=Device.Ethernet.VLANTermination&Operation=Add&LowerLayers=Device.Ethernet.Link.cpe-WEB-EthernetLink-basic-${randomNumber3}&Alias=cpe-WEB-EthernetVLANTermination-basic-${randomNumber3}&Enable=1&VLANID=10&Object=Device.PPP.Interface&Operation=Add&Enable=true&Alias=cpe-WEB-PPPInterface-basic-${randomNumber3}&LowerLayers=Device.Ethernet.VLANTermination.cpe-WEB-EthernetVLANTermination-basic-${randomNumber3}&MaxMRUSize=1492&Username=${$scope.credentials.username}%40tedata.net.eg&Password=${$scope.credentials.password}`;
    const res_eth = await $http.post(URL + "cgi_set", eth_request);

    await $scope.toggle2_4G();
    await $scope.toggle5G();

    //Enable&Set 2_4G Request
    if ($scope.wifiSettings.enable2_4G) {
      await $http.post(URL + "cgi_set", WIFI24G_Request);
    }

    //Enable&Set 5G Request
    if ($scope.wifiSettings.enable5G) {
      await $http.post(URL + "cgi_set", WIFI5G_Request);
    }

    $("#ajaxLoaderSection").hide();

    if (
      result.status == 200 &&
      res_atm.status == 200 &&
      res_eth.status == 200
    ) {
      $location.path("/");
      $scope.$apply();
      window.location.reload();
    } else {
      console.log("Something wrong happened");
    }
  };

  async function deleteOldConnections() {
    try {
      if ($routeParams.id) {
        // Get all upstream interfaces with their Aliases
        const getAllAliasesRequest = `Object=Device.IP.Interface&X_LANTIQ_COM_UpStream=true`;
        const response = await $http.get(
          URL + "cgi_get_filterbyparamval?" + getAllAliasesRequest
        );

        if (response.status === 200 && response.data.Objects) {
          // Filter interfaces that have 'basic' in their Alias
          const ipInterfaces = response.data.Objects.filter((obj) => {
            // Only process main IP Interface objects
            if (!/^Device\.IP\.Interface\.\d+$/.test(obj.ObjName)) {
              return false;
            }

            // Check if this object has 'basic' in its Alias
            const aliasParam = obj.Param.find((p) => p.ParamName === "Alias");
            return (
              aliasParam &&
              aliasParam.ParamValue &&
              aliasParam.ParamValue.toLowerCase().includes("basic")
            );
          });

          // If no interfaces with 'basic' in Alias, exit early
          if (ipInterfaces.length === 0) {
            console.log("No interfaces with 'basic' in Alias found to delete");
            return;
          }

          let allObjectsToDelete = [];

          // Process each interface that has 'basic' in its Alias
          for (const interfaceObj of ipInterfaces) {
            // Get the full chain for this interface
            const chainInfo = await getLowerLayerUntilPhysical(
              interfaceObj.ObjName
            );

            // Get objects to delete from this chain
            const chainObjects = getObjectsToDelete(chainInfo.fullChain);

            // Add to the master list
            allObjectsToDelete = [...allObjectsToDelete, ...chainObjects];

            // Also check if we should add the interface itself
            if (!allObjectsToDelete.includes(interfaceObj.ObjName)) {
              allObjectsToDelete.push(interfaceObj.ObjName);
            }
          }

          // Remove duplicates
          allObjectsToDelete = [...new Set(allObjectsToDelete)];

          // Convert to the format expected by deleteInterfacesOneByOne
          const interfacesToDelete = allObjectsToDelete.map((objName) => {
            // For IP Interfaces, find their object details
            if (objName.includes("Device.IP.Interface")) {
              const ipInterface = ipInterfaces.find(
                (i) => i.ObjName === objName
              );
              if (ipInterface) {
                const lowerLayer = ipInterface.Param.find(
                  (p) => p.ParamName === "LowerLayers"
                );
                const aliasParam = ipInterface.Param.find(
                  (p) => p.ParamName === "Alias"
                );
                return {
                  interfaceObj: objName,
                  lowerLayer: lowerLayer ? lowerLayer.ParamValue : null,
                  name:
                    ipInterface.Param.find((p) => p.ParamName === "Name")
                      ?.ParamValue || "",
                  alias: aliasParam?.ParamValue || "",
                };
              }
            }

            // For non-IP Interface objects, just return the object name
            return {
              interfaceObj: objName,
              lowerLayer: null,
              name: "",
              alias: "",
            };
          });

          // Process all deletions at once
          const result = await deleteInterfacesOneByOne(interfacesToDelete);

          if (!result.success) {
            console.warn(
              `Some deletions failed: ${result.failed.length} failures`
            );
          } else {
            console.log(
              `Successfully deleted ${interfacesToDelete.length} interfaces with 'basic' in Alias`
            );
          }
        }
      } else {
        let res;
        const getAllPVCs = `Object=Device.IP.Interface&X_LANTIQ_COM_UpStream=true`;
        res = await $http.get(URL + "cgi_get_filterbyparamval?" + getAllPVCs);
        const interfacesToDelete = $scope.getInterfacesToDelete(res.data);

        if (interfacesToDelete.length > 0) {
          await deleteInterfacesOneByOne(interfacesToDelete);
        } else {
          console.log("No interfaces found to delete");
        }
      }
    } catch (error) {
      console.error("Error in deleteOldConnections:", error);
    }
  }

  async function getLowerLayerUntilPhysical(lowerLayer) {
    let fullChain = [lowerLayer]; // Start with the current layer
    let currentLayer = lowerLayer;
    let wanType = "UNKNOWN";

    // Follow the chain up to 5 levels deep (should be enough for any connection chain)
    for (let i = 0; i < 5; i++) {
      try {
        const deeper = await $http.get(
          URL + `cgi_get_nosubobj?Object=${currentLayer}`
        );

        if (deeper.status !== 200 || !deeper.data.Objects?.[0]?.Param) {
          break;
        }

        const lowerParam = deeper.data.Objects[0].Param.find(
          (p) => p.ParamName === "LowerLayers"
        );

        if (!lowerParam || !lowerParam.ParamValue) {
          break; // No more lower layers
        }

        currentLayer = lowerParam.ParamValue.replace(/\.$/, "");
        fullChain.push(currentLayer);

        // Check for physical layer to determine WAN type
        if (currentLayer.includes("ATM")) {
          wanType = "ATM";
          break;
        } else if (currentLayer.includes("PTM")) {
          wanType = "PTM";
          break;
        } else if (currentLayer.includes("Ethernet.Interface")) {
          wanType = "ETH";
          break;
        }
      } catch (error) {
        console.error(`Error getting lower layer at depth ${i + 1}:`, error);
        break;
      }
    }

    return {
      fullChain: fullChain,
      lowerLayer: currentLayer,
      wanType: wanType,
    };
  }

  function getObjectsToDelete(fullChain) {
    // Define patterns of objects that should NOT be deleted (physical/system objects)
    const doNotDeletePatterns = [
      /Device\.DSL\.Line\.\d+/, // Physical DSL lines - DO NOT DELETE
      /Device\.PTM\.Link\.\d+/, // PTM links (physical) - DO NOT DELETE
      /Device\.ATM\.Link\.\d+/, // ATM links (physical) - DO NOT DELETE
      /Device\.Ethernet\.Interface\.\d+/, // Ethernet interfaces (physical) - DO NOT DELETE
      /Device\.WiFi\./, // All WiFi objects - DO NOT DELETE
      /\.Stats$/, // Statistics objects - OK to delete but usually auto-regenerated
      /\.QoS$/, // QoS objects - OK to delete
      /\.Security$/, // Security objects - OK to delete
      /\.IPv4Address\.\d+$/, // IPv4 Address objects - OK to delete
      /\.IPv6Address\.\d+$/, // IPv6 Address objects - OK to delete
      /\.IPv6Prefix\.\d+$/, // IPv6 Prefix objects - OK to delete
    ];

    // Filter out objects that shouldn't be deleted
    return fullChain.filter((objPath) => {
      // Skip if matches any "do not delete" pattern
      if (doNotDeletePatterns.some((pattern) => pattern.test(objPath))) {
        return false;
      }

      // Keep these objects (they should be deleted)
      const shouldDeletePatterns = [
        /^Device\.IP\.Interface\.\d+$/, // IP Interfaces - DELETE
        /^Device\.PPP\.Interface\.\d+$/, // PPP Interfaces - DELETE
        /^Device\.Ethernet\.Link\.\d+$/, // Ethernet Links - DELETE
        /^Device\.ATM\.Link\.\d+$/, // ATM Links (non-physical) - DELETE
        /^Device\.PTM\.Link\.\d+$/, // PTM Links (non-physical) - DELETE
      ];

      return shouldDeletePatterns.some((pattern) => pattern.test(objPath));
    });
  }

  async function deleteInterfacesOneByOne(interfacesToDelete) {
    const processedInterfaces = new Set();
    const processedPPP = new Set();
    const failed = [];

    for (const item of interfacesToDelete) {
      if (!item || !item.interfaceObj) continue;

      // Skip if we've already processed this IP Interface
      if (processedInterfaces.has(item.interfaceObj)) {
        continue;
      }

      // Clean lower layer
      const cleanLowerLayer = item.lowerLayer
        ? item.lowerLayer.replace(/\.$/, "")
        : null;

      // Delete IP Interface
      try {
        const ipResponse = await $http.post(
          URL + "cgi_set",
          `Object=${item.interfaceObj}&Operation=Del`
        );

        if (ipResponse.status === 200) {
          processedInterfaces.add(item.interfaceObj);
        } else {
          processedInterfaces.add(item.interfaceObj);
        }
      } catch (error) {
        failed.push({ object: item.interfaceObj, error: error.message });
      }

      // Delete PPP Interface if it exists and we haven't processed it
      if (cleanLowerLayer && !processedPPP.has(cleanLowerLayer)) {
        try {
          const pppResponse = await $http.post(
            URL + "cgi_set",
            `Object=${cleanLowerLayer}&Operation=Del`
          );

          if (pppResponse.status === 200) {
            processedPPP.add(cleanLowerLayer);
          } else if (pppResponse.status === 505) {
            processedPPP.add(cleanLowerLayer);
          } else {
            processedPPP.add(cleanLowerLayer);
          }
        } catch (error) {
          failed.push({ object: cleanLowerLayer, error: error.message });
        }
      } else if (cleanLowerLayer && processedPPP.has(cleanLowerLayer)) {
        console.log(`Skipping ${cleanLowerLayer} - already deleted`);
      }

      // Short 1s delay between operations
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return { success: failed.length === 0, failed };
  }
});
