'use strict'

objtrans = (input, pattern, output) ->
  if not output
    output = {}
  for field of pattern
    func = null
    type = Object.prototype.toString.call pattern[field]
    if type is '[object Array]'
      func = pattern[field][1]
      pattern[field] = pattern[field][0]
      type = '[object String]'
    if type is '[object Function]'
      func = pattern[field]
      type = '[object Boolean]'
    if type is '[object Boolean]'
      output[field] = if func then (func(input[field] or input)) else input[field]
    else if type is '[object Object]'
      inField = input[field]
      if inField
        if Object.prototype.toString.call(inField) is '[object Object]'
          output[field] = objtrans inField, pattern[field]
        else
          output[field] = if func then (func inField) else inField
      else
        output[field] = objtrans input, pattern[field]
    else if type is '[object String]'
      bits = pattern[field].split(/\./g)
      myInput = JSON.parse JSON.stringify input
      for bit in bits
        index = -1
        bit = bit.replace /\[(.+)\]$|$/, (all, num) ->
          index = num
          ''
        if index and index isnt -1
          if index is 'first'
            index = 0
          if index is 'last'
            index = myInput[bit].length - 1
          if myInput[bit]
            myInput = myInput[bit][+index]
        else
           myInput = myInput[bit]
        if myInput
          output[field] = myInput
        else
          output[field] = undefined
          break
      output[field] = if func then (func output[field]) else output[field]
  output
@objtrans = objtrans  
if typeof exports is 'object'
  module.exports = objtrans
