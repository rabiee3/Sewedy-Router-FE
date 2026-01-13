myapp.controller("diagnosticsController", function(
  $scope,
  $http,
  $route,
  localStorageService,
  modifyService,
  $translate,
  $rootScope,
  $interval,
  TOKEN_MISMATCH_CODE
) {
  $("#ajaxLoaderSection").show();
  pageloadiconstatus = true;
  $scope.erroronvalidation = false;

  // var jsonpromise = $interval(function () {
  //     console.log(breadcrumbsdata)
  //     if (jsonloadstatus) {
  //         if (breadcrumbsdata[$route.current.params.param] == undefined) {
  //             $rootScope["breadcrumbs"] = JSON.parse(localStorage.getItem('breadcrumbarray'));

  //             if (localStorage.getItem('hybrideditObject') == null)
  //                 $rootScope["breadcrumbs"].push({
  //                     "name": "Add",
  //                     "path": 'nothing'
  //                 })

  //             else
  //                 $rootScope["breadcrumbs"].push({
  //                     "name": "Edit",
  //                     "path": 'nothing'
  //                 })

  //         } else {

  //             $rootScope["breadcrumbs"] = breadcrumbsdata[$route.current.params.param]
  //             localStorage.setItem('breadcrumbarray', JSON.stringify($rootScope["breadcrumbs"]))
  //             if (breadcrumbstatus) {
  //                 breadcrumbstatus = false;
  //                 setTimeout(function () {
  //                     var tabtype = 'home';
  //                     angular.forEach($rootScope["breadcrumbs"], function (breadcrumbobject, bindex) {
  //                         if (bindex == 0) {
  //                             if (breadcrumbobject.name == "Basic") {
  //                                 $("#myTab li:first-child").addClass('active');
  //                                 $("#home").addClass('active');
  //                                 $("#profile").removeClass('active');
  //                                 $("#myTab li:nth-child(2)").removeClass('active');
  //                             } else {
  //                                 tabtype = 'profile';
  //                                 $("#myTab li:nth-child(2)").addClass('active');
  //                                 $("#myTab li:first-child").removeClass('active');
  //                                 $("#home").removeClass('active');
  //                                 $("#profile").addClass('active');
  //                             }
  //                         } else {
  //                             if (bindex == 1)
  //                                 $rootScope.accordian(tabtype + "-" + breadcrumbobject.name + "-" + breadcrumbobject.index, true);
  //                             else
  //                                 $rootScope.accordian(breadcrumbobject.name + "-" + breadcrumbobject.order + "-" + breadcrumbobject.index, true);
  //                         }
  //                     });
  //                 }, 300);
  //             }
  //         }
  //         $interval.cancel(jsonpromise);
  //     }
  //     console.log($rootScope["breadcrumbs"])

  // }, 500);
  $scope.homefun = function() {
    if (breadcrumbsdata[$route.current.params.param] == undefined)
      bdata = JSON.parse(localStorage.getItem("breadcrumbarray"));
    else bdata = breadcrumbsdata[$route.current.params.param];
    if (bdata[0]["name"] == "Advanced") tab = "profile";
    else tab = "home";
    $rootScope.accordian(
      tab + "-" + bdata[1]["name"] + "-" + bdata[1]["index"],
      true
    );
  };
  /* Breadscrumbs Logic ends here */

  /* Translation starts here */
  var activeLanguage = $translate.use();
  if (activeLanguage != undefined) activeLanguage = $translate.use().split("/");
  else activeLanguage = "en".split("/");
  if (activeLanguage.length > 1) activeLanguage = activeLanguage[1];
  else activeLanguage = activeLanguage[0];
  if (
    $("#dataView")
      .find("div#translation")
      .html() != ""
  )
    $translate.use(
      "languages/" +
        activeLanguage +
        "/" +
        $("#dataView")
          .find("div#translation")
          .html()
    );
  else $translate.use(activeLanguage);
  /* Translation ends here */
  $scope.Linkmapping = {};
  $scope.Linkmapping[""] = "UNKNOWN";
  $scope.Linkmapping["G.992.3_Annex_K_ATM"] = "ADSL";
  $scope.Linkmapping["G.992.3_Annex_K_PTM"] = "ADSL";
  $scope.Linkmapping["G.993.2_Annex_K_ATM"] = "VDSL";
  $scope.Linkmapping["G.993.2_Annex_K_PTM"] = "VDSL";
  $scope.Linkmapping["G.994.1"] = "Auto";
  var changedFields = [];
  var traceroutetestchangedFields = [];
  $scope.loading = false;
  $scope.loading1 = false;
  $scope.loadingipping = false;
  $scope.loadingipping1 = false;
  $scope.loadingtrace = false;
  $scope.loadingtrace1 = false;
  $scope["diagnoseformstatus"] = false;

  getRequestData = function(reqParams) {
    $scope.loading = true;
    $scope.loading1 = true;
    $http
      .get(URL + reqParams)
      .success(function(data, status, headers, config) {
        if (status === 200) {
          objects = data.Objects;
          console.log(objects);
          for (var obj = 0; obj < objects.length; obj++) {
            // setTimeout(function () {
            var objectParamValues = objects[obj].Param;
            for (var pa1 = 0; pa1 < objectParamValues.length; pa1++) {
              var param_name = objectParamValues[pa1].ParamName;
              var ParamValue = objectParamValues[pa1].ParamValue;
              if (
                $scope[
                  objects[obj].ObjName.replace(/\./g, "").replace(/\*/g, "")
                ] === undefined
              )
                $scope[
                  objects[obj].ObjName.replace(/\./g, "").replace(/\*/g, "")
                ] = {};
              $scope[
                objects[obj].ObjName.replace(/\./g, "").replace(/\*/g, "")
              ][param_name] = ParamValue;
            }
            //  }, 2000);
          }
          $scope.loading1 = false;
          //                    $('.ajaxPrgressbarSection').hide();
        } else if (500 <= status && status < 600) {
          $scope["startformname" + "popup"] = true;
          $scope["startformname" + "popupval"] =
            data.Objects[0].Param[0].ParamValue;
        } else if (400 <= status && status < 500) {
          if (data.Objects.length < 2 && data.Objects[0].Param.length < 2) {
            $scope["startformname" + "popup"] = true;
            $scope["startformname" + "popupval"] =
              data.Objects[0].Param[0].ParamValue;
          } else {
            angular.forEach(data.Objects, function(object) {
              var respobject = object.ObjName.replace(/\./g, "").replace(
                /\*/g,
                ""
              );
              angular.forEach(object.Param, function(param) {
                $scope[
                  respobject + "_" + param.ParamName + "responsestatus"
                ] = true;
                $scope[respobject + "_" + param.ParamName + "val"] =
                  param.ParamValue;
              });
            });
          }
        } else if (status === TOKEN_MISMATCH_CODE) {
          getRequestData(reqParams);
        }
      })
      .error(function(data, status, headers, config) {
        $scope.loading1 = false;
        //                    $('.ajaxPrgressbarSection').hide();
      });
  };
  getRequestData("cgi_get?Object=Device.SelfTestDiagnostics");
  $scope.startData = function() {
    $scope.loading = false;
    setTimeout(function() {
      getRequestData("cgi_get?Object=Device.SelfTestDiagnostics");
    }, 100);
  };

  $scope.textChange = function(value) {
    changedFields.push(value);
  };

  getIPPingFormData = function(reqParams) {
    $scope.loadingipping = true;
    $scope.loadingipping1 = true;
    $scope.ippingArray = [];
    $http
      .get(URL + reqParams)
      .success(function(data, status, headers, config) {
        if (status === 200) {
          objects = data.Objects;
          $scope.objects = objects;
          for (var obj = 0; obj < objects.length; obj++) {
            var objectParamValues = objects[obj].Param;
            var ippingobject = {};
            for (var i = 0; i < objectParamValues.length; i++) {
              var param_name = objectParamValues[i].ParamName;
              var param_value = objectParamValues[i].ParamValue;
              ippingobject[param_name] = param_value;
            }
            $scope.ippingArray.push(ippingobject);
          }
          $scope.loadingipping1 = false;
          //                    $('.ajaxPrgressbarSection').hide();
        } else if (500 <= status && status < 600) {
          $scope["ippingformname" + "popup"] = true;
          $scope["ippingformname" + "popupval"] =
            data.Objects[0].Param[0].ParamValue;
        } else if (400 <= status && status < 500) {
          if (data.Objects.length < 2 && data.Objects[0].Param.length < 2) {
            $scope["ippingformname" + "popup"] = true;
            $scope["ippingformname" + "popupval"] =
              data.Objects[0].Param[0].ParamValue;
          } else {
            angular.forEach(data.Objects, function(object) {
              var respobject = object.ObjName.replace(/\./g, "").replace(
                /\*/g,
                ""
              );
              angular.forEach(object.Param, function(param) {
                $scope[
                  respobject + "_" + param.ParamName + "responsestatus"
                ] = true;
                $scope[respobject + "_" + param.ParamName + "val"] =
                  param.ParamValue;
              });
            });
          }
        } else if (status === TOKEN_MISMATCH_CODE) {
          getIPPingFormData(reqParams);
        }
      })
      .error(function(data, status, headers, config) {
        $scope.loadingipping1 = false;
        //                    $('.ajaxPrgressbarSection').hide();
      });
  };
  $scope.startIPPingTest = function(object, event) {
    $scope["diagnoseformstatus"] = true;
    $scope.loadingipping = false;
    $scope.loadingipping1 = true;
    if (event.currentTarget.attributes["formstatus"].value == "true") {
      if ($scope["IPHost"] !== "" && $scope["IPHost"] !== undefined) {
        urlstatus = false;
        var post = "";
        var url = URL + "cgi_set?";
        var formobjects = object.split("?");
        angular.forEach(formobjects, function(object) {
          var objectlevelurlstatus = false;
          var postobject = "Object=" + object + "&Operation=Modify";
          //            angular.forEach($scope[object.replace(/\./g, "")], function (value, key) {
          //            if (changedFields.indexOf("IPHost") > -1) {
          objectlevelurlstatus = true;
          urlstatus = true;
          postobject += "&NumberOfRepetitions=1&Host" + "=" + $scope["IPHost"];
          //            }
          //            });
          if (objectlevelurlstatus) post += postobject + ",";
        });
        post = post.replace(/(^[,\s]+)|([,\s]+$)/g, "");
        //        changedFields = [];
        //alert(post);
        if (urlstatus) {
          var setData = function() {
            $http
              .post(url, post)
              .success(function(data, status, headers, config) {
                if (status === 200) {
                  setTimeout(function() {
                    getIPPingFormData(
                      "cgi_get?Object=Device.IP.Diagnostics.IPPing"
                    );
                  }, 100);
                } else if (500 <= status && status < 600) {
                  $scope["ipping" + "popup"] = true;
                  $scope["ipping" + "popupval"] =
                    data.Objects[0].Param[0].ParamValue;
                } else if (400 <= status && status < 500) {
                  angular.forEach(data.Objects, function(object) {
                    var respobject = object.ObjName.replace(/\./g, "").replace(
                      /\*/g,
                      ""
                    );
                    angular.forEach(object.Param, function(param) {
                      $scope[
                        respobject + "_" + param.ParamName + "responsestatus"
                      ] = true;
                      $scope[respobject + "_" + param.ParamName + "val"] =
                        param.ParamValue;
                    });
                  });
                } else if (status === TOKEN_MISMATCH_CODE) {
                  setData();
                }
              })
              .error(function(data, status, headers, config) {});
          };
          setData();
        } else {
          alert("Parameter is Empty");
        }
      } else {
        alert("Value is Empty");
      }
    }
  };

  $scope.textChangeTracerouteTest = function(value) {
    traceroutetestchangedFields.push(value);
  };

  $scope.startTracerouteTest = function(object) {
    $scope.erroronvalidation = false;
    $scope.tracerouteArray = [];
    $scope.errorMessage = "";
    $scope.loadingtrace = false;
    $scope.loadingtrace1 = true;

    const host = $scope.TraceRouteHost?.trim();

    if (!host) {
      alert("Value is Empty");
      $scope.loadingtrace1 = false;
      return;
    }


    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^\s*((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:)))(%.+)?\s*$/;
    const urlRegex = /^((https?|ftp):\/\/)?([a-z0-9-]+[.])+[a-z]{2,}(:\d+)?(\/.*)?$/i;
    const valid =
      ipv4Regex.test(host) || ipv6Regex.test(host) || urlRegex.test(host);
    if (!valid) {
      $scope.loadingtrace = false;
      $scope.loadingtrace1 = false;
      $scope.erroronvalidation = true;
      return;
    }
    const url = URL + "cgi_set?";
    const objects = object.split("?");
    let post = "";
    angular.forEach(objects, function(obj) {
      const postobject = "Object=" + obj + "&Operation=Modify&Host=" + host;
      post += postobject + ",";
    });
    post = post.replace(/(^[,\s]+)|([,\s]+$)/g, "");
    const setData = function() {
      $http.post(url, post).then(
        function(response) {
          const status = response.status;
          const data = response.data;

          if (status === 200) {
            setTimeout(() => {
              getFormData("cgi_get?Object=Device.IP.Diagnostics.TraceRoute")
                .then(displayTracerouteResult)
                .catch(() => {
                  $scope.errorMessage = "Failed to fetch traceroute results.";
                });
            }, 3000);
          } else if (status === TOKEN_MISMATCH_CODE) {
            setData();
          } else {
            $scope.errorMessage = "Error: " + status;
          }
        },
        function(error) {
          $scope.errorMessage = "HTTP Error: " + error.status;
          $scope.loadingtrace = false;
          $scope.loadingtrace1 = false;
        }
      );
    };

    // Show progress bar and send
    $scope.loadingtrace1 = true;
    setData();
  };

  // This helper processes your cgi_get response
  function displayTracerouteResult(data) {
    $scope.loadingtrace1 = false;
    $scope.loadingtrace = true;

    if (!data || !data.Objects) {
      $scope.errorMessage = "No response from device.";
      return;
    }

    const traceObj = data.Objects.find(
      (o) => o.ObjName === "Device.IP.Diagnostics.TraceRoute"
    );
    const stateParam = traceObj?.Param?.find(
      (p) => p.ParamName === "DiagnosticsState"
    );
    const state = stateParam ? stateParam.ParamValue : "Unknown";

    const hops = data.Objects.filter((o) =>
      o.ObjName.startsWith("Device.IP.Diagnostics.TraceRoute.RouteHops.")
    );
    $scope.tracerouteArray = hops.map((hop) => {
      const getParam = (n) =>
        hop.Param.find((p) => p.ParamName === n)?.ParamValue || "-";
      return {
        Host: getParam("Host"),
        HostAddress: getParam("HostAddress"),
        RTTimes: getParam("RTTimes"),
      };
    });

    if (state !== "Complete") {
      $scope.errorMessage =
        "TraceRoute ended with: " +
        state.replace("Error_", "").replace(/_/g, " ");
    }

    $scope.$applyAsync();
  }

  getFormData = function(reqParams) {
    return $http.get(URL + reqParams).then(function(response) {
      var data = response.data;
      var status = response.status;

      if (status === 200) {
        var objects = data.Objects;
        $scope.diagnoseArray = [];
        for (var obj = 0; obj < objects.length; obj++) {
          if (objects[obj].ObjName === "Device.IP.Diagnostics.TraceRoute") {
            var objectParamValues = objects[obj].Param;
            var diagnoseobject = {};
            for (var i = 0; i < objectParamValues.length; i++) {
              var paramName = objectParamValues[i].ParamName;
              var paramValue = objectParamValues[i].ParamValue;
              if (
                paramName === "DiagnosticsState" ||
                paramName === "RouteHopsNumberOfEntries"
              ) {
                diagnoseobject[paramName] = paramValue;
              }
            }
            if (
              diagnoseobject.DiagnosticsState === "Error_CannotResolveHostName"
            ) {
              $scope.loadingtrace = true;
              $scope["error_responsestatus"] = true;
              $scope["err_val"] = "Cannot resolve host name.";
              $scope.loadingtrace1 = false;
            } else {
              getTraceRoute(
                "cgi_get?Object=Device.IP.Diagnostics.TraceRoute.RouteHops",
                diagnoseobject
              );
            }
          }
        }
        return data;
      }
      if (status === TOKEN_MISMATCH_CODE) {
        return getFormData(reqParams);
      } else {
        return $q.reject({ status, data });
      }
    });
  };

  getTraceRoute = function(reqParams, diagnoseobject) {
    $scope.loadingtrace = true;
    /*  $scope.loadingtrace1 = true;*/
    $http
      .get(URL + reqParams)
      .success(function(data, status, headers, config) {
        if (status === 200) {
          objects = data.Objects;
          $scope.tracerouteArray = [];
          for (
            var obj = 0;
            obj < diagnoseobject.RouteHopsNumberOfEntries;
            obj++
          ) {
            var objectParamValues = objects[obj].Param;
            var tracerouteobject = {};
            for (var i = 0; i < objectParamValues.length; i++) {
              var param_name = objectParamValues[i].ParamName;
              var param_value = objectParamValues[i].ParamValue;
              tracerouteobject[param_name] = param_value;
            }
            $scope.tracerouteArray.push(tracerouteobject);
          }
          $scope.loadingtrace1 = false;
          //                    $('.ajaxPrgressbarSection').hide();
        } else if (500 <= status && status < 600) {
          $scope["traceroutedata" + "popup"] = true;
          $scope["traceroutedata" + "popupval"] =
            data.Objects[0].Param[0].ParamValue;
        } else if (400 <= status && status < 500) {
          if (data.Objects.length < 2 && data.Objects[0].Param.length < 2) {
            $scope["traceroutedata" + "popup"] = true;
            $scope["traceroutedata" + "popupval"] =
              data.Objects[0].Param[0].ParamValue;
          } else {
            angular.forEach(data.Objects, function(object) {
              var respobject = object.ObjName.replace(/\./g, "").replace(
                /\*/g,
                ""
              );
              angular.forEach(object.Param, function(param) {
                $scope[
                  respobject + "_" + param.ParamName + "responsestatus"
                ] = true;
                $scope[respobject + "_" + param.ParamName + "val"] =
                  param.ParamValue;
              });
            });
          }
        } else if (status === TOKEN_MISMATCH_CODE) {
          getTraceRoute(reqParams, diagnoseobject);
        }
      })
      .error(function(data, status, headers, config) {
        //                    $('.ajaxPrgressbarSection').hide();
        $scope.loadingtrace1 = false;
      });
  };

  $scope.selectIPPing = function() {
    $scope.loadingipping = false;
  };
  $scope.selectTrace = function() {
    $scope.loadingtrace = false;
    $scope.erroronvalidation = false;
  };
  $scope.popupclose = function(scopeparam) {
    $scope[scopeparam] = false;
  };
});
