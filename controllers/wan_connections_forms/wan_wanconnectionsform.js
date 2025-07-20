myapp.controller("wan_wanconnectionsform", function($scope, $http, $location) {
  // Initialize main form data
  $scope.form = {
    selectionMode: "PTM",
  };

  //generic data on route change
  $scope.DeviceIpInterface = "";
  $scope.Alias = "";
  $scope.IPv4Enable = "";
  $scope.LowerLayers = "";
  $scope.X_LANTIQ_COM_DefaultGateway = "";
  $scope.X_LANTIQ_COM_Description = "";
  $scope.PPP_Interface = "";
  $scope.Username = "";
  $scope.Password = "";
  $scope.MaxMRUSize = "";

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

  function extractLastNumber(str) {
    const match = str.match(/(\d+)(?!.*\d)/);
    return match ? parseInt(match[1], 10) : null;
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

  $scope.dataReady = false;

  // Fetch IP interface data and set dropdown on controller init
  async function initInterfaceAndDropdown() {
    console.log("init forms");
    const id = localStorage.getItem("internetObject");
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
  }

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

  // Form submission
  $scope.submit = async function() {
    $("#ajaxLoaderSection").show();
    if ($scope.form.selectionMode === "PTM") {
      if ($scope.customWanForm.ptmForm && $scope.customWanForm.ptmForm.$valid) {
        const getAllPVCs = `Object=Device.IP.Interface&X_LANTIQ_COM_DefaultGateway=true`;
        let res;
        //Get ALL PVC Request
        res = await $http.get(URL + "cgi_get_filterbyparamval?" + getAllPVCs);

        //Delete Request
        var DELETE_Request = `Object=${
          $scope.getPTMInterfaceID(res.data)[0]
        }&Operation=Del&Object=${
          $scope.getPTMInterfaceID(res.data)[1]
        }&Operation=Del`;
        await $http.post(URL + "cgi_set", DELETE_Request);

        //Edit PPPoE Request
        const PPPoE_Request2 = `Object=Device.IP.Interface&Operation=Add&Enable=true&Alias=cpe-WEB-IPInterface-18&LowerLayers=Device.PPP.Interface.cpe-WEB-PPPInterface-18&IPv6Enable=${$scope.ptmData.ipv6enable}&X_LANTIQ_COM_DefaultGateway=${$scope.ptmData.defaultGateway}&Object=Device.Ethernet.Link&Operation=Add&Enable=true&Alias=cpe-WEB-EthernetLink-18&LowerLayers=Device.PTM.Link.1.&Object=Device.PPP.Interface&Operation=Add&Enable=true&Alias=cpe-WEB-PPPInterface-18&Username=${$scope.ptmData.username}%40tedata.net.eg&Password=${$scope.ptmData.password}&MaxMRUSize=${$scope.ptmData.mtu_size}&LowerLayers=Device.Ethernet.Link.cpe-WEB-EthernetLink-18`;
        const resultPPPoE_Request = await $http.post(
          URL + "cgi_set",
          PPPoE_Request2
        );

        if (resultPPPoE_Request.status == 200) {
          $location.path("/tableform/wan_wanconnections");
          $scope.$apply();
        } else {
          alert("Something wrong happened");
        }
        $("#ajaxLoaderSection").hide();
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
