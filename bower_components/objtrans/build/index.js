(function() {
  'use strict';
  this.objtrans = function(input, pattern, output) {
    var bit, bits, field, func, i, inField, index, len, myInput, type;
    if (!output) {
      output = {};
    }
    for (field in pattern) {
      func = null;
      type = Object.prototype.toString.call(pattern[field]);
      if (type === '[object Array]') {
        func = pattern[field][1];
        pattern[field] = pattern[field][0];
        type = '[object String]';
      }
      if (type === '[object Function]') {
        func = pattern[field];
        type = '[object Boolean]';
      }
      if (type === '[object Boolean]') {
        output[field] = func ? func(input[field] || input) : input[field];
      } else if (type === '[object Object]') {
        inField = input[field];
        if (inField) {
          if (Object.prototype.toString.call(inField) === '[object Object]') {
            output[field] = objtrans(inField, pattern[field]);
          } else {
            output[field] = func ? func(inField) : inField;
          }
        } else {
          output[field] = objtrans(input, pattern[field]);
        }
      } else if (type === '[object String]') {
        bits = pattern[field].split(/\./g);
        myInput = JSON.parse(JSON.stringify(input));
        for (i = 0, len = bits.length; i < len; i++) {
          bit = bits[i];
          index = -1;
          bit = bit.replace(/\[(.+)\]$|$/, function(all, num) {
            index = num;
            return '';
          });
          if (index && index !== -1) {
            if (index === 'first') {
              index = 0;
            }
            if (index === 'last') {
              index = myInput[bit].length - 1;
            }
            myInput = myInput[bit][+index];
          } else {
            myInput = myInput[bit];
          }
          if (myInput) {
            output[field] = myInput;
          } else {
            output[field] = void 0;
            break;
          }
        }
        output[field] = func ? func(output[field]) : output[field];
      }
    }
    return output;
  };

  if (typeof exports === 'object') {
    module.exports = this.objtrans;
  }

}).call(this);

//# sourceMappingURL=index.js.map
