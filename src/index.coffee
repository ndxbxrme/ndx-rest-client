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
  save: (name, obj) ->
    $http.post "/api/#{name}/#{obj[autoId] or ''}", obj
    .then (response) =>
      endpoints[name].needsRefresh = true
      callRefreshFns name
    , (err) ->
      false
  'delete': (name, obj) ->
    $http.delete "/api/#{name}/#{obj[autoId] or ''}"
    .then (response) =>
      endpoints[name].needsRefresh = true
      callRefreshFns name
    , (err) ->
      false
  register: (fn) ->
    refreshFns.push fn
  dereg: (fn) ->
    refreshFns.splice refreshFns.indexOf(fn), 1
.run ($rootScope, $http, rest) ->
  root = Object.getPrototypeOf $rootScope
  root.list = (name, args, cb) ->
    obj =
      items: null
      refreshFn: null
      table: name
      locked: false
      save: (item) ->
        rest.save name, item
      delete: (item) ->
        rest.delete name, item
    RefreshFn = (name, args) ->
      (table) ->
        if table is name or not table
          $http.post "/api/#{name}/search", args
          .then (response) ->
            obj.items = response.data.items
            obj.total = response.data.total
            obj.page = response.data.page
            obj.pageSize = response.data.pageSize
            obj.error = response.data.error
            cb? obj
          , (err) ->
            obj.items = []
            obj.total = 0
            obj.page = 1
            obj.error = err
            cb? obj
    obj.refreshFn = RefreshFn name, args
    rest.register obj.refreshFn
    dereg = @.$watch ->
      JSON.stringify args
    , (n, o) ->
      if n and rest.okToLoad()
        rest.endpoints[name].needsRefresh = true
        obj.refreshFn obj.table
    , true
    @.$on '$destroy', ->
      dereg()
      rest.dereg obj.refreshFn()
    obj
  root.single = (name, id, cb) ->
    obj = 
      item: null
      refreshFn: null
      table: name
      locked: false
      save: ->
        rest.save name, @.item
      delete: ->
        rest.delete name, @.item
    RefreshFn = (name, id) ->
      (table) ->
        if table is name or not table
          $http.get "/api/#{name}/#{id}"
          .then (response) ->
            obj.item = response.data
            cb? obj.item
          , (err) ->
            obj.item = {}
            cb? obj.item
    obj.refreshFn = RefreshFn name, id
    if rest.okToLoad()
      rest.endpoints[name].needsRefresh = true
      obj.refreshFn obj.table
    obj