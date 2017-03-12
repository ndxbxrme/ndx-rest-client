# ndx-rest (client)

### public api

    endpoints: endpoints
    autoId: autoId
    okToLoad: ->
    save: (endpoint, obj) ->
    'delete': (endpoint, obj) ->
    search: (endpoint, args, obj, cb) ->
    list: (endpoint, obj, cb) ->
    single: (endpoint, id, obj, cb) ->
    register: (fn) ->
    dereg: (fn) ->
    destroy: destroy

### $scope

    $scope.list = (endpoint, args, cb) ->
    $scope.single = (endpoint, id, cb) ->

### private api

    debounce = (func, wait, immediate) ->
    callRefreshFns = debounce () ->
    destroy = (obj) ->
    restore = (obj) ->
    cloneSpecialProps = (obj) ->     
    restoreSpecialProps = (obj, clonedProps) ->


  