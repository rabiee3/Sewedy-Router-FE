myapp.controller("menuController", function(
  $rootScope,
  $scope,
  $http,
  languageService
) {
  // Initialize
  $scope.posts = {};
  $scope.username = "";
  $scope.dataTab = "";
  $scope.logs = "";

  // Function to load menu
  $scope.menuOptions = function() {
    menuload();
  };

  function menuload() {
    var staticMenuPath = "static_sidemenu.json";

    //test url to check for 209
    $http
      .get(URL + "cgi_get_nosubobj?Object=Device.WiFi.Radio.1")
      .success(function(data, status) {
        if (status === 200) {
          $http
            .get(staticMenuPath)
            .then(function(response) {
              var data = response.data;

              if (!data || !Array.isArray(data.menu)) {
                $scope.posts = { menu: [] };
                return;
              }

              function processMenuItems(items) {
                if (!Array.isArray(items)) return [];

                var filtered = items.filter(function(item) {
                  if (
                    item.checkurl &&
                    item.checkvalue &&
                    item.checkvalue === "NotPresent"
                  ) {
                    return false;
                  }
                  return true;
                });

                filtered.sort(function(a, b) {
                  return parseFloat(a.order || 0) - parseFloat(b.order || 0);
                });

                filtered.forEach(function(item) {
                  if (item.childrens && item.childrens.length > 0) {
                    item.childrens = processMenuItems(item.childrens);
                  }
                });

                filtered = filtered.filter(function(item) {
                  if (
                    item.childrens &&
                    item.childrens.length === 0 &&
                    !item.view
                  ) {
                    return false;
                  }
                  return true;
                });

                return filtered;
              }

              var cleanedMenu = processMenuItems(data.menu);

              $scope.posts = { menu: cleanedMenu };
              console.log("Filtered & sorted menu:", $scope.posts);
            })
            .catch(function(error) {
              console.error("Error loading static menu:", error);
            });
        }
      })
      .error(function() {});
  }

  function getSystemLogs() {
    $http.get(URL + "cgi_get_log").success(function(data) {
      $scope.logs = data;
    });
  }

  // Watch for language change (optional)
  $rootScope.$on("rootScope:language_changed", function() {
    menuload();
  });

  // Simple helper for tab navigation
  $scope.setTabPage = function(index) {
    switch (index) {
      case 0:
      case 1:
        location.href = "#/tabHead/adv_homepage";
        break;
      default:
        location.href = "#/tabHead/adv_homepage";
    }
  };

  // Example: toggle accordion menu items
  $scope.accordian = function(id, bool) {
    var currentNode = document.getElementById(id);
    if (!currentNode) return;

    var childNodes = currentNode.parentNode.parentNode.childNodes;
    collapseAll(childNodes, currentNode);
    expandCurrent(currentNode, bool);
    highlightMenuItem(currentNode.parentNode, currentNode);
  };

  function collapseAll(childNodes, currentNode) {
    angular.forEach(childNodes, function(node) {
      if (node.nodeType !== 3) {
        angular.forEach(node.childNodes, function(child) {
          if (child.nodeType !== 3) {
            if (child.nodeName === "A" && child !== currentNode) {
              child.className = "ng-scope";
            } else if (child.nodeName !== "A" && child !== currentNode) {
              child.className = "animation hide ng-scope";
            }
          }
        });
      }
    });
  }

  function expandCurrent(currentNode, bool) {
    if (!currentNode) return;
    currentNode.className =
      currentNode.className.indexOf("hide") !== -1
        ? "show animation"
        : "hide animation";
    if (bool) {
      var lis = currentNode.getElementsByTagName("li");
      collapseAll(lis, currentNode);
    }
  }

  function highlightMenuItem(currentListItem, currentNode) {
    angular.forEach(currentListItem.childNodes, function(child) {
      if (child.nodeType !== 3 && child.nodeName === "A") {
        child.className =
          currentNode.className.indexOf("hide") !== -1
            ? "ng-scope"
            : "ng-scope menuitem-highlight";
      }
    });
  }

  // Initialize menu
  menuload();
  getSystemLogs();
});
