myapp.service("helperService", function($rootScope, $http) {
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

  this.findBridgeInfoForPtm = function(bridgesData, ptmName) {
    for (const entry of bridgesData) {
      const members = entry.Param?.find(
        (p) => p.ParamName === "X_LANTIQ_COM_BridgeMembers"
      );
      if (members && members.ParamValue.includes(ptmName)) {
        const ethMembers = members.ParamValue.split(",")
          .map((v) => v.trim())
          .filter((v) => v.startsWith("eth"));
        return {
          bridgeName: entry.ObjName,
          ethMembers,
        };
      }
    }
    return null; // Not found
  };

  this.deleteIPTVConnection = async function() {
    return null;
  };
});
