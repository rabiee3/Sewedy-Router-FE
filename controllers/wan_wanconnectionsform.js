myapp.controller("wan_wanconnectionsform", function(
  $scope,
  $http,
  $location,
  $routeParams,
  helperService
) {
  // Initialize form state
  $scope.form = {
    selectionMode: "",
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
    if (!$scope.isEditMode) {
      $scope.form.selectionMode = "PTM";
    }

    await loadEditModeData();
    $scope.dataReady = true;
  }

  // Function to load data in edit mode
  async function loadEditModeData() {
    if(!$scope.internetObject) return;
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

    // Search all objects for X_LANTIQ_COM_Description
    let X_LANTIQ_COM_Description = "";
    for (let obj of data["Objects"]) {
      const descParam = obj.Param.find(
        (x) => x.ParamName === "X_LANTIQ_COM_Description"
      );
      if (descParam && descParam.ParamValue) {
        X_LANTIQ_COM_Description = descParam.ParamValue;
        break;
      }
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

  // Function to load the appropriate subform
  $scope.loadForm = function() {
    switch ($scope.form.selectionMode) {
      case "ATM":
        $scope.currentFormTemplate = "atm-form.html";
        $scope.activeFormName = "atmForm";
        break;
      case "PTM":
      case "ETH":
        $scope.currentFormTemplate = "ptm-form.html";
        $scope.activeFormName = "ptmForm";
        break;
      default:
        break;
    }
  };

  // Function to handle form submission
  $scope.submit = async function() {
    if (window.$ && $("#ajaxLoaderSection").length) {
      $("#ajaxLoaderSection").show();
    }

    let activeForm = $scope.activeFormName; // "atmForm" or "ptmForm"
    let addEvent =
      activeForm === "atmForm" ? "addAtmConnection" : "addPtmConnection";
    let editEvent =
      activeForm === "atmForm" ? "editAtmConnection" : "editPtmConnection";

    try {
      // Validate the active subform
      if (
        !$scope.customWanForm[activeForm] ||
        !$scope.customWanForm[activeForm].$valid
      ) {
        const formName = activeForm === "atmForm" ? "ATM" : "PTM";
        alert(
          `Please fix all errors in the ${formName} form before submitting.`
        );
        $("#ajaxLoaderSection").hide();
        return;
      }

      // Always remove existing IPTV before applying new changes
      await helperService.removeExistingIPTVConnection();

      if ($scope.isEditMode) {
        $scope.$broadcast(editEvent, {
          DeviceIpInterface: $scope.DeviceIpInterface,
        });
      } else {
        $scope.$broadcast(addEvent);
      }
    } catch (error) {
      console.error("Error during submit:", error);
      alert("Failed to save connection: " + error.message);
    }
  };

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
