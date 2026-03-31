myapp.controller("cgi_test", function($scope, $http, $location, $rootScope) {
  // Loader visibility
  $("#ajaxLoaderSection").hide();

  // Base router URL (you likely already have this defined globally)
  const BASE_URL = typeof URL !== "undefined" ? URL : "/";

  // Initialize commands array with one default input
  $scope.commands = [{ cmd: "", method: "GET" }];
  $scope.results = [];

  // Add new command input
  $scope.addCommand = function() {
    $scope.commands.push({ cmd: "", method: "GET" });
  };

  // Remove command input
  $scope.removeCommand = function(index) {
    $scope.commands.splice(index, 1);
  };

  // Sequentially execute all commands
  $scope.submitCommands = async function() {
    if ($scope.commands.length === 0) return;

    $("#ajaxLoaderSection").show();
    $scope.results = [];

    for (let i = 0; i < $scope.commands.length; i++) {
      let command = $scope.commands[i];
      let cmd = command.cmd.trim();

      cmd = cmd
        .replace(/^cgi\//i, "") // remove leading "cgi/" if user includes it
        .replace(/\r?\n/g, " ") // replace newlines with spaces
        .replace(/\s*&\s*/g, "&") // remove spaces around &
        .replace(/\s*=\s*/g, "=") // remove spaces around =
        .replace(/\s{2,}/g, " ") // collapse multiple spaces
        .trim()
        .replace(/^&+|&+$/g, ""); // remove leading/trailing &

      const fullUrl = BASE_URL + cmd;

      try {
        let response;

        if (command.method === "GET") {
          response = await $http.get(fullUrl);
        } else {
          response = await $http.post(fullUrl, cmd);
        }

        console.log(`Command ${i + 1} success:`, response.data);

        $scope.results.push({
          index: i + 1,
          command: cmd,
          method: command.method,
          status: response.status,
          data: response.data,
        });
      } catch (error) {
        console.error(`Command ${i + 1} failed:`, error);
        $scope.results.push({
          index: i + 1,
          command: cmd,
          method: command.method,
          status: error.status || "error",
          error: error.data || error.message,
        });
      }
    }

    $("#ajaxLoaderSection").hide();
    $scope.$applyAsync();
  };
});
