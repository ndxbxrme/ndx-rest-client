(function() {
  'use strict';
  var e, error, module;

  module = null;

  try {
    module = angular.module('ndx');
  } catch (error) {
    e = error;
    module = angular.module('ndx', []);
  }

  module.factory('rest', function($http, $injector, $timeout) {
    var auth, autoId, callRefreshFns, debounce, dereg, endpoints, okToLoad, refreshFns, root, socket, waiting;
    okToLoad = false;
    endpoints = {};
    autoId = '_id';
    refreshFns = [];
    waiting = false;
    debounce = function(func, wait, immediate) {
      var timeout;
      timeout = void 0;
      return function() {
        var args, callNow, context, later;
        context = this;
        args = arguments;
        later = function() {
          timeout = null;
          if (!immediate) {
            func.apply(context, args);
          }
        };
        callNow = immediate && !timeout;
        $timeout.cancel(timeout);
        timeout = $timeout(later, wait);
        if (callNow) {
          func.apply(context, args);
        }
      };
    };
    callRefreshFns = debounce(function() {
      var fn, i, key, len, results;
      if (okToLoad && endpoints) {
        results = [];
        for (key in endpoints) {
          if (endpoints[key].needsRefresh) {
            for (i = 0, len = refreshFns.length; i < len; i++) {
              fn = refreshFns[i];
              fn(key);
            }
            results.push(endpoints[key].needsRefresh = false);
          } else {
            results.push(void 0);
          }
        }
        return results;
      }
    }, 50);
    if ($injector.has('auth')) {
      okToLoad = false;
      auth = $injector.get('auth');
      root = $injector.get('$rootScope');
      dereg = root.$watch(function() {
        return auth.getUser();
      }, function(n) {
        var endpoint;
        if (n) {
          okToLoad = true;
          for (endpoint in endpoints) {
            endpoints[endpoint].needsRefresh = true;
          }
          callRefreshFns();
          return dereg();
        }
      });
    }
    try {
      if (io) {
        socket = io();
        socket.on('connect', function() {
          return socket.emit('rest', {});
        });
        socket.on('update', function(data) {
          endpoints[data.table].needsRefresh = true;
          return callRefreshFns();
        });
        socket.on('insert', function(data) {
          endpoints[data.table].needsRefresh = true;
          return callRefreshFns();
        });
        socket.on('delete', function(data) {
          endpoints[data.table].needsRefresh = true;
          return callRefreshFns();
        });
      }
    } catch (undefined) {}
    $http.get('/rest/endpoints').then(function(response) {
      var endpoint, i, len, ref;
      if (response.data && response.data.endpoints && response.data.endpoints.length) {
        ref = response.data.endpoints;
        for (i = 0, len = ref.length; i < len; i++) {
          endpoint = ref[i];
          endpoints[endpoint] = {
            needsRefresh: true
          };
        }
        if (response.data.autoId) {
          autoId = response.data.autoId;
        }
        return callRefreshFns();
      }
    }, function(err) {
      return false;
    });
    return {
      endpoints: endpoints,
      autoId: autoId,
      okToLoad: function() {
        return okToLoad;
      },
      save: function(name, obj) {
        return $http.post("/api/" + name + "/" + (obj[autoId] || ''), obj).then((function(_this) {
          return function(response) {
            endpoints[name].needsRefresh = true;
            return callRefreshFns(name);
          };
        })(this), function(err) {
          return false;
        });
      },
      'delete': function(name, obj) {
        return $http["delete"]("/api/" + name + "/" + (obj[autoId] || '')).then((function(_this) {
          return function(response) {
            endpoints[name].needsRefresh = true;
            return callRefreshFns(name);
          };
        })(this), function(err) {
          return false;
        });
      },
      register: function(fn) {
        return refreshFns.push(fn);
      },
      dereg: function(fn) {
        return refreshFns.splice(refreshFns.indexOf(fn), 1);
      }
    };
  }).run(function($rootScope, $http, rest) {
    var root;
    root = Object.getPrototypeOf($rootScope);
    root.list = function(name, args, cb) {
      var RefreshFn, dereg, obj;
      obj = {
        items: null,
        refreshFn: null,
        table: name,
        locked: false,
        save: function(item) {
          return rest.save(name, item);
        },
        "delete": function(item) {
          return rest["delete"](name, item);
        }
      };
      RefreshFn = function(name, args) {
        return function(table) {
          if (table === name || !table) {
            return $http.post("/api/" + name + "/search", args).then(function(response) {
              obj.items = response.data.items;
              obj.total = response.data.total;
              obj.page = response.data.page;
              obj.pageSize = response.data.pageSize;
              obj.error = response.data.error;
              return typeof cb === "function" ? cb(obj) : void 0;
            }, function(err) {
              obj.items = [];
              obj.total = 0;
              obj.page = 1;
              obj.error = err;
              return typeof cb === "function" ? cb(obj) : void 0;
            });
          }
        };
      };
      obj.refreshFn = RefreshFn(name, args);
      rest.register(obj.refreshFn);
      dereg = this.$watch(function() {
        return JSON.stringify(args);
      }, function(n, o) {
        if (n && rest.okToLoad()) {
          rest.endpoints[name].needsRefresh = true;
          return obj.refreshFn(obj.table);
        }
      }, true);
      this.$on('$destroy', function() {
        dereg();
        return rest.dereg(obj.refreshFn());
      });
      return obj;
    };
    return root.single = function(name, id, cb) {
      var RefreshFn, obj;
      obj = {
        item: null,
        refreshFn: null,
        table: name,
        locked: false,
        save: function() {
          return rest.save(name, this.item);
        },
        "delete": function() {
          return rest["delete"](name, this.item);
        }
      };
      RefreshFn = function(name, id) {
        return function(table) {
          if (table === name || !table) {
            return $http.get("/api/" + name + "/" + id).then(function(response) {
              obj.item = response.data;
              return typeof cb === "function" ? cb(obj.item) : void 0;
            }, function(err) {
              obj.item = {};
              return typeof cb === "function" ? cb(obj.item) : void 0;
            });
          }
        };
      };
      obj.refreshFn = RefreshFn(name, id);
      if (rest.okToLoad()) {
        rest.endpoints[name].needsRefresh = true;
        obj.refreshFn(obj.table);
      }
      return obj;
    };
  });

}).call(this);

//# sourceMappingURL=index.js.map
