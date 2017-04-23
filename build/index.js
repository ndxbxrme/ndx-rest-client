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
    var auth, autoId, callRefreshFns, cloneSpecialProps, dereg, destroy, endpoints, listTransform, ndxCheck, okToLoad, refreshFns, restore, restoreSpecialProps, root, socket, waiting;
    okToLoad = false;
    endpoints = {};
    autoId = '_id';
    refreshFns = [];
    waiting = false;
    ndxCheck = null;
    listTransform = {
      items: true,
      total: true,
      page: true,
      pageSize: true,
      error: true
    };
    callRefreshFns = function() {
      var key, now, results, timeoutTime;
      if (okToLoad && endpoints) {
        results = [];
        for (key in endpoints) {
          if (endpoints[key].needsRefresh) {
            timeoutTime = -1;
            now = new Date().valueOf();
            if (now > endpoints[key].nextRefresh) {
              if (now < endpoints[key].lastRefresh + 500) {
                endpoints[key].nextRefresh = endpoints[key].lastRefresh + 500;
                timeoutTime = endpoints[key].nextRefresh - now;
              } else {
                timeoutTime = 0;
              }
            }
            if (timeoutTime > -1) {
              results.push((function(key, timeoutTime) {
                return $timeout(function() {
                  var fn, i, len;
                  endpoints[key].lastRefresh = new Date().valueOf();
                  for (i = 0, len = refreshFns.length; i < len; i++) {
                    fn = refreshFns[i];
                    fn(key, endpoints[key].ids);
                  }
                  endpoints[key].ids = [];
                  return endpoints[key].needsRefresh = false;
                }, timeoutTime);
              }).call(this, key, timeoutTime));
            } else {
              results.push(void 0);
            }
          } else {
            results.push(void 0);
          }
        }
        return results;
      }
    };
    destroy = function(obj) {
      var i, item, j, key, len, len1, type;
      type = Object.prototype.toString.call(obj);
      if (type === '[object Object]') {
        if (obj.destroy) {
          obj.destroy();
        }
        for (i = 0, len = obj.length; i < len; i++) {
          key = obj[i];
          destroy(obj[key]);
        }
      } else if (type === '[object Array]') {
        for (j = 0, len1 = obj.length; j < len1; j++) {
          item = obj[j];
          destroy(item);
        }
      }
    };
    restore = function(obj) {
      var i, item, j, key, len, len1, type;
      type = Object.prototype.toString.call(obj);
      if (type === '[object Object]') {
        if (obj.refreshFn) {
          refreshFns.push(obj.refreshFn);
        }
        for (i = 0, len = obj.length; i < len; i++) {
          key = obj[i];
          restore(obj[key]);
        }
      } else if (type === '[object Array]') {
        for (j = 0, len1 = obj.length; j < len1; j++) {
          item = obj[j];
          restore(item);
        }
      }
    };
    cloneSpecialProps = function(obj) {
      var clonedItem, i, item, key, len, output, type;
      output = null;
      type = Object.prototype.toString.call(obj);
      if (type === '[object Array]') {
        output = [];
        for (i = 0, len = obj.length; i < len; i++) {
          item = obj[i];
          clonedItem = cloneSpecialProps(item);
          clonedItem[autoId] = item[autoId];
          output.push(clonedItem);
          break;
        }
      } else if (type === '[object Object]') {
        output = {};
        for (key in obj) {
          if (key.indexOf('$') === 0) {
            output[key] = obj[key];
          }
        }
      }
      return output;
    };
    restoreSpecialProps = function(obj, clonedProps) {
      var clonedItem, i, item, j, key, len, len1, type;
      type = Object.prototype.toString.call(obj);
      if (type === '[object Array]') {
        for (i = 0, len = obj.length; i < len; i++) {
          item = obj[i];
          for (j = 0, len1 = clonedProps.length; j < len1; j++) {
            clonedItem = clonedProps[j];
            if (item[autoId] === clonedItem[autoId]) {
              restoreSpecialProps(item, clonedItem);
              break;
            }
          }
        }
      } else if (type === '[object Object]') {
        for (key in clonedProps) {
          obj[key] = clonedProps[key];
          restore(obj[key]);
        }
      }
    };
    if ($injector.has('ndxCheck')) {
      ndxCheck = $injector.get('ndxCheck');
    }
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
          endpoints[data.table].ids.push(data.id);
          return callRefreshFns();
        });
        socket.on('insert', function(data) {
          endpoints[data.table].needsRefresh = true;
          return callRefreshFns();
        });
        socket.on('delete', function(data) {
          endpoints[data.table].needsRefresh = true;
          endpoints[data.table].ids.push(data.id);
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
            needsRefresh: true,
            lastRefresh: 0,
            nextRefresh: 0,
            ids: []
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
      save: function(endpoint, obj) {
        return $http.post((endpoint.route || ("/api/" + endpoint)) + ("/" + (obj[autoId] || '')), obj).then((function(_this) {
          return function(response) {
            endpoints[endpoint].needsRefresh = true;
            ndxCheck && ndxCheck.setPristine();
            return callRefreshFns(endpoint);
          };
        })(this), function(err) {
          return false;
        });
      },
      'delete': function(endpoint, obj) {
        return $http["delete"]((endpoint.route || ("/api/" + endpoint)) + ("/" + (obj[autoId] || ''))).then((function(_this) {
          return function(response) {
            endpoints[endpoint].needsRefresh = true;
            ndxCheck && ndxCheck.setPristine();
            return callRefreshFns(endpoint);
          };
        })(this), function(err) {
          return false;
        });
      },
      search: function(endpoint, args, obj, cb) {
        args = args || {};
        return $http.post(endpoint.route || ("/api/" + endpoint + "/search"), endpoint.route && args && args.where ? args.where : args).then(function(response) {
          var clonedProps;
          clonedProps = null;
          if (obj.items && obj.items.length) {
            clonedProps = cloneSpecialProps(obj.items);
          }
          objtrans(response.data, args.transform || listTransform, obj);
          if (obj.items && obj.items.length && clonedProps) {
            restoreSpecialProps(obj.items, clonedProps);
          }
          return typeof cb === "function" ? cb(obj) : void 0;
        }, function(err) {
          obj.items = [];
          obj.total = 0;
          obj.page = 1;
          obj.error = err;
          return typeof cb === "function" ? cb(obj) : void 0;
        });
      },
      list: function(endpoint, obj, cb) {
        return $http.post(endpoint.route || ("/api/" + endpoint)).then(function(response) {
          var clonedProps;
          clonedProps = null;
          if (obj.items && obj.items.length) {
            clonedProps = cloneSpecialProps(obj.items);
          }
          objtrans(response.data, args.transform || listTransform, obj);
          if (obj.items && obj.items.length && clonedProps) {
            restoreSpecialProps(obj.items, clonedProps);
          }
          return typeof cb === "function" ? cb(obj) : void 0;
        }, function(err) {
          obj.items = [];
          obj.total = 0;
          obj.page = 1;
          obj.error = err;
          return typeof cb === "function" ? cb(obj) : void 0;
        });
      },
      single: function(endpoint, id, obj, cb) {
        return $http.get((endpoint.route || ("/api/" + endpoint)) + ("/" + id)).then(function(response) {
          var clonedProps;
          clonedProps = null;
          if (obj.item) {
            clonedProps = cloneSpecialProps(obj.items);
          }
          obj.item = response.data;
          if (obj.item && clonedProps) {
            restoreSpecialProps(obj.item, clonedProps);
          }
          return typeof cb === "function" ? cb(obj) : void 0;
        }, function(err) {
          obj.item = {};
          return typeof cb === "function" ? cb(obj) : void 0;
        });
      },
      register: function(fn) {
        return refreshFns.push(fn);
      },
      dereg: function(fn) {
        return refreshFns.splice(refreshFns.indexOf(fn), 1);
      },
      destroy: destroy
    };
  }).run(function($rootScope, $http, rest) {
    var root;
    root = Object.getPrototypeOf($rootScope);
    root.list = function(endpoint, args, cb) {
      var RefreshFn, dereg, obj;
      obj = {
        items: null,
        refreshFn: null,
        endpoint: endpoint,
        locked: false,
        save: function(item, checkFn) {
          if (checkFn) {
            return checkFn('save', endpoint, item, function() {
              return rest.save(endpoint, item);
            });
          } else {
            return rest.save(endpoint, item);
          }
        },
        "delete": function(item, checkFn) {
          if (checkFn) {
            return checkFn('delete', endpoint, item, function() {
              return rest["delete"](endpoint, item);
            });
          } else {
            return rest["delete"](endpoint, item);
          }
        },
        destroy: function() {
          return rest.dereg(obj.refreshFn);
        }
      };
      RefreshFn = function(endpoint, args) {
        return function(table) {
          var ep, i, len, ref, results;
          if (!obj.locked) {
            if (obj.items) {
              rest.destroy(obj.items);
            }
            if (endpoint.route) {
              if (endpoint.endpoints && table) {
                ref = endpoint.endpoints;
                results = [];
                for (i = 0, len = ref.length; i < len; i++) {
                  ep = ref[i];
                  if (table === ep) {
                    rest.search(endpoint, args, obj, cb);
                    break;
                  } else {
                    results.push(void 0);
                  }
                }
                return results;
              }
            } else {
              if (table === endpoint || !table) {
                return rest.search(endpoint, args, obj, cb);
              }
            }
          }
        };
      };
      obj.refreshFn = RefreshFn(endpoint, args);
      rest.register(obj.refreshFn);
      if (rest.endpoints || (endpoint.route && !endpoint.endpoints)) {
        rest.search(endpoint, args, obj, cb);
      }
      dereg = this.$watch(function() {
        return JSON.stringify(args);
      }, function(n, o) {
        var ep, i, len, ref;
        if (n && rest.okToLoad()) {
          if (endpoint.route) {
            if (endpoint.endpoints && endpoint.endpoints.length) {
              ref = endpoint.endpoints;
              for (i = 0, len = ref.length; i < len; i++) {
                ep = ref[i];
                rest.endpoints[ep].needsRefresh = true;
              }
            }
          } else {
            rest.endpoints[endpoint].needsRefresh = true;
          }
          return obj.refreshFn(obj.endpoint);
        }
      }, true);
      this.$on('$destroy', function() {
        dereg();
        return obj.destroy();
      });
      return obj;
    };
    return root.single = function(endpoint, id, cb) {
      var RefreshFn, ep, i, len, obj, ref;
      obj = {
        item: null,
        refreshFn: null,
        endpoint: endpoint,
        locked: false,
        save: function(checkFn) {
          if (checkFn) {
            return checkFn('save', endpoint, this.item, (function(_this) {
              return function() {
                return rest.save(endpoint, _this.item);
              };
            })(this));
          } else {
            return rest.save(endpoint, this.item);
          }
        },
        "delete": function(checkFn) {
          if (checkFn) {
            return checkFn('delete', endpoint, this.item, (function(_this) {
              return function() {
                return rest["delete"](endpoint, _this.item);
              };
            })(this));
          } else {
            return rest["delete"](endpoint, this.item);
          }
        },
        destroy: function() {
          return rest.dereg(obj.refreshFn);
        }
      };
      RefreshFn = function(endpoint, id) {
        return function(table, ids) {
          var ep, i, len, ref, results;
          if (ids && obj.item && ids.indexOf(obj.item[rest.autoId]) === -1) {
            return;
          }
          if (!obj.locked) {
            if (endpoint.route) {
              if (endpoint.endpoints) {
                if (endpoint.endpoints.length && table) {
                  ref = endpoint.endpoints;
                  results = [];
                  for (i = 0, len = ref.length; i < len; i++) {
                    ep = ref[i];
                    if (table === ep) {
                      rest.single(endpoint, id, obj, cb);
                      break;
                    } else {
                      results.push(void 0);
                    }
                  }
                  return results;
                }
              }
            } else {
              if (table === endpoint || !table) {
                return rest.single(endpoint, id, obj, cb);
              }
            }
          }
        };
      };
      obj.refreshFn = RefreshFn(endpoint, id);
      rest.register(obj.refreshFn);
      if (rest.okToLoad()) {
        if (endpoint.route) {
          if (endpoint.endpoints) {
            ref = endpoint.endpoints;
            for (i = 0, len = ref.length; i < len; i++) {
              ep = ref[i];
              rest.endpoints[ep].needsRefresh = true;
            }
          }
        } else {
          rest.endpoints[endpoint].needsRefresh = true;
        }
        obj.refreshFn(obj.endpoint);
      }
      if (endpoint.route && !endpoint.endpoints) {
        rest.single(endpoint, id, obj, cb);
      }
      this.$on('$destroy', obj.destroy);
      return obj;
    };
  });

}).call(this);

//# sourceMappingURL=index.js.map
