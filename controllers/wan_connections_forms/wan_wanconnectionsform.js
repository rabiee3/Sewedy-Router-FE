myapp.controller("wan_wanconnectionsform", function($scope, $http, $location) {
  $scope.form = {
    selectionMode: "PTM",
  };

  // Add/Edit mode detection
  const internetObject = localStorage.getItem("internetObject");
  $scope.isEditMode = !!internetObject;

  // Initialize ptmData for subform binding
  $scope.ptmData = {
    connectionType: "PPPoE",
    username: "",
    password: "",
    mac_address: "",
    mtu_size: 1492,
    macCloneEnabled: false,
    enableVlan: "0",
    ipv6enable: "0",
    defaultGateway: "1",
  };

  $scope.dataReady = false;
  $scope.WanGroupMappingLayer = "";

  // Load form and data only in edit mode
  async function initInterfaceAndDropdown() {
    if ($scope.isEditMode) {
      const id = internetObject;
      let deviceIPInterface;
      if (id) {
        deviceIPInterface = id.split(",")[0];
      }
      if (window.$ && $("#ajaxLoaderSection").length) {
        $("#ajaxLoaderSection").show();
      }
      const ipInterfaceData = await $http.get(
        URL + "cgi_get?Object=" + deviceIPInterface
      );
      const ipObj = ipInterfaceData.data["Objects"][0];
      const ipParams = ipObj.Param;
      const getParam = (name) =>
        ipParams.find((x) => x.ParamName === name)?.ParamValue || "";
      $scope.DeviceIpInterface = ipObj.ObjName;
      $scope.Alias = getParam("Alias");
      $scope.IPv4Enable = getParam("IPv4Enable");
      $scope.LowerLayers = getParam("LowerLayers");
      $scope.X_LANTIQ_COM_DefaultGateway = getParam(
        "X_LANTIQ_COM_DefaultGateway"
      );
      // X_LANTIQ_COM_Description is in Objects[1]
      let X_LANTIQ_COM_Description = "";
      if (ipInterfaceData.data["Objects"][1]) {
        const descParam = ipInterfaceData.data["Objects"][1].Param.find(
          (x) => x.ParamName === "X_LANTIQ_COM_Description"
        );
        X_LANTIQ_COM_Description = descParam ? descParam.ParamValue : "";
      }
      $scope.X_LANTIQ_COM_Description = X_LANTIQ_COM_Description;
      // Set dropdown to PTM if description contains PTM
      if (X_LANTIQ_COM_Description.includes("PTM")) {
        $scope.form.selectionMode = "PTM";
      } else if (X_LANTIQ_COM_Description.includes("ATM")) {
        $scope.form.selectionMode = "ATM";
      } else if (X_LANTIQ_COM_Description.includes("ETH")) {
        $scope.form.selectionMode = "ETH";
      }
      $scope.loadForm();
      $scope.dataReady = true;
      if (window.$ && $("#ajaxLoaderSection").length) {
        $("#ajaxLoaderSection").hide();
      }
    } else {
      setTimeout(() => {
        $scope.$broadcast("resetPtmForm");
        $scope.ptmData = {
          connectionType: "PPPoE",
          username: "",
          password: "",
          mac_address: "",
          mtu_size: 1492,
          macCloneEnabled: false,
          enableVlan: "0",
          ipv6enable: "0",
          defaultGateway: "1",
        };
      }, 100);

      $scope.loadForm();
      $scope.dataReady = true;
    }
  }

  // Initial template selection
  $scope.loadForm = function() {
    switch ($scope.form.selectionMode) {
      case "ATM":
        $scope.currentFormTemplate = "wan_connections_views/atm-form.html";
        $scope.activeFormName = "atmForm";
        break;
      case "PTM":
        $scope.currentFormTemplate = "wan_connections_views/ptm-form.html";
        $scope.activeFormName = "ptmForm";
        break;
      case "ETH":
      default:
        $scope.currentFormTemplate = "wan_connections_views/eth-form.html";
        $scope.activeFormName = "ethForm";
        break;
    }
  };

  initInterfaceAndDropdown();

  $scope.patterns = {
    username: /^\d+$/, // Only numbers
    password: /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,}/, // Complex password
    macAddress: /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/, // MAC address
    mtuSize: /^\d+$/, // digit
  };

  $scope.getPTMInterfaceID = function(pvcs) {
    const regex = /(ptm|wan)/i;
    let ptmInterfaceFound = null;

    for (let object of pvcs.Objects) {
      for (let param of object.Param) {
        if (regex.test(param.ParamValue)) {
          ptmInterfaceFound = object;
          break;
        }
      }
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

  // Form submission
  $scope.submit = async function() {
    $("#ajaxLoaderSection").show();
    if ($scope.form.selectionMode === "PTM") {
      if ($scope.customWanForm.ptmForm && $scope.customWanForm.ptmForm.$valid) {
        if ($scope.isEditMode) {
          // Edit mode: delete old connection first
          const getAllPVCs = `Object=Device.IP.Interface&X_LANTIQ_COM_DefaultGateway=true`;
          const res = await $http.get(
            URL + "cgi_get_filterbyparamval?" + getAllPVCs
          );

          //Delete Request
          var DELETE_Request = `Object=${
            $scope.getPTMInterfaceID(res.data)[0]
          }&Operation=Del&Object=${
            $scope.getPTMInterfaceID(res.data)[1]
          }&Operation=Del`;
          await $http.post(URL + "cgi_set", DELETE_Request);
        }

        // Add new PPPoE connection (same for add/edit)
        const randomNumber = parseInt(localStorage.getItem("randomvalue"));
        // all depending on localstorage random number except for the Device.PTM.Link.1. that is get from Device_X_Lantiq

        //get lower layer mapping for wanGroup1 PTM ex: Device.PTM.Link.1.
        const lowerLayer = await $http.get(
          URL +
            `cgi_get_fillparams?Object=Device.X_LANTIQ_COM_NwHardware.WANGroup.${
              $scope.form.selectionMode === "PTM" ? 1 : 3
            }&MappingLowerLayer=`
        );

        $scope.WanGroupMappingLayer =
          lowerLayer.data["Objects"][0].Param[0].ParamValue;

        const PPPoE_Request2 = `Object=Device.IP.Interface&Operation=Add&Enable=true&Alias=cpe-WEB-IPInterface-${randomNumber}&LowerLayers=Device.PPP.Interface.cpe-WEB-PPPInterface-${randomNumber}&IPv6Enable=${$scope.ptmData.ipv6enable}&X_LANTIQ_COM_DefaultGateway=${$scope.ptmData.defaultGateway}&Object=Device.Ethernet.Link&Operation=Add&Enable=true&Alias=cpe-WEB-EthernetLink-${randomNumber}&LowerLayers=${$scope.WanGroupMappingLayer}&Object=Device.PPP.Interface&Operation=Add&Enable=true&Alias=cpe-WEB-PPPInterface-${randomNumber}&Username=${$scope.ptmData.username}%40tedata.net.eg&Password=${$scope.ptmData.password}&MaxMRUSize=${$scope.ptmData.mtu_size}&LowerLayers=Device.Ethernet.Link.cpe-WEB-EthernetLink-${randomNumber}`;
        const resultPPPoE_Request = await $http.post(
          URL + "cgi_set",
          PPPoE_Request2
        );

        if (resultPPPoE_Request.status == 200) {
          $location.path("/tableform/wan_wanconnections");
          $scope.$apply();
        } else {
          alert("Something wrong happened");
          $("#ajaxLoaderSection").hide();
        }
      } else {
        alert("Please fix all errors in the PTM form before submitting.");
        $("#ajaxLoaderSection").hide();
      }
    }
  };

  // Cancel button action
  $scope.cancel = function() {
    $location.path("/tableform/wan_wanconnections");
    $scope.$apply();
  };
});
