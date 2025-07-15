/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

myapp.controller('firewallController', function ($scope,$timeout,firewallService, $http, $route, $translate, $rootScope, $interval, TOKEN_MISMATCH_CODE) {
	$("#ajaxLoaderSection").show();
    pageloadiconstatus = true;
	$rootScope.$watch('firewall', function () {
		$scope.DeviceFirewall.Enable = $rootScope.firewall;
		    		console.info('value returned to controller rootscope changed.', $scope.DeviceFirewall.Enable);
    getFormData("cgi_get_nosubobj?Object=Device.Firewall");

	});
	
	
 	          
   // $scope.DeviceFirewall.Enable=$rootScope.firewall;
    /* Breadscrumbs Logic starts here */
/*    setTimeout(function () {
        console.log(breadcrumbsdata)
        if (breadcrumbsdata[$route.current.params.param] == undefined) {
            $rootScope["breadcrumbs"] = JSON.parse(localStorage.getItem('breadcrumbarray'));
            if (localStorage.getItem('hybrideditObject') == null)
                $rootScope["breadcrumbs"].push({"name": "Add", "path": 'nothing'})
            else
                $rootScope["breadcrumbs"].push({"name": "Edit", "path": 'nothing'})
        }
        else {
            $rootScope["breadcrumbs"] = breadcrumbsdata[$route.current.params.param]
            localStorage.setItem('breadcrumbarray', JSON.stringify($rootScope["breadcrumbs"]))
        }
        console.log($rootScope["breadcrumbs"])
    }, 10);*/
		var jsonpromise = $interval(function () {
        console.log(breadcrumbsdata)
        if (jsonloadstatus) {
            if (breadcrumbsdata[$route.current.params.param] == undefined) {
                $rootScope["breadcrumbs"] = JSON.parse(localStorage.getItem('breadcrumbarray'));

                if (localStorage.getItem('hybrideditObject') == null)
                    $rootScope["breadcrumbs"].push({"name": "Add", "path": 'nothing'})

                else
                    $rootScope["breadcrumbs"].push({"name": "Edit", "path": 'nothing'})

            }

            else {

                $rootScope["breadcrumbs"] = breadcrumbsdata[$route.current.params.param]
                localStorage.setItem('breadcrumbarray', JSON.stringify($rootScope["breadcrumbs"]))
                if (breadcrumbstatus) {
                    breadcrumbstatus = false;
                    setTimeout(function () {
                        var tabtype = 'home';
                        angular.forEach($rootScope["breadcrumbs"], function (breadcrumbobject, bindex) {
                            if (bindex == 0) {
                                if (breadcrumbobject.name == "Basic") {
                                    $("#myTab li:first-child").addClass('active');
                                    $("#home").addClass('active');
                                    $("#profile").removeClass('active');
                                    $("#myTab li:nth-child(2)").removeClass('active');
                                }
                                else {
                                    tabtype = 'profile';
                                    $("#myTab li:nth-child(2)").addClass('active');
                                    $("#myTab li:first-child").removeClass('active');
                                    $("#home").removeClass('active');
                                    $("#profile").addClass('active');
                                }
                            }
                            else {
                                if (bindex == 1)
                                    $rootScope.accordian(tabtype + "-" + breadcrumbobject.name + "-" + breadcrumbobject.index, true);
                                else
                                    $rootScope.accordian(breadcrumbobject.name + "-" + breadcrumbobject.order + "-" + breadcrumbobject.index, true);
                            }
                        });
                    }, 300);
                }
            }
            $interval.cancel(jsonpromise);
        }
        console.log($rootScope["breadcrumbs"])

    }, 500);
    $scope.homefun = function () {
        if (breadcrumbsdata[$route.current.params.param] == undefined)
            bdata = JSON.parse(localStorage.getItem('breadcrumbarray'));
        else
            bdata = breadcrumbsdata[$route.current.params.param];
        if (bdata[0]["name"] == "Advanced")
            tab = "profile";
        else
            tab = "home"
        $rootScope.accordian(tab + "-" + bdata[1]["name"] + "-" + bdata[1]["index"], true)
    }
    /* Breadscrumbs Logic ends here */
    
	/* Translation starts here */
    var activeLanguage = $translate.use();
    if (activeLanguage != undefined)
        activeLanguage = $translate.use().split('/');
    else
        activeLanguage = 'en'.split('/');
    if (activeLanguage.length > 1)
        activeLanguage = activeLanguage[1];
    else
        activeLanguage = activeLanguage[0];    
    if ($("#dataView").find("div#translation").html() != '')
        $translate.use("languages/" + activeLanguage + "/" + $("#dataView").find("div#translation").html());
    else
        $translate.use(activeLanguage);
    /* Translation ends here */
    var firewallpostarray = [];
    //Form data filling
    getFormData = function (reqParams) {
        $http.get(URL + reqParams).
                success(function (data, status, headers, config) {
                    if (status === 200) {
                        objects = data.Objects;
                        var objectParamValues = objects[0].Param;
                        for (var pa1 = 0; pa1 < objectParamValues.length; pa1++) {
                            var param_name = objectParamValues[pa1].ParamName;
                            var ParamValue = objectParamValues[pa1].ParamValue;
                            if ($scope[objects[0].ObjName.replace(/\./g, "").replace(/\*/g, "")] === undefined)
                                $scope[objects[0].ObjName.replace(/\./g, "").replace(/\*/g, "")] = {};
                            $scope[objects[0].ObjName.replace(/\./g, "").replace(/\*/g, "")][param_name] = ParamValue;
                        }
//                    console.log($scope);
                        $scope["Enablechange"] = false;
                        $scope["Configchange"] = false;
                        $scope.changedValue("DeviceFirewall", "Config");
						console.log('firewall value from get ',$scope.DeviceFirewall.Enable);
						//$scope.DeviceFirewall.Enable=$rootScope.firewall;
                    }
                    else if (500 <= status && status < 600) {
                        $scope["formname" + "popup"] = true;
                        $scope["formname" + "popupval"] = data.Objects[0].Param[0].ParamValue;
                    }
                    else if (400 <= status && status < 500) {
                        if (data.Objects.length < 2 && data.Objects[0].Param.length < 2) {
                            $scope["formname" + "popup"] = true;
                            $scope["formname" + "popupval"] = data.Objects[0].Param[0].ParamValue;
                        }
                        else {
                            angular.forEach(data.Objects, function (object) {
                                var respobject = object.ObjName.replace(/\./g, "").replace(/\*/g, "");
                                angular.forEach(object.Param, function (param) {
                                    $scope[respobject + "_" + param.ParamName + "responsestatus"] = true;
                                    $scope[respobject + "_" + param.ParamName + "val"] = param.ParamValue;
                                });
                            });
                        }
                    } else if (status === TOKEN_MISMATCH_CODE){
                        getFormData(reqParams);
                    }
                }).
                error(function (data, status, headers, config) {
                });
    };
    getFormData("cgi_get_nosubobj?Object=Device.Firewall");

    //Config value selection
    $scope.changedValue = function (objectname, paramname) {
        $rootScope.initialtime=Date.now();
        var modelValue = $scope[objectname][paramname];
        if (modelValue === "High") {
            $timeout(function(){
                for(i=3;i<=13;i++){
                    getTableData("cgi_get?Object=Device.Firewall.Chain.1.Rule"+"."+i, "DeviceFirewallChain1Rule");
    
                }
            }).then(function(){
                $timeout(loadTableDetails,2000)
               
            })
           // getTableData("cgi_get?Object=Device.Firewall.Chain.1.Rule", "DeviceFirewallChain1Rule");
        }
    };

    function loadTableDetails(){
        $scope.tableArray=[];
        var tempObjectcreationstatus = true;
        var params = ["Description", "DestPort", "Target"];

        for (var obj = 0; obj < $scope.mainArray.length; obj++) {
            if (tempObjectcreationstatus) {
                var tempObject = {};
                tempObjectcreationstatus = false;
            }
            var objectParamValues = $scope.mainArray[obj].Param;
            for (var i = 0; i < objectParamValues.length; i++) {
                var param_name = objectParamValues[i].ParamName;
                var param_value = objectParamValues[i].ParamValue;
                if (params.indexOf(param_name) > -1) {
                    tempObject[param_name] = param_value;
                    if (params.indexOf(param_name) === 2) {
                        {
                            tempObject["trafficin"] = param_value;
                            tempObject["trafficinobject"] = $scope.mainArray[obj].ObjName;
                            tempObjectcreationstatus = true;
                        }

                    }
                }

            }
            if (tempObjectcreationstatus)
                $scope.tableArray.push(tempObject);
        }
    }

    //Table data filling
    getTableData = function (reqParams, request) {
        $scope.mainArray=[];
       // $scope.tableArray = [];
        $http.get(URL + reqParams).
                success(function (data, status, headers, config) {
                    if (status === 200) {
                        var params = ["Description", "DestPort", "Target"];
                        objects = data.Objects[0];
                        $scope.mainArray.push(objects);
                        function sortByDigits(array) {
                            var re = /\D/g;
                        
                            array.sort(function(a, b) {
                                return(parseInt(a.ObjName.replace(re, ""), 10) - parseInt(b.ObjName.replace(re, ""), 10));
                            });
                            return(array);
                        }
                        sortByDigits($scope.mainArray);
                        
                        console.debug($scope.mainArray)

                    }
                    else if (500 <= status && status < 600) {
                        $scope[request + "popup"] = true;
                        $scope[request + "popupval"] = data.Objects[0].Param[0].ParamValue;
                    }
                    else if (400 <= status && status < 500) {
                        if (data.Objects.length < 2 && data.Objects[0].Param.length < 2) {
                            $scope[request + "popup"] = true;
                            $scope[request + "popupval"] = data.Objects[0].Param[0].ParamValue;
                        }
                        else {
                            var popupvalue = '';
                            angular.forEach(data.Objects, function (object) {
                                $scope[request + "popup"] = true;
                                angular.forEach(object.Param, function (param) {
                                    popupvalue += param.ParamName + ":" + param.ParamValue;
                                });
                            });
                            $scope[request + "popupval"] = popupvalue;
                        }
                    }
                    else if (status === TOKEN_MISMATCH_CODE){
                        getTableData(reqParams, request);
                    }
			$rootScope.fetchSpeed=(Date.now()-$rootScope.initialtime)/1000;
						console.log($rootScope.initialtime)
                }).
                error(function (data, status, headers, config) {
                });
    };

    $scope.toggleIcon = function (objectname, event, tablecelldata, string) {
        if (event == "Accept")
            event = "Drop";
        else
            event = "Accept";
        tablecelldata[string] = event;
        var post = "Object=" + objectname + "&Operation=Modify&Target=" + event;
        firewallpostarray.push(post);
//        alert(post)
//        $http.post(url, post).
//                success(function (data, status, headers, config) {
//                    $route.reload();
//                }).
//                error(function (data, status, headers, config) {
//                });
    };
    $scope.customtextchange = function (value) {
        $scope[value + "change"] = true;
    }
    $scope.customdropdownchange = function (value) {
        $scope[value + "change"] = true;
    }
    $scope.firewallApply = function () {
        $rootScope.initialtime=Date.now();
        $('#ajaxLoaderSection').show();
        var urlstatus = false;
        console.log(firewallpostarray);
        var url = URL + "cgi_set?";
        var post = '';
        if (firewallpostarray.length > 0) {
            urlstatus = true;
            angular.forEach(firewallpostarray, function (obj) {
                post += obj + ",";
            });
        }
        post += "Object=Device.Firewall&Operation=Modify"
        if ($scope["Enablechange"]) {
            urlstatus = true;
            post += "&Enable=" + $scope["DeviceFirewall"]["Enable"]
        }
        if ($scope["Configchange"]) {
            urlstatus = true;
            post += "&Config=" + $scope["DeviceFirewall"]["Config"]
        }
        if (urlstatus) {
            var setData = function(){
                $http.post(url, post).
                        success(function (data, status, headers, config) {
                            if (status === 200) {
                                $('#ajaxLoaderSection').hide();
                                $route.reload();
                            }
                            else if (500 <= status && status < 600) {
                                $('#ajaxLoaderSection').hide();
                                $scope["postname" + "popup"] = true;
                                $scope["postname" + "popupval"] = data.Objects[0].Param[0].ParamValue;
                            }
                            else if (400 <= status && status < 500) {
                                $('#ajaxLoaderSection').hide();
                                angular.forEach(data.Objects, function (object) {
                                    var respobject = object.ObjName.replace(/\./g, "").replace(/\*/g, "");
                                    angular.forEach(object.Param, function (param) {
                                        $scope[respobject + "_" + param.ParamName + "responsestatus"] = true;
                                        $scope[respobject + "_" + param.ParamName + "val"] = param.ParamValue;
                                    });
                                });
                            } else if (status === TOKEN_MISMATCH_CODE){
                                setData(); 
                            }
                        }).
                        error(function (data, status, headers, config) {
                            $('#ajaxLoaderSection').hide();
                        });
            }
            setData();
        }
        else {
            alert("None of the parameters have changed to update");
			$('#ajaxLoaderSection').hide();
        }
    };
    $scope.popupclose = function (scopeparam) {
        $scope[scopeparam] = false;
    }

});
