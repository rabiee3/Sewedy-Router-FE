myapp.controller("ddns", function($scope, $http) {
  /* ===============================
   * STATE
   * =============================== */

  $scope.ddnsEntries = [];
  $scope.selectedEntry = null;

  $scope.isEditMode = false;

  $scope.form = {};

  /* ===============================
   * STATIC DATA (PLACEHOLDERS)
   * =============================== */

  $scope.wanList = ["1_TR09_INTERNET_R_VID_10"];
  $scope.serviceProviders = ["DynDNS", "No-IP", "Custom"];

  $scope.patterns = {
    domainName: /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  };

  /* ===============================
   * INIT
   * =============================== */

  function init() {
    resetForm();
    loadDDNSTable();
  }

  /* ===============================
   * FORM HELPERS
   * =============================== */

  function resetForm() {
    $scope.form = {
      enableDDNS: false,
      wanName: "",
      domainName: "",
      serviceProvider: "",
      host: "",
      port: "",
      username: "",
      password: "",
      encryptionMode: "NONE",
    };

    $scope.isEditMode = false;
    $scope.selectedEntry = null;
  }

  function fillFormFromEntry(entry) {
    $scope.form = angular.copy(entry);
  }

  /* ===============================
   * CGI GET (TABLE LOAD)
   * =============================== */

  function loadDDNSTable() {
    /*
     * PLACEHOLDER FOR REAL CGI_GET
     *
     * $http.get('/cgi-bin/cgi_get_ddns')
     *   .then(function (response) {
     *     $scope.ddnsEntries = response.data;
     *   });
     */

    // MOCK DATA (2 rows)
    $scope.ddnsEntries = [
      {
        id: 1,
        enableDDNS: true,
        wanName: "1_TR09_INTERNET_R_VID_10",
        domainName: "home1.example.com",
        serviceProvider: "DynDNS",
        host: "members.dyndns.org",
        port: 443,
        username: "user1",
        password: "******",
        encryptionMode: "TLS",
        status: "Enabled",
        provider: "DynDNS",
        domain: "home1.example.com",
      },
      {
        id: 2,
        enableDDNS: false,
        wanName: "1_TR09_INTERNET_R_VID_10",
        domainName: "office.example.com",
        serviceProvider: "No-IP",
        host: "dynupdate.no-ip.com",
        port: 80,
        username: "user2",
        password: "******",
        encryptionMode: "NONE",
        status: "Disabled",
        provider: "No-IP",
        domain: "office.example.com",
      },
    ];
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
   * APPLY (ADD / EDIT)
   * =============================== */

  $scope.apply = function() {
    if ($scope.isEditMode) {
      /*
       * PLACEHOLDER FOR CGI_SET (EDIT)
       *
       * $http.post('/cgi-bin/cgi_set_ddns', {
       *   action: 'edit',
       *   id: $scope.selectedEntry.id,
       *   data: $scope.form
       * })
       * .then(function () {
       *   loadDDNSTable();
       *   resetForm();
       * });
       */

      console.log("EDIT CGI_SET payload:", {
        action: "edit",
        id: $scope.selectedEntry.id,
        data: $scope.form,
      });
    } else {
      /*
       * PLACEHOLDER FOR CGI_SET (ADD)
       *
       * $http.post('/cgi-bin/cgi_set_ddns', {
       *   action: 'add',
       *   data: $scope.form
       * })
       * .then(function () {
       *   loadDDNSTable();
       *   resetForm();
       * });
       */

      console.log("ADD CGI_SET payload:", {
        action: "add",
        data: $scope.form,
      });
    }

    // Simulate refresh
    loadDDNSTable();
    resetForm();
  };

  /* ===============================
   * DELETE
   * =============================== */

  $scope.deleteEntry = function(entry) {
    if (!confirm("Are you sure you want to delete this DDNS entry?")) {
      return;
    }

    /*
     * PLACEHOLDER FOR CGI_SET (DELETE)
     *
     * $http.post('/cgi-bin/cgi_set_ddns', {
     *   action: 'delete',
     *   id: entry.id
     * })
     * .then(function () {
     *   loadDDNSTable();
     *   resetForm();
     * });
     */

    console.log("DELETE CGI_SET payload:", {
      action: "delete",
      id: entry.id,
    });

    // Simulate refresh
    loadDDNSTable();
    resetForm();
  };

  /* ===============================
   * START
   * =============================== */

  init();
});
