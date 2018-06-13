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

  module.provider('rest', function() {
    var bustCache, cacheBuster, callbacks, lockAll, syncCallback, waitForAuth;
    waitForAuth = false;
    bustCache = false;
    lockAll = false;
    cacheBuster = function() {
      if (bustCache) {
        return "?" + (Math.floor(Math.random() * 9999999999999));
      } else {
        return '';
      }
    };
    callbacks = {
      endpoints: []
    };
    syncCallback = function(name, obj, cb) {
      var callback, i, len, ref;
      if (callbacks[name] && callbacks[name].length) {
        ref = callbacks[name];
        for (i = 0, len = ref.length; i < len; i++) {
          callback = ref[i];
          callback(obj);
        }
      }
      return typeof cb === "function" ? cb() : void 0;
    };
    return {
      bustCache: function(val) {
        return bustCache = val;
      },
      waitForAuth: function(val) {
        return waitForAuth = val;
      },
      $get: function($http, $injector, $timeout) {
        var auth, autoId, callRefreshFns, cloneSpecialProps, destroy, endpoints, listTransform, loading, maintenanceMode, ndxCheck, needsRefresh, okToLoad, refreshFns, restore, restoreSpecialProps, socket, socketRefresh, waiting;
        okToLoad = true;
        endpoints = {};
        autoId = '_id';
        refreshFns = [];
        waiting = false;
        ndxCheck = null;
        needsRefresh = false;
        maintenanceMode = false;
        loading = 0;
        listTransform = {
          items: true,
          total: true,
          page: true,
          pageSize: true,
          error: true
        };
        callRefreshFns = function() {
          var fn, i, key, len, results;
          if (okToLoad && endpoints) {
            results = [];
            for (key in endpoints) {
              if (endpoints[key].needsRefresh) {
                for (i = 0, len = refreshFns.length; i < len; i++) {
                  fn = refreshFns[i];
                  fn(key, endpoints[key].ids);
                }
                endpoints[key].ids = [];
                results.push(endpoints[key].needsRefresh = false);
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
            output = output || [];
            for (i = 0, len = obj.length; i < len; i++) {
              item = obj[i];
              if (item[autoId]) {
                clonedItem = cloneSpecialProps(item);
                clonedItem[autoId] = item[autoId];
                output.push(clonedItem);
              }
            }
          } else if (type === '[object Object]') {
            output = output || {};
            for (key in obj) {
              if (key.indexOf('$') === 0) {
                output[key] = obj[key];
              } else if (Object.prototype.toString.call(obj[key]) === '[object Array]') {
                output[key] = cloneSpecialProps(obj[key]);
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
              if (key.indexOf('$') === 0 && key !== '$$hashKey') {
                obj[key] = clonedProps[key];
                restore(obj[key]);
              } else {
                restoreSpecialProps(obj[key], clonedProps[key]);
              }
            }
          }
        };
        if ($injector.has('ndxCheck')) {
          ndxCheck = $injector.get('ndxCheck');
        }
        if ($injector.has('Auth')) {
          okToLoad = false;
          auth = $injector.get('Auth');
          auth.onUser(function() {
            return $timeout(function() {
              var endpoint;
              okToLoad = true;
              for (endpoint in endpoints) {
                endpoints[endpoint].needsRefresh = true;
              }
              return callRefreshFns();
            });
          });
        }
        socketRefresh = function(data) {
          var id, key, type;
          if (!lockAll) {
            if (data) {
              endpoints[data.table].needsRefresh = true;
              type = Object.prototype.toString.call(data.id);
              if (type === '[object Array]') {
                for (id in data.id) {
                  endpoints[data.table].ids.push(id);
                }
              } else if (type === '[object String]') {
                endpoints[data.table].ids.push(data.id);
              }
            } else {
              for (key in endpoints) {
                endpoints[key].needsRefresh = true;
              }
            }
            return callRefreshFns();
          }
        };
        if ($injector.has('socket')) {
          socket = $injector.get('socket');
          socket.on('connect', function() {
            return socket.emit('rest', {});
          });
          if (!$injector.has('Server')) {
            socket.on('update', socketRefresh);
            socket.on('insert', socketRefresh);
            socket.on('delete', socketRefresh);
          }
        }
        $timeout(function() {
          return $http.get('/rest/endpoints').then(function(response) {
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
              if (response.data.server) {
                maintenanceMode = response.data.server === 'maintenance';
              }
              if (needsRefresh) {
                callRefreshFns();
              }
              return syncCallback('endpoints', response.data);
            }
          }, function(err) {
            return false;
          });
        });
        return {
          lockAll: function() {
            return lockAll = true;
          },
          unlockAll: function() {
            return lockAll = false;
          },
          on: function(name, callback) {
            return callbacks[name].push(callback);
          },
          off: function(name, callback) {
            return callbacks[name].splice(callbacks[name].indexOf(callback), 1);
          },
          endpoints: endpoints,
          autoId: autoId,
          maintenanceMode: function() {
            return maintenanceMode;
          },
          socketRefresh: socketRefresh,
          needsRefresh: function(val) {
            return needsRefresh = val;
          },
          callRefreshFns: callRefreshFns,
          okToLoad: function() {
            return okToLoad;
          },
          save: function(endpoint, obj, cb) {
            loading++;
            return $http.post((endpoint.route || ("/api/" + endpoint)) + ("/" + (obj[autoId] || '')), obj).then((function(_this) {
              return function(response) {
                loading--;
                endpoints[endpoint].needsRefresh = true;
                ndxCheck && ndxCheck.setPristine();
                callRefreshFns(endpoint);
                return response && response.data && (typeof cb === "function" ? cb(response.data) : void 0);
              };
            })(this), function(err) {
              loading--;
              return false;
            });
          },
          'delete': function(endpoint, obj, cb) {
            loading++;
            return $http["delete"]((endpoint.route || ("/api/" + endpoint)) + ("/" + (obj[autoId] || ''))).then((function(_this) {
              return function(response) {
                loading--;
                endpoints[endpoint].needsRefresh = true;
                ndxCheck && ndxCheck.setPristine();
                callRefreshFns(endpoint);
                return response && response.data && (typeof cb === "function" ? cb(response.data) : void 0);
              };
            })(this), function(err) {
              loading--;
              return false;
            });
          },
          search: function(endpoint, args, obj, cb) {
            loading++;
            args = args || {};
            return $http.post(endpoint.route || ("/api/" + endpoint + "/search" + (cacheBuster())), endpoint.route && args && args.where ? args.where : args).then(function(response) {
              var clonedProps;
              loading--;
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
              loading--;
              obj.items = [];
              obj.total = 0;
              obj.page = 1;
              obj.error = err;
              return typeof cb === "function" ? cb(obj) : void 0;
            });
          },
          list: function(endpoint, obj, cb) {
            loading++;
            return $http.post(endpoint.route || ("/api/" + endpoint + (cacheBuster()))).then(function(response) {
              var clonedProps;
              loading--;
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
              loading--;
              obj.items = [];
              obj.total = 0;
              obj.page = 1;
              obj.error = err;
              return typeof cb === "function" ? cb(obj) : void 0;
            });
          },
          single: function(endpoint, id, obj, cb) {
            loading++;
            if (Object.prototype.toString.call(id) === '[object Object]') {
              id = escape(JSON.stringify(id));
            }
            return $http.get((endpoint.route || ("/api/" + endpoint)) + ("/" + id + (obj.all ? '/all' : '') + (cacheBuster()))).then(function(response) {
              var clonedProps;
              loading--;
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
              loading--;
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
          destroy: destroy,
          loading: function() {
            return loading;
          }
        };
      }
    };
  }).run(function($rootScope, $http, $timeout, rest) {
    var root, throttle;
    throttle = function(func, wait, options) {
      var args, context, later, previous, result, timeout;
      context = void 0;
      args = void 0;
      result = void 0;
      timeout = null;
      previous = 0;
      if (!options) {
        options = {};
      }
      later = function() {
        previous = options.leading === false ? 0 : Date.now();
        timeout = null;
        result = func.apply(context, args);
        if (!timeout) {
          context = args = null;
        }
      };
      return function() {
        var now, remaining;
        now = Date.now();
        if (!previous && options.leading === false) {
          previous = now;
        }
        remaining = wait - (now - previous);
        context = this;
        args = arguments;
        if (remaining <= 0 || remaining > wait) {
          if (timeout) {
            $timeout.cancel(timeout);
            timeout = null;
          }
          previous = now;
          result = func.apply(context, args);
          if (!timeout) {
            context = args = null;
          }
        } else if (!timeout && options.trailing !== false) {
          timeout = $timeout(later, remaining);
        }
        return result;
      };
    };
    root = Object.getPrototypeOf($rootScope);
    root.restLoading = rest.loading;
    root.list = function(endpoint, args, cb, saveCb, locked) {
      var RefreshFn, dereg, ignoreNextWatch, obj, throttledSearch;
      ignoreNextWatch = false;
      if (args) {
        cb = args.onData || cb;
        saveCb = args.onSave || saveCb;
      }
      obj = {
        items: null,
        args: args,
        refreshFn: null,
        endpoint: endpoint,
        locked: locked,
        save: function(item, checkFn) {
          if (checkFn) {
            return checkFn('save', endpoint, item, function() {
              return rest.save(endpoint, item, saveCb);
            });
          } else {
            return rest.save(endpoint, item, saveCb);
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
          if (typeof dereg === "function") {
            dereg();
          }
          return rest.dereg(obj.refreshFn);
        }
      };
      throttledSearch = throttle(rest.search, 1000);
      RefreshFn = function(endpoint, args) {
        return function(table) {
          var ep, i, len, ref, results;
          if (args != null ? args.preRefresh : void 0) {
            args.preRefresh(args);
            ignoreNextWatch = true;
          }
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
                    throttledSearch(endpoint, args, obj, cb);
                    break;
                  } else {
                    results.push(void 0);
                  }
                }
                return results;
              }
            } else {
              if (table === endpoint || !table) {
                return throttledSearch(endpoint, args, obj, cb);
              }
            }
          }
        };
      };
      obj.refreshFn = RefreshFn(endpoint, args);
      rest.register(obj.refreshFn);
      if (endpoint.route && !endpoint.endpoints) {
        rest.search(endpoint, args, obj, cb);
      }
      dereg = this.$watch(function() {
        return JSON.stringify(args);
      }, function(n, o) {
        if (!ignoreNextWatch) {
          if (rest.okToLoad()) {

            /*
            if endpoint.route
              if endpoint.endpoints and endpoint.endpoints.length
                for ep in endpoint.endpoints
                  rest.endpoints[ep].needsRefresh = true
            else
              rest.endpoints[endpoint].needsRefresh = true
             */
            return obj.refreshFn(obj.endpoint);
          } else {
            return rest.needsRefresh(true);
          }
        } else {
          return ignoreNextWatch = false;
        }
      }, true);
      this.$on('$destroy', function() {
        return obj.destroy();
      });
      if (!args && rest.endpoints.endpoints) {
        obj.refreshFn(obj.endpoint);
      }
      if (rest.okToLoad()) {
        rest.callRefreshFns();
      }
      return obj;
    };
    return root.single = function(endpoint, id, cb, saveCb, locked, all) {
      var RefreshFn, obj, throttledSingle;
      obj = {
        all: all,
        item: null,
        refreshFn: null,
        endpoint: endpoint,
        locked: locked,
        save: function(checkFn) {
          if (checkFn) {
            return checkFn('save', endpoint, this.item, (function(_this) {
              return function() {
                return rest.save(endpoint, _this.item, saveCb);
              };
            })(this));
          } else {
            return rest.save(endpoint, this.item, saveCb);
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
      throttledSingle = throttle(rest.single, 1000);
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
                      throttledSingle(endpoint, id, obj, cb);
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
                return throttledSingle(endpoint, id, obj, cb);
              }
            }
          }
        };
      };
      obj.refreshFn = RefreshFn(endpoint, id);
      rest.register(obj.refreshFn);
      if (rest.okToLoad() && rest.endpoints.endpoints) {

        /*
        if endpoint.route
          if endpoint.endpoints
            for ep in endpoint.endpoints
              rest.endpoints[ep].needsRefresh = true
        else
          rest.endpoints[endpoint].needsRefresh = false
         */
        obj.refreshFn(obj.endpoint);
      } else {
        rest.needsRefresh(true);
      }
      rest.single(endpoint, id, obj, cb);
      this.$on('$destroy', obj.destroy);
      return obj;
    };
  });

}).call(this);

//# sourceMappingURL=index.js.map
