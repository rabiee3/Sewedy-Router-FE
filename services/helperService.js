myapp.service("helperService", function($http) {
  this.getIptvInterfaceObject = function(data) {
    if (!Array.isArray(data)) return null;

    for (const item of data) {
      // Only consider main interface objects, not sub-objects like .IPv4Address or .Stats
      //if (!/^Device\.IP\.Interface\.\d+$/.test(item.ObjName)) continue;

      // Look for Alias parameter
      const aliasParam = item.Param?.find((p) => p.ParamName === "Alias");
      if (aliasParam && aliasParam.ParamValue.includes("IPTV")) {
        return item;
      }
    }

    return null;
  };

  this.checkExistingIPTV = async function() {
    const req1 = await $http.get(
      URL + "cgi_get_filterbyparamval?Object=Device.IP.Interface"
    );
    if (req1.status !== 200) {
      throw new Error("Step 1 failed: Unable to Device IP Interfaces");
    }
    return this.getIptvInterfaceObject(req1.data.Objects);
  };

  this.getBridgeInfo = async function(existingConnection) {
    if (!existingConnection) return;

    const req = await $http.get(
      URL + "cgi_get_filterbyparamval?Object=Device.Bridging.Bridge"
    );
    if (req.status !== 200) {
      throw new Error("Step 1 failed: Unable to get bridge conections");
    }

    const name = existingConnection.Param.find((x) => x.ParamName == "Name")
      .ParamValue;

    for (const entry of req.data.Objects) {
      const members = entry.Param?.find(
        (p) => p.ParamName === "X_LANTIQ_COM_BridgeMembers"
      );
      if (members && members.ParamValue.includes(name)) {
        const ethMembers = members.ParamValue.split(",")
          .map((v) => v.trim())
          .filter((v) => v.startsWith("eth"));
        return {
          bridgeName: entry.ObjName,
          ethMembers,
        };
      }
    }
    return null;
  };

  this.getLansList = async function() {
    try {
      const res = await $http.get(
        URL +
          "cgi_get_filterbyparamval?Object=Device.Bridging.Bridge.1&X_LANTIQ_COM_BridgeMembers="
      );

      if (res.status !== 200)
        throw new Error("Failed to get available LANs list");

      if (res.data.Objects?.length > 0) {
        return res.data.Objects[0].Param[0].ParamValue.split(",")
          .sort()
          .filter((x) => x !== "eth0_5")
          .map((item) => ({
            id: item,
            name: "LAN" + item.slice(-1),
          }));
      }
    } catch (err) {
      alert("Error loading LAN list: " + err.message);
    }
  };

  this.removeExistingIPTVConnection = async function() {
    if (window.$ && $("#ajaxLoaderSection").length) {
      $("#ajaxLoaderSection").show();
    }
    const existingLans = await this.getLansList();
    const existingIPTVConnection = await this.checkExistingIPTV();

    if (!existingIPTVConnection) return;

    const bridgeInfo = await this.getBridgeInfo(existingIPTVConnection);

    if (!bridgeInfo) return;

    // 1- get lower1 ex: Device.Ethernet.VLANTermination.1
    const lower1 = await $http.get(
      URL +
        `cgi_get_filterbyparamval?Object=${existingIPTVConnection.ObjName}&LowerLayers=`
    );
    if (lower1.status !== 200) {
      $("#ajaxLoaderSection").hide();
      throw new Error("Step 1 failed: Unable to Device IP Interfaces");
    }

    const vlanTermination = lower1.data.Objects[0].Param[0].ParamValue;

    // 2- get lower2 ex: Device.Ethernet.Link.15
    const lower2 = await $http.get(
      URL + `cgi_get_filterbyparamval?Object=${vlanTermination}&LowerLayers=`
    );
    if (lower2.status !== 200) {
      $("#ajaxLoaderSection").hide();
      throw new Error("Step 1 failed: Unable to Device IP Interfaces");
    }

    const ethLink = lower2.data.Objects[0].Param[0].ParamValue;

    // 3- get lower3 ex: Device.Bridging.Bridge.2.Port.3
    const lower3 = await $http.get(
      URL + `cgi_get_filterbyparamval?Object=${ethLink}&LowerLayers=`
    );
    if (lower3.status !== 200) {
      $("#ajaxLoaderSection").hide();
      throw new Error("Step 1 failed: Unable to Device IP Interfaces");
    }

    const bridgePort = lower3.data.Objects[0].Param[0].ParamValue;

    //4- delete IP interface with its (VLAN / Ethernet Link / Bridge Port)
    const delIpInterface = await $http.post(
      URL + "cgi_set",
      `Object=${existingIPTVConnection.ObjName}&Operation=Del&Object=${vlanTermination}&Operation=Del&Object=${ethLink}&Operation=Del&Object=${bridgePort}&Operation=Del`
    );
    if (delIpInterface.status !== 200) {
      $("#ajaxLoaderSection").hide();
      throw new Error("Failed to delete IP Interface");
    }

    //5- delete LAN bridge 2
    const delLANBridge = await $http.post(
      URL + "cgi_set",
      `Object=Device.Bridging.Bridge.2&Operation=Del&Operation=Del`
    );
    if (delLANBridge.status !== 200) {
      $("#ajaxLoaderSection").hide();
      throw new Error("Failed to delete attached LAN Bridge");
    }

    const remainingLans = existingLans
      .map((lan) => lan.id)
      .filter((id) => id !== null);
    remainingLans.push(bridgeInfo.ethMembers[0]);
    remainingLans.push("eth0_5");

    const remainingLansEncoded = encodeURIComponent(remainingLans.join(","));

    // 6 - Modify main bridge
    const modBridge = await $http.post(
      URL + "cgi_set",
      `Object=Device.Bridging.Bridge.1&Operation=Modify&X_LANTIQ_COM_BridgeMembers=${remainingLansEncoded}`
    );
    if (modBridge.status !== 200) {
      $("#ajaxLoaderSection").hide();
      throw new Error("failed to Modify main bridge");
    } else {
      //end refresh the screen
      alert("IPTV removed Successfully");
    }
  };
});
