myapp.controller("wan_wanconnectionsform", function(
  $scope,
  $http,
  $location,
  $routeParams
) {
  // Initialize form state
  $scope.form = {
    selectionMode: "PTM",
  };

  //get route data
  $scope.internetObject = $routeParams.id;

  // Add/Edit mode detection
  $scope.isEditMode = !!$scope.internetObject;

  // Initialize ptmData for subform binding
  $scope.ptmData = getDefaultPtmData();

  // State variables
  $scope.dataReady = false;
  $scope.WanGroupMappingLayer = "";
  $scope.DeviceIpInterface;

  // Validation patterns
  $scope.patterns = {
    username: /^\d+$/, // Only numbers
    password: /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,}/, // Complex password
    macAddress: /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/, // MAC address
    mtuSize: /^\d+$/, // Only numbers
  };

  // Function to get default PTM data
  function getDefaultPtmData() {
    return {
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
  }

  // Call loadForm after initializing selectionMode
  $scope.$watch("form.selectionMode", function(newValue) {
    if (newValue) {
      $scope.loadForm();
    }
  });

  // Function to initialize the form and dropdowns
  async function initInterfaceAndDropdown() {
    if ($scope.isEditMode) {
      await loadEditModeData();
    } else {
      resetForm();
    }

    $scope.loadForm();
    $scope.dataReady = true;
  }

  // Function to load data in edit mode
  async function loadEditModeData() {
    $scope.DeviceIpInterface = $scope.internetObject.split(",")[0];

    if (window.$ && $("#ajaxLoaderSection").length) {
      $("#ajaxLoaderSection").show();
    }

    try {
      const ipInterfaceData = await $http.get(
        URL + "cgi_get?Object=" + $scope.DeviceIpInterface
      );
      processEditModeData(ipInterfaceData.data);
    } catch (error) {
      console.error("Error loading edit mode data:", error);
    } finally {
      if (window.$ && $("#ajaxLoaderSection").length) {
        $("#ajaxLoaderSection").hide();
      }
    }
  }

  // Function to process data in edit mode
  function processEditModeData(data) {
    const ipObj = data["Objects"][0];
    const ipParams = ipObj.Param;

    const getParam = (name) =>
      ipParams.find((x) => x.ParamName === name)?.ParamValue || "";

    // $scope.DeviceIpInterface = ipObj.ObjName;
    // $scope.Alias = getParam("Alias");
    // $scope.IPv4Enable = getParam("IPv4Enable");
    // $scope.LowerLayers = getParam("LowerLayers");
    $scope.X_LANTIQ_COM_DefaultGateway = getParam(
      "X_LANTIQ_COM_DefaultGateway"
    );

    let X_LANTIQ_COM_Description = "";
    if (data["Objects"][1]) {
      const descParam = data["Objects"][1].Param.find(
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
  }

  // Function to reset the form
  function resetForm() {
    $scope.$broadcast("resetPtmForm");
    $scope.ptmData = getDefaultPtmData();
  }

  // Function to load the appropriate subform
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

  // Function to handle form submission
  $scope.submit = async function() {
    $("#ajaxLoaderSection").show();

    if ($scope.form.selectionMode === "PTM") {
      if ($scope.customWanForm.ptmForm && $scope.customWanForm.ptmForm.$valid) {
        if ($scope.isEditMode) {
          await deleteOldConnection();
        }

        await addNewConnection();
      } else {
        alert("Please fix all errors in the PTM form before submitting.");
        $("#ajaxLoaderSection").hide();
      }
    }
  };

  // Function to delete the old connection in edit mode
  async function deleteOldConnection() {
    const getAllPVCs = `Object=Device.IP.Interface&X_LANTIQ_COM_DefaultGateway=true`;
    const res = await $http.get(URL + "cgi_get_filterbyparamval?" + getAllPVCs);

    const DELETE_Request = `Object=${
      $scope.getPTMInterfaceID(res.data)[0]
    }&Operation=Del&Object=${
      $scope.getPTMInterfaceID(res.data)[1]
    }&Operation=Del`;
    await $http.post(URL + "cgi_set", DELETE_Request);
  }

  // Function to add a new connection
  async function addNewConnection() {
    const randomNumber = parseInt(localStorage.getItem("randomvalue"));

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
  }

  // Cancel button action
  $scope.cancel = function() {
    $location.path("/tableform/wan_wanconnections");
    $scope.$apply();
  };

  // Initialize the form
  initInterfaceAndDropdown();
});
