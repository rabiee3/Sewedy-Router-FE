myapp.controller("iptv", function($scope, $http) {
  $scope.iptvdata = {
    selectedLan: null,
    enableVlan: "0",
    lans: [],
  };

  // --------------------------
  // 1- Fill available LANs list
  // --------------------------
  $scope.fillLansList = async function() {
    try {
      const res = await $http.get(
        URL +
          "cgi_get_filterbyparamval?Object=Device.Bridging.Bridge.1&X_LANTIQ_COM_BridgeMembers="
      );

      if (res.status !== 200)
        throw new Error("Failed to get available LANs list");

      if (res.data.Objects?.length > 0) {
        $scope.iptvdata.lans = res.data.Objects[0].Param[0].ParamValue.split(
          ","
        )
          .sort()
          .filter((x) => x !== "eth0_5") // hide eth0_5
          .map((item) => ({
            id: item,
            name: "LAN" + item.slice(-1),
          }));
      }
    } catch (err) {
      alert("Error loading LAN list: " + err.message);
    }
  };

  $scope.fillLansList();

  // --------------------------
  // 2- Add new IPTV connection
  // --------------------------
  $scope.addnewIptvConnection = async function() {
    if (!$scope.iptvdata.selectedLan) {
      alert("Please select a LAN first.");
      return;
    }

    try {
      let deviceIpInterface = null;
      let lowerlayer = null;
      let wanType = "UNKNOWN";

      // Step 1 - Get default gateway interface
      const req1 = await $http.get(
        URL +
          "cgi_get_filterbyparamval?Object=Device.IP.Interface&X_LANTIQ_COM_DefaultGateway=true"
      );
      if (req1.status !== 200)
        throw new Error("Step 1 failed: Unable to get default gateway");

      if (!req1.data.Objects?.length)
        throw new Error("No default gateway interface found");

      deviceIpInterface = req1.data.Objects[0].ObjName;

      // Step 2 - Get its lower layer
      const req2 = await $http.get(
        URL +
          `cgi_get_filterbyparamval?Object=${deviceIpInterface}&LowerLayers=`
      );
      if (req2.status !== 200)
        throw new Error("Step 2 failed: Unable to get lower layer");

      lowerlayer = req2.data.Objects?.[0]?.Param?.[0]?.ParamValue;
      if (!lowerlayer)
        throw new Error("No lower layer found for default gateway");

      // Step 3 - Determine WAN type
      if (lowerlayer.includes("PTM")) {
        wanType = "PTM";
      } else if (lowerlayer.includes("ATM")) {
        wanType = "ATM";
      } else if (lowerlayer.includes("Ethernet.Interface")) {
        wanType = "ETH";
      } else {
        // go deeper until we hit a known layer
        for (let i = 0; i < 2; i++) {
          const deeper = await $http.get(
            URL + `cgi_get_filterbyparamval?Object=${lowerlayer}&LowerLayers=`
          );
          if (deeper.status !== 200)
            throw new Error(`Failed to get lower layer (depth ${i + 1})`);

          lowerlayer = deeper.data.Objects?.[0]?.Param?.[0]?.ParamValue;
          if (!lowerlayer) break;

          if (lowerlayer.includes("ATM")) {
            wanType = "ATM";
            break;
          } else if (lowerlayer.includes("PTM")) {
            wanType = "PTM";
            break;
          } else if (lowerlayer.includes("Ethernet.Interface")) {
            wanType = "ETH";
            break;
          }
        }
      }

      if (wanType === "UNKNOWN")
        throw new Error("Could not determine WAN type");

      lowerlayer = lowerlayer.replace(/\.$/, ""); // remove trailing dot

      const selectedLanId = $scope.iptvdata.selectedLan.id;
      const remainingLans = $scope.iptvdata.lans
        .map((lan) => lan.id)
        .filter((id) => id !== selectedLanId);
      remainingLans.push("eth0_5");

      const remainingLansEncoded = encodeURIComponent(remainingLans.join(","));

      // Step 4 - Modify main bridge
      const modBridge = await $http.post(
        URL + "cgi_set",
        `Object=Device.Bridging.Bridge.1&Operation=Modify&X_LANTIQ_COM_BridgeMembers=${remainingLansEncoded}`
      );
      if (modBridge.status !== 200)
        throw new Error("Step 4 failed: Modify main bridge");

      // Step 5 - Create new bridge for selected LAN
      const addBridge = await $http.post(
        URL + "cgi_set",
        `Object=Device.Bridging.Bridge&Operation=Add&X_LANTIQ_COM_BridgeMembers=${selectedLanId}`
      );
      if (addBridge.status !== 200)
        throw new Error("Step 5 failed: Create new bridge");

      // Step 6 - Build IPTV chain based on WAN type
      let randomNumber = parseInt(localStorage.getItem("randomvalue"));
      if (isNaN(randomNumber)) {
        randomNumber = Math.floor(Math.random() * 100);
        localStorage.setItem("randomvalue", randomNumber);
      }

      let connRequest = "";

      // Optional ATM QoS
      if (wanType === "ATM") {
        const qosObj = lowerlayer + ".QoS";
        connRequest += `Object=${qosObj}&Operation=Modify&QoSClass=UBR&PeakCellRate=0&MaximumBurstSize=0&SustainableCellRate=0`;
      }

      // Common IPTV chain for all WAN types
      connRequest += `&Object=Device.IP.Interface&Operation=Add&Enable=true&Alias=cpe-WEB-IPInterface-${randomNumber}&LowerLayers=Device.Ethernet.VLANTermination.cpe-WEB-EthernetVLANTermination-${randomNumber}`;
      connRequest += `&Object=Device.Ethernet.Link&Operation=Add&Enable=true&Alias=cpe-WEB-EthernetLink-${randomNumber}&LowerLayers=Device.Bridging.Bridge.2.Port.cpe-WEB-BridgingBridge2Port-${randomNumber}`;
      connRequest += `&Object=Device.Bridging.Bridge.2.Port&Operation=Add&Enable=true&Alias=cpe-WEB-BridgingBridge2Port-${randomNumber}&LowerLayers=${lowerlayer}`;
      connRequest += `&Object=Device.Ethernet.VLANTermination&Operation=Add&LowerLayers=Device.Ethernet.Link.cpe-WEB-EthernetLink-${randomNumber}&Alias=cpe-WEB-EthernetVLANTermination-${randomNumber}&Enable=1&VLANID=301`;
      

      const finalReq = await $http.post(URL + "cgi_set", connRequest);
      if (finalReq.status !== 200)
        throw new Error("Step 6 failed: IPTV chain creation failed");

      alert(
        `IPTV connection created successfully for ${selectedLanId} (WAN type: ${wanType})`
      );
    } catch (error) {
      alert("IPTV setup failed: " + error.message);
    }
  };
});
