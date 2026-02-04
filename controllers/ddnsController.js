myapp.controller("ddns", function($scope, $http) {
  /* ===============================
   * STATE
   * =============================== */

  $scope.ddnsEntries = [];
  $scope.selectedEntry = null;

  $scope.isEditMode = false;

  $scope.form = {};
  $scope.originalForm = {};

  /* ===============================
   * STATIC DATA (PLACEHOLDERS)
   * =============================== */

  $scope.wanList = [];
  $scope.serviceProviders = [];

  /* ===============================
   * INIT
   * =============================== */

  function init() {
    resetForm();
    loadServiceProviders();
    loadDDNSTable();
    loadCurrentWans();
  }

  /* ===============================
   * FORM HELPERS
   * =============================== */

  function resetForm() {
    $scope.form = {
      enableDDNS: false,
      wanName: "",
      serviceProvider: "",
      host: "",
      username: "",
      password: "",
    };

    $scope.originalForm = {};
    $scope.isEditMode = false;
    $scope.selectedEntry = null;
  }

  function fillFormFromEntry(entry) {
    $scope.form = angular.copy(entry);
    $scope.originalForm = angular.copy(entry);
  }

  /* ===============================
   * HELPER: Map server name to service provider
   * =============================== */

  function getServiceProviderFromServer(serverName) {
    // Return the server name as-is if it's in the supported services list
    // Otherwise return it as-is (might be a custom host or unknown provider)
    if (serverName && serverName !== "") {
      // Check if it's in the loaded service providers list
      if ($scope.serviceProviders.indexOf(serverName) !== -1) {
        return serverName;
      }
      // Return as-is if not found in list (could be custom or legacy)
      return serverName;
    } else {
      return "";
    }
  }

  /* ===============================
   * HELPER: Get parameter value from Param array
   * =============================== */

  function getParamValue(params, paramName) {
    if (!params || !Array.isArray(params)) {
      return "";
    }
    var param = params.find(function(p) {
      return p.ParamName === paramName;
    });
    return param ? param.ParamValue : "";
  }

  /* ===============================
   * CGI GET (LOAD SERVICE PROVIDERS)
   * =============================== */

  function loadServiceProviders() {
    $("#ajaxLoaderSection").show();
    $http.get('/cgi/cgi_get?Object=Device.DynamicDNS')
      .then(function(response) {
        var supportedServices = "";
        
        if (response.data && response.data.Objects) {
          response.data.Objects.forEach(function(obj) {
            if (obj.ObjName === "Device.DynamicDNS" && obj.Param) {
              var supportedServicesParam = obj.Param.find(function(param) {
                return param.ParamName === "SupportedServices";
              });
              
              if (supportedServicesParam && supportedServicesParam.ParamValue) {
                supportedServices = supportedServicesParam.ParamValue;
              }
            }
          });
        }
        
        // Parse comma-separated string into array
        if (supportedServices) {
          $scope.serviceProviders = supportedServices.split(',').map(function(service) {
            return service.trim();
          });
        } else {
          // Fallback to empty array if no services found
          $scope.serviceProviders = [];
        }
        
        $("#ajaxLoaderSection").hide();
      })
      .catch(function(error) {
        console.error("Error loading service providers:", error);
        // Fallback to empty array on error
        $scope.serviceProviders = [];
        $("#ajaxLoaderSection").hide();
      });
  }

  /* ===============================
   * CGI GET (TABLE LOAD)
   * =============================== */

  function loadDDNSTable() {
    $("#ajaxLoaderSection").show();
    $http.get('/cgi/cgi_get?Object=Device.DynamicDNS.Client')
      .then(function(response) {
        var entries = [];
        
        if (response.data && response.data.Objects) {
          response.data.Objects.forEach(function(obj) {
            // Extract ID from ObjName (e.g., "Device.DynamicDNS.Client.1" -> 1)
            var idMatch = obj.ObjName.match(/Device\.DynamicDNS\.Client\.(\d+)/);
            if (!idMatch) {
              return; // Skip if ObjName doesn't match expected pattern
            }
            
            var id = parseInt(idMatch[1], 10);
            var params = obj.Param || [];
            
            // Extract parameter values
            var enableValue = getParamValue(params, "Enable");
            var serverName = getParamValue(params, "Server");
            var serviceProvider = getServiceProviderFromServer(serverName);
            
            // Build entry object
            var entry = {
              id: id,
              enableDDNS: enableValue === "true",
              wanName: getParamValue(params, "Interface"),
              serviceProvider: serviceProvider,
              host: getParamValue(params, "Hostname"),
              username: getParamValue(params, "Username"),
              password: getParamValue(params, "Password"), // Already masked as "******"
              status: getParamValue(params, "Status"),
              provider: serviceProvider
            };
            
            entries.push(entry);
          });
        }
        
        $scope.ddnsEntries = entries;
        $("#ajaxLoaderSection").hide();
      })
      .catch(function(error) {
        console.error("Error loading DDNS table:", error);
        // Keep empty array on error
        $scope.ddnsEntries = [];
        $("#ajaxLoaderSection").hide();
      });
  }

  /* ===============================
   * CGI GET (TABLE LOAD)
   * =============================== */

  function loadCurrentWans() {
    $("#ajaxLoaderSection").show();
    $http.get('/cgi/cgi_get_filterbyparamval?Object=Device.IP.Interface&X_LANTIQ_COM_UpStream=true')
      .then(function (response) {
        var wanNames = [];
        
        if (response.data && response.data.Objects) {
          // Filter for main interface objects (not sub-objects like IPv4Address, IPv6Address, Stats)
          var interfaceObjects = response.data.Objects.filter(function(obj) {
            // Match pattern: Device.IP.Interface.X (where X is a number, no additional dots)
            return /^Device\.IP\.Interface\.\d+$/.test(obj.ObjName);
          });
          
          // Extract the "Name" parameter value from each interface
          interfaceObjects.forEach(function(interfaceObj) {
            if (interfaceObj.Param) {
              var nameParam = interfaceObj.Param.find(function(param) {
                return param.ParamName === "Name";
              });
              
              if (nameParam && nameParam.ParamValue) {
                wanNames.push(nameParam.ParamValue);
              }
            }
          });
        }
        
        $scope.wanList = wanNames;
        $("#ajaxLoaderSection").hide();
      })
      .catch(function(error) {
        console.error("Error loading WAN list:", error);
        $("#ajaxLoaderSection").hide();
      });
  }

  /* ===============================
   * UI ACTIONS
   * =============================== */

  // NEW button
  $scope.createNew = function() {
    resetForm();
  };

  // Row click (EDIT)
  $scope.selectEntry = function(entry) {
    $scope.selectedEntry = entry;
    $scope.isEditMode = true;
    fillFormFromEntry(entry);
  };

  // Cancel Edit
  $scope.cancelEdit = function() {
    resetForm();
  };

  /* ===============================
   * HELPER: Map service provider to server name
   * =============================== */

  function getServerName(serviceProvider, host) {
    // Service providers are already in lowercase format
    // Return the service provider name directly as it matches the API format
    if (serviceProvider && $scope.serviceProviders.indexOf(serviceProvider) !== -1) {
      return serviceProvider;
    } else {
      // Fallback: return lowercase or use host if provided
      return (serviceProvider || "").toLowerCase() || host || "";
    }
  }

  /* ===============================
   * HELPER: Extract WAN interface name
   * =============================== */

  function extractWANInterface(wanName) {
    // Extract the interface name from wanName (e.g., "pppoe-wan9" -> "wan9")
    if (!wanName || wanName.trim() === "") {
      return "";
    }
    
    // Get the part after the last dash
    var parts = wanName.split('-');
    if (parts.length > 1) {
      return parts[parts.length - 1];
    }
    
    return wanName;
  }

  /* ===============================
   * HELPER: Check if form has changed
   * =============================== */

  function hasFormChanged() {
    // Compare all form fields with original form
    return $scope.form.enableDDNS !== $scope.originalForm.enableDDNS ||
           $scope.form.wanName !== $scope.originalForm.wanName ||
           $scope.form.serviceProvider !== $scope.originalForm.serviceProvider ||
           $scope.form.host !== $scope.originalForm.host ||
           $scope.form.username !== $scope.originalForm.username ||
           $scope.form.password !== $scope.originalForm.password;
  }

  /* ===============================
   * CGI ACTION: Disconnect WAN
   * =============================== */

  function disconnectWAN(wanInterface) {
    if (!wanInterface || wanInterface.trim() === "") {
      return Promise.reject("WAN interface name is required");
    }

    var queryParams = {
      Object: "Device.X_LANTIQ_COM_NwHardware.WANConnection",
      ConnectionName: "",
      UciSection: ""
    };

    var queryString = Object.keys(queryParams)
      .map(function(key) {
        return encodeURIComponent(key) + "=" + encodeURIComponent(queryParams[key]);
      })
      .join("&");
    
    var url = "/cgi/cgi_action?" + queryString;
    
    var payload = "Action=Disconnect&Interface=" + encodeURIComponent(wanInterface);

    return $http.post(url, payload, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
  }

  /* ===============================
   * CGI ACTION: Connect WAN
   * =============================== */

  function connectWAN(wanInterface) {
    if (!wanInterface || wanInterface.trim() === "") {
      return Promise.reject("WAN interface name is required");
    }

    var queryParams = {
      Object: "Device.X_LANTIQ_COM_NwHardware.WANConnection",
      ConnectionName: "",
      UciSection: ""
    };

    var queryString = Object.keys(queryParams)
      .map(function(key) {
        return encodeURIComponent(key) + "=" + encodeURIComponent(queryParams[key]);
      })
      .join("&");
    
    var url = "/cgi/cgi_action?" + queryString;
    
    var payload = "Action=Connect&Interface=" + encodeURIComponent(wanInterface);

    return $http.post(url, payload, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
  }

  /* ===============================
   * APPLY (ADD / EDIT)
   * =============================== */

  $scope.apply = function() {
    // Validate required fields
    if (!$scope.form.serviceProvider || $scope.form.serviceProvider.trim() === "") {
      alert("Service Provider is required and cannot be empty.");
      return;
    }

    if (!$scope.form.host || $scope.form.host.trim() === "") {
      alert("Host is required and cannot be empty.");
      return;
    }

    if (!$scope.form.username || $scope.form.username.trim() === "") {
      alert("User Name is required and cannot be empty.");
      return;
    }

    if (!$scope.form.password || $scope.form.password.trim() === "") {
      alert("Password is required and cannot be empty.");
      return;
    }

    // Map service provider to server name
    var serverName = getServerName($scope.form.serviceProvider, $scope.form.host);

    if ($scope.isEditMode) {
      // Build query parameters for Modify
      var params = {
        Object: "Device.DynamicDNS.Client." + $scope.selectedEntry.id,
        Operation: "Modify",
        Enable: $scope.form.enableDDNS ? "true" : "false",
        Server: serverName,
        Interface: $scope.form.wanName || "",
        Username: $scope.form.username || "",
        Password: $scope.form.password || "",
        Hostname: $scope.form.host || ""
      };

      // Build URL with query string
      var queryString = Object.keys(params)
        .map(function(key) {
          return encodeURIComponent(key) + "=" + encodeURIComponent(params[key]);
        })
        .join("&");
      
      var url = "/cgi/cgi_set_ddns?" + queryString;

      // Make the CGI_SET call
      $("#ajaxLoaderSection").show();
      $http.get(url)
        .then(function(response) {
          // Check if form has changed to decide whether to reconnect WAN
          if (hasFormChanged()) {
            var wanInterface = extractWANInterface($scope.form.wanName);
            
            if (wanInterface) {
              // Disconnect first, then connect
              return disconnectWAN(wanInterface)
                .then(function() {
                  return connectWAN(wanInterface);
                });
            } else {
              return Promise.resolve();
            }
          } else {
            return Promise.resolve();
          }
        })
        .then(function() {
          // Success: refresh table
          loadDDNSTable();
          $("#ajaxLoaderSection").hide();
        })
        .catch(function(error) {
          // Error handling
          console.error("Error modifying DDNS entry:", error);
          alert("Failed to modify DDNS entry. Please try again.");
          $("#ajaxLoaderSection").hide();
        });
    } else {
      // Build query parameters for Add
      var params = {
        Object: "Device.DynamicDNS.Client",
        Operation: "Add",
        Enable: $scope.form.enableDDNS ? "true" : "false",
        Server: serverName,
        Interface: $scope.form.wanName || "",
        Username: $scope.form.username || "",
        Password: $scope.form.password || "",
        Hostname: $scope.form.host
      };

      // Build URL with query string
      var queryString = Object.keys(params)
        .map(function(key) {
          return encodeURIComponent(key) + "=" + encodeURIComponent(params[key]);
        })
        .join("&");
      
      var url = "/cgi/cgi_set_ddns?" + queryString;

      // Make the CGI_SET call
      $("#ajaxLoaderSection").show();
      $http.get(url)
        .then(function(response) {
          // Success: extract WAN interface and disconnect/reconnect
          var wanInterface = extractWANInterface($scope.form.wanName);
          
          if (wanInterface) {
            // Disconnect first, then connect
            return disconnectWAN(wanInterface)
              .then(function() {
                return connectWAN(wanInterface);
              });
          } else {
            return Promise.resolve();
          }
        })
        .then(function() {
          // After WAN reconnection succeeds, refresh table 
          loadDDNSTable();
          $("#ajaxLoaderSection").hide();
        })
        .catch(function(error) {
          // Error handling
          console.error("Error adding DDNS entry or reconnecting WAN:", error);
          alert("Failed to add DDNS entry or reconnect WAN. Please try again.");
          $("#ajaxLoaderSection").hide();
        });
    }
  };

  /* ===============================
   * DELETE
   * =============================== */

  $scope.deleteEntry = function(entry) {
    if (!confirm("Are you sure you want to delete this DDNS entry?")) {
      return;
    }

    $("#ajaxLoaderSection").show();

    // First, modify the entry to set Enable=false
    var modifyParams = {
      Object: "Device.DynamicDNS.Client." + entry.id,
      Operation: "Modify",
      Enable: "false"
    };

    var modifyQueryString = Object.keys(modifyParams)
      .map(function(key) {
        return encodeURIComponent(key) + "=" + encodeURIComponent(modifyParams[key]);
      })
      .join("&");
    
    var modifyUrl = "/cgi/cgi_set_ddns?" + modifyQueryString;

    // First call: Modify with Enable=false
    $http.get(modifyUrl)
      .then(function(response) {
        // After successful modify, proceed with delete
        var deleteParams = {
          Object: "Device.DynamicDNS.Client." + entry.id,
          Operation: "Del"
        };

        var deleteQueryString = Object.keys(deleteParams)
          .map(function(key) {
            return encodeURIComponent(key) + "=" + encodeURIComponent(deleteParams[key]);
          })
          .join("&");
        
        var deleteUrl = "/cgi/cgi_set_ddns?" + deleteQueryString;

        // Second call: Delete
        return $http.get(deleteUrl);
      })
      .then(function(response) {
        // Success: refresh table and reset form
        loadDDNSTable();
        resetForm();
        $("#ajaxLoaderSection").hide();
      })
      .catch(function(error) {
        // Error handling
        console.error("Error deleting DDNS entry:", error);
        alert("Failed to delete DDNS entry. Please try again.");
        $("#ajaxLoaderSection").hide();
      });
  };

  /* ===============================
   * START
   * =============================== */

  init();
});
