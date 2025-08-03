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

    $scope.X_LANTIQ_COM_DefaultGateway = getParam(
      "X_LANTIQ_COM_DefaultGateway"
    );

    let X_LANTIQ_COM_Description = "";
    if (data["Objects"][2]) {
      const descParam = data["Objects"][2].Param.find(
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
        $scope.currentFormTemplate = "atm-form.html";
        $scope.activeFormName = "atmForm";
        break;
      case "PTM":
      case "ETH":
      default:
        $scope.currentFormTemplate = "ptm-form.html";
        $scope.activeFormName = "ptmForm";
        break;
    }
  };

  // Function to handle form submission
  $scope.submit = async function() {
    if (window.$ && $("#ajaxLoaderSection").length) {
      $("#ajaxLoaderSection").show();
    }

    let activeForm = $scope.activeFormName; // "atmForm" or "ptmForm"
    let eventToBroadcast =
      activeForm === "atmForm" ? "addAtmConnection" : "addPtmConnection";
    if (
      $scope.customWanForm[activeForm] &&
      $scope.customWanForm[activeForm].$valid
    ) {
      $scope.$broadcast(eventToBroadcast);
    } else {
      const formName = activeForm === "atmForm" ? "ATM" : "PTM";
      alert(`Please fix all errors in the ${formName} form before submitting.`);
      $("#ajaxLoaderSection").hide();
    }
  };

  // Listen for connectionAdded event from PTM form
  $scope.$on("connectionAdded", function(event, success) {
    if (success) {
      $location.path("/tableform/wan_wanconnections");
      $scope.$apply();
    }
  });

  // Listen for connectionAdded event from PTM form
  $scope.$on("connectionAdded", function(event, success) {
    if (success) {
      $location.path("/tableform/wan_wanconnections");
      $scope.$apply();
    }
  });

  // Cancel button action
  $scope.cancel = function() {
    $location.path("/tableform/wan_wanconnections");
    $scope.$apply();
  };

  // Initialize the form
  initInterfaceAndDropdown();
});
