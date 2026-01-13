myapp.controller("ptm_form_controller", function($scope, $http, $routeParams) {
  // --- model (unchanged) ---
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

  // --- helpers ---
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

  // --- builders (use wanLayer passed from caller) ---

  // PPPoE builder
  function buildPppoeRequest(model, wanLayer, randomValue) {
    const ipAlias = makeAlias("cpe-WEB-IPInterface", randomValue);
    const ethLinkAlias = makeAlias("cpe-WEB-EthernetLink", randomValue);
    const pppAlias = makeAlias("cpe-WEB-PPPInterface", randomValue);

    // VLAN case: build sequence where PPP lower is VLAN termination
    if (model.enableVlan === "1" && model.vlanId) {
      const vlanAlias = makeAlias(
        "cpe-WEB-EthernetVLANTermination",
        randomValue
      );

      let r = "";
      // IP.Interface -> lower = PPP.Interface.<pppAlias>
      r += `Object=Device.IP.Interface&Operation=Add&Enable=true&Alias=${enc(
        ipAlias
      )}&LowerLayers=Device.PPP.Interface.${enc(pppAlias)}&IPv6Enable=${enc(
        model.ipv6enable
      )}&MaxMTUSize=${enc(model.mtu_size)}&X_LANTIQ_COM_DefaultGateway=${enc(
        model.defaultGateway
      )}`;

      // Ethernet.Link -> lower = wanLayer (PTM or ETH base)
      r += `&Object=Device.Ethernet.Link&Operation=Add&Enable=true&Alias=${enc(
        ethLinkAlias
      )}&LowerLayers=${enc(wanLayer)}`;
      if (model.macCloneEnabled && model.mac_address) {
        r += `&X_INTEL_COM_MACCloning=true&MACAddress=${enc(
          model.mac_address
        )}`;
      }

      // VLAN termination -> lower = Ethernet.Link.<ethLinkAlias>
      r += `&Object=Device.Ethernet.VLANTermination&Operation=Add&LowerLayers=Device.Ethernet.Link.${enc(
        ethLinkAlias
      )}&Alias=${enc(vlanAlias)}&Enable=1&VLANID=${enc(model.vlanId)}`;

      // PPP.Interface -> lower = Ethernet.VLANTermination.<vlanAlias>
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

    // Non-VLAN PPPoE path
    let req = "";
    req += `Object=Device.IP.Interface&Operation=Add&Enable=true&Alias=${enc(
      ipAlias
    )}&LowerLayers=Device.PPP.Interface.${enc(pppAlias)}&IPv6Enable=${enc(
      model.ipv6enable
    )}&MaxMTUSize=${enc(model.mtu_size)}&X_LANTIQ_COM_DefaultGateway=${enc(
      model.defaultGateway
    )}`;

    // Ethernet.Link -> lower = wanLayer
    req += `&Object=Device.Ethernet.Link&Operation=Add&Enable=true&Alias=${enc(
      ethLinkAlias
    )}&LowerLayers=${enc(wanLayer)}`;
    if (model.macCloneEnabled && model.mac_address) {
      req += `&X_INTEL_COM_MACCloning=true&MACAddress=${enc(
        model.mac_address
      )}`;
    }

    // PPP.Interface -> lower = Ethernet.Link.<ethLinkAlias>
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

  // Bridge builder
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

    // VLAN Bridge sequence: IP.Interface -> Ethernet.VLANTermination -> Ethernet.Link -> Bridge.Port -> base physical
    if (model.enableVlan === "1" && model.vlanId) {
      const vlanAlias = makeAlias(
        "cpe-WEB-EthernetVLANTermination",
        randomValue
      );

      let r = "";
      r += `Object=Device.IP.Interface&Operation=Add&Enable=true&Alias=${enc(
        ipAlias
      )}&LowerLayers=Device.Ethernet.VLANTermination.${enc(vlanAlias)}`;

      // Ethernet.Link -> LowerLayers = <BridgeObj>.Port.<bridgePortAlias> (the link sits on bridging port)
      r += `&Object=Device.Ethernet.Link&Operation=Add&Enable=true&Alias=${enc(
        ethLinkAlias
      )}&LowerLayers=${enc(
        model.selectedBridge.objName + ".Port." + bridgePortAlias
      )}`;

      // Bridging.Port -> LowerLayers = wanLayer (physical base)
      r += `&Object=${enc(
        model.selectedBridge.objName
      )}.Port&Operation=Add&Enable=true&Alias=${enc(
        bridgePortAlias
      )}&LowerLayers=${enc(wanLayer)}`;

      // VLAN term -> lower = Ethernet.Link.<ethLinkAlias>
      r += `&Object=Device.Ethernet.VLANTermination&Operation=Add&TPID=&LowerLayers=Device.Ethernet.Link.${enc(
        ethLinkAlias
      )}&Alias=${enc(vlanAlias)}&Enable=1&VLANID=${enc(model.vlanId)}`;

      return r;
    }

    // Non-VLAN Bridge sequence
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

  // Static builder
  function buildStaticRequest(model, wanLayer, randomValue) {
    const ipAlias = makeAlias("cpe-WEB-IPInterface", randomValue);
    const ethLinkAlias = makeAlias("cpe-WEB-EthernetLink", randomValue);
    const dnsEntries = buildStaticDnsEntries($scope.staticDNSData, randomValue);

    // VLAN static: IP.Interface -> Ethernet.VLANTermination -> Ethernet.Link -> base physical
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

    // Non-VLAN static (IP.Interface and Ethernet.Link point to wanLayer)
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

  // DHCP builder
  function buildDhcpRequest(model, wanLayer, randomValue) {
    const ipAlias = makeAlias("cpe-WEB-IPInterface", randomValue);
    const ethLinkAlias = makeAlias("cpe-WEB-EthernetLink", randomValue);

    // VLAN DHCP: IP.Interface lower -> VLAN term
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

  // --- preserved helpers/loaders (unchanged) ---
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

  // ---------- Recursive Layer Traversal (Skip ATM/PTM/DSL Layers) ----------
  async function getConnectionObjects(ipInterface) {
    const objectsToDelete = [];

    async function traceLayers(layer) {
      if (!layer) return;
      const cleanLayer = layer.replace(/\.$/, "");

      // Skip ATM/PTM/DSL layers
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
      $scope.$parent.internetObject.split(",")[0]
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

  // --- main add connection flow (decide wanLayer here, then call builders) ---
  $scope.addNewConnection = async function() {
    try {
      $("#ajaxLoaderSection").show();

      const randomValue = ensureRandomValue();

      // decide wanLayer:
      // - If ETH mode, always use the fixed physical ethernet interface
      // - If PTM mode, query WANGroup mapping (preserve existing PTM behavior)
      let wanLayer = "Device.PTM.Link.1.";
      if ($scope.$parent.form && $scope.$parent.form.selectionMode === "ETH") {
        wanLayer = "Device.Ethernet.Interface.5.";
      } else {
        // PTM: retain the existing mapping retrieval
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
        if (dnsResult.status !== 200) {
          console.log("Failed to set user-defined DNS.");
        }

        if ($scope.$parent.isEditMode) {
          const deleteRes = await deleteOldPtmConnection();
          if (!deleteRes || deleteRes.status !== 200) {
            alert("Problem Deleting Old PTM Connection");
            $("#ajaxLoaderSection").hide();
            throw new Error("Problem Deleting Old PTM Connection");
          }
        }

        $("#ajaxLoaderSection").hide();
        $scope.$emit("connectionAdded", true);
      } else {
        if (addResult.data?.Objects?.[0]?.Param?.[0]?.ParamValue) {
          alert(addResult.data.Objects[0].Param[0].ParamValue);
        } else {
          alert("Something wrong happened");
        }
        if (window.$ && $("#ajaxLoaderSection").length) {
          $("#ajaxLoaderSection").hide();
        }
      }
    } catch (error) {
      console.error("Error adding new connection:", error);
      if (window.$ && $("#ajaxLoaderSection").length) {
        $("#ajaxLoaderSection").hide();
      }
      alert("Failed to add connection.");
    }
  };

  //save edit
  $scope.saveEditedConnection = async function() {
    try {
      const pathParts = ($routeParams.path || "").split(",");
      const oldIPInterface = pathParts[0];
      const oldIPv4Address = pathParts[1];
      $scope.oldIPInterface = oldIPInterface;
      $scope.oldIPv4Address = oldIPv4Address;

      const oldType = $scope.oldConnectionType || $scope.ptmData.connectionType;
      const newType = $scope.ptmData.connectionType;

      // Add the new one first
      await $scope.addNewConnection();

      // If same type → remove old
      if (oldType === newType && oldIPInterface) {
        const ifaceNumMatch = oldIPInterface.match(/\d+$/);
        const ifaceNum = ifaceNumMatch ? ifaceNumMatch[0] : "";
        const deletePayload = [];

        deletePayload.push(`Object=${oldIPInterface}&Operation=Del`);

        if (oldType === "PPPoE") {
          deletePayload.push(
            `Object=Device.PPP.Interface.${ifaceNum}.&Operation=Del`,
            `Object=Device.Ethernet.Link.${ifaceNum}.&Operation=Del`
          );
        } else if (oldType === "DHCP" || oldType === "Static") {
          deletePayload.push(
            `Object=Device.Ethernet.Link.${ifaceNum}.&Operation=Del`
          );
        }

        const deleteCgi = deletePayload.join("&");
        const res = await $http.post(URL + "cgi_set", deleteCgi);
        if (res.status !== 200) {
          throw new Error("Failed to delete old connection");
        }

        console.log("Old connection deleted successfully:", deleteCgi);
      }
      $("#ajaxLoaderSection").hide();
      alert("Connection saved successfully.");
    } catch (err) {
      console.error("Error saving edited connection:", err);
      $("#ajaxLoaderSection").hide();
      alert(
        "Failed to save edited connection. Please check console for details."
      );
    }
  };

  $scope.$on("addPtmConnection", function() {
    $scope.addNewConnection();
  });

  $scope.$on("editPtmConnection", async function(event, args) {
    try {
      await $scope.saveEditedConnection(args.DeviceIpInterface);
      $scope.$emit("connectionAdded", true);
    } catch (err) {
      console.error("Error editing connection:", err);
      alert("Failed to edit PTM connection: " + err.message);
    }
  });

  // ---------- VLAN Detection (Enhanced) ----------
  async function detectVlanFromLowerLayers(objName) {
    try {
      // If this layer is VLAN termination → we’re done
      if (objName.includes("Device.Ethernet.VLANTermination")) return objName;

      // Step 1: Get LowerLayers of the given object (could be IP.Interface or PPP.Interface)
      const lowerResp = await $http.get(
        URL + `/cgi_get_filterbyparamval?Object=${objName}&LowerLayers=`
      );
      if (lowerResp.status !== 200 || !lowerResp.data.Objects?.length)
        return null;

      const lowerLayer = lowerResp.data.Objects[0].Param[0]?.ParamValue;
      if (!lowerLayer) return null;

      // If this layer is VLAN termination → we’re done
      if (lowerLayer.includes("Device.Ethernet.VLANTermination"))
        return lowerLayer;

      // Otherwise, recursively check next layer
      return await detectVlanFromLowerLayers(lowerLayer.replace(/\.$/, ""));
    } catch (err) {
      console.warn("detectVlanFromLowerLayers failed for:", objName, err);
      return null;
    }
  }

  // initialization & edit helpers (unchanged)
  async function initializeConnectionType() {
    try {
      if ($scope.$parent.internetObject) {
        $scope.editIPInterface = $scope.$parent.internetObject.split(",")[0];
        const response = await $http.get(
          URL + `/cgi_get?Object=${$scope.editIPInterface}`
        );
        const objects = response.data["Objects"] || [];
        const ipInterfaceObj =
          objects.find((o) => o.ObjName === $scope.editIPInterface + ".") ||
          objects[0];
        const ipInterfaceData =
          objects.find((o) => o.ObjName.includes(".IPv4Address.")) || null;

        // ---------- VLAN Detection ----------
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

        // ---------- Connection Type Detection ----------
        if (ipInterfaceData) {
          const addressingType = ipInterfaceData.Param.find(
            (x) => x.ParamName === "AddressingType"
          )?.ParamValue;
          if (addressingType) {
            switch (addressingType) {
              case "X_LANTIQ_COM_PPPoE":
                $scope.ptmData.connectionType = "PPPoE";
                await loadUserPassData();
                break;
              case "Bridge":
                $scope.ptmData.connectionType = "Bridge";
                await loadBridgeConnections();
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
                await loadStaticDNSData();
                break;
              default:
                $scope.ptmData.connectionType = "DHCP";
            }
          }
        }

        await loadUserDefinedDNS();
      }
    } catch (error) {
      console.error("Error initializing connection type:", error);
    }
  }

  initializeConnectionType();

  // watchers & small helpers (unchanged)
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
