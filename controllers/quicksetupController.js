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
    password2_4G: "c789d000",
    ssid5G: "WE_F771A0",
    password5G: "c789d000",
  };

  loadExistingCredentials();

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
      return; // Prevent going to the next step if WiFi is invalid
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

  $scope.getPTMInterfaceID = function(pvcs) {
    const regex = /(ptm|wan|eth)/i;
    let ptmInterfaceFound = null;

    if (!pvcs || pvcs.length <= 0) return;
    // Loop through the objects
    for (let object of pvcs.Objects) {
      // Loop through the params inside each object
      for (let param of object.Param) {
        if (regex.test(param.ParamValue)) {
          ptmInterfaceFound = object; // Set ptmInterfaceFound to the outer object
          break; // Break out of the inner loop when a match is found
        }
      }

      // If a match was found, break out of the outer loop too
      if (ptmInterfaceFound) {
        break;
      }
    }

    if (!ptmInterfaceFound) {
      console.log("No PTM interface found.");
      return null;
    }

    let lowerLayer = ptmInterfaceFound.Param.find(
      (x) => x.ParamName === "LowerLayers"
    );
    return [ptmInterfaceFound.ObjName, lowerLayer.ParamValue];
  };

  async function loadExistingCredentials() {
    try {
      let DeviceIpInterface = null;

      // Step 1: Get DeviceIpInterface dynamically
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

      debugger;

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

      // Get WiFi 2_4G Password data
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

      // If we’re at physical layer and caller wants it, stop here
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

    var PPPoE_Request = `Object=Device.IP.Interface&Operation=Add&Enable=true&Alias=cpe-WEB-IPInterface-Default-${randomNumber1}&LowerLayers=Device.PPP.Interface.cpe-WEB-PPPInterface-Default-${randomNumber1}&IPv6Enable=true&X_LANTIQ_COM_DefaultGateway=true&Object=Device.Ethernet.Link&Operation=Add&Enable=true&Alias=cpe-WEB-EthernetLink-Default-${randomNumber1}&LowerLayers=Device.PTM.Link.1.&Object=Device.PPP.Interface&Operation=Add&Enable=true&Alias=cpe-WEB-PPPInterface-Default-${randomNumber1}&Username=${$scope.credentials.username}%40tedata.net.eg&Password=${$scope.credentials.password}&MaxMRUSize=1492&LowerLayers=Device.Ethernet.Link.cpe-WEB-EthernetLink-${randomNumber1}`;
    var WIFI24G_Request = `Object=Device.WiFi.SSID.1&Operation=Modify&Enable=${$scope.wifiSettings.enable2_4G}&SSID=${$scope.wifiSettings.ssid2_4G}&Object=Device.WiFi.Radio.1&Operation=Modify&RegulatoryDomain=EG%20&AutoChannelEnable=true&OperatingStandards=b%2Cg%2Cn%2Cax&ExtensionChannel=AboveControlChannel&OperatingChannelBandwidth=40MHz&Object=Device.WiFi.AccessPoint.1&Operation=Modify&SSIDAdvertisementEnabled=true&IsolationEnable=false&Object=Device.WiFi.AccessPoint.1.Security&Operation=Modify&ModeEnabled=WPA-WPA2-Personal&KeyPassphrase=${$scope.wifiSettings.password2_4G}&RekeyingInterval=3600`;
    var WIFI5G_Request = `Object=Device.WiFi.SSID.2&Operation=Modify&Enable=${$scope.wifiSettings.enable5G}&SSID=${$scope.wifiSettings.ssid5G}&Object=Device.WiFi.Radio.2&Operation=Modify&RegulatoryDomain=EG%20&Enable=true&AutoChannelEnable=true&IEEE80211hEnabled=false&OperatingStandards=a%2Cn%2Cac%2Cax&ExtensionChannel=AboveControlChannel&OperatingChannelBandwidth=Auto&Object=Device.WiFi.AccessPoint.2&Operation=Modify&SSIDAdvertisementEnabled=true&IsolationEnable=false&Object=Device.WiFi.AccessPoint.2.Security&Operation=Modify&ModeEnabled=WPA2-Personal&KeyPassphrase=${$scope.wifiSettings.password5G}&RekeyingInterval=3600&`;

    //Delete old connections
    await deleteOldConnections();

    //ATM PPoE request'
    const atm_request = `Object=Device.ATM.Link&Operation=Add&Enable=true&Alias=cpe-WEB-ATMLink-Default-${randomNumber2}&LowerLayers=Device.DSL.Line.1.&DestinationAddress=0%2F35&Encapsulation=LLC&LinkType=EoA&Object=Device.ATM.Link.cpe-WEB-ATMLink-Default-${randomNumber2}.QoS&Operation=Modify&QoSClass=UBR&Object=Device.IP.Interface&Operation=Add&Enable=true&Alias=cpe-WEB-IPInterface-Default-${randomNumber2}&LowerLayers=Device.PPP.Interface.cpe-WEB-PPPInterface-Default-${randomNumber2}&IPv6Enable=true&X_LANTIQ_COM_DefaultGateway=false&Object=Device.Ethernet.Link&Operation=Add&Enable=true&Alias=cpe-WEB-EthernetLink-Default-${randomNumber2}&LowerLayers=Device.ATM.Link.cpe-WEB-ATMLink-Default-${randomNumber2}&Object=Device.PPP.Interface&Operation=Add&Enable=true&Alias=cpe-WEB-PPPInterface-Default-${randomNumber2}&LowerLayers=Device.Ethernet.Link.cpe-WEB-EthernetLink-Default-${randomNumber2}&MaxMRUSize=1492&Username=${$scope.credentials.username}%40tedata.net.eg&Password=${$scope.credentials.password}`;
    const res_atm = await $http.post(URL + "cgi_set", atm_request);

    //PTM PPoE Request
    const result = await $http.post(URL + "cgi_set", PPPoE_Request);

    //ETH PPoE Request
    const eth_request = `Object=Device.IP.Interface&Operation=Add&Enable=true&Alias=cpe-WEB-IPInterface-Default-${randomNumber3}&LowerLayers=Device.PPP.Interface.cpe-WEB-PPPInterface-Default-${randomNumber3}&IPv6Enable=0&MaxMTUSize=1492&X_LANTIQ_COM_DefaultGateway=1&Object=Device.Ethernet.Link&Operation=Add&Enable=true&Alias=cpe-WEB-EthernetLink-Default-${randomNumber3}&LowerLayers=Device.Ethernet.Interface.5.&Object=Device.PPP.Interface&Operation=Add&Enable=true&Alias=cpe-WEB-PPPInterface-${randomNumber3}&LowerLayers=Device.Ethernet.Link.cpe-WEB-EthernetLink-Default-${randomNumber3}&MaxMRUSize=1492&Username=${$scope.credentials.username}%40tedata.net.eg&Password=${$scope.credentials.password}`;
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
        const getAllAliasesRequest = `Object=Device.IP.Interface`;
        const response = await $http.get(
          URL + "cgi_get_filterbyparamval?" + getAllAliasesRequest
        );

        if (response.status === 200 && response.data.Objects) {
          const defaultAliases = response.data.Objects.filter((obj) =>
            obj.Param.some(
              (param) =>
                param.ParamName === "Alias" &&
                param.ParamValue.includes("Default")
            )
          );

          const deleteRequests = [];

          for (const aliasObj of defaultAliases) {
            const { lowerLayer } = await getLowerLayerUntilPhysical(
              aliasObj.ObjName
            );

            // Collect all layers to delete
            let layersToDelete = [aliasObj.ObjName, lowerLayer];

            layersToDelete = layersToDelete.filter(layer=>layer!==undefined);
            debugger;//debugger 1
            for (const layer of layersToDelete) {
              const deleteRequest = `Object=${layer}&Operation=Del`;
              deleteRequests.push($http.post(URL + "cgi_set", deleteRequest));
            }
          }

          debugger;//debugger 2
          await Promise.all(deleteRequests);
        }
      } else {
        let res;
        // Get ALL Device.IP.Interfaces
        res = await $http.get(
          URL +
            "cgi_get_filterbyparamval?Object=Device.IP.Interface" +
            getAllPVCs
        );
        var DELETE_Request = `Object=${
          $scope.getPTMInterfaceID(res.data)[0]
        }&Operation=Del&Object=${
          $scope.getPTMInterfaceID(res.data)[1]
        }&Operation=Del`;

        await $http.post(URL + "cgi_set", DELETE_Request);
      }
    } catch (error) {
      console.error("Error deleting old connections:", error);
    }
  }

  async function getLowerLayerUntilPhysical(lowerLayer) {
    let wanType = "UNKNOWN";

    for (let i = 0; i < 2; i++) {
      try {
        const deeper = await $http.get(
          URL + `cgi_get_filterbyparamval?Object=${lowerLayer}&LowerLayers=`
        );

        if (deeper.status !== 200 || !deeper.data.Objects?.[0]?.Param?.[0]?.ParamValue) {
          console.warn(`Failed to get valid lower layer data (depth ${i + 1})`);
          continue; // Skip to the next iteration
        }

        lowerLayer = deeper.data.Objects[0].Param[0].ParamValue;

        if (lowerLayer.includes("ATM")) {
          wanType = "ATM";
          break;
        } else if (lowerLayer.includes("PTM")) {
          wanType = "PTM";
          break;
        } else if (lowerLayer.includes("Ethernet.Interface")) {
          wanType = "ETH";
          break;
        }
      } catch (error) {
        console.error(`Error during cgi_get request (depth ${i + 1}):`, error);
      }
    }

    if (wanType === "UNKNOWN") {
      return { error: "Could not determine WAN type after traversing lower layers" };
    }

    return { lowerLayer, wanType };
  }
});
