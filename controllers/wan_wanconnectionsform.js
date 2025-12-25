myapp.controller("wan_wanconnectionsform", function(
  $scope,
  $http,
  $location,
  $routeParams,
  helperService
) {
  // ------------------------------------------------------------
  // Shared base state
  // ------------------------------------------------------------
  $scope.form = {
    accessType: "",
    encapsulationMode: "",
    protocolType: "",
    wanMode: "",
    enableVlan: "0",
    vlanId: "",
    mtu_mru_size: 1492,
    policy802:"",
    value802:0,
    ipAcqMode:"",
    username: "",
    password: "",
    mac_address: "",
    macCloneEnabled: false,
    ipv6enable: "0",
    defaultGateway: "1",
    isUserDefinedDNS: false,
    natType: "Port Restricted Cone NAT",
    primaryDNS: "",
    secondaryDNS: "",
    ipaddress: "",
    subnetmask: "",
    gatewayaddress: "",
    encapsulation: "LLC",
    atmQosClass: "UBR",
    peakCellRate: null,
    maximumBSize: null,
    sustainableCellRate: null,
    vpiVci: "",
    selectedBridge: null,
    selectedATMLink: null,
  };
  $scope.serviceTypes = ["TR069_Internet", "IPTV"];
  $scope.policies802 = [
    "Custom",
    "From IP",
    "DSCP"
  ];
  $scope.encapsulationOptions = ["LLC", "VCMUX"];
  $scope.atmQosClassOptions = ["UBR", "CBR", "NRT-VBR", "RT-VBR", "UBR+"];
  $scope.ipAcqModes = ["PPPoE","DHCP", "Static","Bridge"];

  $scope.internetObject = $routeParams.id;
  $scope.isEditMode = !!$scope.internetObject;
  $scope.dataReady = false;
  $scope.WanGroupMappingLayer = "";
  $scope.DeviceIpInterface = null;

  // Validation patterns used by both ATM/PTM sections
  $scope.patterns = {
    username: /^\d+$/,
    password: /^\d+$/,
    macAddress: /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/,
    mtu_mru_size: /^\d+$/,
    ipv4: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
  };

  // ------------------------------------------------------------
  // Shared submit / navigation
  // ------------------------------------------------------------
  $scope.submit = async function() {
    if (window.$ && $("#ajaxLoaderSection").length) {
      $("#ajaxLoaderSection").show();
    }

    // Determine active form based on selectionMode
    let activeForm;
    if ($scope.form.accessType === "ATM") {
      activeForm = "atmForm";
    } else if (
      $scope.form.accessType === "PTM" ||
      $scope.form.accessType === "ETH"
    ) {
      activeForm = "ptmForm";
    } else {
      // Default or error handling
      alert("Please select a valid mode (ATM, PTM, or ETH)");
      $("#ajaxLoaderSection").hide();
      return;
    }

    try {
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

      await helperService.removeExistingIPTVConnection();

      if (activeForm === "atmForm") {
        await $scope.addAtmConnection();
      } else {
        if ($scope.isEditMode) {
          await $scope.saveEditedPtmConnection();
        } else {
          await $scope.addPtmConnection();
        }
      }

      $location.path("/tableform/wan_wanconnections");
      $scope.$applyAsync();
    } catch (error) {
      console.error("Error during submit:", error);
      alert("Failed to save connection: " + error.message);
    } finally {
      if (window.$ && $("#ajaxLoaderSection").length) {
        $("#ajaxLoaderSection").hide();
      }
    }
  };

  $scope.cancel = function() {
    $location.path("/tableform/wan_wanconnections");
    $scope.$applyAsync();
  };

  // ------------------------------------------------------------
  // ATM logic (merged)
  // ------------------------------------------------------------
  function setupAtmLogic() {
    $scope.atmLinks = [];
    $scope.atmLinksQos = [];
    $scope.connectionTypes = [];
    $scope.encapsulationOptions = ["LLC", "VCMUX"];
    $scope.atmQosClassOptions = ["UBR", "CBR", "NRT-VBR", "RT-VBR", "UBR+"];
    $scope.linkTypeOptions = ["EoA", "PPPoA"];
    $scope.vpiVciOptions = [];
    $scope.bridgeConnections = [];
    $scope.editEthernetInterface = "";
    $scope.editPPPInterface = "";
    $scope.editIPInterface = "";
    $scope.editAlias = "";
    $scope.vpiVciSelected = false;
    $scope.Passwordfieldstatus = false;
    $scope.lowerPTM_link = "";
    $scope.ethInterfaceLink = "";

    $scope.$watch("atmData.linkType", function(newVal) {
      if ($scope.form.accessType !== "ATM") return;
      $scope.connectionTypes = $scope.connectionTypeOptionsMap[newVal] || [];
      if (newVal) {
        initializeAtmConnectionType();
      }
    });

    $scope.connectionTypeOptionsMap = {
      EoA: ["PPPoE", "Bridge", "DHCP", "Static"],
      PPPoA: ["PPPoA"],
    };

    $scope.isPrimaryDNSValid = function() {
      return $scope.patterns.ipv4.test($scope.atmData.primaryDNS);
    };

    $scope.isSecondaryDNSValid = function() {
      if (!$scope.atmData.secondaryDNS) return true;
      if ($scope.atmData.secondaryDNS === $scope.atmData.primaryDNS)
        return false;
      return $scope.patterns.ipv4.test($scope.atmData.secondaryDNS);
    };

    $scope.selectVpiVci = function(vpiVci) {
      $scope.atmData.vpiVci = vpiVci;
      const linkObj = $scope.atmLinks.find((obj) => {
        const addrParam = obj.Param.find(
          (p) => p.ParamName === "DestinationAddress"
        );
        return addrParam && addrParam.ParamValue === vpiVci;
      });
      $scope.selectedATMLink = linkObj;

      let qosObj = null;
      if (linkObj) {
        const linkNumMatch = linkObj.ObjName.match(/Device\.ATM\.Link\.(\d+)$/);
        if (linkNumMatch) {
          const qosObjName = `Device.ATM.Link.${linkNumMatch[1]}.QoS`;
          qosObj = $scope.atmLinksQos.find((obj) => obj.ObjName === qosObjName);
        }
      }
      if (qosObj) {
        $scope.atmData.atmQosClass = getAtmParamValue(qosObj, "QoSClass");
        $scope.atmData.peakCellRate =
          parseInt(getAtmParamValue(qosObj, "PeakCellRate")) || "";
        $scope.atmData.maximumBSize =
          parseInt(getAtmParamValue(qosObj, "MaximumBurstSize")) || "";
        $scope.atmData.sustainableCellRate =
          parseInt(getAtmParamValue(qosObj, "SustainableCellRate")) || "";
      } else {
        $scope.atmData.atmQosClass = "";
        $scope.atmData.peakCellRate = "";
        $scope.atmData.maximumBSize = "";
        $scope.atmData.sustainableCellRate = "";
      }
    };

    function getAtmParamValue(obj, paramName) {
      const param = obj.Param.find((p) => p.ParamName === paramName);
      return param ? param.ParamValue : "";
    }

    $scope.resetAtmForm = function() {
      $scope.atmData = defaultAtm();
    };

    async function loadAtmLinksAndQos() {
      if ($scope.form.accessType !== "ATM") return;
      if (window.$ && $("#ajaxLoaderSection").length) {
        $("#ajaxLoaderSection").show();
      }
      try {
        const response = await $http.get(
          URL + "cgi_get?Object=Device.ATM.Link"
        );
        const objects = response.data.Objects || [];
        $scope.atmLinks = objects.filter((obj) =>
          /^Device\.ATM\.Link\.\d+$/.test(obj.ObjName)
        );
        $scope.atmLinksQos = objects.filter((obj) =>
          /\.QoS$/.test(obj.ObjName)
        );
        $scope.vpiVciOptions = $scope.atmLinks
          .map((obj) => {
            const addrParam = obj.Param.find(
              (p) => p.ParamName === "DestinationAddress"
            );
            return addrParam ? addrParam.ParamValue : null;
          })
          .filter(Boolean);
      } catch (err) {
        console.error("Failed to load ATM Link/QoS objects", err);
        $scope.vpiVciOptions = [];
      } finally {
        if (window.$ && $("#ajaxLoaderSection").length) {
          $("#ajaxLoaderSection").hide();
        }
      }
    }

    async function fetchVpiVciName(atmLinkObjName) {
      $("#ajaxLoaderSection").show();
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
        initializeAtmConnectionType();
        $scope.atmData.encapsulation = getParam("Encapsulation");
      } catch (err) {
        console.error("Error fetching VPI/VCI name:", err);
      } finally {
        if (window.$ && $("#ajaxLoaderSection").length) {
          $("#ajaxLoaderSection").hide();
        }
      }
    }

    async function loadStaticDNSDataAtm() {
      if ($scope.atmData.connectionType !== "Static") return;
      try {
        const response = await $http.get(
          "https://192.168.1.1/cgi/cgi_get?Object=Device.DNS.Client.Server"
        );
        if (response.data && response.data.Objects) {
          const currentInterface = ($scope.editIPInterface || "").replace(
            /\.$/,
            ""
          );
          $scope.staticDNSData = response.data.Objects.filter((dns) => {
            const interfaceParam = dns.Param.find(
              (x) => x.ParamName === "Interface"
            );
            return (
              interfaceParam &&
              interfaceParam.ParamValue.replace(/\.$/, "") === currentInterface
            );
          }).map((dns) => {
            const serverParam = dns.Param.find(
              (x) => x.ParamName === "DNSServer"
            );
            return {
              id: dns.ObjName,
              ip: serverParam ? serverParam.ParamValue : "",
              editable: false,
            };
          });
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

    async function loadUserDefinedDNSAtm() {
      try {
        const response = await $http.get(URL + "cgi_get_dns");
        const dnsData = response.data.split("\n");
        dnsData.forEach((line) => {
          const [key, value] = line.split("=");
          if (key === "UsrDefDNS1") {
            $scope.atmData.primaryDNS = value || "";
            if (value && value.trim() !== "") {
              $scope.atmData.isUserDefinedDNS = true;
            }
          } else if (key === "UsrDefDNS2") {
            $scope.atmData.secondaryDNS = value || "";
          }
        });
      } catch (error) {
        console.error("Error loading user-defined DNS data:", error);
      }
    }

    async function detectVlanFromLowerLayers(objName) {
      try {
        const chain = await atmGetConnectionObjects(objName);
        if (!Array.isArray(chain) || chain.length === 0) return null;
        const vlanObjName = chain.find((o) =>
          o.includes("Device.Ethernet.VLANTermination")
        );
        if (!vlanObjName) return null;

        const vlanResp = await $http.get(
          `${URL}cgi_get_nosubobj?Object=${vlanObjName}`
        );
        const vlanObj = vlanResp.data.Objects?.[0];
        if (!vlanObj) return null;

        const vlanEnable = vlanObj.Param.find((p) => p.ParamName === "Enable")
          ?.ParamValue;
        const vlanId = vlanObj.Param.find((p) => p.ParamName === "VLANID")
          ?.ParamValue;

        return {
          enableVlan: vlanEnable === "true" || vlanEnable === "1" ? "1" : "0",
          vlanId: vlanId ? parseInt(vlanId, 10) : "",
        };
      } catch (err) {
        console.warn("detectVlanFromLowerLayers failed for:", objName, err);
        return null;
      }
    }

    async function initializeAtmConnectionType() {
      try {
        if ($scope.internetObject) {
          $scope.editIPInterface = $scope.internetObject.split(",")[0];

          // Load NAT settings for ATM
          await loadNATSettingsATM($scope.editIPInterface);

          const response = await $http.get(
            URL + `/cgi_get?Object=${$scope.editIPInterface}`
          );
          const ipInterfaceData = response.data["Objects"][1];
          if (ipInterfaceData) {
            const addressingType = ipInterfaceData.Param.find(
              (x) => x.ParamName === "AddressingType"
            )?.ParamValue;
            setTimeout(() => {
              $scope.$apply(() => {
                if (addressingType) {
                  switch (addressingType) {
                    case "X_LANTIQ_COM_PPPoE":
                      $scope.atmData.connectionType = "PPPoE";
                      loadUserPassDataAtm();
                      break;
                    case "X_LANTIQ_COM_Bridged":
                      $scope.atmData.connectionType = "Bridge";
                      loadBridgeConnectionsAtm();
                      break;
                    case "DHCP":
                      $scope.atmData.connectionType = "DHCP";
                      break;
                    case "Static":
                      $scope.atmData.connectionType = "Static";
                      $scope.atmData.subnetmask =
                        ipInterfaceData.Param.find(
                          (x) => x.ParamName === "SubnetMask"
                        )?.ParamValue || "";
                      $scope.atmData.ipaddress =
                        ipInterfaceData.Param.find(
                          (x) => x.ParamName === "IPAddress"
                        )?.ParamValue || "";
                      loadStaticDNSDataAtm();
                      break;
                    default:
                      $scope.atmData.connectionType = "PPPoE";
                  }
                  // If connection type is PPPoE and DNS fields have values, check the box
                  if (
                    $scope.atmData.connectionType === "PPPoE" &&
                    ($scope.atmData.primaryDNS || $scope.atmData.secondaryDNS)
                  ) {
                    $scope.atmData.isUserDefinedDNS = true;
                  }
                }
              });
            }, 200);
          }

          const response2 = await $http.get(
            URL + `/cgi_get?Object=${$scope.editIPInterface}`
          );
          const objects = response2.data["Objects"] || [];
          const ipInterfaceObj =
            objects.find((o) => o.ObjName === $scope.editIPInterface + ".") ||
            objects[0];

          try {
            const lowerLayersParam = ipInterfaceObj.Param.find(
              (p) => p.ParamName === "LowerLayers"
            );
            if (lowerLayersParam) {
              const vlanObj = await detectVlanFromLowerLayers(
                lowerLayersParam.ParamValue
              );
              if (vlanObj) {
                const vlanEnable = vlanObj.enableVlan;
                const vlanId = vlanObj.vlanId;
                $scope.atmData.enableVlan =
                  vlanEnable === "true" || vlanEnable === "1" ? "1" : "0";
                $scope.atmData.vlanId = vlanId ? parseInt(vlanId, 10) : "";
              } else {
                $scope.atmData.enableVlan = "0";
                $scope.atmData.vlanId = "";
              }
            } else {
              $scope.atmData.enableVlan = "0";
              $scope.atmData.vlanId = "";
            }
          } catch (vlanErr) {
            console.warn("No VLAN data found:", vlanErr);
            $scope.atmData.enableVlan = "0";
            $scope.atmData.vlanId = "";
          }
        }
        await loadUserDefinedDNSAtm();
      } catch (error) {
        console.error("Error initializing connection type:", error);
      }
    }

    $scope.staticDNSData =
      JSON.parse(localStorage.getItem("staticDNSData")) || [];
    $scope.addStaticDNSRow = function() {
      $scope.staticDNSData.push({ id: null, ip: "", editable: true });
    };
    $scope.confirmStaticDNSRow = function(index) {
      const dns = $scope.staticDNSData[index];
      if ($scope.patterns.ipv4.test(dns.ip)) {
        dns.editable = false;
        localStorage.setItem(
          "staticDNSData",
          JSON.stringify($scope.staticDNSData)
        );
      } else {
        alert("Please enter a valid IPv4 address.");
      }
    };
    $scope.removeStaticDNSRow = function(index) {
      $scope.staticDNSData.splice(index, 1);
      localStorage.setItem(
        "staticDNSData",
        JSON.stringify($scope.staticDNSData)
      );
    };

    async function bindVpiVci() {
      if (!$scope.internetObject) return;
      const deviceIpInterface = $scope.internetObject.split(",")[0];
      const connectionChain = await atmGetConnectionObjects(
        deviceIpInterface,
        true
      );
      if (!Array.isArray(connectionChain) || connectionChain.length === 0)
        return;
      const physicalLayer = connectionChain.find(
        (x) =>
          x.includes("ATM.Link") ||
          x.includes("PTM.Link") ||
          x.includes("DSL.Channel")
      );
      if (physicalLayer) {
        const vpiVciName = await fetchVpiVciName(physicalLayer);
        initializeAtmConnectionType();
        $scope.atmData.vpiVciName = vpiVciName || "";
      } else {
        $scope.atmData.vpiVciName = "";
      }
    }

    async function bindVlan() {
      if (!$scope.internetObject) return;
      const deviceIpInterface = $scope.internetObject.split(",")[0];
      const connectionChain = await atmGetConnectionObjects(
        deviceIpInterface,
        true
      );
      if (!Array.isArray(connectionChain) || connectionChain.length === 0)
        return;

      let tInterface = "";
      switch ($scope.atmData.connectionType) {
        case "PPPoE":
        case "PPPoA":
          tInterface = "PPP.Interface";
          break;
        case "Bridge":
        case "Static":
        case "DHCP":
          tInterface = "Ethernet.Link";
          break;
        default:
          return;
      }
      const target_interface = connectionChain.find((x) =>
        x.includes(tInterface)
      );
      if (!target_interface) return;
      const vlanInfo = await detectVlanFromLowerLayers(target_interface);
      if (vlanInfo && vlanInfo.enableVlan === "1") {
        $scope.atmData.enableVlan = "1";
        $scope.atmData.vlanId = vlanInfo.vlanId;
      } else {
        $scope.atmData.enableVlan = "0";
        $scope.atmData.vlanId = "";
      }
    }

    async function loadUserPassDataAtm() {
      try {
        if (!$scope.internetObject) return;
        const deviceIpInterface = $scope.internetObject.split(",")[0];
        const connectionChain = await atmGetConnectionObjects(
          deviceIpInterface,
          true
        );
        if (!Array.isArray(connectionChain) || connectionChain.length === 0)
          return;
        const pppInterface = connectionChain.find((x) =>
          x.includes("PPP.Interface")
        );
        if (!pppInterface) return;

        const pppRes = await $http.get(
          `${URL}cgi_get_nosubobj?Object=${pppInterface}`
        );
        const pppObj = pppRes.data.Objects?.[0];
        if (!pppObj) return;

        const usernameParam = pppObj.Param.find(
          (p) => p.ParamName === "Username"
        );
        const passwordParam = pppObj.Param.find(
          (p) => p.ParamName === "Password"
        );
        const mtuParam = pppObj.Param.find((p) => p.ParamName === "MaxMRUSize");

        setTimeout(() => {
          $scope.$apply(() => {
            $scope.atmData.username =
              usernameParam?.ParamValue?.split("@")[0] || "";
            $scope.atmData.password = passwordParam?.ParamValue || "";
            $scope.atmData.mtu_size = parseInt(mtuParam?.ParamValue) || 1492;
          });
        }, 200);
      } catch (error) {
        console.error("Error loading PPPoE user/pass data:", error);
      }
    }

    // Add NAT loading function for ATM
    async function loadNATSettingsATM(ipInterface) {
      try {
        const natResponse = await $http.get(
          URL + "cgi_get?Object=Device.NAT.InterfaceSetting"
        );

        if (natResponse.data && natResponse.data.Objects) {
          const interfaceNatSetting = natResponse.data.Objects.find((nat) => {
            const interfaceParam = nat.Param.find(
              (p) => p.ParamName === "Interface"
            );
            return interfaceParam && interfaceParam.ParamValue === ipInterface;
          });

          if (interfaceNatSetting) {
            const enableParam = interfaceNatSetting.Param.find(
              (p) => p.ParamName === "Enable"
            );
            const natTypeParam = interfaceNatSetting.Param.find(
              (p) => p.ParamName === "X_LANTIQ_COM_NATType"
            );

            setTimeout(() => {
              $scope.$apply(() => {
                if (enableParam) {
                  $scope.atmData.enableNAT =
                    enableParam.ParamValue === "true" ||
                    enableParam.ParamValue === "1"
                      ? "1"
                      : "0";
                }
                if (natTypeParam && $scope.atmData.enableNAT === "1") {
                  $scope.atmData.natType = natTypeParam.ParamValue;
                }
              });
            }, 100);
          }
        }
      } catch (error) {
        console.error("Error loading NAT settings for ATM:", error);
      }
    }

    function getAtmAliasNumber(selectedATMLink) {
      if (!selectedATMLink || !Array.isArray(selectedATMLink.Param))
        return null;
      const aliasParam = selectedATMLink.Param.find(
        (p) => p.ParamName === "Alias"
      );
      if (!aliasParam || !aliasParam.ParamValue) return null;
      const alias = aliasParam.ParamValue;
      const match = alias.match(/-(\d+)$/);
      return match ? match[1] : null;
    }

    async function loadBridgeConnectionsAtm() {
      if ($scope.atmData.connectionType !== "Bridge") return;
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
          $scope.bridgeConnections = response.data.Objects.map((bridge) => {
            const nameParam = bridge.Param.find(
              (x) => x.ParamName === "X_LANTIQ_COM_Name"
            );
            const match = bridge.ObjName.match(
              /Device\.Bridging\.Bridge\.(\d+)/
            );
            const id = match ? parseInt(match[1], 10) : null;
            return {
              id,
              objName: bridge.ObjName,
              name: nameParam ? nameParam.ParamValue : bridge.ObjName,
            };
          });
          $scope.atmData.selectedBridge = $scope.bridgeConnections[0];
        } else {
          $scope.bridgeConnections = [];
        }
      } catch (error) {
        console.error("Error loading bridge connections:", error);
      }
    }

    $scope.addAtmConnection = async function() {
      try {
        $("#ajaxLoaderSection").show();
        let randomNumber = parseInt(localStorage.getItem("randomvalue"));
        if (isNaN(randomNumber)) {
          randomNumber = Math.floor(Math.random() * 1000);
        }
        const atmAliasNumber = getAtmAliasNumber($scope.selectedATMLink);
        if (atmAliasNumber) {
          randomNumber = atmAliasNumber;
        }

        const dslLowerLayer = "Device.DSL.Line.1.";
        const atmAlias = `cpe-WEB-ATMLink-${randomNumber}`;
        const ethAlias = `cpe-WEB-EthernetLink-${randomNumber}`;
        const pppAlias = `cpe-WEB-PPPInterface-${randomNumber}`;
        const pppUsername = encodeURIComponent(
          `${$scope.atmData.username}@tedata.net.eg`
        );
        const pppPassword = encodeURIComponent($scope.atmData.password);
        let connectionRequest = "";

        if (!$scope.selectedATMLink) {
          connectionRequest += `&Object=Device.ATM.Link&Operation=Add&Enable=true&Alias=${atmAlias}`;
          connectionRequest += `&LowerLayers=${dslLowerLayer}`;
          connectionRequest += `&DestinationAddress=${encodeURIComponent(
            $scope.atmData.vpiVci
          )}`;
          connectionRequest += `&Encapsulation=${$scope.atmData.encapsulation}`;
          connectionRequest += `&LinkType=${$scope.atmData.linkType}`;
        }

        if (!$scope.selectedATMLink) {
          connectionRequest += `&Object=Device.ATM.Link.${atmAlias}.QoS&Operation=Modify`;
        } else {
          connectionRequest += `&Object=${$scope.selectedATMLink.ObjName}.QoS&Operation=Modify`;
        }
        connectionRequest += `&QoSClass=${$scope.atmData.atmQosClass}`;
        if ($scope.atmData.peakCellRate) {
          connectionRequest += `&PeakCellRate=${$scope.atmData.peakCellRate}`;
        }
        if ($scope.atmData.maximumBSize) {
          connectionRequest += `&MaximumBurstSize=${$scope.atmData.maximumBSize}`;
        }
        if ($scope.atmData.sustainableCellRate) {
          connectionRequest += `&SustainableCellRate=${$scope.atmData.sustainableCellRate}`;
        }

        const ipAlias = `cpe-WEB-IPInterface-${randomNumber}`;
        connectionRequest += `&Object=Device.IP.Interface&Operation=Add&Enable=true&Alias=${ipAlias}`;
        if (
          $scope.atmData.enableVlan == "1" &&
          $scope.atmData.connectionType === "Bridge"
        ) {
          connectionRequest += `&LowerLayers=Device.Ethernet.VLANTermination.cpe-WEB-EthernetVLANTermination-${randomNumber}`;
        } else if ($scope.atmData.connectionType === "DHCP") {
          connectionRequest += `&LowerLayers=Device.Ethernet.Link.${ethAlias}`;
        } else {
          connectionRequest += `&LowerLayers=Device.PPP.Interface.${pppAlias}`;
        }
        connectionRequest += `&X_LANTIQ_COM_DefaultGateway=${
          $scope.atmData.defaultGateway === "1" ? "true" : "false"
        }`;
        connectionRequest += `&IPv6Enable=${
          $scope.atmData.ipv6enable === "1" ? "true" : "false"
        }`;

        connectionRequest += `&Object=Device.Ethernet.Link&Operation=Add&Enable=true&Alias=${ethAlias}`;
        if ($scope.atmData.connectionType === "Bridge") {
          connectionRequest += `&LowerLayers=${$scope.atmData.selectedBridge.objName}.Port.cpe-WEB-BridgingBridge${$scope.atmData.selectedBridge.id}Port-${randomNumber}`;
        } else {
          if ($scope.isEditMode && $scope.selectedATMLink) {
            connectionRequest += `&LowerLayers=${$scope.selectedATMLink.ObjName}`;
          } else {
            connectionRequest += `&LowerLayers=Device.ATM.Link.${atmAlias}`;
          }
        }

        if ($scope.atmData.enableVlan == "1") {
          connectionRequest += `&Object=Device.Ethernet.VLANTermination&Operation=Add&LowerLayers=Device.Ethernet.Link.cpe-WEB-EthernetLink-${randomNumber}&Alias=cpe-WEB-EthernetVLANTermination-${randomNumber}&Enable=1&VLANID=${$scope.atmData.vlanId}`;
        }

        if ($scope.atmData.connectionType === "PPPoE") {
          connectionRequest += `&Object=Device.PPP.Interface&Operation=Add&Enable=true&Alias=${pppAlias}`;
          connectionRequest += `&MaxMRUSize=${$scope.atmData.mtu_size}`;
          connectionRequest += `&Username=${pppUsername}&Password=${pppPassword}`;
          if ($scope.atmData.enableVlan == "1") {
            connectionRequest += `&LowerLayers=Device.Ethernet.VLANTermination.cpe-WEB-EthernetVLANTermination-${randomNumber}`;
          } else {
            connectionRequest += `&LowerLayers=Device.Ethernet.Link.${ethAlias}`;
          }
        }

        if ($scope.atmData.connectionType === "Bridge") {
          if ($scope.selectedATMLink) {
            connectionRequest += `&Object=${$scope.atmData.selectedBridge.objName}.Port&Operation=Add&Enable=true&Alias=cpe-WEB-BridgingBridge${$scope.atmData.selectedBridge.id}Port-${randomNumber}&LowerLayers=${$scope.selectedATMLink.ObjName}`;
          } else {
            alert(
              "No ATM links found, please create one first before creating a bridge"
            );
            return;
          }
        }

        if ($scope.atmData.connectionType === "DHCP") {
          connectionRequest += `&Object=Device.DHCPv4.Client&Operation=Add&Interface=Device.IP.Interface.${ipAlias}`;
        }

        if ($scope.atmData.connectionType === "Static") {
          connectionRequest += `&Object=Device.IP.Interface.${ipAlias}.IPv4Address&Operation=Add&IPAddress=${$scope.atmData.ipaddress}&SubnetMask=${$scope.atmData.subnetmask}`;
          connectionRequest += `&Object=Device.Routing.Router.1.IPv4Forwarding&Operation=Add&Interface=Device.IP.Interface.${ipAlias}&Enable=true&GatewayIPAddress=${$scope.atmData.gatewayaddress}`;
          connectionRequest += `&Object=Device.Routing.Router.1.IPv6Forwarding&Operation=Add&Interface=Device.IP.Interface.${ipAlias}`;
          if ($scope.staticDNSData.length > 0) {
            $scope.staticDNSData.forEach((dns) => {
              connectionRequest += `&?Object=Device.DNS.Client.Server&Operation=Add&DNSServer=${dns.ip}&Enable=1&Interface=Device.IP.${ipAlias}`;
            });
          }
        }

        const result = await $http.post(URL + "cgi_set", connectionRequest);

        if (result.status === 200) {
          if ($scope.atmData.isUserDefinedDNS) {
            const dnsRequest = `UsrDefDNS1=${$scope.atmData.primaryDNS}&UsrDefDNS2=${$scope.atmData.secondaryDNS}`;
            const dnsResult = await $http.post(
              URL + "cgi_setUserDefinedDNS",
              dnsRequest
            );
            if (dnsResult.status !== 200) {
              console.log("Failed to set user-defined DNS.");
            }
          }
          if ($scope.isEditMode) {
            await $scope.deleteAtmConnection();
          }
        } else {
          alert(
            result.data?.Objects?.[0]?.Param?.[0]?.ParamValue ||
              "Something went wrong."
          );
        }
      } catch (err) {
        console.error("Error adding ATM connection:", err);
        alert("Failed to add ATM connection.");
      } finally {
        $("#ajaxLoaderSection").hide();
      }
    };

    $scope.$watch("atmData.connectionType", function(newValue, oldValue) {
      if ($scope.form.accessType !== "ATM") return;
      if (newValue === oldValue) return;
      if (newValue === "Static") {
        loadStaticDNSDataAtm();
      } else if (newValue === "Bridge") {
        loadBridgeConnectionsAtm();
      } else {
        loadUserPassDataAtm();
      }
    });

    $scope.$watch("atmData.vpiVci", function() {
      const found = $scope.atmLinks.find((obj) => {
        const addrParam = obj.Param.find(
          (p) => p.ParamName === "DestinationAddress"
        );
        return addrParam && addrParam.ParamValue === $scope.atmData.vpiVci;
      });
      if (!found) {
        $scope.selectedATMLink = null;
      }
    });

    $scope.validateDNSForm = function() {
      if (!$scope.atmForm) return;
      const same =
        $scope.atmData.secondaryDNS &&
        $scope.atmData.secondaryDNS === $scope.atmData.primaryDNS;
      $scope.atmForm.$setValidity("dnsConflict", !same);
    };

    async function atmGetConnectionObjects(
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
        const deeper = await atmGetConnectionObjects(
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

    $scope.deleteAtmConnection = async function() {
      let objects = await atmGetConnectionObjects(
        $scope.internetObject.split(",")[0]
      );
      let deleteRequest = "";
      objects.forEach((objName) => {
        if (
          objName &&
          !objName.includes("Device.ATM") &&
          !objName.includes("DSL.Link")
        ) {
          deleteRequest += `Object=${objName}&Operation=Del&`;
        }
      });
      return await $http.post(URL + "cgi_set", deleteRequest);
    };

    async function initAtm() {
      await loadAtmLinksAndQos();
      await bindVpiVci();
      await bindVlan();
    }

    initAtm();
  }

  // ------------------------------------------------------------
  // PTM / ETH logic (merged)
  // ------------------------------------------------------------
  function setupPtmLogic() {
    $scope.connectionTypes = ["PPPoE", "Bridge", "DHCP", "Static"];
    $scope.bridgeConnections = [];
    $scope.editEthernetInterface = "";
    $scope.editPPPInterface = "";
    $scope.editIPInterface = "";
    $scope.editAlias = "";
    $scope.Passwordfieldstatus = false;
    $scope.staticDNSData =
      JSON.parse(localStorage.getItem("staticDNSData")) || [];

    function ensureRandomValue() {
      let v = localStorage.getItem("randomvalue");
      if (!v) {
        v = Math.floor(Math.random() * 9990 + 10).toString();
        localStorage.setItem("randomvalue", v);
      }
      return v;
    }
    function makeAlias(prefix, randomValue) {
      return `${prefix}-${randomValue}`;
    }
    function appendTedata(username) {
      if (!username) return "";
      if (username.indexOf("@") !== -1) return username;
      return `${username}@tedata.net.eg`;
    }
    function enc(v) {
      return encodeURIComponent(
        v === undefined || v === null ? "" : v.toString()
      );
    }
    function buildStaticDnsEntries(staticDNSData, randomValue) {
      if (!staticDNSData || !staticDNSData.length) return "";
      return staticDNSData
        .map((dns, idx) => {
          return `Object=Device.DNS.Client.Server&Operation=Add&Enable=true&Alias=StaticDNS-${randomValue}-${idx}&DNSServer=${enc(
            dns.ip
          )}&Interface=Device.IP.Interface.cpe-WEB-IPInterface-${randomValue}`;
        })
        .join("&");
    }

    function buildPppoeRequest(model, wanLayer, randomValue) {
      const ipAlias = makeAlias("cpe-WEB-IPInterface", randomValue);
      const ethLinkAlias = makeAlias("cpe-WEB-EthernetLink", randomValue);
      const pppAlias = makeAlias("cpe-WEB-PPPInterface", randomValue);

      if (model.enableVlan === "1" && model.vlanId) {
        const vlanAlias = makeAlias(
          "cpe-WEB-EthernetVLANTermination",
          randomValue
        );
        let r = "";
        r += `Object=Device.IP.Interface&Operation=Add&Enable=true&Alias=${enc(
          ipAlias
        )}&LowerLayers=Device.PPP.Interface.${enc(pppAlias)}&IPv6Enable=${enc(
          model.ipv6enable
        )}&MaxMTUSize=${enc(model.mtu_size)}&X_LANTIQ_COM_DefaultGateway=${enc(
          model.defaultGateway
        )}`;
        r += `&Object=Device.Ethernet.Link&Operation=Add&Enable=true&Alias=${enc(
          ethLinkAlias
        )}&LowerLayers=${enc(wanLayer)}`;
        if (model.macCloneEnabled && model.mac_address) {
          r += `&X_INTEL_COM_MACCloning=true&MACAddress=${enc(
            model.mac_address
          )}`;
        }
        r += `&Object=Device.Ethernet.VLANTermination&Operation=Add&LowerLayers=Device.Ethernet.Link.${enc(
          ethLinkAlias
        )}&Alias=${enc(vlanAlias)}&Enable=1&VLANID=${enc(model.vlanId)}`;
        const username = appendTedata(model.username);
        r += `&Object=Device.PPP.Interface&Operation=Add&Enable=true&Alias=${enc(
          pppAlias
        )}&LowerLayers=Device.Ethernet.VLANTermination.${enc(
          vlanAlias
        )}&MaxMRUSize=${enc(model.mtu_size)}`;
        if (username) r += `&Username=${enc(username)}`;
        if (model.password) r += `&Password=${enc(model.password)}`;
        return r;
      }

      let req = "";
      req += `Object=Device.IP.Interface&Operation=Add&Enable=true&Alias=${enc(
        ipAlias
      )}&LowerLayers=Device.PPP.Interface.${enc(pppAlias)}&IPv6Enable=${enc(
        model.ipv6enable
      )}&MaxMTUSize=${enc(model.mtu_size)}&X_LANTIQ_COM_DefaultGateway=${enc(
        model.defaultGateway
      )}`;
      req += `&Object=Device.Ethernet.Link&Operation=Add&Enable=true&Alias=${enc(
        ethLinkAlias
      )}&LowerLayers=${enc(wanLayer)}`;
      if (model.macCloneEnabled && model.mac_address) {
        req += `&X_INTEL_COM_MACCloning=true&MACAddress=${enc(
          model.mac_address
        )}`;
      }
      const username = appendTedata(model.username);
      req += `&Object=Device.PPP.Interface&Operation=Add&Enable=true&Alias=${enc(
        pppAlias
      )}&LowerLayers=Device.Ethernet.Link.${enc(ethLinkAlias)}&MaxMRUSize=${enc(
        model.mtu_size
      )}`;
      if (username) req += `&Username=${enc(username)}`;
      if (model.password) req += `&Password=${enc(model.password)}`;
      return req;
    }

    function buildBridgeRequest(model, wanLayer, randomValue) {
      const ipAlias = makeAlias("cpe-WEB-IPInterface", randomValue);
      const ethLinkAlias = makeAlias("cpe-WEB-EthernetLink", randomValue);
      const bridgePortAlias = makeAlias(
        "cpe-WEB-BridgingBridge1Port",
        randomValue
      );
      if (!model.selectedBridge || !model.selectedBridge.objName) {
        throw new Error("Bridge object name not found");
      }
      if (model.enableVlan === "1" && model.vlanId) {
        const vlanAlias = makeAlias(
          "cpe-WEB-EthernetVLANTermination",
          randomValue
        );
        let r = "";
        r += `Object=Device.IP.Interface&Operation=Add&Enable=true&Alias=${enc(
          ipAlias
        )}&LowerLayers=Device.Ethernet.VLANTermination.${enc(vlanAlias)}`;
        r += `&Object=Device.Ethernet.Link&Operation=Add&Enable=true&Alias=${enc(
          ethLinkAlias
        )}&LowerLayers=${enc(
          model.selectedBridge.objName + ".Port." + bridgePortAlias
        )}`;
        r += `&Object=${enc(
          model.selectedBridge.objName
        )}.Port&Operation=Add&Enable=true&Alias=${enc(
          bridgePortAlias
        )}&LowerLayers=${enc(wanLayer)}`;
        r += `&Object=Device.Ethernet.VLANTermination&Operation=Add&TPID=&LowerLayers=Device.Ethernet.Link.${enc(
          ethLinkAlias
        )}&Alias=${enc(vlanAlias)}&Enable=1&VLANID=${enc(model.vlanId)}`;
        return r;
      }
      let req = "";
      req += `Object=Device.IP.Interface&Operation=Add&Enable=true&Alias=${enc(
        ipAlias
      )}&LowerLayers=Device.Ethernet.Link.${enc(ethLinkAlias)}`;
      req += `&Object=Device.Ethernet.Link&Operation=Add&Enable=true&Alias=${enc(
        ethLinkAlias
      )}&LowerLayers=${enc(
        model.selectedBridge.objName + ".Port." + bridgePortAlias
      )}`;
      req += `&Object=${enc(
        model.selectedBridge.objName
      )}.Port&Operation=Add&Enable=true&Alias=${enc(
        bridgePortAlias
      )}&LowerLayers=${enc(wanLayer)}`;
      return req;
    }

    function buildStaticRequest(model, wanLayer, randomValue) {
      const ipAlias = makeAlias("cpe-WEB-IPInterface", randomValue);
      const ethLinkAlias = makeAlias("cpe-WEB-EthernetLink", randomValue);
      const dnsEntries = buildStaticDnsEntries(
        $scope.staticDNSData,
        randomValue
      );
      if (model.enableVlan === "1" && model.vlanId) {
        const vlanAlias = makeAlias(
          "cpe-WEB-EthernetVLANTermination",
          randomValue
        );
        let r = "";
        r += `Object=Device.IP.Interface&Operation=Add&Enable=true&Alias=${enc(
          ipAlias
        )}&LowerLayers=Device.Ethernet.VLANTermination.${enc(vlanAlias)}`;
        r += `&Object=Device.Ethernet.Link&Operation=Add&Enable=true&Alias=${enc(
          ethLinkAlias
        )}&LowerLayers=${enc(wanLayer)}`;
        if (model.macCloneEnabled && model.mac_address) {
          r += `&X_INTEL_COM_MACCloning=true&MACAddress=${enc(
            model.mac_address
          )}`;
        }
        r += `&Object=Device.Ethernet.VLANTermination&Operation=Add&LowerLayers=Device.Ethernet.Link.${enc(
          ethLinkAlias
        )}&Alias=${enc(vlanAlias)}&Enable=1&VLANID=${enc(model.vlanId)}`;
        r += `&Object=Device.IP.Interface.${enc(
          ipAlias
        )}.IPv4Address&Operation=Add&IPAddress=${enc(
          model.ipaddress
        )}&SubnetMask=${enc(model.subnetmask)}`;
        r += `&Object=Device.Routing.Router.1.IPv4Forwarding&Operation=Add&Interface=Device.IP.Interface.${enc(
          ipAlias
        )}&Enable=true&GatewayIPAddress=${enc(model.gatewayaddress)}`;
        if (dnsEntries) r += `&${dnsEntries}`;
        return r;
      }
      let req = "";
      req += `Object=Device.IP.Interface&Operation=Add&Enable=true&Alias=${enc(
        ipAlias
      )}&LowerLayers=${enc(wanLayer)}`;
      req += `&Object=Device.Ethernet.Link&Operation=Add&Enable=true&Alias=${enc(
        ethLinkAlias
      )}&LowerLayers=${enc(wanLayer)}`;
      if (model.macCloneEnabled && model.mac_address) {
        req += `&X_INTEL_COM_MACCloning=true&MACAddress=${enc(
          model.mac_address
        )}`;
      }
      req += `&Object=Device.IP.Interface.${enc(
        ipAlias
      )}.IPv4Address&Operation=Add&IPAddress=${enc(
        model.ipaddress
      )}&SubnetMask=${enc(model.subnetmask)}`;
      req += `&Object=Device.Routing.Router.1.IPv4Forwarding&Operation=Add&Interface=Device.IP.Interface.${enc(
        ipAlias
      )}&Enable=true&GatewayIPAddress=${enc(model.gatewayaddress)}`;
      if (dnsEntries) req += `&${dnsEntries}`;
      return req;
    }

    function buildDhcpRequest(model, wanLayer, randomValue) {
      const ipAlias = makeAlias("cpe-WEB-IPInterface", randomValue);
      const ethLinkAlias = makeAlias("cpe-WEB-EthernetLink", randomValue);
      if (model.enableVlan === "1" && model.vlanId) {
        const vlanAlias = makeAlias(
          "cpe-WEB-EthernetVLANTermination",
          randomValue
        );
        let r = "";
        r += `Object=Device.IP.Interface&Operation=Add&Enable=true&Alias=${enc(
          ipAlias
        )}&LowerLayers=Device.Ethernet.VLANTermination.${enc(
          vlanAlias
        )}&X_LANTIQ_COM_DefaultGateway=${enc(model.defaultGateway)}`;
        r += `&Object=Device.Ethernet.Link&Operation=Add&Enable=true&Alias=${enc(
          ethLinkAlias
        )}&LowerLayers=${enc(wanLayer)}`;
        if (model.macCloneEnabled && model.mac_address) {
          r += `&X_INTEL_COM_MACCloning=true&MACAddress=${enc(
            model.mac_address
          )}`;
        }
        r += `&Object=Device.DHCPv4.Client&Operation=Add&Interface=Device.IP.Interface.${enc(
          ipAlias
        )}`;
        r += `&Object=Device.Ethernet.VLANTermination&Operation=Add&LowerLayers=Device.Ethernet.Link.${enc(
          ethLinkAlias
        )}&Alias=${enc(vlanAlias)}&Enable=1&VLANID=${enc(model.vlanId)}`;
        return r;
      }
      let req = "";
      req += `Object=Device.IP.Interface&Operation=Add&Enable=true&Alias=${enc(
        ipAlias
      )}&LowerLayers=${enc(wanLayer)}&X_LANTIQ_COM_DefaultGateway=${enc(
        model.defaultGateway
      )}`;
      req += `&Object=Device.Ethernet.Link&Operation=Add&Enable=true&Alias=${enc(
        ethLinkAlias
      )}&LowerLayers=${enc(wanLayer)}`;
      req += `&Object=Device.DHCPv4.Client&Operation=Add&Interface=Device.IP.Interface.${enc(
        ipAlias
      )}`;
      return req;
    }

    async function loadUserPassDataPtm() {
      try {
        if ($scope.internetObject) {
          $scope.editIPInterface = $scope.internetObject.split(",")[0];
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
            pppObj.Param.find((x) => x.ParamName === "IPv6Enable")
              ?.ParamValue === "true"
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
        }
      } catch (error) {
        console.error("Error loading user_pass data:", error);
      }
    }

    async function loadBridgeConnectionsPtm() {
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
          $scope.bridgeConnections = response.data.Objects.map((bridge) => {
            const nameParam = bridge.Param.find(
              (x) => x.ParamName === "X_LANTIQ_COM_Name"
            );
            return {
              objName: bridge.ObjName,
              name: nameParam ? nameParam.ParamValue : bridge.ObjName,
            };
          });
          $scope.ptmData.selectedBridge = $scope.bridgeConnections[0];
        } else {
          $scope.bridgeConnections = [];
        }
      } catch (error) {
        console.error("Error loading bridge connections:", error);
      }
    }

    async function getConnectionObjects(ipInterface) {
      const objectsToDelete = [];
      async function traceLayers(layer) {
        if (!layer) return;
        const cleanLayer = layer.replace(/\.$/, "");
        if (
          !cleanLayer.includes("ATM") &&
          !cleanLayer.includes("PTM") &&
          !cleanLayer.includes("DSL")
        ) {
          if (!objectsToDelete.includes(cleanLayer)) {
            objectsToDelete.push(cleanLayer);
          }
        }
        try {
          const res = await $http.get(
            `${URL}cgi_get_nosubobj?Object=${cleanLayer}`
          );
          const obj = res.data.Objects?.[0];
          if (!obj || !obj.Param) return;
          const nextLayer = obj.Param.find((p) => p.ParamName === "LowerLayers")
            ?.ParamValue;
          if (nextLayer) {
            await traceLayers(nextLayer);
          }
        } catch (err) {
          console.warn("Failed to fetch layer:", layer, err);
        }
      }
      try {
        await traceLayers(ipInterface);
      } catch (err) {
        console.error("Error traversing ATM connection chain:", err);
      }
      return objectsToDelete;
    }

    async function deleteOldPtmConnection() {
      let objects = await getConnectionObjects(
        $scope.internetObject.split(",")[0]
      );
      let deleteRequest = "";
      objects.forEach((objName) => {
        if (
          objName &&
          !objName.includes("Device.PTM") &&
          !objName.includes("DSL.Link")
        ) {
          deleteRequest += `Object=${objName}&Operation=Del&`;
        }
      });
      return await $http.post(URL + "cgi_set", deleteRequest);
    }

    async function loadStaticDNSData() {
      if ($scope.ptmData.connectionType !== "Static") return;
      try {
        const response = await $http.get(
          "https://192.168.1.1/cgi/cgi_get?Object=Device.DNS.Client.Server"
        );
        if (response.data && response.data.Objects) {
          const currentInterface = ($scope.editIPInterface || "").replace(
            /\.$/,
            ""
          );
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
              interfaceParam.ParamValue.replace(/\.$/, "") === currentInterface
            );
          }).map((dns) => {
            const serverParam = dns.Param.find(
              (x) => x.ParamName === "DNSServer"
            );
            return {
              id: dns.ObjName,
              ip: serverParam ? serverParam.ParamValue : "",
              editable: false,
            };
          });
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

    $scope.addStaticDNSRow = function() {
      $scope.staticDNSData.push({ id: null, ip: "", editable: true });
    };
    $scope.confirmStaticDNSRow = function(index) {
      const dns = $scope.staticDNSData[index];
      if ($scope.patterns.ipv4.test(dns.ip)) {
        dns.editable = false;
        localStorage.setItem(
          "staticDNSData",
          JSON.stringify($scope.staticDNSData)
        );
      } else {
        alert("Please enter a valid IPv4 address.");
      }
    };
    $scope.removeStaticDNSRow = function(index) {
      $scope.staticDNSData.splice(index, 1);
      localStorage.setItem(
        "staticDNSData",
        JSON.stringify($scope.staticDNSData)
      );
    };

    async function loadUserDefinedDNS() {
      try {
        const response = await $http.get(URL + "cgi_get_dns");
        const dnsData = response.data.split("\n");
        let hasDNSValues = false;

        dnsData.forEach((line) => {
          const [key, value] = line.split("=");
          if (key === "UsrDefDNS1") {
            $scope.ptmData.primaryDNS = value || "";
            if (value && value.trim() !== "") {
              hasDNSValues = true;
            }
          }
          if (key === "UsrDefDNS2") {
            $scope.ptmData.secondaryDNS = value || "";
            if (value && value.trim() !== "") {
              hasDNSValues = true;
            }
          }
        });

        // Set checkbox state based on DNS values and connection type
        setTimeout(() => {
          if ($scope.ptmData.connectionType === "PPPoE" && hasDNSValues) {
            $scope.ptmData.isUserDefinedDNS = true;
          }
        }, 100);
      } catch (error) {
        console.error("Error loading user-defined DNS data:", error);
      }
    }

    $scope.addPtmConnection = async function() {
      try {
        $("#ajaxLoaderSection").show();
        const randomValue = ensureRandomValue();
        let wanLayer = "Device.PTM.Link.1.";
        if ($scope.form && $scope.form.accessType === "ETH") {
          wanLayer = "Device.Ethernet.Interface.5.";
        } else {
          const lowerLayerRes = await $http.get(
            URL +
              `cgi_get_fillparams?Object=Device.X_LANTIQ_COM_NwHardware.WANGroup.1&MappingLowerLayer=`
          );
          wanLayer =
            lowerLayerRes.data["Objects"][0].Param[0].ParamValue || wanLayer;
        }

        let connectionRequest = "";
        const model = $scope.ptmData;
        if (model.connectionType === "PPPoE") {
          connectionRequest = buildPppoeRequest(model, wanLayer, randomValue);
        } else if (model.connectionType === "Bridge") {
          connectionRequest = buildBridgeRequest(model, wanLayer, randomValue);
        } else if (model.connectionType === "Static") {
          connectionRequest = buildStaticRequest(model, wanLayer, randomValue);
        } else if (model.connectionType === "DHCP") {
          connectionRequest = buildDhcpRequest(model, wanLayer, randomValue);
        } else {
          throw new Error("Unsupported connection type");
        }

        const addResult = await $http.post(URL + "cgi_set", connectionRequest);
        if (addResult.status === 200) {
          const dnsRequest = `UsrDefDNS1=${enc(
            $scope.ptmData.primaryDNS
          )}&UsrDefDNS2=${enc($scope.ptmData.secondaryDNS)}`;
          const dnsResult = await $http.post(
            URL + "cgi_setUserDefinedDNS",
            dnsRequest
          );
          if ($scope.isEditMode) {
            const deleteRes = await deleteOldPtmConnection();
            if (!deleteRes || deleteRes.status !== 200) {
              alert("Problem Deleting Old PTM Connection");
              throw new Error("Problem Deleting Old PTM Connection");
            }
          }
          if (dnsResult.status !== 200) {
            console.log("Failed to set user-defined DNS.");
          }
        } else {
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
        if (window.$ && $("#ajaxLoaderSection").length) {
          $("#ajaxLoaderSection").hide();
        }
      }
    };

    $scope.saveEditedPtmConnection = async function() {
      try {
        await $scope.addPtmConnection();
      } catch (err) {
        console.error("Error saving edited connection:", err);
        alert(
          "Failed to save edited connection. Please check console for details."
        );
      }
    };

    $scope.updateParent = function() {
      // placeholder used by templates
    };

    $scope.isPrimaryDNSValid = function() {
      return $scope.patterns.ipv4.test($scope.ptmData.primaryDNS);
    };
    $scope.isSecondaryDNSValid = function() {
      if (!$scope.ptmData.secondaryDNS) return true;
      if ($scope.ptmData.secondaryDNS === $scope.ptmData.primaryDNS)
        return false;
      return $scope.patterns.ipv4.test($scope.ptmData.secondaryDNS);
    };
    $scope.resetPtmForm = function() {
      $scope.ptmData = defaultPtm();
    };
    $scope.validateDNSForm = function() {
      if (!$scope.ptmForm) return;
      const same =
        $scope.ptmData.secondaryDNS &&
        $scope.ptmData.secondaryDNS === $scope.ptmData.primaryDNS;
      $scope.ptmForm.$setValidity("dnsConflict", !same);
    };

    async function detectVlanFromLowerLayers(objName) {
      try {
        if (objName.includes("Device.Ethernet.VLANTermination")) return objName;
        const lowerResp = await $http.get(
          URL + `/cgi_get_filterbyparamval?Object=${objName}&LowerLayers=`
        );
        if (lowerResp.status !== 200 || !lowerResp.data.Objects?.length)
          return null;
        const lowerLayer = lowerResp.data.Objects[0].Param[0]?.ParamValue;
        if (!lowerLayer) return null;
        if (lowerLayer.includes("Device.Ethernet.VLANTermination"))
          return lowerLayer;
        return await detectVlanFromLowerLayers(lowerLayer.replace(/\.$/, ""));
      } catch (err) {
        console.warn("detectVlanFromLowerLayers failed for:", objName, err);
        return null;
      }
    }

    async function initializeConnectionType() {
      try {
        if ($scope.internetObject) {
          $scope.editIPInterface = $scope.internetObject.split(",")[0];

          const response = await $http.get(
            URL + `/cgi_get?Object=${$scope.editIPInterface}`
          );
          const objects = response.data["Objects"] || [];
          const ipInterfaceObj =
            objects.find((o) => o.ObjName === $scope.editIPInterface + ".") ||
            objects[0];
          const ipInterfaceData =
            objects.find((o) => o.ObjName.includes(".IPv4Address.")) || null;

          // Load NAT settings
          await loadNATSettings($scope.editIPInterface);

          const ipLowerLayers = ipInterfaceObj.Param.find(
            (p) => p.ParamName === "LowerLayers"
          )?.ParamValue;
          let vlanObjPath = null;
          if (ipLowerLayers) {
            vlanObjPath = await detectVlanFromLowerLayers(
              ipLowerLayers.replace(/\.$/, "")
            );
          }
          if (vlanObjPath) {
            try {
              const vlanResponse = await $http.get(
                URL + `/cgi_get?Object=${vlanObjPath.replace(/\.$/, "")}`
              );
              const vlanData = vlanResponse.data["Objects"]?.[0]?.Param || [];
              const vlanEnable = vlanData.find((p) => p.ParamName === "Enable")
                ?.ParamValue;
              const vlanId = vlanData.find((p) => p.ParamName === "VLANID")
                ?.ParamValue;
              $scope.ptmData.enableVlan =
                vlanEnable === "true" || vlanEnable === "1" ? "1" : "0";
              $scope.ptmData.vlanId = vlanId ? parseInt(vlanId, 10) : "";
            } catch (vlanErr) {
              console.warn("No VLAN data found:", vlanErr);
              $scope.ptmData.enableVlan = "0";
              $scope.ptmData.vlanId = "";
            }
          } else {
            $scope.ptmData.enableVlan = "0";
            $scope.ptmData.vlanId = "";
          }

          if (ipInterfaceData) {
            const addressingType = ipInterfaceData.Param.find(
              (x) => x.ParamName === "AddressingType"
            )?.ParamValue;
            if (addressingType) {
              switch (addressingType) {
                case "X_LANTIQ_COM_PPPoE":
                  $scope.ptmData.connectionType = "PPPoE";
                  await loadUserPassDataPtm();
                  break;
                case "Bridge":
                  $scope.ptmData.connectionType = "Bridge";
                  await loadBridgeConnectionsPtm();
                  break;
                case "Static":
                  $scope.ptmData.connectionType = "Static";
                  $scope.ptmData.subnetmask =
                    ipInterfaceData.Param.find(
                      (x) => x.ParamName === "SubnetMask"
                    )?.ParamValue || "";
                  $scope.ptmData.ipaddress =
                    ipInterfaceData.Param.find(
                      (x) => x.ParamName === "IPAddress"
                    )?.ParamValue || "";
                  await loadStaticDNSData();
                  break;
                default:
                  $scope.ptmData.connectionType = "DHCP";
              }
            }
          }
          // Check DNS checkbox if DNS values exist and it's PPPoE
          if ($scope.ptmData.connectionType === "PPPoE") {
            await loadUserDefinedDNS();
            if ($scope.ptmData.primaryDNS || $scope.ptmData.secondaryDNS) {
              $scope.ptmData.isUserDefinedDNS = true;
            }
          }
        }
      } catch (error) {
        console.error("Error initializing connection type:", error);
      }
    }

    $scope.$watch("ptmData.connectionType", function(newValue, oldValue) {
      if (
        $scope.form.accessType !== "PTM" &&
        $scope.form.accessType !== "ETH"
      )
        return;
      if (newValue === oldValue) return;
      if (newValue === "Static") {
        loadStaticDNSData();
      } else if (newValue === "Bridge") {
        loadBridgeConnectionsPtm();
      } else {
        loadUserPassDataPtm();
      }
    });

    async function loadNATSettings(ipInterface) {
      try {
        // Get the NAT settings for this interface
        const natResponse = await $http.get(
          URL + "cgi_get?Object=Device.NAT.InterfaceSetting"
        );

        if (natResponse.data && natResponse.data.Objects) {
          // Find NAT setting for this specific interface
          const interfaceNatSetting = natResponse.data.Objects.find((nat) => {
            const interfaceParam = nat.Param.find(
              (p) => p.ParamName === "Interface"
            );
            return interfaceParam && interfaceParam.ParamValue === ipInterface;
          });

          if (interfaceNatSetting) {
            const enableParam = interfaceNatSetting.Param.find(
              (p) => p.ParamName === "Enable"
            );
            const natTypeParam = interfaceNatSetting.Param.find(
              (p) => p.ParamName === "X_LANTIQ_COM_NATType"
            );

            // Update PTM data
            setTimeout(() => {
              $scope.$apply(() => {
                if (enableParam) {
                  $scope.ptmData.enableNAT =
                    enableParam.ParamValue === "true" ||
                    enableParam.ParamValue === "1"
                      ? "1"
                      : "0";
                }
                if (natTypeParam && $scope.ptmData.enableNAT === "1") {
                  $scope.ptmData.natType = natTypeParam.ParamValue;
                }
              });
            }, 100);
          }
        }
      } catch (error) {
        console.error("Error loading NAT settings:", error);
      }
    }

    initializeConnectionType();
  }

  // ------------------------------------------------------------
  // Edit mode setup and selection detection
  // ------------------------------------------------------------
  async function loadEditModeData() {
    if (!$scope.internetObject) return;
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

  function processEditModeData(data) {
    const ipObj = data["Objects"][0];
    const ipParams = ipObj.Param;
    const getParam = (name) =>
      ipParams.find((x) => x.ParamName === name)?.ParamValue || "";
    $scope.X_LANTIQ_COM_DefaultGateway = getParam(
      "X_LANTIQ_COM_DefaultGateway"
    );
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
    if (X_LANTIQ_COM_Description.includes("PTM")) {
      $scope.form.accessType = "PTM";
    } else if (X_LANTIQ_COM_Description.includes("ATM")) {
      $scope.form.accessType = "ATM";
    } else if (X_LANTIQ_COM_Description.includes("ETH")) {
      $scope.form.accessType = "ETH";
    }
  }

  async function initInterfaceAndDropdown() {
    if (!$scope.isEditMode) {
      $scope.form.accessType = "PTM";
    }
    await loadEditModeData();
    $scope.dataReady = true;
  }

  // Add this to the main controller, after $scope.form definition
  $scope.showDNSFields = function() {
    if ($scope.form.accessType === "ATM") {
      return (
        $scope.atmData.isUserDefinedDNS &&
        $scope.atmData.connectionType !== "Bridge" &&
        $scope.atmData.connectionType !== ""
      );
    } else if (
      $scope.form.accessType === "PTM" ||
      $scope.form.accessType === "ETH"
    ) {
      return (
        $scope.ptmData.isUserDefinedDNS &&
        $scope.ptmData.connectionType !== "Bridge" &&
        $scope.ptmData.connectionType !== ""
      );
    }
    return false;
  };

  $scope.$watch("form.accessType", function(newMode, oldMode) {
    if (newMode !== oldMode) {
      if (newMode === "PTM" || newMode === "ETH") {
        // Reset to PTM/ETH connection types
        $scope.connectionTypes = ["PPPoE", "Bridge", "DHCP", "Static"];
        $scope.resetPtmForm();
      }
    }
  });

  // ------------------------------------------------------------
  // Bootstrap
  // ------------------------------------------------------------
  async function bootstrap() {
    await initInterfaceAndDropdown();
    setupAtmLogic();
    setupPtmLogic();
  }

  bootstrap();
});
