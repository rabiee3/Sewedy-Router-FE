myapp.controller("iptv", function($scope, $http) {
  $scope.iptvdata = {
    selectedLan: null,
    enableVlan: "0",
    lans: [
      { id: "eth0_1", name: "LAN1" },
      { id: "eth0_2", name: "LAN2" },
      { id: "eth0_3", name: "LAN3" },
      { id: "eth0_4", name: "LAN4" },
    ],
    atmLinks: [],
  };

  $scope.addnewIptvConnection = async function() {
    if (!$scope.iptvdata.selectedLan) {
      alert("Please select a LAN first.");
      return;
    }

    debugger;
    const response = await $http.get(URL + "cgi_get?Object=Device.ATM.Link");
    const objects = response.data.Objects || [];
    $scope.iptvdata.atmLinks = objects.filter((obj) =>
      /^Device\.ATM\.Link\.\d+$/.test(obj.ObjName)
    );

    if (!$scope.iptvdata.atmLinks || $scope.iptvdata.atmLinks.length <= 0) {
      alert("No ATM Links Found, please create at least one ATM Connection");
      return;
    }

    const selectedLanId = $scope.iptvdata.selectedLan.id;

    const remainingLans = $scope.iptvdata.lans
      .map((lan) => lan.id)
      .filter((id) => id !== selectedLanId);

    remainingLans.push("eth0_5");
    const remainingLansEncoded = encodeURIComponent(remainingLans.join(","));

    try {
      // STEP 1 - Modify the existing bridge to remove selected LAN
      const req1 = await $http.post(
        URL + "cgi_set",
        `Object=Device.Bridging.Bridge.1&Operation=Modify&X_LANTIQ_COM_BridgeMembers=${remainingLansEncoded}`
      );
      if (req1.status !== 200) throw new Error("Failed to modify main bridge");

      // STEP 2 - Create new bridge and add selected LAN to it
      const req2 = await $http.post(
        URL + "cgi_set",
        `Object=Device.Bridging.Bridge&Operation=Add&X_LANTIQ_COM_BridgeMembers=${selectedLanId}`
      );
      if (req2.status !== 200) throw new Error("Failed to create new bridge");

      // STEP 3 - Generate random number
      let randomNumber = parseInt(localStorage.getItem("randomvalue"));
      if (isNaN(randomNumber)) {
        randomNumber = Math.floor(Math.random() * 1000);
      }

      // STEP 4 - Create IP Interface and VLAN chain
      const req3 = await $http.post(
        URL + "cgi_set",
        `Object=Device.ATM.Link.1.QoS&Operation=Modify&QoSClass=UBR&PeakCellRate=0&MaximumBurstSize=0&SustainableCellRate=0` +
          `&Object=Device.IP.Interface&Operation=Add&Enable=true&Alias=cpe-WEB-IPInterface-${randomNumber}&LowerLayers=Device.Ethernet.VLANTermination.cpe-WEB-EthernetVLANTermination-${randomNumber}` +
          `&Object=Device.Ethernet.Link&Operation=Add&Enable=true&Alias=cpe-WEB-EthernetLink-${randomNumber}&LowerLayers=Device.Bridging.Bridge.2.Port.cpe-WEB-BridgingBridge2Port-${randomNumber}` +
          `&Object=Device.Bridging.Bridge.2.Port&Operation=Add&Enable=true&Alias=cpe-WEB-BridgingBridge2Port-${randomNumber}&LowerLayers=Device.ATM.Link.1` +
          `&Object=Device.Ethernet.VLANTermination&Operation=Add&LowerLayers=Device.Ethernet.Link.cpe-WEB-EthernetLink-${randomNumber}&Alias=cpe-WEB-EthernetVLANTermination-${randomNumber}&Enable=1&VLANID=301`
      );
      if (req3.status !== 200)
        throw new Error("Failed to create IPTV interface chain");

      alert("IPTV connection created successfully for " + selectedLanId);
    } catch (error) {
      alert("IPTV setup failed: " + error.message);
    }
  };
});
