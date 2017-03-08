'use strict'
module = null
try
  module = angular.module 'ndx'
catch e
  module =angular.module 'ndx', []
module.factory 'rest', ($http, $injector, $timeout) ->
  okToLoad = false
  endpoints = {}
  autoId = '_id'
  refreshFns = []
  waiting = false
  listTransform =
    items: true
    total: true
    page: true
    pageSize: true
    error: true
  debounce = (func, wait, immediate) ->
    timeout = undefined
    ->
      context = @
      args = arguments
      later = ->
        timeout = null
        if !immediate
          func.apply context, args
        return
      callNow = immediate and !timeout
      $timeout.cancel timeout
      timeout = $timeout later, wait
      if callNow
        func.apply context, args
      return
  callRefreshFns = debounce () ->
    if okToLoad and endpoints
      for key of endpoints
        if endpoints[key].needsRefresh
          for fn in refreshFns
            fn key
          endpoints[key].needsRefresh = false
  , 50
  destroy = (obj) ->
    type = Object.prototype.toString.call obj
    if type is '[object Object]'
      if obj.destroy
        obj.destroy()
      for key in obj
        destroy obj[key]
    else if type is '[object Array]'
      for item in obj
        destroy item
    return
    
  if $injector.has 'auth'
    okToLoad = false
    auth = $injector.get 'auth'
    root = $injector.get '$rootScope'
    dereg = root.$watch ->
      auth.getUser()
    , (n) ->
      if n
        okToLoad = true
        for endpoint of endpoints
          endpoints[endpoint].needsRefresh = true
        callRefreshFns()
        dereg()
  try
    if io
      socket = io()
      socket.on 'connect', ->
        socket.emit 'rest', {}
      socket.on 'update', (data) ->
        endpoints[data.table].needsRefresh = true
        callRefreshFns()
      socket.on 'insert', (data) ->
        endpoints[data.table].needsRefresh = true
        callRefreshFns()
      socket.on 'delete', (data) ->
        endpoints[data.table].needsRefresh = true
        callRefreshFns()
  $http.get '/rest/endpoints'
  .then (response) ->
    if response.data and response.data.endpoints and response.data.endpoints.length
      for endpoint in response.data.endpoints
        endpoints[endpoint] = 
          needsRefresh: true
      if response.data.autoId
        autoId = response.data.autoId
      callRefreshFns()
  , (err) ->
    false
  endpoints: endpoints
  autoId: autoId
  okToLoad: ->
    okToLoad
  save: (endpoint, obj) ->
    $http.post (endpoint.route or "/api/#{endpoint}") + ("/#{obj[autoId] or ''}"), obj
    .then (response) =>
      endpoints[endpoint].needsRefresh = true
      callRefreshFns endpoint
    , (err) ->
      false
  'delete': (endpoint, obj) ->
    $http.delete (endpoint.route or "/api/#{endpoint}") + ("/#{obj[autoId] or ''}")
    .then (response) =>
      endpoints[endpoint].needsRefresh = true
      callRefreshFns endpoint
    , (err) ->
      false
  search: (endpoint, args, obj, cb) ->
    $http.post (endpoint.route or "/api/#{endpoint}/search"), if endpoint.route and args and args.where then args.where else args
    .then (response) ->
      objtrans response.data, (args.transform or listTransform), obj
      cb? obj
    , (err) ->
      obj.items = []
      obj.total = 0
      obj.page = 1
      obj.error = err
      cb? obj
  list: (endpoint, obj, cb) ->
    $http.post (endpoint.route or "/api/#{endpoint}")
    .then (response) ->
      objtrans response.data, (args.transform or listTransform), obj
      cb? obj
    , (err) ->
      obj.items = []
      obj.total = 0
      obj.page = 1
      obj.error = err
      cb? obj
  single: (endpoint, id, obj, cb) ->
    $http.get (endpoint.route or "/api/#{endpoint}") + "/#{id}"
    .then (response) ->
      obj.item = response.data
      cb? obj.item
    , (err) ->
      obj.item = {}
      cb? obj.item
  register: (fn) ->
    refreshFns.push fn
  dereg: (fn) ->
    refreshFns.splice refreshFns.indexOf(fn), 1
  destroy: destroy
.run ($rootScope, $http, rest) ->
  root = Object.getPrototypeOf $rootScope
  root.list = (endpoint, args, cb) ->
    obj =
      items: null
      refreshFn: null
      endpoint: endpoint
      locked: false
      save: (item) ->
        rest.save endpoint, item
      delete: (item) ->
        rest.delete endpoint, item
      destroy: ->
        rest.dereg obj.refreshFn
    RefreshFn = (endpoint, args) ->
      (table) ->
        if obj.items
          rest.destroy obj.items
        if endpoint.route and endpoint.endpoints
          for ep in endpoint.endpoints
            if table is ep or not table
              rest.search ep, args, obj, cb
              break
        else
          if table is endpoint or not table
            rest.search endpoint, args, obj, cb
    obj.refreshFn = RefreshFn endpoint, args
    rest.register obj.refreshFn
    if endpoint.route and not endpoint.endpoints
      rest.search endpoint, args, obj.cb
    dereg = @.$watch ->
      JSON.stringify args
    , (n, o) ->
      if n and rest.okToLoad()
        if endpoint.route
          if endpoint.endpoints and endpoint.endpoints.length
            for ep in endpoint.endpoints
              rest.endpoints[ep].needsRefresh = true
        else
          rest.endpoints[endpoint].needsRefresh = true
        obj.refreshFn obj.endpoint
    , true
    @.$on '$destroy', ->
      dereg()
      obj.destroy()
    obj
  root.single = (endpoint, id, cb) ->
    obj = 
      item: null
      refreshFn: null
      endpoint: endpoint
      locked: false
      save: ->
        rest.save endpoint, @.item
      delete: ->
        rest.delete endpoint, @.item
      destroy: ->
        rest.dereg obj.refreshFn
    RefreshFn = (endpoint, id) ->
      (table) ->
        if endpoint.route
          if endpoint.endpoints and endpoint.endpoints.length
            for ep in endpoint.endpoints
              if table is ep or not table
                rest.single ep, id, obj, cb
                break
        else
          if table is endpoint or not table
            rest.single endpoint, id, obj, cb
    obj.refreshFn = RefreshFn endpoint, id
    rest.register obj.refreshFn
    if rest.okToLoad()
      if endpoint.route and endpoint.endpoints
        for ep in endpoint.endpoints
          rest.endpoints[ep].needsRefresh = true
      else
        rest.endpoints[endpoint].needsRefresh = true
      obj.refreshFn obj.endpoint
    if endpoint.route and not endpoint.endpoints
      rest.single endpoint, id, obj, cb
    @.$on '$destroy', obj.destroy

    obj