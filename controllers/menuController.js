myapp.controller('menuController', function ($rootScope,$scope, $route, $http, $location, localStorageService, modifyService, $q, $http, languageService, TOKEN_MISMATCH_CODE) {

    $scope.dataTab = "";
    $scope.menuOptions = function () {
    var menufolder = ''; 
   
        
    $rootScope.$on('rootScope:language_changed', function (event, args) {
         menuload();
    });
        
    function menuload(){
         var language = languageService.getObject();
             if(language === undefined){
                 language = 'en';
             }
        var menuLoad = function(){
            var url = URL + 'cgi_action?Action=User';
            console.log("url= ", url)
            $http.get(url).success(function (data, status, headers, config) {
                console.log("status= ", status, ", TOKEN_MISMATCH_CODE= ", TOKEN_MISMATCH_CODE)
                if(status === TOKEN_MISMATCH_CODE){
                    menuLoad();
                }
                else{
                    $scope.username=data;
                    getClientModeData();
                }
        
            });
        }
        menuLoad();
            
        var getClientModeData = function(){
            $http.get(URL + '/cgi_get_fillparams?Object=Device.X_INTEL_COM_ClientMode.Profile&Enable=').success(function (data, status, headers, config) {
                    if(status === 200){
                    var responseData = data;
                    if(data !== undefined && data.Objects !== undefined){
                        if(data.Objects.length  > 0){
                            var isEnpointTrue = false;
                            angular.forEach(data.Objects, function(object){
                                if(object.Param !== undefined &&  object.Param[0] !== undefined && object.Param[0].ParamValue === 'true'){
                                    isEnpointTrue = true;
                                }
                            });
                            
                            if(isEnpointTrue === true){
                                var getClientMenu = function(){
                                    $http.get('menu_ClientMode.json').
                                    success(function (data, status, headers, config) {
                                        if(status === 200){
                                        $scope.posts = data;
                                        } else if (status === TOKEN_MISMATCH_CODE){
                                            getClientMenu();
                                        }
                                    }).
                                    error(function (data, status, headers, config) {
                                        var getMenu = function(){
                                            $http.get(URL+"cgi_action?Action=Menu&Language="+language).
                                                success(function (data, status, headers, config) {
                                                    if(status === 200){
                                                        $scope.createmenu(data, $q, $http);
                                                    }
                                                    else if (status === TOKEN_MISMATCH_CODE){
                                                        getMenu();
                                                    }
                                                }).
                                                error(function (data, status, headers, config) {
                                                });
                                        }
                                        getMenu();
                                    });
                                }
                                getClientMenu();
                            }
                            else{
                                var getBeerocksData = function(){
                                    $http.get(URL + '/cgi_get_fillparams?Object=Device.X_INTEL_COM_BEEROCKS&Gateway=&Onboarding=').success(function (data, status, headers, config) {
                                    if(status === 200){
                                        var responseData = data;
                                        var objectResponse = [];
                                        var objectname = [];
                                            if(data !== undefined && data.Objects !== undefined){
                                                if(data.Objects.length  > 0){
                                                    var isEnpointTrue = false;
                                                    angular.forEach(data.Objects, function(object){
                                                        angular.forEach(object.Param, function(objectparam){
                                                        if(objectparam !== undefined){
                                                        if (object.ObjName === "Device.X_INTEL_COM_BEEROCKS" && objectparam.ParamValue === "false" && objectparam.ParamName === "Gateway"){
                                                                var objectDetails = {};
                                                                objectDetails.objectname = object.ObjName + '.' + objectparam.ParamName;
                                                                objectDetails.isEnpointTrue = objectparam.ParamValue;
                                                                objectResponse.push(objectDetails);
                                                                objectname.push(object.ObjName + '.' + objectparam.ParamName);
                                                        }
                                                            else if (object.ObjName === "Device.X_INTEL_COM_BEEROCKS" && objectparam.ParamValue === "false" && objectparam.ParamName === "Onboarding"){
                                                                var objectDetails = {};
                                                                objectDetails.objectname = object.ObjName + '.' + objectparam.ParamName;
                                                                objectDetails.isEnpointTrue = objectparam.ParamValue;
                                                                objectResponse.push(objectDetails);
                                                                objectname.push(object.ObjName + '.' + objectparam.ParamName);
                                                            }
                                                        }
                                                        });
                                                        
                                                    });
                                            
                                        if(objectname.indexOf("Device.X_INTEL_COM_BEEROCKS.Gateway") > -1){
                                                var index = objectname.indexOf("Device.X_INTEL_COM_BEEROCKS.Gateway");
                                            if(objectResponse[index].isEnpointTrue === "false"){
                                                var getIreMenu = function(){
                                                    $http.get('menu_ire_mode.json').
                                                    success(function (data, status, headers, config) {
                                                        if(status === 200){
                                                            $scope.posts = data;
                                                        } else if (status === TOKEN_MISMATCH_CODE){
                                                            getIreMenu();
                                                        }
                                                    }).
                                                    error(function (data, status, headers, config) {
                                                        var getMenu = function(){
                                                            $http.get(URL+"cgi_action?Action=Menu&Language="+language).
                                                                success(function (data, status, headers, config) {
                                                                    if(status === 200){
                                                                        $scope.createmenu(data, $q, $http);
                                                                    }
                                                                    else if (status === TOKEN_MISMATCH_CODE){
                                                                        getMenu();
                                                                    }
                                                                }).
                                                                error(function (data, status, headers, config) {
                                                                });
                                                        }
                                                        getMenu();
                                                    });
                                                }
                                                getIreMenu();
                                            }
                                                else{
                                                    var getMenu = function(){
                                                        $http.get(URL+"cgi_action?Action=Menu&Language="+language).
                                                            success(function (data, status, headers, config) {
                                                                if(status === 200){
                                                                    $scope.createmenu(data, $q, $http);
                                                                }
                                                                else if (status === TOKEN_MISMATCH_CODE){
                                                                    getMenu();
                                                                }
                                                            }).
                                                            error(function (data, status, headers, config) {
                                                            });
                                                    }
                                                    getMenu();
                                            }
                                            }
                                            else if(objectname.indexOf("Device.X_INTEL_COM_BEEROCKS.Onboarding") > -1){
                                                var index = objectname.indexOf("Device.X_INTEL_COM_BEEROCKS.Onboarding");
                                            if(objectResponse[index].isEnpointTrue === "false"){
                                                var getOperationalModeMenu = function(){
                                                    $http.get('menu_operationalmode.json').
                                                    success(function (data, status, headers, config) {
                                                        if(status === 200){
                                                            $scope.posts = data;
                                                        } else if (status === TOKEN_MISMATCH_CODE){
                                                            getOperationalModeMenu();
                                                        }
                                                    }).
                                                    error(function (data, status, headers, config) {
                                                        var getMenu = function(){
                                                            $http.get(URL+"cgi_action?Action=Menu&Language="+language).
                                                                success(function (data, status, headers, config) {
                                                                    if(status === 200){
                                                                        $scope.createmenu(data, $q, $http);
                                                                    }
                                                                    else if (status === TOKEN_MISMATCH_CODE){
                                                                        getMenu();
                                                                    }
                                                                }).
                                                                error(function (data, status, headers, config) {
                                                                });
                                                        }
                                                        getMenu();
                                                    });
                                                
                                                }
                                                getOperationalModeMenu();
                                            }
                                                else{
                                                    var getMenu = function(){
                                                        $http.get(URL+"cgi_action?Action=Menu&Language="+language).
                                                            success(function (data, status, headers, config) {
                                                                if(status === 200){
                                                                    $scope.createmenu(data, $q, $http);
                                                                }
                                                                else if (status === TOKEN_MISMATCH_CODE){
                                                                    getMenu();
                                                                }
                                                            }).
                                                            error(function (data, status, headers, config) {
                                                            });
                                                    }
                                                    getMenu();
                                            }
                                            }
                                            else{
                                                var getMenu = function(){
                                                    $http.get(URL+"cgi_action?Action=Menu&Language="+language).
                                                        success(function (data, status, headers, config) {
                                                            if(status === 200){
                                                                $scope.createmenu(data, $q, $http);
                                                            }
                                                            else if (status === TOKEN_MISMATCH_CODE){
                                                                getMenu();
                                                            }
                                                        }).
                                                        error(function (data, status, headers, config) {
                                                        });
                                                }
                                                getMenu();
                                            }
                                            
                                            
                                        }
                                    }
                                        else{
                                            var getMenu = function(){
                                                $http.get(URL+"cgi_action?Action=Menu&Language="+language).
                                                    success(function (data, status, headers, config) {
                                                        if(status === 200){
                                                            $scope.createmenu(data, $q, $http);
                                                        }
                                                        else if (status === TOKEN_MISMATCH_CODE){
                                                            getMenu();
                                                        }
                                                    }).
                                                    error(function (data, status, headers, config) {
                                                    });
                                            }
                                            getMenu();
                                        }
                                    }
                                    else if (status === TOKEN_MISMATCH_CODE){
                                        getBeerocksData();
                                    } else {
                                        var getMenu = function() {
                                            $http.get(URL+"cgi_action?Action=Menu&Language="+language).
                                                success(function (data, status, headers, config) {
                                                    if (status === 200) {
                                                        $scope.createmenu(data, $q, $http);
                                                    } else if (status === TOKEN_MISMATCH_CODE) {
                                                        getMenu();
                                                    }
                                                }).
                                                error(function (data, status, headers, config) {
                                                });
                                        }
                                        getMenu();
                                    }
                                    }).
                                    error(function (data, status, headers, config) {
                                        var getMenu = function(){
                                            $http.get(URL+"cgi_action?Action=Menu&Language="+language).
                                                success(function (data, status, headers, config) {
                                                    if(status === 200){
                                                        $scope.createmenu(data, $q, $http);
                                                    }
                                                    else if (status === TOKEN_MISMATCH_CODE){
                                                        getMenu();
                                                    }
                                                }).
                                                error(function (data, status, headers, config) {
                                                });
                                        }
                                        getMenu();
                                    });
                                }
                                getBeerocksData();
                            }
                        }
                    }
                    else{
                        var getMenu = function(){
                            $http.get(URL+"cgi_action?Action=Menu&Language="+language).
                                success(function (data, status, headers, config) {
                                    if(status === 200){
                                        $scope.createmenu(data, $q, $http);
                                    }
                                    else if (status === TOKEN_MISMATCH_CODE){
                                        getMenu();
                                    }
                                }).
                                error(function (data, status, headers, config) {
                                });
                        }
                        getMenu();
                    }
                    }
                    else if (status === TOKEN_MISMATCH_CODE){
                        getClientModeData();
                    } else {
                        var getMenu = function(){
                            $http.get(URL+"cgi_action?Action=Menu&Language="+language).
                                success(function (data, status, headers, config) {
                                    if(status === 200){
                                        $scope.createmenu(data, $q, $http);
                                    }
                                    else if (status === TOKEN_MISMATCH_CODE){
                                        getMenu();
                                    }
                                }).
                                error(function (data, status, headers, config) {
                                });
                        }
                        getMenu();
                    }          
            }).
            error(function (data, status, headers, config) {
                    $http.get(URL+"cgi_action?Action=Menu&Language="+language).
                    success(function (data, status, headers, config) {
                        $scope.createmenu(data, $q, $http);
                    }).
                    error(function (data, status, headers, config) {
                    });
            });
        }
        
       
    }
                menuload("en");         
    // });
    };

$scope.createmenu= function(json, $q , $http) {
	//console.log(json['items'][0]);
	var basic = [];
	var advanced = [];
	var menufinal = [];
        var menu_json = {};
       	var items = json['items']
        var i,j,k;
      	var globalorder;
        var requests = [];
        var requestcheck = [];
        var promise = function(){
            if(items!=undefined){
            for (i = 0; i < items.length; ++i) {
                var menu = items[i]['menu']        
                for (j = 0; j < menu.length; ++j) {
                    var item = menu[j];
                    var childs = item['childrens'].sort(function(a, b){
                                        return a.order - b.order
                                });
                    for (k = 0; k < childs.length; ++k) {
                        var child = childs[k]; 
                        if(child.checkvalue && child.checkurl){
                            requests.push($http.get(URL + child.checkurl));
                            requestcheck.push(child.name)
                        }
                    }
                }
            }}
            $q.all(requests).then(function(responses){
                var isTokenMismatch = false;
                angular.forEach(responses, function(result){
                    if(result.status === TOKEN_MISMATCH_CODE){
                        isTokenMismatch = true;
                    }
                });
                if(isTokenMismatch === false){
                    for (i = 0; i < items.length; ++i) {
                        var menu = items[i]['menu']
                        for (j = 0; j < menu.length; ++j) {
                            var item = menu[j];
                            var childs = item['childrens'].sort(function(a, b){
                                    return a.order - b.order
                                    });
                            for (k = 0; k < childs.length; ++k) {
                                var child = childs[k];                                
                                function menuObjectCreate(){
                                if(child.view !=undefined){
                                    if(item.name=="Basic"){
                                        dashboardname="Basic";
                                        itemviewnmae="tabHead/adv_homepage";
                                    }
                                    else{
                                        dashboardname="Advanced";
                                        itemviewnmae="tabHead/adv_homepage";
                                    }
                                    breadcrumbsdata[child.view]=[{"name":dashboardname,"path":itemviewnmae}];
                                    globalorder=parseInt(child.order)-1;
                                    breadcrumbsdata[child.view].push({
                                        "path":child.viewtype+"/"+child.view,
                                        "name":child.name,
                                        "index":globalorder,
                                        "order":globalorder
                                    })
                                }
                                var gchild = child["childrens"];
                                //gchild = gchild.sort(compare);
                                gchild = gchild.sort(function(a, b){
                                        return a.order - b.order
                                    })
                                child['childrens'] = gchild;
                                for (l = 0; l < gchild.length; ++l) {
                                    if(gchild[l].view !=undefined){
                                        if(item.name=="Basic"){
                                            dashboardname="Basic"; 
                                            itemviewnmae="tabHead/adv_homepage";
                                        }
                                        else{                   
                                            dashboardname="Advanced";     
                                            itemviewnmae="tabHead/adv_homepage";
                                        }
                                        breadcrumbsdata[gchild[l].view]=[{"name":dashboardname,"path":itemviewnmae}];
                                        breadcrumbsdata[gchild[l].view].push({"name":child.name,"path":"nothing","index":parseInt(childs[k].order)-1,"order":parseInt(gchild[l].order)-1})
                                        breadcrumbsdata[gchild[l].view].push({"name":gchild[l].name,"path":gchild[l].viewtype+"/"+gchild[l].view,"index":parseInt(childs[k].order)-1,"order":parseInt(gchild[l].order)-1})
                                    }
                                    // check for great grand children, VOIP case
                                    var ggchild = gchild[l]['childrens'];
                                    //ggchild = ggchild.sort(compare);
                                    ggchild = ggchild.sort(function(a, b){
                                            return a.order - b.order
                                        })
                                    gchild['childrens'] = ggchild;
                                    var voipchildrens=gchild['childrens']
                                    for(var m=0;m<voipchildrens.length;m++){
                                        if(voipchildrens[m].view !=undefined){
                                            if(item.name=="Basic"){
                                                dashboardname="Basic"; 
                                                itemviewnmae="tabHead/adv_homepage";
                                            }
                                            else{                   
                                                dashboardname="Advanced";     
                                                itemviewnmae="tabHead/adv_homepage";
                                            }
                                            breadcrumbsdata[voipchildrens[m].view]=[{"name":dashboardname,"path":itemviewnmae}];
                                            breadcrumbsdata[voipchildrens[m].view].push({"name":child.name,"path":"nothing","index":parseInt(childs[k].order)-1,"order":parseInt(voipchildrens[m].order)-1})
                                            breadcrumbsdata[voipchildrens[m].view].push({"name":gchild[l].name,"path":"nothing","index":parseInt(childs[k].order)-1,"order":parseInt(voipchildrens[m].order)-1})
                                            breadcrumbsdata[voipchildrens[m].view].push({"name":voipchildrens[m].name,"path":voipchildrens[m].viewtype+"/"+voipchildrens[m].view,"index":parseInt(childs[k].order)-1,"order":parseInt(voipchildrens[m].order)-1})
                                        }
                                    }
                                }
                                if (item['name'] === "Basic") {
                                    basic.push(child);
                                } else {
                                    advanced.push(child);
                                }
                            } 
                            var successindex = -1;
                            if(child.checkvalue && child.checkurl){
                                for (p = 0; p < requestcheck.length; ++p) {
                                    if(child.name == requestcheck[p])
                                        successindex = p;
                                }
                                if(successindex > -1){
                                    if(responses[successindex] != undefined && responses[successindex].data != undefined && responses[successindex].data.Objects[0].Param[0].ParamValue != child.checkvalue){
                                        menuObjectCreate();
                                    }
                                }
                            }else{
                                menuObjectCreate();
                            }
                        }
                        }
                    }
                    jsonloadstatus=true;
                    var advanced_sort = advanced.sort(function(a, b){
                        return a.order - b.order
                    })
                    var basic_sort = basic.sort(function(a, b){
                            return a.order - b.order
                        })
                    var basic_menu = {name: "Basic", id: "home", childrens: basic_sort};
                    menufinal.push(basic_menu);
                    var adv_menu = {name: "Advanced", id: "profile", childrens: advanced_sort};
                    menufinal.push(adv_menu);
                    menu_json = {menu: menufinal};
                    $scope.posts= menu_json;
                } else{
                    promise();
                }
            });
        }
        promise();
    }		        	        		                                                 
    $scope.setTabPage = function (index) {
        if($location.path() != '/' && $location.path() != "/tabHead/adv_homepage"){
            switch (index) {
                case 0:
                    $location.path("tabHead/adv_homepage");
                    break;
                case 1:
                    $location.path("tabHead/adv_homepage");
                    break;
                default:
                    $location.path("tabHead/adv_homepage");
            }
        }
    };

    $scope.accordian = function (id, bool) {
        var currentNode = document.getElementById(id);
        var childNodes = currentNode.parentNode.parentNode.childNodes;
        collapseAll(childNodes, currentNode);
        expandCurrent(currentNode, bool);
        highlightMenuItem(currentNode.parentNode, currentNode);
    };
    
    
     $rootScope.accordian = function (id, bool) {
        var currentNode = document.getElementById(id);
		 if(currentNode!=undefined){
			 var childNodes = currentNode.parentNode.parentNode.childNodes;

		 }
        collapseAll(childNodes, currentNode);
        expandCurrent(currentNode, bool);
		 if(currentNode!=null){
        highlightMenuItem(currentNode.parentNode, currentNode);
		 }
    };
 
    collapseAll = function (childNodes, currentNode) {
		if(childNodes!=undefined){
        for (var i = 0; i < childNodes.length; i++) {
            if (childNodes[i].nodeType !== 3) {
                for (var j = 0; j < childNodes[i].childNodes.length; j++) {
                    if (childNodes[i].childNodes[j].nodeType !== 3 && childNodes[i].childNodes[j].nodeName === "A" && childNodes[i].childNodes[j] !== currentNode) {
                        childNodes[i].childNodes[j].className = " ng-scope";
                    }
                    if (childNodes[i].childNodes[j].nodeType !== 3 && childNodes[i].childNodes[j].nodeName !== "A" && childNodes[i].childNodes[j] !== currentNode) {
                        childNodes[i].childNodes[j].className = "animation hide ng-scope";
                    }
                }
            }
        }}
    };
    expandCurrent = function (currentNode, bool) {
		if(currentNode!=null){
        if (currentNode.className.indexOf("hide") != -1) {
            currentNode.className = "show animation";
        } else {
            currentNode.className = "hide animation";
        }
        if (bool) {
            var lis = currentNode.getElementsByTagName("li");
            collapseAll(lis, currentNode);
        }
		}
    };
    highlightMenuItem = function (currentListItem, currentNode) {
        for (var i = 0; i < currentListItem.childNodes.length; i++) {
            if (currentListItem.childNodes[i].nodeType !== 3 && currentListItem.childNodes[i].nodeName === "A") {
                if (currentNode.className.indexOf("hide") !== -1) {
                    currentListItem.childNodes[i].className = "ng-scope";
                } else {
                    currentListItem.childNodes[i].className = "ng-scope menuitem-highlight";
                }

            }
        }
    };
    $scope.edit = function (event, formToopen) {
        location.href = "#/tableform/" + formToopen;
    }
    $scope.formfilldata = function (object, objectparams) {
        var orgobject = object;
        var objparams = objectparams.split('?');
        var objectwithoutdot = object.replace(/\./g, "");
        $http.get(URL + "cgi_get_nosubobj?Object=" + orgobject).success(function (data) {
            var objects = data.Objects;
            angular.forEach(objects, function (dataobject) {
                var data_objectname = dataobject.ObjName;
                var data_params = dataobject.Param;
                angular.forEach(data_params, function (param) {
                    var param_name = param.ParamName;
                    var param_value = param.ParamValue;
                    if (objparams.indexOf(param_name) > -1) {
                        if ($scope[objectwithoutdot] == undefined)
                            $scope[objectwithoutdot] = {};
                        $scope[objectwithoutdot][param_name] = param_value;
                    }

                })
            })
        })
    }
    $scope.callregister = function (scopevariable, clickedtab, req) {
        $scope[scopevariable] = clickedtab;
        var reqobjects = req.split('&');
        var finalobject = '';
        var reqobjectsarray = ["Device.Services.VoiceService.VoiceProfile.1.Line.1.X_VENDOR_COM_MissCallRegister.X_VENDOR_COM_MissCallRegEntry.*","Device.Services.VoiceService.VoiceProfile.1.Line.1.X_VENDOR_COM_DialCallRegister.X_VENDOR_COM_DialCallRegEntry.*","Device.Services.VoiceService.VoiceProfile.1.Line.1.X_VENDOR_COM_RecvCallRegister.X_VENDOR_COM_RecvCallRegEntry.*,Device.Services.VoiceService.X_VENDOR_COM_FxoPhyIf.1.X_VENDOR_COM_MissCallRegister.X_VENDOR_COM_MissCallRegEntry.*,Device.Services.VoiceService.X_VENDOR_COM_FxoPhyIf.1.X_VENDOR_COM_RecvCallRegister.X_VENDOR_COM_RecvCallRegEntry.*,Device.Services.VoiceService.X_VENDOR_COM_FxoPhyIf.1.X_VENDOR_COM_DialCallRegister.X_VENDOR_COM_DialCallRegEntry.*"];
        var reqobjectsarray1 = ["Device.Services.VoiceService.VoiceProfile.*.Line.*.X_VENDOR_COM_MissCallRegister.X_VENDOR_COM_MissCallRegEntry.*","Device.Services.VoiceService.VoiceProfile.*.Line.*.X_VENDOR_COM_DialCallRegister.X_VENDOR_COM_DialCallRegEntry.*","Device.Services.VoiceService.VoiceProfile.*.Line.*.X_VENDOR_COM_RecvCallRegister.X_VENDOR_COM_RecvCallRegEntry.*,Device.Services.VoiceService.X_VENDOR_COM_FxoPhyIf.*.X_VENDOR_COM_MissCallRegister.X_VENDOR_COM_MissCallRegEntry.*,Device.Services.VoiceService.X_VENDOR_COM_FxoPhyIf.*.X_VENDOR_COM_RecvCallRegister.X_VENDOR_COM_RecvCallRegEntry.*,Device.Services.VoiceService.X_VENDOR_COM_FxoPhyIf.*.X_VENDOR_COM_DialCallRegister.X_VENDOR_COM_DialCallRegEntry.*"];
        
        angular.forEach(reqobjects, function (reqobject) {
            var req = reqobject.split('?')
            var object = req[0]
            console.log("hi");
            console.log(object)
            //reqobjectsarray.push(object);
            var objparams = req[1].split(',')
            var index=reqobjectsarray.indexOf(object);
            $scope[reqobjectsarray1[index] + "params"] = objparams;
            finalobject += "Object=" + object.split('.*')[0] + ","
console.log(finalobject)
        })
        
        /* angular.forEach(modifyService.split(angular.copy(reqobjects)), function (obj) {
            finalobject += "Object=" + obj.split('.*')[0] + ","
        })*/

        finalobject = finalobject.replace(/(^[,\s]+)|([,\s]+$)/g, '');
        $scope['callregisterarray'] = [];
        $http.get(URL + "cgi_get?" + finalobject).success(function (data) {
            var objects = data.Objects;
            angular.forEach(objects, function (object) {
                var objectname = modifyService.dotstarremove(object.ObjName, '.*')
                if (reqobjectsarray1.indexOf(objectname) > -1) {
                    var tempobj = {};
                    angular.forEach(object.Param, function (params) {
                        var param_name = params.ParamName;
                        var param_value = params.ParamValue;
                        console.log(objectname+"params")
                        if ($scope[objectname + "params"].indexOf(param_name) > -1) {
                            tempobj[param_name] = param_value
                        }
                    })
                
                    $scope['callregisterarray'].push(tempobj);
                }
            })
        })
    }
    
    $rootScope.$on('rootScope:logout', function (event, args) {
        $scope.posts = {};
    });

    $scope.gotoQuickSetup = function () {
      location.href = "#/quicksetup/1"
    }
 
});
