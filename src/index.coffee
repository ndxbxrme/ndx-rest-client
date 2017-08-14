'use strict'
module = null
try
  module = angular.module 'ndx'
catch e
  module =angular.module 'ndx', []
module.provider 'rest', ->
  waitForAuth = false
  waitForAuth: (val) ->
    waitForAuth = val
  $get: ($http, $injector, $timeout) ->
    okToLoad = true
    endpoints = {}
    autoId = '_id'
    refreshFns = []
    waiting = false
    ndxCheck = null
    needsRefresh = false
    listTransform =
      items: true
      total: true
      page: true
      pageSize: true
      error: true
    callRefreshFns = ->
      if okToLoad and endpoints
        for key of endpoints
          if endpoints[key].needsRefresh
            for fn in refreshFns
              fn key, endpoints[key].ids
            endpoints[key].ids = []
            endpoints[key].needsRefresh = false
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
    restore = (obj) ->
      type = Object.prototype.toString.call obj
      if type is '[object Object]'
        if obj.refreshFn
          refreshFns.push obj.refreshFn
        for key in obj
          restore obj[key]
      else if type is '[object Array]'
        for item in obj
          restore item
      return
    cloneSpecialProps = (obj) ->
      output = null
      type = Object.prototype.toString.call obj
      if type is '[object Array]'
        output = []
        for item in obj
          clonedItem = cloneSpecialProps item
          clonedItem[autoId] = item[autoId]
          output.push clonedItem
      else if type is '[object Object]'
        output = {}
        for key of obj
          if key.indexOf('$') is 0
            output[key] = obj[key]
      output

    restoreSpecialProps = (obj, clonedProps) ->
      type = Object.prototype.toString.call obj
      if type is '[object Array]'
        for item in obj
          for clonedItem in clonedProps
            if item[autoId] is clonedItem[autoId]
              restoreSpecialProps item, clonedItem
              break
      else if type is '[object Object]'
        for key of clonedProps
          obj[key] = clonedProps[key]
          restore obj[key]
      return

    if $injector.has 'ndxCheck'
      ndxCheck = $injector.get 'ndxCheck'
    if $injector.has('Auth') and waitForAuth
      okToLoad = false
      auth = $injector.get 'Auth'
      root = $injector.get '$rootScope'
      dereg = root.$watch ->
        auth.getUser()
      , (n) ->
        if n
          okToLoad = true
          for endpoint of endpoints
            endpoints[endpoint].needsRefresh = true
          if needsRefresh
            callRefreshFns()
          dereg()
    if $injector.has 'socket'
      socket = $injector.get 'socket'
      socket.on 'connect', ->
        socket.emit 'rest', {}
      socket.on 'update', (data) ->
        endpoints[data.table].needsRefresh = true
        endpoints[data.table].ids.push data.id
        callRefreshFns()
      socket.on 'insert', (data) ->
        endpoints[data.table].needsRefresh = true
        callRefreshFns()
      socket.on 'delete', (data) ->
        endpoints[data.table].needsRefresh = true
        endpoints[data.table].ids.push data.id
        callRefreshFns()
    $http.get '/rest/endpoints'
    .then (response) ->
      if response.data and response.data.endpoints and response.data.endpoints.length
        for endpoint in response.data.endpoints
          endpoints[endpoint] = 
            needsRefresh: true
            lastRefresh: 0
            nextRefresh: 0
            ids: []
        if response.data.autoId
          autoId = response.data.autoId
        if needsRefresh
          callRefreshFns()
    , (err) ->
      false
    endpoints: endpoints
    autoId: autoId
    needsRefresh: (val) ->
      needsRefresh = val
    okToLoad: ->
      okToLoad
    save: (endpoint, obj) ->
      $http.post (endpoint.route or "/api/#{endpoint}") + ("/#{obj[autoId] or ''}"), obj
      .then (response) =>
        endpoints[endpoint].needsRefresh = true
        ndxCheck and ndxCheck.setPristine()
        callRefreshFns endpoint
      , (err) ->
        false
    'delete': (endpoint, obj) ->
      $http.delete (endpoint.route or "/api/#{endpoint}") + ("/#{obj[autoId] or ''}")
      .then (response) =>
        endpoints[endpoint].needsRefresh = true
        ndxCheck and ndxCheck.setPristine()
        callRefreshFns endpoint
      , (err) ->
        false
    search: (endpoint, args, obj, cb) ->
      args = args or {}
      $http.post (endpoint.route or "/api/#{endpoint}/search"), if endpoint.route and args and args.where then args.where else args
      .then (response) ->
        clonedProps = null
        if obj.items and obj.items.length
          clonedProps = cloneSpecialProps obj.items
        objtrans response.data, (args.transform or listTransform), obj
        if obj.items and obj.items.length and clonedProps
          restoreSpecialProps obj.items, clonedProps
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
        clonedProps = null
        if obj.items and obj.items.length
          clonedProps = cloneSpecialProps obj.items
        objtrans response.data, (args.transform or listTransform), obj
        if obj.items and obj.items.length and clonedProps
          restoreSpecialProps obj.items, clonedProps
        cb? obj
      , (err) ->
        obj.items = []
        obj.total = 0
        obj.page = 1
        obj.error = err
        cb? obj
    single: (endpoint, id, obj, cb) ->
      if Object.prototype.toString.call(id) is '[object Object]'
        id = escape JSON.stringify id
      $http.get (endpoint.route or "/api/#{endpoint}") + "/#{id}"
      .then (response) ->
        clonedProps = null
        if obj.item
          clonedProps = cloneSpecialProps obj.items
        obj.item = response.data
        if obj.item and clonedProps
          restoreSpecialProps obj.item, clonedProps
        cb? obj
      , (err) ->
        obj.item = {}
        cb? obj
    register: (fn) ->
      refreshFns.push fn
    dereg: (fn) ->
      refreshFns.splice refreshFns.indexOf(fn), 1
    destroy: destroy
.run ($rootScope, $http, rest) ->
  #borrowed from underscore.js
  throttle = (func, wait, options) ->
    context = undefined
    args = undefined
    result = undefined
    timeout = null
    previous = 0
    if !options
      options = {}
    later = ->
      previous = if options.leading == false then 0 else Date.now()
      timeout = null
      result = func.apply(context, args)
      if !timeout
        context = args = null
      return
    ->
      now = Date.now()
      if !previous and options.leading == false
        previous = now
      remaining = wait - (now - previous)
      context = this
      args = arguments
      if remaining <= 0 or remaining > wait
        if timeout
          clearTimeout timeout
          timeout = null
        previous = now
        result = func.apply(context, args)
        if !timeout
          context = args = null
      else if !timeout and options.trailing != false
        timeout = setTimeout(later, remaining)
      result
      
  root = Object.getPrototypeOf $rootScope
  root.list = (endpoint, args, cb) ->
    obj =
      items: null
      refreshFn: null
      endpoint: endpoint
      locked: false
      save: (item, checkFn) ->
        if checkFn
          checkFn 'save', endpoint, item, ->
            rest.save endpoint, item
        else
          rest.save endpoint, item
      delete: (item, checkFn) ->
        if checkFn
          checkFn 'delete', endpoint, item, ->
            rest.delete endpoint, item
        else
          rest.delete endpoint, item
      destroy: ->
        rest.dereg obj.refreshFn
    throttledSearch = throttle rest.search, 1000
    RefreshFn = (endpoint, args) ->
      (table) ->
        if not obj.locked
          if obj.items
            rest.destroy obj.items
          if endpoint.route 
            if endpoint.endpoints and table
              for ep in endpoint.endpoints
                if table is ep
                  throttledSearch endpoint, args, obj, cb
                  break
          else
            if table is endpoint or not table
              throttledSearch endpoint, args, obj, cb
    obj.refreshFn = RefreshFn endpoint, args
    rest.register obj.refreshFn
    #if rest.endpoints or (endpoint.route and not endpoint.endpoints)
    #  rest.search endpoint, args, obj, cb
    dereg = @.$watch ->
      JSON.stringify args
    , (n, o) ->
      if n and rest.okToLoad()
        ###
        if endpoint.route
          if endpoint.endpoints and endpoint.endpoints.length
            for ep in endpoint.endpoints
              rest.endpoints[ep].needsRefresh = true
        else
          rest.endpoints[endpoint].needsRefresh = true
        ###
        obj.refreshFn obj.endpoint
      else
        rest.needsRefresh true
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
      save: (checkFn) ->
        if checkFn
          checkFn 'save', endpoint, @.item, =>
            rest.save endpoint, @.item
        else
          rest.save endpoint, @.item
      delete: (checkFn) ->
        if checkFn
          checkFn 'delete', endpoint, @.item, =>
            rest.delete endpoint, @.item
        else
          rest.delete endpoint, @.item
      destroy: ->
        rest.dereg obj.refreshFn
    throttledSingle = throttle rest.single, 1000
    RefreshFn = (endpoint, id) ->
      (table, ids) ->
        if ids and obj.item and ids.indexOf(obj.item[rest.autoId]) is -1
          return
        if not obj.locked
          if endpoint.route
            if endpoint.endpoints
              if endpoint.endpoints.length and table
                for ep in endpoint.endpoints
                  if table is ep
                    throttledSingle endpoint, id, obj, cb
                    break
          else
            if table is endpoint or not table
              throttledSingle endpoint, id, obj, cb
    obj.refreshFn = RefreshFn endpoint, id
    rest.register obj.refreshFn
    if rest.okToLoad()
      ###
      if endpoint.route
        if endpoint.endpoints
          for ep in endpoint.endpoints
            rest.endpoints[ep].needsRefresh = true
      else
        rest.endpoints[endpoint].needsRefresh = false
      ###
      obj.refreshFn obj.endpoint
    else
      rest.needsRefresh true
    #if endpoint.route and not endpoint.endpoints
    #  rest.single endpoint, id, obj, cb
    @.$on '$destroy', obj.destroy
    obj