myapp.controller("macFilterController", function ($scope, $http, $route, $rootScope) {
    /* ===============================
     * STATE
     * =============================== */
    $scope.global = {
        Enable: '0',
        DefaultAction: '1' // 1: Permit, 0: Deny
    };
    $scope.rules = [];
    $scope.isAdding = false;
    $scope.newRule = {
        MACAddress: ''
    };

    // Constants
    var URL_BASE = '/cgi/'; // Or use URL global if available

    /* ===============================
     * INIT
     * =============================== */
    function init() {
        loadGlobalSettings();
        loadRules();
    }

    /* ===============================
     * CGI ACTIONS
     * =============================== */

    // Load Global Settings (Enable, DefaultAction)
    function loadGlobalSettings() {
        $("#ajaxLoaderSection").show();
        var query = "cgi_get_nosubobj?Object=Device.Firewall.X_LANTIQ_COM_ParentalControl";
        $http.get(URL_BASE + query)
            .then(function (response) {
                var data = response.data;
                if (data && data.Objects && data.Objects.length > 0) {
                    var params = data.Objects[0].Param;
                    params.forEach(function (p) {
                        if (p.ParamName === 'Enable') $scope.global.Enable = p.ParamValue;
                        if (p.ParamName === 'DefaultAction') $scope.global.DefaultAction = p.ParamValue;
                    });
                }
                $("#ajaxLoaderSection").hide();
            })
            .catch(function (err) {
                console.error("Error loading global settings", err);
                $("#ajaxLoaderSection").hide();
            });
    }

    // Load Rules
    function loadRules() {
        $("#ajaxLoaderSection").show();
        var query = "cgi_get?Object=Device.Firewall.X_LANTIQ_COM_ParentalControl.Rule";
        $http.get(URL_BASE + query)
            .then(function (response) {
                var data = response.data;
                $scope.rules = [];
                if (data && data.Objects) {
                    data.Objects.forEach(function (obj) {
                        var rule = {
                            ObjName: obj.ObjName
                        };
                        obj.Param.forEach(function (p) {
                            rule[p.ParamName] = p.ParamValue;
                        });
                        $scope.rules.push(rule);
                    });
                }
                $("#ajaxLoaderSection").hide();
            })
            .catch(function (err) {
                console.error("Error loading rules", err);
                $("#ajaxLoaderSection").hide();
            });
    }

    /* ===============================
     * UI HANDLERS
     * =============================== */

    // Save Global Settings
    $scope.saveGlobalSettings = function() {
        $("#ajaxLoaderSection").show();
        // cgi_set?Object=Device.Firewall.X_LANTIQ_COM_ParentalControl&Operation=Modify&Enable=...&DefaultAction=...
        var postUrl = URL_BASE + "cgi_set";
        var enable = $scope.global.Enable;
        var mode = $scope.global.DefaultAction;
        
        var body = "Object=Device.Firewall.X_LANTIQ_COM_ParentalControl&Operation=Modify" +
                   "&Enable=" + enable +
                   "&DefaultAction=" + mode;

        $http.post(postUrl, body)
            .then(function (response) {
                loadGlobalSettings();
                loadRules();
                alert("Settings saved successfully.");
                $("#ajaxLoaderSection").hide();
            })
            .catch(function (err) {
                console.error("Error saving settings", err);
                alert("Failed to save settings.");
                $("#ajaxLoaderSection").hide();
            });
    };

    // Toggle Add form
    $scope.showAddForm = function() {
        $scope.isAdding = true;
        $scope.newRule.MACAddress = '';
    };

    $scope.cancelAdd = function() {
        $scope.isAdding = false;
        $scope.newRule.MACAddress = '';
    };

    // Add New Rule
    $scope.addRule = function() {
        var target = 'Accept'; 
        if ($scope.global.DefaultAction == '1') {
             target = 'Drop'; 
        } else {
             target = 'Accept';
        }

        var postUrl = URL_BASE + "cgi_set";
        var body = "Object=Device.Firewall.X_LANTIQ_COM_ParentalControl.Rule&Operation=Add" +
                   "&Enable=1" +
                   "&Target=Accept" +
                   "&MACAddress=" + $scope.newRule.MACAddress + 
                   "&TimeStart=22:00&TimeEnd=21:59&DaysOfTheWeek=Sun,Mon,Tue,Wed,Thu,Fri,Sat";
        $("#ajaxLoaderSection").show();
        $http.post(postUrl, body)
            .then(function (response) {
                $scope.isAdding = false;
                $scope.newRule.MACAddress = '';
                loadRules();
                $("#ajaxLoaderSection").hide();
            })
            .catch(function (err) {
                console.error("Error adding rule", err);
                alert("Failed to add rule.");
                $("#ajaxLoaderSection").hide();
            });
    };

    // Delete Rule
    $scope.deleteRule = function(rule) {
        $("#ajaxLoaderSection").show();
        if (!confirm("Are you sure you want to delete this rule?")) return;

        // cgi_set?Object=Device.Firewall.X_LANTIQ_COM_ParentalControl.Rule.1&Operation=Del
        var postUrl = URL_BASE + "cgi_set";
        var body = "Object=" + rule.ObjName + "&Operation=Del";

        $http.post(postUrl, body)
            .then(function (response) {
                loadRules();
                $("#ajaxLoaderSection").hide();
            })
            .catch(function (err) {
                console.error("Error deleting rule", err);
                alert("Failed to delete rule.");
                $("#ajaxLoaderSection").hide();
            });
    };

    // Start
    init();
});
