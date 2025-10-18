myapp.controller("iptv", function($scope, $http) {
  $scope.iptvdata = {
    selectedLan: null,
    enableVlan: "0",
    lans: [],
    atmLinks: [],
  };

  $scope.fillLansList = async function() {
    //fill the dropdown list with available bridge 1 LANs
    // cgi_get?Object=Device.Bridging.Bridge Device.Bridging.Bridge.1
    const req1 = await $http.get(
      URL +
        "cgi_get_filterbyparamval?Object=Device.Bridging.Bridge.1&X_LANTIQ_COM_BridgeMembers="
    );
    if (req1.status !== 200) {
      throw new Error("Failed get Available LANs List");
    } else {
      if (req1.data.Objects && req1.data.Objects.length > 0) {
        $scope.iptvdata.lans = req1.data.Objects[0].Param[0].ParamValue.split(
          ","
        )
          .sort()
          .filter((x) => x !== "eth0_5")
          .map((item) => {
            return {
              id: item,
              name: "LAN" + item.slice(-1),
            };
          });
      }
    }
  };

  $scope.fillLansList();

  $scope.addnewIptvConnection = async function() {
    if (!$scope.iptvdata.selectedLan) {
      alert("Please select a LAN first.");
      return;
    }

    let deviceIpInterface = null;
    let lowerlayer1 = null;

    //Step1 - get Ip interface
    const req1 = await $http.get(
      URL +
        "cgi_get_filterbyparamval?Object=Device.IP.Interface&X_LANTIQ_COM_DefaultGateway=true"
    );
    if (req1.status !== 200) {
      throw new Error("Failed to get default gateway interfaces ");
    } else {
      if (req1.data.Objects && req1.data.Objects.length > 0) {
        deviceIpInterface = req1.data.Objects[0].ObjName; //ex Device.IP.Interface.18
      }
    }

    if (!deviceIpInterface) {
      alert("No default gateway interfaces defined");
      return;
    }

    //Step2 - get LowerLayer interface for default gateway ip interface
    const req2 = await $http.get(
      URL + `cgi_get_filterbyparamval?Object=${deviceIpInterface}&LowerLayers=`
    );
    if (req2.status !== 200) {
      throw new Error("Failed to get Lowerlayer");
    } else {
      if (req2.data.Objects && req2.data.Objects.length > 0) {
        lowerlayer1 = req2.data.Objects[0].Param[0].ParamValue; //ex Device.PPP.Interface.2.
      }
    }

    if (!lowerlayer1.includes("Ethernet.Interface")) {
      //Step3 (Optional) - get LowerLayer again in case this is not the root
      const req3 = await $http.get(
        URL + `cgi_get_filterbyparamval?Object=${lowerlayer1}&LowerLayers=`
      );
      if (req3.status !== 200) {
        throw new Error("Failed get Available LANs List");
      } else {
        if (req3.data.Objects && req3.data.Objects.length > 0) {
          lowerlayer1 = req3.data.Objects[0].Param[0].ParamValue; //ex Device.Ethernet.Link.1
        }
        if (!lowerlayer1.includes("Ethernet.Interface")) {
          //Step4 (Optional)
          const req4 = await $http.get(
            URL + `cgi_get_filterbyparamval?Object=${lowerlayer1}&LowerLayers=`
          );
          if (req4.status !== 200) {
            throw new Error("Failed to get Lowerlayer");
          } else {
            if (req4.data.Objects && req4.data.Objects.length > 0) {
              if (
                !req4.data.Objects[0].Param[0].ParamValue.includes(
                  "Ethernet.Interface"
                )
              ) {
                lowerlayer1 = req4.data.Objects[0].Param[0].ParamValue; //ex Device.ATM.Link.1.
              }
            }
          }
        }
      }
    }
    debugger;
    lowerlayer1 = lowerlayer1.replace(/\.$/, ""); //remove trailing dot if exist
    const selectedLanId = $scope.iptvdata.selectedLan.id;

    const remainingLans = $scope.iptvdata.lans
      .map((lan) => lan.id)
      .filter((id) => id !== selectedLanId);

    remainingLans.push("eth0_5");
    const remainingLansEncoded = encodeURIComponent(remainingLans.join(","));
    debugger;
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

      let connRequest = "";
      // STEP 4 - Create IP Interface and VLAN Main Request Chain

      // IF ATM then QoS Modify
      if (lowerlayer1.includes("ATM")) {
        //connRequest += `Object=${lowerlayer1}.QoS&Operation=Modify&QoSClass=UBR&PeakCellRate=0&MaximumBurstSize=0&SustainableCellRate=0`;
      }

      //Add New (Bridged) Ip Interface with VLanTermination Lower layer
      connRequest += `&Object=Device.IP.Interface&Operation=Add&Enable=true&Alias=cpe-WEB-IPInterface-${randomNumber}&LowerLayers=Device.Ethernet.VLANTermination.cpe-WEB-EthernetVLANTermination-${randomNumber}`;

      //Add New Ethernet Link with (Bridge2 port) Lower layer
      connRequest += `&Object=Device.Ethernet.Link&Operation=Add&Enable=true&Alias=cpe-WEB-EthernetLink-${randomNumber}&LowerLayers=Device.Bridging.Bridge.2.Port.cpe-WEB-BridgingBridge2Port-${randomNumber}`;

      //Add New Port to Bridge2 with main Default Gateway Link as lower layer (ex: Device.ATM.Link.1)
      connRequest += `&Object=Device.Bridging.Bridge.2.Port&Operation=Add&Enable=true&Alias=cpe-WEB-BridgingBridge2Port-${randomNumber}&LowerLayers=${lowerlayer1}`;

      //Add New VLAN Termination with newly just created ethernet link as its lower layer
      connRequest += `&Object=Device.Ethernet.VLANTermination&Operation=Add&LowerLayers=Device.Ethernet.Link.cpe-WEB-EthernetLink-${randomNumber}&Alias=cpe-WEB-EthernetVLANTermination-${randomNumber}&Enable=1&VLANID=301`;

      const req3 = await $http.post(URL + "cgi_set", connRequest);
      if (req3.status !== 200)
        throw new Error("Failed to create IPTV interface chain");

      alert("IPTV connection created successfully for " + selectedLanId);
    } catch (error) {
      alert("IPTV setup failed: " + error.message);
    }
  };
});
