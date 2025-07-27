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
    username: "00000000",
    password: "00000000",
  };

  $scope.wifiSettings = {
    enable2_4G: true,
    enable5G: false,
    ssid2_4G: "WE_F771A0",
    password2_4G: "c789d000",
    ssid5G: "WE_F771A0_5G",
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
    if (!Array.isArray(res) && res.status == 209) {
      //Change Password
      res = await $http.post(URL + "cgi_action", "Newpassword=C789D000");
      await $http.get(URL + "cgi_get" + "?Action=User");
    }
    if (res.status == 200) {
      $location.path("/");
      $scope.$apply();
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
    const regex = /(ptm|wan)/i;
    let ptmInterfaceFound = null;

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

    console.log(`PTM Interface ID: ${ptmInterfaceFound.ObjName}`);
    let lowerLayer = ptmInterfaceFound.Param.find(
      (x) => x.ParamName === "LowerLayers"
    );
    return [ptmInterfaceFound.ObjName, lowerLayer.ParamValue];
  };

  async function loadExistingCredentials() {
    try {
      if ($routeParams.id) {
        const DeviceIpInterface = $routeParams.id.split(",")[0];

        // Get PPP interface data
        const pppInterfaceData = await $http.get(
          URL + "cgi_get_nosubobj?Object=" + DeviceIpInterface
        );
        const pppObj = pppInterfaceData.data["Objects"][0];

        const lowerPTM_link = pppObj.Param.find(
          (x) => x.ParamName === "LowerLayers"
        )?.ParamValue;

        if (lowerPTM_link) {
          const userPassResponse = await $http.get(
            URL + "cgi_get_nosubobj?Object=" + lowerPTM_link
          );

          const userPassData = userPassResponse.data["Objects"][0];

          // Update credentials
          $scope.credentials.username =
            userPassData.Param.find(
              (x) => x.ParamName === "Username"
            )?.ParamValue.split("@")[0] || "";

          $scope.credentials.password =
            userPassData.Param.find((x) => x.ParamName === "Password")
              ?.ParamValue || "";
        }

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
          if (passwordParam) {
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
          if (passwordParam) {
            $scope.wifiSettings.password5G = passwordParam.ParamValue;
          }
        }
      }
    } catch (error) {
      console.error("Error loading existing credentials:", error);
    }
  }

  $scope.submit = async function() {
    $("#ajaxLoaderSection").show();

    var getAllPVCs = `Object=Device.IP.Interface&X_LANTIQ_COM_DefaultGateway=true`;

    var PPPoE_Request = `Object=Device.IP.Interface&Operation=Add&Enable=true&Alias=cpe-WEB-IPInterface-18&LowerLayers=Device.PPP.Interface.cpe-WEB-PPPInterface-18&IPv6Enable=true&X_LANTIQ_COM_DefaultGateway=true&Object=Device.Ethernet.Link&Operation=Add&Enable=true&Alias=cpe-WEB-EthernetLink-18&LowerLayers=Device.PTM.Link.1.&Object=Device.PPP.Interface&Operation=Add&Enable=true&Alias=cpe-WEB-PPPInterface-18&Username=${$scope.credentials.username}%40tedata.net.eg&Password=${$scope.credentials.password}&MaxMRUSize=1492&LowerLayers=Device.Ethernet.Link.cpe-WEB-EthernetLink-18`;
    var WIFI24G_Request = `Object=Device.WiFi.SSID.1&Operation=Modify&Enable=${$scope.wifiSettings.enable2_4G}&SSID=${$scope.wifiSettings.ssid2_4G}&Object=Device.WiFi.Radio.1&Operation=Modify&RegulatoryDomain=EG%20&AutoChannelEnable=true&OperatingStandards=b%2Cg%2Cn%2Cax&ExtensionChannel=AboveControlChannel&OperatingChannelBandwidth=40MHz&Object=Device.WiFi.AccessPoint.1&Operation=Modify&SSIDAdvertisementEnabled=true&IsolationEnable=false&Object=Device.WiFi.AccessPoint.1.Security&Operation=Modify&ModeEnabled=WPA-WPA2-Personal&KeyPassphrase=${$scope.wifiSettings.password2_4G}&RekeyingInterval=3600`;
    var WIFI5G_Request = `Object=Device.WiFi.SSID.2&Operation=Modify&Enable=${$scope.wifiSettings.enable5G}&SSID=${$scope.wifiSettings.ssid5G}&Object=Device.WiFi.Radio.2&Operation=Modify&RegulatoryDomain=EG%20&Enable=true&AutoChannelEnable=true&IEEE80211hEnabled=true&OperatingStandards=a%2Cn%2Cac%2Cax&ExtensionChannel=AboveControlChannel&OperatingChannelBandwidth=Auto&Object=Device.WiFi.AccessPoint.2&Operation=Modify&SSIDAdvertisementEnabled=true&IsolationEnable=false&Object=Device.WiFi.AccessPoint.2.Security&Operation=Modify&ModeEnabled=WPA2-Personal&KeyPassphrase=${$scope.wifiSettings.password5G}&RekeyingInterval=3600&`;

    let res;
    //Get ALL PVC Request
    res = await $http.get(URL + "cgi_get_filterbyparamval?" + getAllPVCs);

    if (!Array.isArray(res) && res.status == 209) {
      //Change Password
      await $http.post(URL + "cgi_action", "Newpassword=C789D000");
      await $http.get(URL + "cgi_get" + "?Action=User");

      res = await $http.get(URL + "cgi_get_filterbyparamval?" + getAllPVCs);
    }

    //Delete Request
    var DELETE_Request = `Object=${
      $scope.getPTMInterfaceID(res.data)[0]
    }&Operation=Del&Object=${
      $scope.getPTMInterfaceID(res.data)[1]
    }&Operation=Del`;
    await $http.post(URL + "cgi_set", DELETE_Request);

    //Main PPOE Request
    const result = await $http.post(URL + "cgi_set", PPPoE_Request);

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

    if (result.status == 200) {
      $location.path("/");
      $scope.$apply();
    } else {
      console.log("Something wrong happened");
    }
  };
});
