myapp.controller("macFilteringController", function($scope, $http, helperService, $q, $routeParams, $timeout) {
  // Determine WiFi band from route parameter
  // 1 = 2.4G, 2 = 5G
  const wifiBand = $routeParams.id ? parseInt($routeParams.id) : 1;
  const isBand24G = wifiBand === 1;
  const isBand5G = wifiBand === 2;
  
  $scope.wifiBandInfo = {
    bandId: wifiBand,
    bandName: isBand24G ? "2.4G" : "5G",
    is24G: isBand24G,
    is5G: isBand5G,
    apIndex: wifiBand, // AccessPoint index (1 for 2.4G, 2 for 5G)
  };

  // Initialize MAC filtering data
  $scope.macFilteringData = {
    enable: false,
    filterMode: "Whitelist", // Whitelist or Blacklist
    devices: [], // Current devices in the rule
    connectedDevices: [], // All connected devices available
  };

  $scope.dataLoaded = false;

  // Form data for adding new device
  $scope.newDevice = {
    deviceName: "",
    macAddress: "",
    selectedDevice: null, // When selected from dropdown
  };

  // For multi-select delete functionality
  $scope.selectedDevices = {};

  // Available filter modes
  $scope.filterModes = ["Whitelist", "Blacklist"];

  // Load current MAC filtering configuration from router
  async function loadMACFilteringConfig() {
    try {
      const apIndex = $scope.wifiBandInfo.apIndex;
      const response = await $http.get(
        URL + `cgi_get?Object=Device.WiFi.AccessPoint.${apIndex}.X_LANTIQ_COM_Vendor`
      );

      if (response.status === 200 && response.data && response.data.Objects) {
        // Find the main vendor object (not sub-objects like Security, AC, HS20, etc.)
        const vendorObj = response.data.Objects.find(
          (obj) => obj.ObjName === `Device.WiFi.AccessPoint.${apIndex}.X_LANTIQ_COM_Vendor`
        );

        if (vendorObj && vendorObj.Param) {
          let macControlEnabled = false;
          let macFilterMode = "Whitelist";
          let macAddressList = "";

          // Extract MAC filtering parameters
          vendorObj.Param.forEach((param) => {
            if (param.ParamName === "MACAddressControlEnabled") {
              macControlEnabled = param.ParamValue === "true" || param.ParamValue === true;
            } else if (param.ParamName === "MACAddressControlMode") {
              // Mode can be "Allow" (Whitelist) or "Deny" (Blacklist)
              macFilterMode = param.ParamValue === "Deny" ? "Blacklist" : "Whitelist";
            } else if (param.ParamName === "MACAddressControlList") {
              macAddressList = param.ParamValue;
            }
          });

          // Update controller state with explicit boolean conversion
          $scope.macFilteringData.enable = Boolean(macControlEnabled);
          $scope.macFilteringData.filterMode = macFilterMode;

          // Use $timeout to ensure digest cycle happens
          $timeout(function() {
            // This ensures the checkbox binding updates
          }, 0);

          // Parse MAC address list (comma-separated values)
          if (macAddressList && macAddressList.trim()) {
            const macAddresses = macAddressList.split(",").map((mac) => mac.trim());

            // For each MAC address, find matching device from connected devices
            $scope.macFilteringData.devices = macAddresses.map((mac, index) => {
              const normalizedMac = mac.toUpperCase();
              
              // Try to find matching device from connected devices
              const connectedDevice = $scope.macFilteringData.connectedDevices.find((device) => {
                const deviceMac = device.macAddress.toUpperCase();
                return deviceMac === normalizedMac;
              });

              // Determine device display name
              let displayName = mac.toUpperCase(); // Default to MAC address itself if not found
              if (connectedDevice) {
                // If hostname is available and not "Unknown", use it
                if (connectedDevice.hostName && connectedDevice.hostName !== "Unknown") {
                  displayName = connectedDevice.hostName;
                }
                // Otherwise use alias if available
                else if (connectedDevice.alias) {
                  displayName = connectedDevice.alias;
                }
                // Fall back to IP address
                else if (connectedDevice.ipAddress) {
                  displayName = connectedDevice.ipAddress;
                }
              }

              return {
                id: Date.now() + index,
                name: displayName,
                macAddress: mac.toUpperCase(),
              };
            });

          } else {
            $scope.macFilteringData.devices = [];
          }
        }
      }
    } catch (error) {
      console.error("Error loading MAC filtering configuration:", error);
      // Initialize with empty values on error
      $scope.macFilteringData.enable = false;
      $scope.macFilteringData.filterMode = "Whitelist";
      $scope.macFilteringData.devices = [];
    }
  }

  // Load connected devices from router
  async function loadConnectedDevices() {
    try {
      const response = await $http.get(URL + "cgi_get?Object=Device.Hosts.Host");
      
      if (response.status === 200 && response.data && response.data.Objects) {
        const connectedDevices = [];
        let deviceId = 1;
        
        // Parse the response to extract host devices
        response.data.Objects.forEach((obj) => {
          // Only process main host objects (Device.Hosts.Host.X pattern)
          // Skip IPv4Address sub-objects
          if (!/^Device\.Hosts\.Host\.\d+$/.test(obj.ObjName)) {
            return;
          }
          
          let macAddress = "";
          let hostName = "";
          let alias = "";
          let ipAddress = "";
          
          // Extract parameters from the host object
          if (obj.Param && Array.isArray(obj.Param)) {
            obj.Param.forEach((param) => {
              if (param.ParamName === "PhysAddress") {
                macAddress = param.ParamValue;
              } else if (param.ParamName === "HostName") {
                hostName = param.ParamValue;
              } else if (param.ParamName === "Alias") {
                alias = param.ParamValue;
              } else if (param.ParamName === "IPAddress") {
                ipAddress = param.ParamValue;
              }
            });
          }
          
          // Use HostName if available, otherwise use Alias or IP
          const deviceName = hostName && hostName !== "Unknown" 
            ? hostName 
            : (alias || ipAddress || `Device ${deviceId}`);
          
          connectedDevices.push({
            id: deviceId,
            name: deviceName,
            macAddress: macAddress.toUpperCase(),
            ipAddress: ipAddress,
            alias: alias,
            hostName: hostName
          });
          
          deviceId++;
        });
        
        $scope.macFilteringData.connectedDevices = connectedDevices;
      }
    } catch (error) {
      console.error("Error loading connected devices:", error);
      // Fall back to empty array if CGI call fails
      $scope.macFilteringData.connectedDevices = [];
    }
  }

  // Initialize on page load
  async function init() {
    
    // Load connected devices first
    await loadConnectedDevices();
    
    // Then load current MAC filtering configuration from router
    await loadMACFilteringConfig();
    
    // Mark data as loaded
    $scope.$apply(function() {
      $scope.dataLoaded = true;
    });
  }

  // Watch for filter mode changes
//   $scope.$watch("macFilteringData.filterMode", function(newVal, oldVal) {
//     if (newVal && oldVal && newVal !== oldVal && $scope.macFilteringData.devices.length > 0) {
//       // Show confirmation prompt when switching between modes with existing devices
//       showModeChangePrompt(oldVal, newVal);
//     }
//   });

  // Show confirmation prompt when changing filter mode
  function showModeChangePrompt(oldMode, newMode) {
    const confirmDelete = confirm(
      `Switching from ${oldMode} to ${newMode} will delete all current rules. Do you want to continue?`
    );

    if (!confirmDelete) {
      // Revert the change
      $scope.macFilteringData.filterMode = oldMode;
    } else {
      // Clear all devices when mode changes
      $scope.macFilteringData.devices = [];
      $scope.selectedDevices = {};
    }
  }

  // When a device is selected from dropdown, auto-fill name and MAC
  $scope.onDeviceSelected = function() {
    if ($scope.newDevice.selectedDevice) {
      $scope.newDevice.deviceName = $scope.newDevice.selectedDevice.name;
      $scope.newDevice.macAddress = $scope.newDevice.selectedDevice.macAddress;
    }
  };

  // Validate MAC address format
  function isValidMacAddress(mac) {
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    return macRegex.test(mac);
  }

  // Apply/Add new device to the rule table
  $scope.applyMACFilterRule = async function() {
    // Validation
    if (!$scope.newDevice.deviceName.trim()) {
      alert("Please enter a device name");
      return;
    }

    if (!$scope.newDevice.macAddress.trim()) {
      alert("Please enter a MAC address");
      return;
    }

    if (!isValidMacAddress($scope.newDevice.macAddress)) {
      alert("Invalid MAC address format. Use format: AA:BB:CC:DD:EE:FF");
      return;
    }

    // Check for duplicates
    const isDuplicate = $scope.macFilteringData.devices.some(
      (device) => device.macAddress.toUpperCase() === $scope.newDevice.macAddress.toUpperCase()
    );

    if (isDuplicate) {
      alert("This MAC address is already in the rule list");
      return;
    }

    // Create new device object
    const newDevice = {
      id: Date.now(), // Simple ID generation
      name: $scope.newDevice.deviceName,
      macAddress: $scope.newDevice.macAddress,
    };

    // TODO: Send CGI request to router
    // POST: cgi_set with parameters like:
    // Object=Device.WiFi.AccessPoint.X.DeviceControl&Operation=Add&MAC=XXXX&DeviceName=XXXX&FilterMode=Whitelist

    try {
      // Simulate adding to table (replace with real CGI call)
      $scope.macFilteringData.devices.push(newDevice);

      // Clear form fields
      $scope.newDevice.deviceName = "";
      $scope.newDevice.macAddress = "";
      $scope.newDevice.selectedDevice = null;

      // TODO: Refresh table from router after successful addition
      // await refreshDevicesList();
    } catch (error) {
      console.error("Error adding device:", error);
      alert("Failed to add device to rule");
    }
  };

  // Delete selected devices from the rule table
  $scope.deleteSelectedDevices = async function() {
    const selectedIds = Object.keys($scope.selectedDevices).filter(
      (key) => $scope.selectedDevices[key]
    );

    if (selectedIds.length === 0) {
      alert("Please select at least one device to delete");
      return;
    }

    const confirmDelete = confirm(
      `Are you sure you want to delete ${selectedIds.length} device(s) from the rule?`
    );

    if (!confirmDelete) {
      return;
    }

    try {
      // TODO: Send CGI request to router for each device
      // POST: cgi_set with parameters like:
      // Object=Device.WiFi.AccessPoint.X.DeviceControl.Y&Operation=Delete

      // Remove from table
      $scope.macFilteringData.devices = $scope.macFilteringData.devices.filter((device) => {
        return !selectedIds.includes(device.id.toString());
      });

      // Clear selections
      $scope.selectedDevices = {};

      // TODO: Refresh table from router after successful deletion
      // await refreshDevicesList();
    } catch (error) {
      console.error("Error deleting devices:", error);
      alert("Failed to delete devices from rule");
    }
  };

  // Delete a single device from the rule
  $scope.deleteDevice = function(deviceId) {
    const device = $scope.macFilteringData.devices.find((d) => d.id === deviceId);
    if (device) {
      const confirmDelete = confirm(
        `Are you sure you want to delete "${device.name}" (${device.macAddress}) from the rule?`
      );

      if (confirmDelete) {
        $scope.macFilteringData.devices = $scope.macFilteringData.devices.filter(
          (d) => d.id !== deviceId
        );
        delete $scope.selectedDevices[deviceId];
      }
    }
  };

  // Check if any device is selected
  $scope.hasSelectedDevices = function() {
    return Object.keys($scope.selectedDevices).some((key) => $scope.selectedDevices[key]);
  };

  // Toggle all devices selection
  $scope.toggleAllDevices = function(checked) {
    $scope.macFilteringData.devices.forEach((device) => {
      $scope.selectedDevices[device.id] = checked;
    });
  };

  // Watch selectAllDevices checkbox to keep it in sync
  $scope.$watch('selectAllDevices', function(newVal) {
    if (newVal !== undefined) {
      $scope.toggleAllDevices(newVal);
    }
  });

  // Watch individual device selections to update selectAllDevices checkbox
  $scope.$watch('selectedDevices', function() {
    if ($scope.macFilteringData.devices.length === 0) {
      $scope.selectAllDevices = false;
      return;
    }
    $scope.selectAllDevices = $scope.macFilteringData.devices.every(
      (device) => $scope.selectedDevices[device.id]
    );
  }, true);

  // Apply all rules to the router
  $scope.applyRulesToRouter = async function() {
    // If MAC filtering is enabled, require at least one device
    if ($scope.macFilteringData.enable && $scope.macFilteringData.devices.length === 0) {
      alert("No devices to apply. Please add at least one device to the rule.");
      return;
    }

    // If MAC filtering is enabled, require a filter mode
    if ($scope.macFilteringData.enable && !$scope.macFilteringData.filterMode) {
      alert("Please select a filter mode.");
      return;
    }

    try {
      // Show loading indicator
      if (window.$ && $("#ajaxLoaderSection").length) {
        $("#ajaxLoaderSection").show();
      }

      const apIndex = $scope.wifiBandInfo.apIndex;
      let cgiRequest;

      debugger;
      if ($scope.macFilteringData.enable) {
        // MAC filtering is enabled - send with devices and mode
        // Build comma-separated MAC address list
        const macAddressList = $scope.macFilteringData.devices
          .map((device) => device.macAddress.toLowerCase())
          .join(",");

        // Convert filter mode to router format
        // "Whitelist" -> "Allow", "Blacklist" -> "Deny"
        const controlMode = $scope.macFilteringData.filterMode === "Whitelist" ? "Allow" : "Deny";

        cgiRequest = `Object=Device.WiFi.AccessPoint.${apIndex}.X_LANTIQ_COM_Vendor&Operation=Modify&MACAddressControlEnabled=true&MACAddressControlMode=${controlMode}&MACAddressControlList=${encodeURIComponent(macAddressList)}`;

      } else {
        cgiRequest = `Object=Device.WiFi.AccessPoint.${apIndex}.X_LANTIQ_COM_Vendor&Operation=Modify&MACAddressControlEnabled=false&MACAddressControlMode=Disabled&MACAddressControlList=`;
      }

      const response = await $http.post(URL + "cgi_set", cgiRequest);

      if (response.status === 200) {
        const statusMsg = $scope.macFilteringData.enable
          ? `Successfully applied ${$scope.macFilteringData.devices.length} device(s) to the ${$scope.macFilteringData.filterMode} rule`
          : "Successfully disabled MAC filtering";
        
        alert(statusMsg);
        await loadMACFilteringConfig();
      } else {
        throw new Error(`Unexpected response status: ${response.status}`);
      }
    } catch (error) {
      console.error("Error applying rules:", error);
      alert("Failed to apply rules to the router");
    } finally {
      if (window.$ && $("#ajaxLoaderSection").length) {
        $("#ajaxLoaderSection").hide();
      }
    }
  };

  init();
});
