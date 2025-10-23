myapp.controller("ptm_form_controller", function($scope, $http) {
  // --- preserved model (keeps your original fields) ---
  $scope.ptmData = {
    connectionType: "PPPoE",
    username: "",
    password: "",
    mac_address: "",
    mtu_size: "1492",
    macCloneEnabled: false,
    enableVlan: "0",
    vlanId: "",
    ipv6enable: "0",
    defaultGateway: "1",
    isUserDefinedDNS: false,
    primaryDNS: "",
    secondaryDNS: "",
    ipaddress: "",
    subnetmask: "",
    gatewayaddress: "",
    enableNAT: "1",
    natType: "Port Restricted Cone NAT",
  };

  $scope.connectionTypes = ["PPPoE", "Bridge", "DHCP", "Static"];
  $scope.bridgeConnections = [];

  $scope.editEthernetInterface = "";
  $scope.editPPPInterface = "";
  $scope.editIPInterface = "";
  $scope.editAlias = "";

  $scope.Passwordfieldstatus = false;

  $scope.patterns = {
    username: /^\d+$/,
    password: /^\d+$/,
    macAddress: /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/,
    mtuSize: /^\d+$/,
    ipv4: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
  };

  const baseLayer =
    $scope.$parent.form.selectionMode === "ETH"
      ? "Device.Ethernet.Interface.5."
      : "Device.PTM.Link.1.";

  // --- helpers ---
  function ensureRandomValue() {
    let v = localStorage.getItem("randomvalue");
    if (!v) {
      // use a stable-ish random integer between 10 and 9999
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
    // encode values for placing into the CGI long-string
    return encodeURIComponent(
      v === undefined || v === null ? "" : v.toString()
    );
  }

  // Builds DNS entries for static mode
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

  // --- CGI builders for each mode ---
  // 1) PPPoE (with/without VLAN)
  function buildPppoeRequest(model, wanLayer, randomValue) {
    const ipAlias = makeAlias("cpe-WEB-IPInterface", randomValue);
    const ethLinkAlias = makeAlias("cpe-WEB-EthernetLink", randomValue);
    const pppAlias = makeAlias("cpe-WEB-PPPInterface", randomValue);
    let vlanTermAlias = "";
    let req = "";

    // IP.Interface (points to PPP interface)
    req += `Object=Device.IP.Interface&Operation=Add&Enable=true&Alias=${enc(
      ipAlias
    )}&LowerLayers=Device.PPP.Interface.${enc(pppAlias)}`;

    // optional flags on IP.Interface
    if (model.ipv6enable !== undefined) {
      req += `&IPv6Enable=${enc(model.ipv6enable)}`;
    }
    if (model.mtu_size) {
      req += `&MaxMTUSize=${enc(model.mtu_size)}`;
    }
    if (model.defaultGateway !== undefined) {
      req += `&X_LANTIQ_COM_DefaultGateway=${enc(model.defaultGateway)}`;
    }

    // Ethernet Link (always created)
    req += `&Object=Device.Ethernet.Link&Operation=Add&Enable=true&Alias=${enc(
      ethLinkAlias
    )}&LowerLayers=${enc(baseLayer)}`;

    if (model.macCloneEnabled && model.mac_address) {
      req += `&X_INTEL_COM_MACCloning=true&MACAddress=${enc(
        model.mac_address
      )}`;
    }

    // PPP.Interface
    const username = appendTedata(model.username);
    req += `&Object=Device.PPP.Interface&Operation=Add&Enable=true&Alias=${enc(
      pppAlias
    )}&LowerLayers=Device.Ethernet.Link.${enc(ethLinkAlias)}`;
    if (model.mtu_size) {
      req += `&MaxMRUSize=${enc(model.mtu_size)}`;
    }
    if (username) {
      req += `&Username=${enc(username)}`;
    }
    if (model.password) {
      req += `&Password=${enc(model.password)}`;
    }

    // VLAN handling: if VLAN enabled we need VLAN termination object and adjust LowerLayers relationships.
    if (model.enableVlan === "1" && model.vlanId) {
      vlanTermAlias = makeAlias("cpe-WEB-EthernetVLANTermination", randomValue);

      // We must change the PPP lower layer to point to VLAN termination alias
      // So: IP.Interface -> PPP.Interface -> Ethernet.VLANTermination -> Ethernet.Link -> PTM.Link.1
      // To match reference order we add VLAN termination object and set PPP lower to Ethernet.VLANTermination
      // Adjust previously added PPP lower and Ethernet.Link LowerLayers remain as PTM
      // Replace PPP's LowerLayers reference to VLAN termination
      // (To keep single long string: we add the VLAN termination AFTER PPP and include the appropriate LowerLayers references)
      req += `&Object=Device.Ethernet.VLANTermination&Operation=Add&LowerLayers=Device.Ethernet.Link.${enc(
        ethLinkAlias
      )}&Alias=${enc(vlanTermAlias)}&Enable=1&VLANID=${enc(model.vlanId)}`;

      // Update PPP.Interface lower to point to VLAN termination (router-side expects PPP.Interface lower to be VLAN termination)
      // We must also ensure IP.Interface LowerLayers remains PPP.Interface alias (done).
      // To reflect PPP lower correctly in the single string, append a modify-like field by adding LowerLayers param in the PPP block above would have been ideal,
      // but since we already added PPP with LowerLayers=Device.Ethernet.Link.<ethLinkAlias>, we will append a second PPP block that sets LowerLayers to VLAN termination.
      // The router examples place LowerLayers on PPP creation to VLAN termination. To ensure exact ordering, build string such that VLAN termination appears and PPP creation includes correct LowerLayers.
      // For simplicity and matching your reference style, create PPP lower pointing to VLAN termination instead of eth link.
      // So we'll rebuild PPP.Interface creation replacing LowerLayers to VLAN termination.
      // For clarity here we append a PPP Interface 'fix' by adding Operation=Modify isn't desired; better to reconstruct PPP as correct:
      // Remove previously appended PPP segment and re-add it correctly: easiest is to craft PPP block correctly from the start when VLAN enabled.
      // (Implemented below: return a new properly ordered string instead of above when VLAN enabled.)
      // Implementation note: when VLAN is enabled we will return a different sequence built specifically for VLAN case.
    }

    // If VLAN enabled we will return specialized sequence to preserve correct ordering and LowerLayers references:
    if (model.enableVlan === "1" && model.vlanId) {
      const vlanAlias = makeAlias(
        "cpe-WEB-EthernetVLANTermination",
        randomValue
      );
      // IP.Interface -> PPP.Interface (lower will point to PPP which lower points to VLAN term)
      // Ethernet.Link as before
      // VLAN termination created and points to Ethernet.Link
      // PPP.Interface created with LowerLayers=Device.Ethernet.VLANTermination.<vlanAlias>
      // Keep IP.Interface LowerLayers pointing to PPP Interface as earlier.

      // rebuild string:
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
      )}&LowerLayers=${enc(baseLayer)}`;
      if (model.macCloneEnabled && model.mac_address) {
        r += `&X_INTEL_COM_MACCloning=true&MACAddress=${enc(
          model.mac_address
        )}`;
      }

      r += `&Object=Device.Ethernet.VLANTermination&Operation=Add&LowerLayers=Device.Ethernet.Link.${enc(
        ethLinkAlias
      )}&Alias=${enc(vlanAlias)}&Enable=1&VLANID=${enc(model.vlanId)}`;

      r += `&Object=Device.PPP.Interface&Operation=Add&Enable=true&Alias=${enc(
        pppAlias
      )}&LowerLayers=Device.Ethernet.VLANTermination.${enc(
        vlanAlias
      )}&MaxMRUSize=${enc(model.mtu_size)}&Username=${enc(
        appendTedata(model.username)
      )}&Password=${enc(model.password)}`;

      return r;
    }

    // Non-VLAN PPPoE path -> return req built earlier
    return req;
  }

  // 2) Bridge (with/without VLAN)
  function buildBridgeRequest(model, wanLayer, randomValue) {
    const ipAlias = makeAlias("cpe-WEB-IPInterface", randomValue);
    const ethLinkAlias = makeAlias("cpe-WEB-EthernetLink", randomValue);
    const bridgePortAlias = makeAlias(
      "cpe-WEB-BridgingBridge1Port",
      randomValue
    );
    let req = "";

    if (!model.selectedBridge || !model.selectedBridge.objName) {
      throw new Error("Bridge object name not found");
    }

    if (model.enableVlan === "1" && model.vlanId) {
      // IP.Interface -> Ethernet.VLANTermination -> Ethernet.Link -> Bridging.Port -> PTM.Link.1
      const vlanAlias = makeAlias(
        "cpe-WEB-EthernetVLANTermination",
        randomValue
      );

      req += `Object=Device.IP.Interface&Operation=Add&Enable=true&Alias=${enc(
        ipAlias
      )}&LowerLayers=Device.Ethernet.VLANTermination.${enc(vlanAlias)}`;

      req += `&Object=Device.Ethernet.Link&Operation=Add&Enable=true&Alias=${enc(
        ethLinkAlias
      )}&LowerLayers=${enc(
        model.selectedBridge.objName + ".Port." + bridgePortAlias
      )}`;

      req += `&Object=${enc(
        model.selectedBridge.objName
      )}.Port&Operation=Add&Enable=true&Alias=${enc(
        bridgePortAlias
      )}&LowerLayers=${enc(baseLayer)}`;

      req += `&Object=Device.Ethernet.VLANTermination&Operation=Add&TPID=&LowerLayers=Device.Ethernet.Link.${enc(
        ethLinkAlias
      )}&Alias=${enc(vlanAlias)}&Enable=1&VLANID=${enc(model.vlanId)}`;

      return req;
    }

    // Non-VLAN Bridge:
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
    )}&LowerLayers=${enc(baseLayer)}`;

    return req;
  }

  // 3) Static (with/without VLAN)
  function buildStaticRequest(model, wanLayer, randomValue) {
    const ipAlias = makeAlias("cpe-WEB-IPInterface", randomValue);
    const ethLinkAlias = makeAlias("cpe-WEB-EthernetLink", randomValue);
    const bridgePortAlias = makeAlias(
      "cpe-WEB-BridgingBridge1Port",
      randomValue
    );
    const dnsEntries = buildStaticDnsEntries($scope.staticDNSData, randomValue);

    if (model.enableVlan === "1" && model.vlanId) {
      const vlanAlias = makeAlias(
        "cpe-WEB-EthernetVLANTermination",
        randomValue
      );

      // IP.Interface -> Ethernet.VLANTermination -> Ethernet.Link -> Bridging.Port -> PTM.Link.1
      let req = "";
      req += `Object=Device.IP.Interface&Operation=Add&Enable=true&Alias=${enc(
        ipAlias
      )}&LowerLayers=Device.Ethernet.VLANTermination.${enc(vlanAlias)}`;

      req += `&Object=Device.Ethernet.Link&Operation=Add&Enable=true&Alias=${enc(
        ethLinkAlias
      )}&LowerLayers=${enc(baseLayer)}`;
      if (model.macCloneEnabled && model.mac_address) {
        req += `&X_INTEL_COM_MACCloning=true&MACAddress=${enc(
          model.mac_address
        )}`;
      }

      req += `&Object=Device.Ethernet.VLANTermination&Operation=Add&LowerLayers=Device.Ethernet.Link.${enc(
        ethLinkAlias
      )}&Alias=${enc(vlanAlias)}&Enable=1&VLANID=${enc(model.vlanId)}`;

      req += `&Object=Device.IP.Interface.${enc(
        ipAlias
      )}.IPv4Address&Operation=Add&IPAddress=${enc(
        model.ipaddress
      )}&SubnetMask=${enc(model.subnetmask)}`;

      req += `&Object=Device.Routing.Router.1.IPv4Forwarding&Operation=Add&Interface=Device.IP.Interface.${enc(
        ipAlias
      )}&Enable=true&GatewayIPAddress=${enc(model.gatewayaddress)}`;

      if (dnsEntries) {
        req += `&${dnsEntries}`;
      }

      return req;
    }

    // Non-VLAN static
    let req = "";
    req += `Object=Device.IP.Interface&Operation=Add&Enable=true&Alias=${enc(
      ipAlias
    )}&LowerLayers=${enc(wanLayer)}`; // wanLayer likely Device.X_LANTIQ_COM_NwHardware.WANGroup.X.MappingLowerLayer or Device.Ethernet.Link

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

    if (dnsEntries) {
      req += `&${dnsEntries}`;
    }

    return req;
  }

  // 4) DHCP (with/without VLAN)
  function buildDhcpRequest(model, wanLayer, randomValue) {
    const ipAlias = makeAlias("cpe-WEB-IPInterface", randomValue);
    const ethLinkAlias = makeAlias("cpe-WEB-EthernetLink", randomValue);

    if (model.enableVlan === "1" && model.vlanId) {
      const vlanAlias = makeAlias(
        "cpe-WEB-EthernetVLANTermination",
        randomValue
      );

      let req = "";
      req += `Object=Device.IP.Interface&Operation=Add&Enable=true&Alias=${enc(
        ipAlias
      )}&LowerLayers=Device.Ethernet.VLANTermination.${enc(
        vlanAlias
      )}&X_LANTIQ_COM_DefaultGateway=${enc(model.defaultGateway)}`;

      req += `&Object=Device.Ethernet.Link&Operation=Add&Enable=true&Alias=${enc(
        ethLinkAlias
      )}&LowerLayers=${enc(baseLayer)}`;

      if (model.macCloneEnabled && model.mac_address) {
        req += `&X_INTEL_COM_MACCloning=true&MACAddress=${enc(
          model.mac_address
        )}`;
      }

      req += `&Object=Device.DHCPv4.Client&Operation=Add&Interface=Device.IP.Interface.${enc(
        ipAlias
      )}`;

      req += `&Object=Device.Ethernet.VLANTermination&Operation=Add&LowerLayers=Device.Ethernet.Link.${enc(
        ethLinkAlias
      )}&Alias=${enc(vlanAlias)}&Enable=1&VLANID=${enc(model.vlanId)}`;

      return req;
    }

    // Non-VLAN DHCP
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

  // --- functions retained from original controller (load/edit helpers) ---
  async function loadUserPassData() {
    try {
      if ($scope.$parent.internetObject) {
        $scope.editIPInterface = $scope.$parent.internetObject.split(",")[0];
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

  async function deleteOldPtmConnection() {
    const DELETE_Request = `Object=${$scope.editIPInterface}&Operation=Del&Object=${$scope.editPPPInterface}&Operation=Del&Object=${$scope.editEthernetInterface}&Operation=Del`;
    return await $http.post(URL + "cgi_set", DELETE_Request);
  }

  async function loadStaticDNSData() {
    if ($scope.ptmData.connectionType !== "Static") return;
    try {
      const response = await $http.get(
        "https://192.168.1.1/cgi/cgi_get?Object=Device.DNS.Client.Server"
      );
      if (response.data && response.data.Objects) {
        const currentInterface = $scope.editIPInterface.replace(/\.$/, "");
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
    localStorage.setItem("staticDNSData", JSON.stringify($scope.staticDNSData));
  };

  async function loadUserDefinedDNS() {
    try {
      const response = await $http.get(URL + "cgi_get_dns");
      const dnsData = response.data.split("\n");
      dnsData.forEach((line) => {
        const [key, value] = line.split("=");
        if (key === "UsrDefDNS1") $scope.ptmData.primaryDNS = value || "";
        if (key === "UsrDefDNS2") $scope.ptmData.secondaryDNS = value || "";
      });
      $scope.updateParent();
    } catch (error) {
      console.error("Error loading user-defined DNS data:", error);
    }
  }

  // --- main add connection flow ---
  $scope.addNewConnection = async function() {
    try {
      $("#ajaxLoaderSection").show();

      const randomValue = ensureRandomValue();

      // keep request for PTM reference compatibility
      let WanGroupMappingLayer = baseLayer;

      if ($scope.$parent.form.selectionMode === "PTM") {
        const lowerLayerRes = await $http.get(
          URL +
            `cgi_get_fillparams?Object=Device.X_LANTIQ_COM_NwHardware.WANGroup.1&MappingLowerLayer=`
        );
        WanGroupMappingLayer =
          lowerLayerRes.data["Objects"][0].Param[0].ParamValue;
      }

      let connectionRequest = "";
      const model = $scope.ptmData;

      if (model.connectionType === "PPPoE") {
        connectionRequest = buildPppoeRequest(
          model,
          WanGroupMappingLayer,
          randomValue
        );
      } else if (model.connectionType === "Bridge") {
        connectionRequest = buildBridgeRequest(
          model,
          WanGroupMappingLayer,
          randomValue
        );
      } else if (model.connectionType === "Static") {
        connectionRequest = buildStaticRequest(
          model,
          WanGroupMappingLayer,
          randomValue
        );
      } else if (model.connectionType === "DHCP") {
        connectionRequest = buildDhcpRequest(
          model,
          WanGroupMappingLayer,
          randomValue
        );
      } else {
        throw new Error("Unsupported connection type");
      }

      // If editing, attempt deletion of old connection first (preserve existing edit logic)
      if ($scope.$parent.isEditMode) {
        const deleteRes = await deleteOldPtmConnection();
        if (!deleteRes || deleteRes.status !== 200) {
          alert("Problem Deleting Old PTM Connection");
          throw new Error("Problem Deleting Old PTM Connection");
        }
      }

      const addResult = await $http.post(URL + "cgi_set", connectionRequest);

      if (addResult.status === 200) {
        // persist user-defined DNS if provided
        const dnsRequest = `UsrDefDNS1=${enc(
          $scope.ptmData.primaryDNS
        )}&UsrDefDNS2=${enc($scope.ptmData.secondaryDNS)}`;
        const dnsResult = await $http.post(
          URL + "cgi_setUserDefinedDNS",
          dnsRequest
        );
        if (dnsResult.status !== 200) {
          alert("Failed to set user-defined DNS.");
        }
        $scope.$emit("connectionAdded", true);
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
      $("#ajaxLoaderSection").hide();
    }
  };

  $scope.$on("addPtmConnection", function() {
    $scope.addNewConnection();
  });

  // initialization & edit helpers (preserved and cleaned)
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

      await loadUserDefinedDNS();
    } catch (error) {
      console.error("Error initializing connection type:", error);
    }
  }

  initializeConnectionType();

  // watchers & small helpers (preserved)
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
      isUserDefinedDNS: false,
      primaryDNS: "",
      secondaryDNS: "",
      ipaddress: "",
      subnetmask: "",
      gatewayaddress: "",
      enableNAT: "1",
      natType: "Port Restricted Cone NAT",
    };
    $scope.updateParent();
  };

  $scope.$on("resetPtmForm", function() {
    $scope.resetForm();
  });

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
