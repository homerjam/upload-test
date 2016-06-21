(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
;(function (exports) {
  'use strict'

  var i
  var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  var lookup = []
  for (i = 0; i < code.length; i++) {
    lookup[i] = code[i]
  }
  var revLookup = []

  for (i = 0; i < code.length; ++i) {
    revLookup[code.charCodeAt(i)] = i
  }
  revLookup['-'.charCodeAt(0)] = 62
  revLookup['_'.charCodeAt(0)] = 63

  var Arr = (typeof Uint8Array !== 'undefined')
    ? Uint8Array
    : Array

  function decode (elt) {
    var v = revLookup[elt.charCodeAt(0)]
    return v !== undefined ? v : -1
  }

  function b64ToByteArray (b64) {
    var i, j, l, tmp, placeHolders, arr

    if (b64.length % 4 > 0) {
      throw new Error('Invalid string. Length must be a multiple of 4')
    }

    // the number of equal signs (place holders)
    // if there are two placeholders, than the two characters before it
    // represent one byte
    // if there is only one, then the three characters before it represent 2 bytes
    // this is just a cheap hack to not do indexOf twice
    var len = b64.length
    placeHolders = b64.charAt(len - 2) === '=' ? 2 : b64.charAt(len - 1) === '=' ? 1 : 0

    // base64 is 4/3 + up to two characters of the original data
    arr = new Arr(b64.length * 3 / 4 - placeHolders)

    // if there are placeholders, only get up to the last complete 4 chars
    l = placeHolders > 0 ? b64.length - 4 : b64.length

    var L = 0

    function push (v) {
      arr[L++] = v
    }

    for (i = 0, j = 0; i < l; i += 4, j += 3) {
      tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
      push((tmp & 0xFF0000) >> 16)
      push((tmp & 0xFF00) >> 8)
      push(tmp & 0xFF)
    }

    if (placeHolders === 2) {
      tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
      push(tmp & 0xFF)
    } else if (placeHolders === 1) {
      tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
      push((tmp >> 8) & 0xFF)
      push(tmp & 0xFF)
    }

    return arr
  }

  function encode (num) {
    return lookup[num]
  }

  function tripletToBase64 (num) {
    return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
  }

  function encodeChunk (uint8, start, end) {
    var temp
    var output = []
    for (var i = start; i < end; i += 3) {
      temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
      output.push(tripletToBase64(temp))
    }
    return output.join('')
  }

  function uint8ToBase64 (uint8) {
    var i
    var extraBytes = uint8.length % 3 // if we have 1 byte left, pad 2 bytes
    var output = ''
    var parts = []
    var temp, length
    var maxChunkLength = 16383 // must be multiple of 3

    // go through the array every three bytes, we'll deal with trailing stuff later

    for (i = 0, length = uint8.length - extraBytes; i < length; i += maxChunkLength) {
      parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > length ? length : (i + maxChunkLength)))
    }

    // pad the end with zeros, but make sure to not forget the extra bytes
    switch (extraBytes) {
      case 1:
        temp = uint8[uint8.length - 1]
        output += encode(temp >> 2)
        output += encode((temp << 4) & 0x3F)
        output += '=='
        break
      case 2:
        temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
        output += encode(temp >> 10)
        output += encode((temp >> 4) & 0x3F)
        output += encode((temp << 2) & 0x3F)
        output += '='
        break
      default:
        break
    }

    parts.push(output)

    return parts.join('')
  }

  exports.toByteArray = b64ToByteArray
  exports.fromByteArray = uint8ToBase64
}(typeof exports === 'undefined' ? (this.base64js = {}) : exports))

},{}],2:[function(require,module,exports){
(function (global){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')
var isArray = require('isarray')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50
Buffer.poolSize = 8192 // not used by this implementation

var rootParent = {}

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Due to various browser bugs, sometimes the Object implementation will be used even
 * when the browser supports typed arrays.
 *
 * Note:
 *
 *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
 *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *     incorrect length in some situations.

 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
 * get the Object implementation, which is slower but behaves correctly.
 */
Buffer.TYPED_ARRAY_SUPPORT = global.TYPED_ARRAY_SUPPORT !== undefined
  ? global.TYPED_ARRAY_SUPPORT
  : typedArraySupport()

function typedArraySupport () {
  try {
    var arr = new Uint8Array(1)
    arr.foo = function () { return 42 }
    return arr.foo() === 42 && // typed array instances can be augmented
        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
        arr.subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
  } catch (e) {
    return false
  }
}

function kMaxLength () {
  return Buffer.TYPED_ARRAY_SUPPORT
    ? 0x7fffffff
    : 0x3fffffff
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */
function Buffer (arg) {
  if (!(this instanceof Buffer)) {
    // Avoid going through an ArgumentsAdaptorTrampoline in the common case.
    if (arguments.length > 1) return new Buffer(arg, arguments[1])
    return new Buffer(arg)
  }

  if (!Buffer.TYPED_ARRAY_SUPPORT) {
    this.length = 0
    this.parent = undefined
  }

  // Common case.
  if (typeof arg === 'number') {
    return fromNumber(this, arg)
  }

  // Slightly less common case.
  if (typeof arg === 'string') {
    return fromString(this, arg, arguments.length > 1 ? arguments[1] : 'utf8')
  }

  // Unusual.
  return fromObject(this, arg)
}

// TODO: Legacy, not needed anymore. Remove in next major version.
Buffer._augment = function (arr) {
  arr.__proto__ = Buffer.prototype
  return arr
}

function fromNumber (that, length) {
  that = allocate(that, length < 0 ? 0 : checked(length) | 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < length; i++) {
      that[i] = 0
    }
  }
  return that
}

function fromString (that, string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') encoding = 'utf8'

  // Assumption: byteLength() return value is always < kMaxLength.
  var length = byteLength(string, encoding) | 0
  that = allocate(that, length)

  that.write(string, encoding)
  return that
}

function fromObject (that, object) {
  if (Buffer.isBuffer(object)) return fromBuffer(that, object)

  if (isArray(object)) return fromArray(that, object)

  if (object == null) {
    throw new TypeError('must start with number, buffer, array or string')
  }

  if (typeof ArrayBuffer !== 'undefined') {
    if (object.buffer instanceof ArrayBuffer) {
      return fromTypedArray(that, object)
    }
    if (object instanceof ArrayBuffer) {
      return fromArrayBuffer(that, object)
    }
  }

  if (object.length) return fromArrayLike(that, object)

  return fromJsonObject(that, object)
}

function fromBuffer (that, buffer) {
  var length = checked(buffer.length) | 0
  that = allocate(that, length)
  buffer.copy(that, 0, 0, length)
  return that
}

function fromArray (that, array) {
  var length = checked(array.length) | 0
  that = allocate(that, length)
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

// Duplicate of fromArray() to keep fromArray() monomorphic.
function fromTypedArray (that, array) {
  var length = checked(array.length) | 0
  that = allocate(that, length)
  // Truncating the elements is probably not what people expect from typed
  // arrays with BYTES_PER_ELEMENT > 1 but it's compatible with the behavior
  // of the old Buffer constructor.
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

function fromArrayBuffer (that, array) {
  array.byteLength // this throws if `array` is not a valid ArrayBuffer

  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = new Uint8Array(array)
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    that = fromTypedArray(that, new Uint8Array(array))
  }
  return that
}

function fromArrayLike (that, array) {
  var length = checked(array.length) | 0
  that = allocate(that, length)
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

// Deserialize { type: 'Buffer', data: [1,2,3,...] } into a Buffer object.
// Returns a zero-length buffer for inputs that don't conform to the spec.
function fromJsonObject (that, object) {
  var array
  var length = 0

  if (object.type === 'Buffer' && isArray(object.data)) {
    array = object.data
    length = checked(array.length) | 0
  }
  that = allocate(that, length)

  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

if (Buffer.TYPED_ARRAY_SUPPORT) {
  Buffer.prototype.__proto__ = Uint8Array.prototype
  Buffer.__proto__ = Uint8Array
  if (typeof Symbol !== 'undefined' && Symbol.species &&
      Buffer[Symbol.species] === Buffer) {
    // Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
    Object.defineProperty(Buffer, Symbol.species, {
      value: null,
      configurable: true
    })
  }
} else {
  // pre-set for values that may exist in the future
  Buffer.prototype.length = undefined
  Buffer.prototype.parent = undefined
}

function allocate (that, length) {
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = new Uint8Array(length)
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    that.length = length
  }

  var fromPool = length !== 0 && length <= Buffer.poolSize >>> 1
  if (fromPool) that.parent = rootParent

  return that
}

function checked (length) {
  // Note: cannot use `length < kMaxLength` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= kMaxLength()) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + kMaxLength().toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (subject, encoding) {
  if (!(this instanceof SlowBuffer)) return new SlowBuffer(subject, encoding)

  var buf = new Buffer(subject, encoding)
  delete buf.parent
  return buf
}

Buffer.isBuffer = function isBuffer (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.compare = function compare (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError('Arguments must be Buffers')
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  var i = 0
  var len = Math.min(x, y)
  while (i < len) {
    if (a[i] !== b[i]) break

    ++i
  }

  if (i !== len) {
    x = a[i]
    y = b[i]
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!isArray(list)) throw new TypeError('list argument must be an Array of Buffers.')

  if (list.length === 0) {
    return new Buffer(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; i++) {
      length += list[i].length
    }
  }

  var buf = new Buffer(length)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var item = list[i]
    item.copy(buf, pos)
    pos += item.length
  }
  return buf
}

function byteLength (string, encoding) {
  if (typeof string !== 'string') string = '' + string

  var len = string.length
  if (len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'binary':
      // Deprecated
      case 'raw':
      case 'raws':
        return len
      case 'utf8':
      case 'utf-8':
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) return utf8ToBytes(string).length // assume utf8
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  start = start | 0
  end = end === undefined || end === Infinity ? this.length : end | 0

  if (!encoding) encoding = 'utf8'
  if (start < 0) start = 0
  if (end > this.length) end = this.length
  if (end <= start) return ''

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'binary':
        return binarySlice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// The property is used by `Buffer.isBuffer` and `is-buffer` (in Safari 5-7) to detect
// Buffer instances.
Buffer.prototype._isBuffer = true

Buffer.prototype.toString = function toString () {
  var length = this.length | 0
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max) str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return 0
  return Buffer.compare(this, b)
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset) {
  if (byteOffset > 0x7fffffff) byteOffset = 0x7fffffff
  else if (byteOffset < -0x80000000) byteOffset = -0x80000000
  byteOffset >>= 0

  if (this.length === 0) return -1
  if (byteOffset >= this.length) return -1

  // Negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = Math.max(this.length + byteOffset, 0)

  if (typeof val === 'string') {
    if (val.length === 0) return -1 // special case: looking for empty string always fails
    return String.prototype.indexOf.call(this, val, byteOffset)
  }
  if (Buffer.isBuffer(val)) {
    return arrayIndexOf(this, val, byteOffset)
  }
  if (typeof val === 'number') {
    if (Buffer.TYPED_ARRAY_SUPPORT && Uint8Array.prototype.indexOf === 'function') {
      return Uint8Array.prototype.indexOf.call(this, val, byteOffset)
    }
    return arrayIndexOf(this, [ val ], byteOffset)
  }

  function arrayIndexOf (arr, val, byteOffset) {
    var foundIndex = -1
    for (var i = 0; byteOffset + i < arr.length; i++) {
      if (arr[byteOffset + i] === val[foundIndex === -1 ? 0 : i - foundIndex]) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === val.length) return byteOffset + foundIndex
      } else {
        foundIndex = -1
      }
    }
    return -1
  }

  throw new TypeError('val must be string, number or Buffer')
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new Error('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (isNaN(parsed)) throw new Error('Invalid hex string')
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function binaryWrite (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset | 0
    if (isFinite(length)) {
      length = length | 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  // legacy write(string, encoding, offset, length) - remove in v0.13
  } else {
    var swap = encoding
    encoding = offset
    offset = length | 0
    length = swap
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'binary':
        return binaryWrite(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
      : (firstByte > 0xBF) ? 2
      : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function binarySlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    newBuf = this.subarray(start, end)
    newBuf.__proto__ = Buffer.prototype
  } else {
    var sliceLen = end - start
    newBuf = new Buffer(sliceLen, undefined)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
  }

  if (newBuf.length) newBuf.parent = this.parent || this

  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('buffer must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('value is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkInt(this, value, offset, byteLength, Math.pow(2, 8 * byteLength), 0)

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkInt(this, value, offset, byteLength, Math.pow(2, 8 * byteLength), 0)

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  this[offset] = (value & 0xff)
  return offset + 1
}

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; i++) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; i++) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24)
    this[offset + 2] = (value >>> 16)
    this[offset + 1] = (value >>> 8)
    this[offset] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = value < 0 ? 1 : 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = value < 0 ? 1 : 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
    this[offset + 2] = (value >>> 16)
    this[offset + 3] = (value >>> 24)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('index out of range')
  if (offset < 0) throw new RangeError('index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start
  var i

  if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (i = len - 1; i >= 0; i--) {
      target[i + targetStart] = this[i + start]
    }
  } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
    // ascending copy from start
    for (i = 0; i < len; i++) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, start + len),
      targetStart
    )
  }

  return len
}

// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function fill (value, start, end) {
  if (!value) value = 0
  if (!start) start = 0
  if (!end) end = this.length

  if (end < start) throw new RangeError('end < start')

  // Fill 0 bytes; we're done
  if (end === start) return
  if (this.length === 0) return

  if (start < 0 || start >= this.length) throw new RangeError('start out of bounds')
  if (end < 0 || end > this.length) throw new RangeError('end out of bounds')

  var i
  if (typeof value === 'number') {
    for (i = start; i < end; i++) {
      this[i] = value
    }
  } else {
    var bytes = utf8ToBytes(value.toString())
    var len = bytes.length
    for (i = start; i < end; i++) {
      this[i] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; i++) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"base64-js":1,"ieee754":4,"isarray":3}],3:[function(require,module,exports){
var toString = {}.toString;

module.exports = Array.isArray || function (arr) {
  return toString.call(arr) == '[object Array]';
};

},{}],4:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],5:[function(require,module,exports){
module.exports = arrayBufferConcat

function arrayBufferConcat () {
  var length = 0
  var buffer = null

  for (var i in arguments) {
    buffer = arguments[i]
    length += buffer.byteLength
  }

  var joined = new Uint8Array(length)
  var offset = 0

  for (var i in arguments) {
    buffer = arguments[i]
    joined.set(new Uint8Array(buffer), offset)
    offset += buffer.byteLength
  }

  return joined.buffer
}

},{}],6:[function(require,module,exports){
/*
 * JavaScript Canvas to Blob
 * https://github.com/blueimp/JavaScript-Canvas-to-Blob
 *
 * Copyright 2012, Sebastian Tschan
 * https://blueimp.net
 *
 * Licensed under the MIT license:
 * http://www.opensource.org/licenses/MIT
 *
 * Based on stackoverflow user Stoive's code snippet:
 * http://stackoverflow.com/q/4998908
 */

/*global window, atob, Blob, ArrayBuffer, Uint8Array, define, module */

;(function (window) {
  'use strict'

  var CanvasPrototype = window.HTMLCanvasElement &&
                          window.HTMLCanvasElement.prototype
  var hasBlobConstructor = window.Blob && (function () {
    try {
      return Boolean(new Blob())
    } catch (e) {
      return false
    }
  }())
  var hasArrayBufferViewSupport = hasBlobConstructor && window.Uint8Array &&
    (function () {
      try {
        return new Blob([new Uint8Array(100)]).size === 100
      } catch (e) {
        return false
      }
    }())
  var BlobBuilder = window.BlobBuilder || window.WebKitBlobBuilder ||
                      window.MozBlobBuilder || window.MSBlobBuilder
  var dataURIPattern = /^data:((.*?)(;charset=.*?)?)(;base64)?,/
  var dataURLtoBlob = (hasBlobConstructor || BlobBuilder) && window.atob &&
    window.ArrayBuffer && window.Uint8Array &&
    function (dataURI) {
      var matches,
        mediaType,
        isBase64,
        dataString,
        byteString,
        arrayBuffer,
        intArray,
        i,
        bb
      // Parse the dataURI components as per RFC 2397
      matches = dataURI.match(dataURIPattern)
      if (!matches) {
        throw new Error('invalid data URI')
      }
      // Default to text/plain;charset=US-ASCII
      mediaType = matches[2]
        ? matches[1]
        : 'text/plain' + (matches[3] || ';charset=US-ASCII')
      isBase64 = !!matches[4]
      dataString = dataURI.slice(matches[0].length)
      if (isBase64) {
        // Convert base64 to raw binary data held in a string:
        byteString = atob(dataString)
      } else {
        // Convert base64/URLEncoded data component to raw binary:
        byteString = decodeURIComponent(dataString)
      }
      // Write the bytes of the string to an ArrayBuffer:
      arrayBuffer = new ArrayBuffer(byteString.length)
      intArray = new Uint8Array(arrayBuffer)
      for (i = 0; i < byteString.length; i += 1) {
        intArray[i] = byteString.charCodeAt(i)
      }
      // Write the ArrayBuffer (or ArrayBufferView) to a blob:
      if (hasBlobConstructor) {
        return new Blob(
          [hasArrayBufferViewSupport ? intArray : arrayBuffer],
          {type: mediaType}
        )
      }
      bb = new BlobBuilder()
      bb.append(arrayBuffer)
      return bb.getBlob(mediaType)
    }
  if (window.HTMLCanvasElement && !CanvasPrototype.toBlob) {
    if (CanvasPrototype.mozGetAsFile) {
      CanvasPrototype.toBlob = function (callback, type, quality) {
        if (quality && CanvasPrototype.toDataURL && dataURLtoBlob) {
          callback(dataURLtoBlob(this.toDataURL(type, quality)))
        } else {
          callback(this.mozGetAsFile('blob', type))
        }
      }
    } else if (CanvasPrototype.toDataURL && dataURLtoBlob) {
      CanvasPrototype.toBlob = function (callback, type, quality) {
        callback(dataURLtoBlob(this.toDataURL(type, quality)))
      }
    }
  }
  if (typeof define === 'function' && define.amd) {
    define(function () {
      return dataURLtoBlob
    })
  } else if (typeof module === 'object' && module.exports) {
    module.exports = dataURLtoBlob
  } else {
    window.dataURLtoBlob = dataURLtoBlob
  }
}(window))

},{}],7:[function(require,module,exports){
module.exports = require('./js/load-image')

require('./js/load-image-exif')
require('./js/load-image-exif-map')
require('./js/load-image-meta')
require('./js/load-image-orientation')

},{"./js/load-image":12,"./js/load-image-exif":9,"./js/load-image-exif-map":8,"./js/load-image-meta":10,"./js/load-image-orientation":11}],8:[function(require,module,exports){
/*
 * JavaScript Load Image Exif Map
 * https://github.com/blueimp/JavaScript-Load-Image
 *
 * Copyright 2013, Sebastian Tschan
 * https://blueimp.net
 *
 * Exif tags mapping based on
 * https://github.com/jseidelin/exif-js
 *
 * Licensed under the MIT license:
 * http://www.opensource.org/licenses/MIT
 */

/*global define, module, require, window */

;(function (factory) {
  'use strict'
  if (typeof define === 'function' && define.amd) {
    // Register as an anonymous AMD module:
    define(['./load-image', './load-image-exif'], factory)
  } else if (typeof module === 'object' && module.exports) {
    factory(require('./load-image'), require('./load-image-exif'))
  } else {
    // Browser globals:
    factory(window.loadImage)
  }
}(function (loadImage) {
  'use strict'

  loadImage.ExifMap.prototype.tags = {
    // =================
    // TIFF tags (IFD0):
    // =================
    0x0100: 'ImageWidth',
    0x0101: 'ImageHeight',
    0x8769: 'ExifIFDPointer',
    0x8825: 'GPSInfoIFDPointer',
    0xA005: 'InteroperabilityIFDPointer',
    0x0102: 'BitsPerSample',
    0x0103: 'Compression',
    0x0106: 'PhotometricInterpretation',
    0x0112: 'Orientation',
    0x0115: 'SamplesPerPixel',
    0x011C: 'PlanarConfiguration',
    0x0212: 'YCbCrSubSampling',
    0x0213: 'YCbCrPositioning',
    0x011A: 'XResolution',
    0x011B: 'YResolution',
    0x0128: 'ResolutionUnit',
    0x0111: 'StripOffsets',
    0x0116: 'RowsPerStrip',
    0x0117: 'StripByteCounts',
    0x0201: 'JPEGInterchangeFormat',
    0x0202: 'JPEGInterchangeFormatLength',
    0x012D: 'TransferFunction',
    0x013E: 'WhitePoint',
    0x013F: 'PrimaryChromaticities',
    0x0211: 'YCbCrCoefficients',
    0x0214: 'ReferenceBlackWhite',
    0x0132: 'DateTime',
    0x010E: 'ImageDescription',
    0x010F: 'Make',
    0x0110: 'Model',
    0x0131: 'Software',
    0x013B: 'Artist',
    0x8298: 'Copyright',
    // ==================
    // Exif Sub IFD tags:
    // ==================
    0x9000: 'ExifVersion', // EXIF version
    0xA000: 'FlashpixVersion', // Flashpix format version
    0xA001: 'ColorSpace', // Color space information tag
    0xA002: 'PixelXDimension', // Valid width of meaningful image
    0xA003: 'PixelYDimension', // Valid height of meaningful image
    0xA500: 'Gamma',
    0x9101: 'ComponentsConfiguration', // Information about channels
    0x9102: 'CompressedBitsPerPixel', // Compressed bits per pixel
    0x927C: 'MakerNote', // Any desired information written by the manufacturer
    0x9286: 'UserComment', // Comments by user
    0xA004: 'RelatedSoundFile', // Name of related sound file
    0x9003: 'DateTimeOriginal', // Date and time when the original image was generated
    0x9004: 'DateTimeDigitized', // Date and time when the image was stored digitally
    0x9290: 'SubSecTime', // Fractions of seconds for DateTime
    0x9291: 'SubSecTimeOriginal', // Fractions of seconds for DateTimeOriginal
    0x9292: 'SubSecTimeDigitized', // Fractions of seconds for DateTimeDigitized
    0x829A: 'ExposureTime', // Exposure time (in seconds)
    0x829D: 'FNumber',
    0x8822: 'ExposureProgram', // Exposure program
    0x8824: 'SpectralSensitivity', // Spectral sensitivity
    0x8827: 'PhotographicSensitivity', // EXIF 2.3, ISOSpeedRatings in EXIF 2.2
    0x8828: 'OECF', // Optoelectric conversion factor
    0x8830: 'SensitivityType',
    0x8831: 'StandardOutputSensitivity',
    0x8832: 'RecommendedExposureIndex',
    0x8833: 'ISOSpeed',
    0x8834: 'ISOSpeedLatitudeyyy',
    0x8835: 'ISOSpeedLatitudezzz',
    0x9201: 'ShutterSpeedValue', // Shutter speed
    0x9202: 'ApertureValue', // Lens aperture
    0x9203: 'BrightnessValue', // Value of brightness
    0x9204: 'ExposureBias', // Exposure bias
    0x9205: 'MaxApertureValue', // Smallest F number of lens
    0x9206: 'SubjectDistance', // Distance to subject in meters
    0x9207: 'MeteringMode', // Metering mode
    0x9208: 'LightSource', // Kind of light source
    0x9209: 'Flash', // Flash status
    0x9214: 'SubjectArea', // Location and area of main subject
    0x920A: 'FocalLength', // Focal length of the lens in mm
    0xA20B: 'FlashEnergy', // Strobe energy in BCPS
    0xA20C: 'SpatialFrequencyResponse',
    0xA20E: 'FocalPlaneXResolution', // Number of pixels in width direction per FPRUnit
    0xA20F: 'FocalPlaneYResolution', // Number of pixels in height direction per FPRUnit
    0xA210: 'FocalPlaneResolutionUnit', // Unit for measuring the focal plane resolution
    0xA214: 'SubjectLocation', // Location of subject in image
    0xA215: 'ExposureIndex', // Exposure index selected on camera
    0xA217: 'SensingMethod', // Image sensor type
    0xA300: 'FileSource', // Image source (3 == DSC)
    0xA301: 'SceneType', // Scene type (1 == directly photographed)
    0xA302: 'CFAPattern', // Color filter array geometric pattern
    0xA401: 'CustomRendered', // Special processing
    0xA402: 'ExposureMode', // Exposure mode
    0xA403: 'WhiteBalance', // 1 = auto white balance, 2 = manual
    0xA404: 'DigitalZoomRatio', // Digital zoom ratio
    0xA405: 'FocalLengthIn35mmFilm',
    0xA406: 'SceneCaptureType', // Type of scene
    0xA407: 'GainControl', // Degree of overall image gain adjustment
    0xA408: 'Contrast', // Direction of contrast processing applied by camera
    0xA409: 'Saturation', // Direction of saturation processing applied by camera
    0xA40A: 'Sharpness', // Direction of sharpness processing applied by camera
    0xA40B: 'DeviceSettingDescription',
    0xA40C: 'SubjectDistanceRange', // Distance to subject
    0xA420: 'ImageUniqueID', // Identifier assigned uniquely to each image
    0xA430: 'CameraOwnerName',
    0xA431: 'BodySerialNumber',
    0xA432: 'LensSpecification',
    0xA433: 'LensMake',
    0xA434: 'LensModel',
    0xA435: 'LensSerialNumber',
    // ==============
    // GPS Info tags:
    // ==============
    0x0000: 'GPSVersionID',
    0x0001: 'GPSLatitudeRef',
    0x0002: 'GPSLatitude',
    0x0003: 'GPSLongitudeRef',
    0x0004: 'GPSLongitude',
    0x0005: 'GPSAltitudeRef',
    0x0006: 'GPSAltitude',
    0x0007: 'GPSTimeStamp',
    0x0008: 'GPSSatellites',
    0x0009: 'GPSStatus',
    0x000A: 'GPSMeasureMode',
    0x000B: 'GPSDOP',
    0x000C: 'GPSSpeedRef',
    0x000D: 'GPSSpeed',
    0x000E: 'GPSTrackRef',
    0x000F: 'GPSTrack',
    0x0010: 'GPSImgDirectionRef',
    0x0011: 'GPSImgDirection',
    0x0012: 'GPSMapDatum',
    0x0013: 'GPSDestLatitudeRef',
    0x0014: 'GPSDestLatitude',
    0x0015: 'GPSDestLongitudeRef',
    0x0016: 'GPSDestLongitude',
    0x0017: 'GPSDestBearingRef',
    0x0018: 'GPSDestBearing',
    0x0019: 'GPSDestDistanceRef',
    0x001A: 'GPSDestDistance',
    0x001B: 'GPSProcessingMethod',
    0x001C: 'GPSAreaInformation',
    0x001D: 'GPSDateStamp',
    0x001E: 'GPSDifferential',
    0x001F: 'GPSHPositioningError'
  }

  loadImage.ExifMap.prototype.stringValues = {
    ExposureProgram: {
      0: 'Undefined',
      1: 'Manual',
      2: 'Normal program',
      3: 'Aperture priority',
      4: 'Shutter priority',
      5: 'Creative program',
      6: 'Action program',
      7: 'Portrait mode',
      8: 'Landscape mode'
    },
    MeteringMode: {
      0: 'Unknown',
      1: 'Average',
      2: 'CenterWeightedAverage',
      3: 'Spot',
      4: 'MultiSpot',
      5: 'Pattern',
      6: 'Partial',
      255: 'Other'
    },
    LightSource: {
      0: 'Unknown',
      1: 'Daylight',
      2: 'Fluorescent',
      3: 'Tungsten (incandescent light)',
      4: 'Flash',
      9: 'Fine weather',
      10: 'Cloudy weather',
      11: 'Shade',
      12: 'Daylight fluorescent (D 5700 - 7100K)',
      13: 'Day white fluorescent (N 4600 - 5400K)',
      14: 'Cool white fluorescent (W 3900 - 4500K)',
      15: 'White fluorescent (WW 3200 - 3700K)',
      17: 'Standard light A',
      18: 'Standard light B',
      19: 'Standard light C',
      20: 'D55',
      21: 'D65',
      22: 'D75',
      23: 'D50',
      24: 'ISO studio tungsten',
      255: 'Other'
    },
    Flash: {
      0x0000: 'Flash did not fire',
      0x0001: 'Flash fired',
      0x0005: 'Strobe return light not detected',
      0x0007: 'Strobe return light detected',
      0x0009: 'Flash fired, compulsory flash mode',
      0x000D: 'Flash fired, compulsory flash mode, return light not detected',
      0x000F: 'Flash fired, compulsory flash mode, return light detected',
      0x0010: 'Flash did not fire, compulsory flash mode',
      0x0018: 'Flash did not fire, auto mode',
      0x0019: 'Flash fired, auto mode',
      0x001D: 'Flash fired, auto mode, return light not detected',
      0x001F: 'Flash fired, auto mode, return light detected',
      0x0020: 'No flash function',
      0x0041: 'Flash fired, red-eye reduction mode',
      0x0045: 'Flash fired, red-eye reduction mode, return light not detected',
      0x0047: 'Flash fired, red-eye reduction mode, return light detected',
      0x0049: 'Flash fired, compulsory flash mode, red-eye reduction mode',
      0x004D: 'Flash fired, compulsory flash mode, red-eye reduction mode, return light not detected',
      0x004F: 'Flash fired, compulsory flash mode, red-eye reduction mode, return light detected',
      0x0059: 'Flash fired, auto mode, red-eye reduction mode',
      0x005D: 'Flash fired, auto mode, return light not detected, red-eye reduction mode',
      0x005F: 'Flash fired, auto mode, return light detected, red-eye reduction mode'
    },
    SensingMethod: {
      1: 'Undefined',
      2: 'One-chip color area sensor',
      3: 'Two-chip color area sensor',
      4: 'Three-chip color area sensor',
      5: 'Color sequential area sensor',
      7: 'Trilinear sensor',
      8: 'Color sequential linear sensor'
    },
    SceneCaptureType: {
      0: 'Standard',
      1: 'Landscape',
      2: 'Portrait',
      3: 'Night scene'
    },
    SceneType: {
      1: 'Directly photographed'
    },
    CustomRendered: {
      0: 'Normal process',
      1: 'Custom process'
    },
    WhiteBalance: {
      0: 'Auto white balance',
      1: 'Manual white balance'
    },
    GainControl: {
      0: 'None',
      1: 'Low gain up',
      2: 'High gain up',
      3: 'Low gain down',
      4: 'High gain down'
    },
    Contrast: {
      0: 'Normal',
      1: 'Soft',
      2: 'Hard'
    },
    Saturation: {
      0: 'Normal',
      1: 'Low saturation',
      2: 'High saturation'
    },
    Sharpness: {
      0: 'Normal',
      1: 'Soft',
      2: 'Hard'
    },
    SubjectDistanceRange: {
      0: 'Unknown',
      1: 'Macro',
      2: 'Close view',
      3: 'Distant view'
    },
    FileSource: {
      3: 'DSC'
    },
    ComponentsConfiguration: {
      0: '',
      1: 'Y',
      2: 'Cb',
      3: 'Cr',
      4: 'R',
      5: 'G',
      6: 'B'
    },
    Orientation: {
      1: 'top-left',
      2: 'top-right',
      3: 'bottom-right',
      4: 'bottom-left',
      5: 'left-top',
      6: 'right-top',
      7: 'right-bottom',
      8: 'left-bottom'
    }
  }

  loadImage.ExifMap.prototype.getText = function (id) {
    var value = this.get(id)
    switch (id) {
      case 'LightSource':
      case 'Flash':
      case 'MeteringMode':
      case 'ExposureProgram':
      case 'SensingMethod':
      case 'SceneCaptureType':
      case 'SceneType':
      case 'CustomRendered':
      case 'WhiteBalance':
      case 'GainControl':
      case 'Contrast':
      case 'Saturation':
      case 'Sharpness':
      case 'SubjectDistanceRange':
      case 'FileSource':
      case 'Orientation':
        return this.stringValues[id][value]
      case 'ExifVersion':
      case 'FlashpixVersion':
        return String.fromCharCode(value[0], value[1], value[2], value[3])
      case 'ComponentsConfiguration':
        return this.stringValues[id][value[0]] +
        this.stringValues[id][value[1]] +
        this.stringValues[id][value[2]] +
        this.stringValues[id][value[3]]
      case 'GPSVersionID':
        return value[0] + '.' + value[1] + '.' + value[2] + '.' + value[3]
    }
    return String(value)
  }

  ;(function (exifMapPrototype) {
    var tags = exifMapPrototype.tags
    var map = exifMapPrototype.map
    var prop
    // Map the tag names to tags:
    for (prop in tags) {
      if (tags.hasOwnProperty(prop)) {
        map[tags[prop]] = prop
      }
    }
  }(loadImage.ExifMap.prototype))

  loadImage.ExifMap.prototype.getAll = function () {
    var map = {}
    var prop
    var id
    for (prop in this) {
      if (this.hasOwnProperty(prop)) {
        id = this.tags[prop]
        if (id) {
          map[id] = this.getText(id)
        }
      }
    }
    return map
  }
}))

},{"./load-image":12,"./load-image-exif":9}],9:[function(require,module,exports){
/*
 * JavaScript Load Image Exif Parser
 * https://github.com/blueimp/JavaScript-Load-Image
 *
 * Copyright 2013, Sebastian Tschan
 * https://blueimp.net
 *
 * Licensed under the MIT license:
 * http://www.opensource.org/licenses/MIT
 */

/*global define, module, require, window, console */

;(function (factory) {
  'use strict'
  if (typeof define === 'function' && define.amd) {
    // Register as an anonymous AMD module:
    define(['./load-image', './load-image-meta'], factory)
  } else if (typeof module === 'object' && module.exports) {
    factory(require('./load-image'), require('./load-image-meta'))
  } else {
    // Browser globals:
    factory(window.loadImage)
  }
}(function (loadImage) {
  'use strict'

  loadImage.ExifMap = function () {
    return this
  }

  loadImage.ExifMap.prototype.map = {
    'Orientation': 0x0112
  }

  loadImage.ExifMap.prototype.get = function (id) {
    return this[id] || this[this.map[id]]
  }

  loadImage.getExifThumbnail = function (dataView, offset, length) {
    var hexData,
      i,
      b
    if (!length || offset + length > dataView.byteLength) {
      console.log('Invalid Exif data: Invalid thumbnail data.')
      return
    }
    hexData = []
    for (i = 0; i < length; i += 1) {
      b = dataView.getUint8(offset + i)
      hexData.push((b < 16 ? '0' : '') + b.toString(16))
    }
    return 'data:image/jpeg,%' + hexData.join('%')
  }

  loadImage.exifTagTypes = {
    // byte, 8-bit unsigned int:
    1: {
      getValue: function (dataView, dataOffset) {
        return dataView.getUint8(dataOffset)
      },
      size: 1
    },
    // ascii, 8-bit byte:
    2: {
      getValue: function (dataView, dataOffset) {
        return String.fromCharCode(dataView.getUint8(dataOffset))
      },
      size: 1,
      ascii: true
    },
    // short, 16 bit int:
    3: {
      getValue: function (dataView, dataOffset, littleEndian) {
        return dataView.getUint16(dataOffset, littleEndian)
      },
      size: 2
    },
    // long, 32 bit int:
    4: {
      getValue: function (dataView, dataOffset, littleEndian) {
        return dataView.getUint32(dataOffset, littleEndian)
      },
      size: 4
    },
    // rational = two long values, first is numerator, second is denominator:
    5: {
      getValue: function (dataView, dataOffset, littleEndian) {
        return dataView.getUint32(dataOffset, littleEndian) /
        dataView.getUint32(dataOffset + 4, littleEndian)
      },
      size: 8
    },
    // slong, 32 bit signed int:
    9: {
      getValue: function (dataView, dataOffset, littleEndian) {
        return dataView.getInt32(dataOffset, littleEndian)
      },
      size: 4
    },
    // srational, two slongs, first is numerator, second is denominator:
    10: {
      getValue: function (dataView, dataOffset, littleEndian) {
        return dataView.getInt32(dataOffset, littleEndian) /
        dataView.getInt32(dataOffset + 4, littleEndian)
      },
      size: 8
    }
  }
  // undefined, 8-bit byte, value depending on field:
  loadImage.exifTagTypes[7] = loadImage.exifTagTypes[1]

  loadImage.getExifValue = function (dataView, tiffOffset, offset, type, length, littleEndian) {
    var tagType = loadImage.exifTagTypes[type]
    var tagSize
    var dataOffset
    var values
    var i
    var str
    var c
    if (!tagType) {
      console.log('Invalid Exif data: Invalid tag type.')
      return
    }
    tagSize = tagType.size * length
    // Determine if the value is contained in the dataOffset bytes,
    // or if the value at the dataOffset is a pointer to the actual data:
    dataOffset = tagSize > 4
      ? tiffOffset + dataView.getUint32(offset + 8, littleEndian)
      : (offset + 8)
    if (dataOffset + tagSize > dataView.byteLength) {
      console.log('Invalid Exif data: Invalid data offset.')
      return
    }
    if (length === 1) {
      return tagType.getValue(dataView, dataOffset, littleEndian)
    }
    values = []
    for (i = 0; i < length; i += 1) {
      values[i] = tagType.getValue(dataView, dataOffset + i * tagType.size, littleEndian)
    }
    if (tagType.ascii) {
      str = ''
      // Concatenate the chars:
      for (i = 0; i < values.length; i += 1) {
        c = values[i]
        // Ignore the terminating NULL byte(s):
        if (c === '\u0000') {
          break
        }
        str += c
      }
      return str
    }
    return values
  }

  loadImage.parseExifTag = function (dataView, tiffOffset, offset, littleEndian, data) {
    var tag = dataView.getUint16(offset, littleEndian)
    data.exif[tag] = loadImage.getExifValue(
      dataView,
      tiffOffset,
      offset,
      dataView.getUint16(offset + 2, littleEndian), // tag type
      dataView.getUint32(offset + 4, littleEndian), // tag length
      littleEndian
    )
  }

  loadImage.parseExifTags = function (dataView, tiffOffset, dirOffset, littleEndian, data) {
    var tagsNumber,
      dirEndOffset,
      i
    if (dirOffset + 6 > dataView.byteLength) {
      console.log('Invalid Exif data: Invalid directory offset.')
      return
    }
    tagsNumber = dataView.getUint16(dirOffset, littleEndian)
    dirEndOffset = dirOffset + 2 + 12 * tagsNumber
    if (dirEndOffset + 4 > dataView.byteLength) {
      console.log('Invalid Exif data: Invalid directory size.')
      return
    }
    for (i = 0; i < tagsNumber; i += 1) {
      this.parseExifTag(
        dataView,
        tiffOffset,
        dirOffset + 2 + 12 * i, // tag offset
        littleEndian,
        data
      )
    }
    // Return the offset to the next directory:
    return dataView.getUint32(dirEndOffset, littleEndian)
  }

  loadImage.parseExifData = function (dataView, offset, length, data, options) {
    if (options.disableExif) {
      return
    }
    var tiffOffset = offset + 10
    var littleEndian
    var dirOffset
    var thumbnailData
    // Check for the ASCII code for "Exif" (0x45786966):
    if (dataView.getUint32(offset + 4) !== 0x45786966) {
      // No Exif data, might be XMP data instead
      return
    }
    if (tiffOffset + 8 > dataView.byteLength) {
      console.log('Invalid Exif data: Invalid segment size.')
      return
    }
    // Check for the two null bytes:
    if (dataView.getUint16(offset + 8) !== 0x0000) {
      console.log('Invalid Exif data: Missing byte alignment offset.')
      return
    }
    // Check the byte alignment:
    switch (dataView.getUint16(tiffOffset)) {
      case 0x4949:
        littleEndian = true
        break
      case 0x4D4D:
        littleEndian = false
        break
      default:
        console.log('Invalid Exif data: Invalid byte alignment marker.')
        return
    }
    // Check for the TIFF tag marker (0x002A):
    if (dataView.getUint16(tiffOffset + 2, littleEndian) !== 0x002A) {
      console.log('Invalid Exif data: Missing TIFF marker.')
      return
    }
    // Retrieve the directory offset bytes, usually 0x00000008 or 8 decimal:
    dirOffset = dataView.getUint32(tiffOffset + 4, littleEndian)
    // Create the exif object to store the tags:
    data.exif = new loadImage.ExifMap()
    // Parse the tags of the main image directory and retrieve the
    // offset to the next directory, usually the thumbnail directory:
    dirOffset = loadImage.parseExifTags(
      dataView,
      tiffOffset,
      tiffOffset + dirOffset,
      littleEndian,
      data
    )
    if (dirOffset && !options.disableExifThumbnail) {
      thumbnailData = {exif: {}}
      dirOffset = loadImage.parseExifTags(
        dataView,
        tiffOffset,
        tiffOffset + dirOffset,
        littleEndian,
        thumbnailData
      )
      // Check for JPEG Thumbnail offset:
      if (thumbnailData.exif[0x0201]) {
        data.exif.Thumbnail = loadImage.getExifThumbnail(
          dataView,
          tiffOffset + thumbnailData.exif[0x0201],
          thumbnailData.exif[0x0202] // Thumbnail data length
        )
      }
    }
    // Check for Exif Sub IFD Pointer:
    if (data.exif[0x8769] && !options.disableExifSub) {
      loadImage.parseExifTags(
        dataView,
        tiffOffset,
        tiffOffset + data.exif[0x8769], // directory offset
        littleEndian,
        data
      )
    }
    // Check for GPS Info IFD Pointer:
    if (data.exif[0x8825] && !options.disableExifGps) {
      loadImage.parseExifTags(
        dataView,
        tiffOffset,
        tiffOffset + data.exif[0x8825], // directory offset
        littleEndian,
        data
      )
    }
  }

  // Registers the Exif parser for the APP1 JPEG meta data segment:
  loadImage.metaDataParsers.jpeg[0xffe1].push(loadImage.parseExifData)

  // Adds the following properties to the parseMetaData callback data:
  // * exif: The exif tags, parsed by the parseExifData method

  // Adds the following options to the parseMetaData method:
  // * disableExif: Disables Exif parsing.
  // * disableExifThumbnail: Disables parsing of the Exif Thumbnail.
  // * disableExifSub: Disables parsing of the Exif Sub IFD.
  // * disableExifGps: Disables parsing of the Exif GPS Info IFD.
}))

},{"./load-image":12,"./load-image-meta":10}],10:[function(require,module,exports){
/*
 * JavaScript Load Image Meta
 * https://github.com/blueimp/JavaScript-Load-Image
 *
 * Copyright 2013, Sebastian Tschan
 * https://blueimp.net
 *
 * Image meta data handling implementation
 * based on the help and contribution of
 * Achim Stöhr.
 *
 * Licensed under the MIT license:
 * http://www.opensource.org/licenses/MIT
 */

  /*global define, module, require, window, DataView, Blob, Uint8Array, console */(function (factory) {
  'use strict';
  if (typeof define === 'function' && define.amd) {
    // Register as an anonymous AMD module:
    define(['./load-image'], factory);
  } else if (typeof module === 'object' && module.exports) {
    factory(require('./load-image'));
  } else {
    // Browser globals:
    factory(window.loadImage);
  }
}(function (loadImage) {
  'use strict';

  var hasblobSlice = window.Blob && (Blob.prototype.slice ||
    Blob.prototype.webkitSlice || Blob.prototype.mozSlice);

  loadImage.blobSlice = hasblobSlice && function () {
      var slice = this.slice || this.webkitSlice || this.mozSlice;
      return slice.apply(this, arguments);
  };

  loadImage.metaDataParsers = {
    jpeg: {
      // 0xffe0: [], // APP0 marker
      0xffe1: [], // APP1 marker
      // 0xffe2: [], // APP2 marker
      // 0xffe3: [], // APP3 marker
      // 0xffec: [], // APP12 marker
      // 0xffed: [], // APP13 marker
      // 0xffee: [], // APP14 marker
    }
  };

  // Parses image meta data and calls the callback with an object argument
  // with the following properties:
  // * imageHead: The complete image head as ArrayBuffer (Uint8Array for IE10)
  // The options arguments accepts an object and supports the following properties:
  // * maxMetaDataSize: Defines the maximum number of bytes to parse.
  // * disableImageHead: Disables creating the imageHead property.
  loadImage.parseMetaData = function (file, callback, options) {
    options = options || {};
    var that = this;
    // 256 KiB should contain all EXIF/ICC/IPTC segments:
    var maxMetaDataSize = options.maxMetaDataSize || 262144;
    maxMetaDataSize = Math.min(file.size, maxMetaDataSize);
    var data = {};
    var noMetaData = !(window.DataView && file && file.size >= 12 &&
      file.type === 'image/jpeg' && loadImage.blobSlice);
    if (noMetaData || !loadImage.readFile(
        loadImage.blobSlice.call(file, 0, maxMetaDataSize),
        function (e) {
          if (e.target.error) {
            // FileReader error
            console.log(e.target.error);
            callback(data);
            return;
          }
          // Note on endianness:
          // Since the marker and length bytes in JPEG files are always
          // stored in big endian order, we can leave the endian parameter
          // of the DataView methods undefined, defaulting to big endian.
          var buffer = e.target.result;
          var dataView = new DataView(buffer);
          var offset = 2;
          var maxOffset = dataView.byteLength - 4;
          var headLength = offset;
          var markerBytes;
          var markerLength;
          var parsers;
          var i;
          // Check for the JPEG marker (0xffd8):
          if (dataView.getUint16(0) === 0xffd8) {
            while (offset < maxOffset) {
              markerBytes = dataView.getUint16(offset);
              // Search for APPn (0xffeN) and COM (0xfffe) markers,
              // which contain application-specific meta-data like
              // Exif, ICC and IPTC data and text comments:
              if ((markerBytes >= 0xffe0 && markerBytes <= 0xffed) ||
                markerBytes === 0xfffe) {
                // The marker bytes (2) are always followed by
                // the length bytes (2), indicating the length of the
                // marker segment, which includes the length bytes,
                // but not the marker bytes, so we add 2:
                markerLength = dataView.getUint16(offset + 2) + 2;

                if (offset + markerLength > dataView.byteLength) {
                  console.log('Invalid meta data: Invalid segment size.');
                  break;
                }

                parsers = loadImage.metaDataParsers.jpeg[markerBytes];

                if (parsers) {
                  for (i = 0; i < parsers.length; i += 1) {
                    parsers[i].call(
                      that,
                      dataView,
                      offset,
                      markerLength,
                      data,
                      options
                    );
                  }
                }

                offset += markerLength;
                headLength = offset;
              } else {
                // Not an APPn or COM marker, probably safe to
                // assume that this is the end of the meta data
                break;
              }
            }
            // Meta length must be longer than JPEG marker (2)
            // plus APPn marker (2), followed by length bytes (2):
            if (!options.disableImageHead && headLength > 6) {
              if (buffer.slice) {
                data.imageHead = buffer.slice(0, headLength);
              } else {
                // Workaround for IE10, which does not yet
                // support ArrayBuffer.slice:
                data.imageHead = new Uint8Array(buffer)
                  .subarray(0, headLength);
              }
            }
          } else {
            console.log('Invalid JPEG file: Missing JPEG marker.');
          }
          callback(data);
        },
        'readAsArrayBuffer'
      )) {
      callback(data);
    }
  };
}));

},{"./load-image":12}],11:[function(require,module,exports){
/*
 * JavaScript Load Image Orientation
 * https://github.com/blueimp/JavaScript-Load-Image
 *
 * Copyright 2013, Sebastian Tschan
 * https://blueimp.net
 *
 * Licensed under the MIT license:
 * http://www.opensource.org/licenses/MIT
 */

/*global define, module, require, window */

;(function (factory) {
  'use strict'
  if (typeof define === 'function' && define.amd) {
    // Register as an anonymous AMD module:
    define(['./load-image'], factory)
  } else if (typeof module === 'object' && module.exports) {
    factory(require('./load-image'))
  } else {
    // Browser globals:
    factory(window.loadImage)
  }
}(function (loadImage) {
  'use strict'

  var originalHasCanvasOption = loadImage.hasCanvasOption
  var originalTransformCoordinates = loadImage.transformCoordinates
  var originalGetTransformedOptions = loadImage.getTransformedOptions

  // This method is used to determine if the target image
  // should be a canvas element:
  loadImage.hasCanvasOption = function (options) {
    return !!options.orientation ||
      originalHasCanvasOption.call(loadImage, options)
  }

  // Transform image orientation based on
  // the given EXIF orientation option:
  loadImage.transformCoordinates = function (canvas, options) {
    originalTransformCoordinates.call(loadImage, canvas, options)
    var ctx = canvas.getContext('2d')
    var width = canvas.width
    var height = canvas.height
    var styleWidth = canvas.style.width
    var styleHeight = canvas.style.height
    var orientation = options.orientation
    if (!orientation || orientation > 8) {
      return
    }
    if (orientation > 4) {
      canvas.width = height
      canvas.height = width
      canvas.style.width = styleHeight
      canvas.style.height = styleWidth
    }
    switch (orientation) {
      case 2:
        // horizontal flip
        ctx.translate(width, 0)
        ctx.scale(-1, 1)
        break
      case 3:
        // 180° rotate left
        ctx.translate(width, height)
        ctx.rotate(Math.PI)
        break
      case 4:
        // vertical flip
        ctx.translate(0, height)
        ctx.scale(1, -1)
        break
      case 5:
        // vertical flip + 90 rotate right
        ctx.rotate(0.5 * Math.PI)
        ctx.scale(1, -1)
        break
      case 6:
        // 90° rotate right
        ctx.rotate(0.5 * Math.PI)
        ctx.translate(0, -height)
        break
      case 7:
        // horizontal flip + 90 rotate right
        ctx.rotate(0.5 * Math.PI)
        ctx.translate(width, -height)
        ctx.scale(-1, 1)
        break
      case 8:
        // 90° rotate left
        ctx.rotate(-0.5 * Math.PI)
        ctx.translate(-width, 0)
        break
    }
  }

  // Transforms coordinate and dimension options
  // based on the given orientation option:
  loadImage.getTransformedOptions = function (img, opts) {
    var options = originalGetTransformedOptions.call(loadImage, img, opts)
    var orientation = options.orientation
    var newOptions
    var i
    if (!orientation || orientation > 8 || orientation === 1) {
      return options
    }
    newOptions = {}
    for (i in options) {
      if (options.hasOwnProperty(i)) {
        newOptions[i] = options[i]
      }
    }
    switch (options.orientation) {
      case 2:
        // horizontal flip
        newOptions.left = options.right
        newOptions.right = options.left
        break
      case 3:
        // 180° rotate left
        newOptions.left = options.right
        newOptions.top = options.bottom
        newOptions.right = options.left
        newOptions.bottom = options.top
        break
      case 4:
        // vertical flip
        newOptions.top = options.bottom
        newOptions.bottom = options.top
        break
      case 5:
        // vertical flip + 90 rotate right
        newOptions.left = options.top
        newOptions.top = options.left
        newOptions.right = options.bottom
        newOptions.bottom = options.right
        break
      case 6:
        // 90° rotate right
        newOptions.left = options.top
        newOptions.top = options.right
        newOptions.right = options.bottom
        newOptions.bottom = options.left
        break
      case 7:
        // horizontal flip + 90 rotate right
        newOptions.left = options.bottom
        newOptions.top = options.right
        newOptions.right = options.top
        newOptions.bottom = options.left
        break
      case 8:
        // 90° rotate left
        newOptions.left = options.bottom
        newOptions.top = options.left
        newOptions.right = options.top
        newOptions.bottom = options.right
        break
    }
    if (options.orientation > 4) {
      newOptions.maxWidth = options.maxHeight
      newOptions.maxHeight = options.maxWidth
      newOptions.minWidth = options.minHeight
      newOptions.minHeight = options.minWidth
      newOptions.sourceWidth = options.sourceHeight
      newOptions.sourceHeight = options.sourceWidth
    }
    return newOptions
  }
}))

},{"./load-image":12}],12:[function(require,module,exports){
/*
 * JavaScript Load Image
 * https://github.com/blueimp/JavaScript-Load-Image
 *
 * Copyright 2011, Sebastian Tschan
 * https://blueimp.net
 *
 * Licensed under the MIT license:
 * http://www.opensource.org/licenses/MIT
 */

/*global define, module, window, document, URL, webkitURL, FileReader */

;(function ($) {
  'use strict'

  // Loads an image for a given File object.
  // Invokes the callback with an img or optional canvas
  // element (if supported by the browser) as parameter:
  var loadImage = function (file, callback, options) {
    var img = document.createElement('img')
    var url
    var oUrl
    img.onerror = callback
    img.onload = function () {
      if (oUrl && !(options && options.noRevoke)) {
        loadImage.revokeObjectURL(oUrl)
      }
      if (callback) {
        callback(loadImage.scale(img, options))
      }
    }
    if (loadImage.isInstanceOf('Blob', file) ||
      // Files are also Blob instances, but some browsers
      // (Firefox 3.6) support the File API but not Blobs:
      loadImage.isInstanceOf('File', file)) {
      url = oUrl = loadImage.createObjectURL(file)
      // Store the file type for resize processing:
      img._type = file.type
    } else if (typeof file === 'string') {
      url = file
      if (options && options.crossOrigin) {
        img.crossOrigin = options.crossOrigin
      }
    } else {
      return false
    }
    if (url) {
      img.src = url
      return img
    }
    return loadImage.readFile(file, function (e) {
      var target = e.target
      if (target && target.result) {
        img.src = target.result
      } else {
        if (callback) {
          callback(e)
        }
      }
    })
  }
  // The check for URL.revokeObjectURL fixes an issue with Opera 12,
  // which provides URL.createObjectURL but doesn't properly implement it:
  var urlAPI = (window.createObjectURL && window) ||
                (window.URL && URL.revokeObjectURL && URL) ||
                (window.webkitURL && webkitURL)

  loadImage.isInstanceOf = function (type, obj) {
    // Cross-frame instanceof check
    return Object.prototype.toString.call(obj) === '[object ' + type + ']'
  }

  // Transform image coordinates, allows to override e.g.
  // the canvas orientation based on the orientation option,
  // gets canvas, options passed as arguments:
  loadImage.transformCoordinates = function () {
    return
  }

  // Returns transformed options, allows to override e.g.
  // maxWidth, maxHeight and crop options based on the aspectRatio.
  // gets img, options passed as arguments:
  loadImage.getTransformedOptions = function (img, options) {
    var aspectRatio = options.aspectRatio
    var newOptions
    var i
    var width
    var height
    if (!aspectRatio) {
      return options
    }
    newOptions = {}
    for (i in options) {
      if (options.hasOwnProperty(i)) {
        newOptions[i] = options[i]
      }
    }
    newOptions.crop = true
    width = img.naturalWidth || img.width
    height = img.naturalHeight || img.height
    if (width / height > aspectRatio) {
      newOptions.maxWidth = height * aspectRatio
      newOptions.maxHeight = height
    } else {
      newOptions.maxWidth = width
      newOptions.maxHeight = width / aspectRatio
    }
    return newOptions
  }

  // Canvas render method, allows to implement a different rendering algorithm:
  loadImage.renderImageToCanvas = function (
    canvas,
    img,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    destX,
    destY,
    destWidth,
    destHeight
  ) {
    canvas.getContext('2d').drawImage(
      img,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      destX,
      destY,
      destWidth,
      destHeight
    )
    return canvas
  }

  // This method is used to determine if the target image
  // should be a canvas element:
  loadImage.hasCanvasOption = function (options) {
    return options.canvas || options.crop || !!options.aspectRatio
  }

  // Scales and/or crops the given image (img or canvas HTML element)
  // using the given options.
  // Returns a canvas object if the browser supports canvas
  // and the hasCanvasOption method returns true or a canvas
  // object is passed as image, else the scaled image:
  loadImage.scale = function (img, options) {
    options = options || {}
    var canvas = document.createElement('canvas')
    var useCanvas = img.getContext ||
                    (loadImage.hasCanvasOption(options) && canvas.getContext)
    var width = img.naturalWidth || img.width
    var height = img.naturalHeight || img.height
    var destWidth = width
    var destHeight = height
    var maxWidth
    var maxHeight
    var minWidth
    var minHeight
    var sourceWidth
    var sourceHeight
    var sourceX
    var sourceY
    var pixelRatio
    var downsamplingRatio
    var tmp
    function scaleUp () {
      var scale = Math.max(
        (minWidth || destWidth) / destWidth,
        (minHeight || destHeight) / destHeight
      )
      if (scale > 1) {
        destWidth *= scale
        destHeight *= scale
      }
    }
    function scaleDown () {
      var scale = Math.min(
        (maxWidth || destWidth) / destWidth,
        (maxHeight || destHeight) / destHeight
      )
      if (scale < 1) {
        destWidth *= scale
        destHeight *= scale
      }
    }
    if (useCanvas) {
      options = loadImage.getTransformedOptions(img, options)
      sourceX = options.left || 0
      sourceY = options.top || 0
      if (options.sourceWidth) {
        sourceWidth = options.sourceWidth
        if (options.right !== undefined && options.left === undefined) {
          sourceX = width - sourceWidth - options.right
        }
      } else {
        sourceWidth = width - sourceX - (options.right || 0)
      }
      if (options.sourceHeight) {
        sourceHeight = options.sourceHeight
        if (options.bottom !== undefined && options.top === undefined) {
          sourceY = height - sourceHeight - options.bottom
        }
      } else {
        sourceHeight = height - sourceY - (options.bottom || 0)
      }
      destWidth = sourceWidth
      destHeight = sourceHeight
    }
    maxWidth = options.maxWidth
    maxHeight = options.maxHeight
    minWidth = options.minWidth
    minHeight = options.minHeight
    if (useCanvas && maxWidth && maxHeight && options.crop) {
      destWidth = maxWidth
      destHeight = maxHeight
      tmp = sourceWidth / sourceHeight - maxWidth / maxHeight
      if (tmp < 0) {
        sourceHeight = maxHeight * sourceWidth / maxWidth
        if (options.top === undefined && options.bottom === undefined) {
          sourceY = (height - sourceHeight) / 2
        }
      } else if (tmp > 0) {
        sourceWidth = maxWidth * sourceHeight / maxHeight
        if (options.left === undefined && options.right === undefined) {
          sourceX = (width - sourceWidth) / 2
        }
      }
    } else {
      if (options.contain || options.cover) {
        minWidth = maxWidth = maxWidth || minWidth
        minHeight = maxHeight = maxHeight || minHeight
      }
      if (options.cover) {
        scaleDown()
        scaleUp()
      } else {
        scaleUp()
        scaleDown()
      }
    }
    if (useCanvas) {
      pixelRatio = options.pixelRatio
      if (pixelRatio > 1) {
        canvas.style.width = destWidth + 'px'
        canvas.style.height = destHeight + 'px'
        destWidth *= pixelRatio
        destHeight *= pixelRatio
        canvas.getContext('2d').scale(pixelRatio, pixelRatio)
      }
      downsamplingRatio = options.downsamplingRatio
      if (downsamplingRatio > 0 && downsamplingRatio < 1 &&
            destWidth < sourceWidth && destHeight < sourceHeight) {
        while (sourceWidth * downsamplingRatio > destWidth) {
          canvas.width = sourceWidth * downsamplingRatio
          canvas.height = sourceHeight * downsamplingRatio
          loadImage.renderImageToCanvas(
            canvas,
            img,
            sourceX,
            sourceY,
            sourceWidth,
            sourceHeight,
            0,
            0,
            canvas.width,
            canvas.height
          )
          sourceWidth = canvas.width
          sourceHeight = canvas.height
          img = document.createElement('canvas')
          img.width = sourceWidth
          img.height = sourceHeight
          loadImage.renderImageToCanvas(
            img,
            canvas,
            0,
            0,
            sourceWidth,
            sourceHeight,
            0,
            0,
            sourceWidth,
            sourceHeight
          )
        }
      }
      canvas.width = destWidth
      canvas.height = destHeight
      loadImage.transformCoordinates(
        canvas,
        options
      )
      return loadImage.renderImageToCanvas(
        canvas,
        img,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        destWidth,
        destHeight
      )
    }
    img.width = destWidth
    img.height = destHeight
    return img
  }

  loadImage.createObjectURL = function (file) {
    return urlAPI ? urlAPI.createObjectURL(file) : false
  }

  loadImage.revokeObjectURL = function (url) {
    return urlAPI ? urlAPI.revokeObjectURL(url) : false
  }

  // Loads a given File object via FileReader interface,
  // invokes the callback with the event object (load or error).
  // The result can be read via event.target.result:
  loadImage.readFile = function (file, callback, method) {
    if (window.FileReader) {
      var fileReader = new FileReader()
      fileReader.onload = fileReader.onerror = callback
      method = method || 'readAsDataURL'
      if (fileReader[method]) {
        fileReader[method](file)
        return fileReader
      }
    }
    return false
  }

  if (typeof define === 'function' && define.amd) {
    define(function () {
      return loadImage
    })
  } else if (typeof module === 'object' && module.exports) {
    module.exports = loadImage
  } else {
    $.loadImage = loadImage
  }
}(window))

},{}],13:[function(require,module,exports){
/* FileSaver.js
 * A saveAs() FileSaver implementation.
 * 1.1.20160328
 *
 * By Eli Grey, http://eligrey.com
 * License: MIT
 *   See https://github.com/eligrey/FileSaver.js/blob/master/LICENSE.md
 */

/*global self */
/*jslint bitwise: true, indent: 4, laxbreak: true, laxcomma: true, smarttabs: true, plusplus: true */

/*! @source http://purl.eligrey.com/github/FileSaver.js/blob/master/FileSaver.js */

var saveAs = saveAs || (function(view) {
	"use strict";
	// IE <10 is explicitly unsupported
	if (typeof navigator !== "undefined" && /MSIE [1-9]\./.test(navigator.userAgent)) {
		return;
	}
	var
		  doc = view.document
		  // only get URL when necessary in case Blob.js hasn't overridden it yet
		, get_URL = function() {
			return view.URL || view.webkitURL || view;
		}
		, save_link = doc.createElementNS("http://www.w3.org/1999/xhtml", "a")
		, can_use_save_link = "download" in save_link
		, click = function(node) {
			var event = new MouseEvent("click");
			node.dispatchEvent(event);
		}
		, is_safari = /Version\/[\d\.]+.*Safari/.test(navigator.userAgent)
		, webkit_req_fs = view.webkitRequestFileSystem
		, req_fs = view.requestFileSystem || webkit_req_fs || view.mozRequestFileSystem
		, throw_outside = function(ex) {
			(view.setImmediate || view.setTimeout)(function() {
				throw ex;
			}, 0);
		}
		, force_saveable_type = "application/octet-stream"
		, fs_min_size = 0
		// the Blob API is fundamentally broken as there is no "downloadfinished" event to subscribe to
		, arbitrary_revoke_timeout = 1000 * 40 // in ms
		, revoke = function(file) {
			var revoker = function() {
				if (typeof file === "string") { // file is an object URL
					get_URL().revokeObjectURL(file);
				} else { // file is a File
					file.remove();
				}
			};
			/* // Take note W3C:
			var
			  uri = typeof file === "string" ? file : file.toURL()
			, revoker = function(evt) {
				// idealy DownloadFinishedEvent.data would be the URL requested
				if (evt.data === uri) {
					if (typeof file === "string") { // file is an object URL
						get_URL().revokeObjectURL(file);
					} else { // file is a File
						file.remove();
					}
				}
			}
			;
			view.addEventListener("downloadfinished", revoker);
			*/
			setTimeout(revoker, arbitrary_revoke_timeout);
		}
		, dispatch = function(filesaver, event_types, event) {
			event_types = [].concat(event_types);
			var i = event_types.length;
			while (i--) {
				var listener = filesaver["on" + event_types[i]];
				if (typeof listener === "function") {
					try {
						listener.call(filesaver, event || filesaver);
					} catch (ex) {
						throw_outside(ex);
					}
				}
			}
		}
		, auto_bom = function(blob) {
			// prepend BOM for UTF-8 XML and text/* types (including HTML)
			if (/^\s*(?:text\/\S*|application\/xml|\S*\/\S*\+xml)\s*;.*charset\s*=\s*utf-8/i.test(blob.type)) {
				return new Blob(["\ufeff", blob], {type: blob.type});
			}
			return blob;
		}
		, FileSaver = function(blob, name, no_auto_bom) {
			if (!no_auto_bom) {
				blob = auto_bom(blob);
			}
			// First try a.download, then web filesystem, then object URLs
			var
				  filesaver = this
				, type = blob.type
				, blob_changed = false
				, object_url
				, target_view
				, dispatch_all = function() {
					dispatch(filesaver, "writestart progress write writeend".split(" "));
				}
				// on any filesys errors revert to saving with object URLs
				, fs_error = function() {
					if (target_view && is_safari && typeof FileReader !== "undefined") {
						// Safari doesn't allow downloading of blob urls
						var reader = new FileReader();
						reader.onloadend = function() {
							var base64Data = reader.result;
							target_view.location.href = "data:attachment/file" + base64Data.slice(base64Data.search(/[,;]/));
							filesaver.readyState = filesaver.DONE;
							dispatch_all();
						};
						reader.readAsDataURL(blob);
						filesaver.readyState = filesaver.INIT;
						return;
					}
					// don't create more object URLs than needed
					if (blob_changed || !object_url) {
						object_url = get_URL().createObjectURL(blob);
					}
					if (target_view) {
						target_view.location.href = object_url;
					} else {
						var new_tab = view.open(object_url, "_blank");
						if (new_tab === undefined && is_safari) {
							//Apple do not allow window.open, see http://bit.ly/1kZffRI
							view.location.href = object_url
						}
					}
					filesaver.readyState = filesaver.DONE;
					dispatch_all();
					revoke(object_url);
				}
				, abortable = function(func) {
					return function() {
						if (filesaver.readyState !== filesaver.DONE) {
							return func.apply(this, arguments);
						}
					};
				}
				, create_if_not_found = {create: true, exclusive: false}
				, slice
			;
			filesaver.readyState = filesaver.INIT;
			if (!name) {
				name = "download";
			}
			if (can_use_save_link) {
				object_url = get_URL().createObjectURL(blob);
				setTimeout(function() {
					save_link.href = object_url;
					save_link.download = name;
					click(save_link);
					dispatch_all();
					revoke(object_url);
					filesaver.readyState = filesaver.DONE;
				});
				return;
			}
			// Object and web filesystem URLs have a problem saving in Google Chrome when
			// viewed in a tab, so I force save with application/octet-stream
			// http://code.google.com/p/chromium/issues/detail?id=91158
			// Update: Google errantly closed 91158, I submitted it again:
			// https://code.google.com/p/chromium/issues/detail?id=389642
			if (view.chrome && type && type !== force_saveable_type) {
				slice = blob.slice || blob.webkitSlice;
				blob = slice.call(blob, 0, blob.size, force_saveable_type);
				blob_changed = true;
			}
			// Since I can't be sure that the guessed media type will trigger a download
			// in WebKit, I append .download to the filename.
			// https://bugs.webkit.org/show_bug.cgi?id=65440
			if (webkit_req_fs && name !== "download") {
				name += ".download";
			}
			if (type === force_saveable_type || webkit_req_fs) {
				target_view = view;
			}
			if (!req_fs) {
				fs_error();
				return;
			}
			fs_min_size += blob.size;
			req_fs(view.TEMPORARY, fs_min_size, abortable(function(fs) {
				fs.root.getDirectory("saved", create_if_not_found, abortable(function(dir) {
					var save = function() {
						dir.getFile(name, create_if_not_found, abortable(function(file) {
							file.createWriter(abortable(function(writer) {
								writer.onwriteend = function(event) {
									target_view.location.href = file.toURL();
									filesaver.readyState = filesaver.DONE;
									dispatch(filesaver, "writeend", event);
									revoke(file);
								};
								writer.onerror = function() {
									var error = writer.error;
									if (error.code !== error.ABORT_ERR) {
										fs_error();
									}
								};
								"writestart progress write abort".split(" ").forEach(function(event) {
									writer["on" + event] = filesaver["on" + event];
								});
								writer.write(blob);
								filesaver.abort = function() {
									writer.abort();
									filesaver.readyState = filesaver.DONE;
								};
								filesaver.readyState = filesaver.WRITING;
							}), fs_error);
						}), fs_error);
					};
					dir.getFile(name, {create: false}, abortable(function(file) {
						// delete file if it already exists
						file.remove();
						save();
					}), abortable(function(ex) {
						if (ex.code === ex.NOT_FOUND_ERR) {
							save();
						} else {
							fs_error();
						}
					}));
				}), fs_error);
			}), fs_error);
		}
		, FS_proto = FileSaver.prototype
		, saveAs = function(blob, name, no_auto_bom) {
			return new FileSaver(blob, name, no_auto_bom);
		}
	;
	// IE 10+ (native saveAs)
	if (typeof navigator !== "undefined" && navigator.msSaveOrOpenBlob) {
		return function(blob, name, no_auto_bom) {
			if (!no_auto_bom) {
				blob = auto_bom(blob);
			}
			return navigator.msSaveOrOpenBlob(blob, name || "download");
		};
	}

	FS_proto.abort = function() {
		var filesaver = this;
		filesaver.readyState = filesaver.DONE;
		dispatch(filesaver, "abort");
	};
	FS_proto.readyState = FS_proto.INIT = 0;
	FS_proto.WRITING = 1;
	FS_proto.DONE = 2;

	FS_proto.error =
	FS_proto.onwritestart =
	FS_proto.onprogress =
	FS_proto.onwrite =
	FS_proto.onabort =
	FS_proto.onerror =
	FS_proto.onwriteend =
		null;

	return saveAs;
}(
	   typeof self !== "undefined" && self
	|| typeof window !== "undefined" && window
	|| this.content
));
// `self` is undefined in Firefox for Android content script context
// while `this` is nsIContentFrameMessageManager
// with an attribute `content` that corresponds to the window

if (typeof module !== "undefined" && module.exports) {
  module.exports.saveAs = saveAs;
} else if ((typeof define !== "undefined" && define !== null) && (define.amd !== null)) {
  define([], function() {
    return saveAs;
  });
}

},{}],14:[function(require,module,exports){
'use strict';

// http://www.color.org/profileheader.xalter

var versionMap = {
  0x02000000: '2.0',
  0x02100000: '2.1',
  0x02400000: '2.4',
  0x04000000: '4.0',
  0x04200000: '4.2'
};

var intentMap = {
  0: 'Perceptual',
  1: 'Relative',
  2: 'Saturation',
  3: 'Absolute'
};

var valueMap = {
  // Device
  'scnr': 'Scanner',
  'mntr': 'Monitor',
  'prtr': 'Printer',
  'link': 'Link',
  'abst': 'Abstract',
  'spac': 'Space',
  'nmcl': 'Named color',
  // Platform
  'appl': 'Apple',
  'adbe': 'Adobe',
  'msft': 'Microsoft',
  'sunw': 'Sun Microsystems',
  'sgi' : 'Silicon Graphics',
  'tgnt': 'Taligent'
};

var tagMap = {
  'desc': 'description',
  'cprt': 'copyright',
  'dmdd': 'deviceModelDescription',
  'vued': 'viewingConditionsDescription'
};

var getContentAtOffsetAsString = function(buffer, offset) {
  var value = buffer.slice(offset, offset + 4).toString().trim();
  return (value.toLowerCase() in valueMap) ? valueMap[value.toLowerCase()] : value;
};

var hasContentAtOffset = function(buffer, offset) {
  return (buffer.readUInt32BE(offset) !== 0);
};

module.exports.parse = function(buffer) {
  // Verify expected length
  var size = buffer.readUInt32BE(0);
  if (size !== buffer.length) {
    throw new Error('Invalid ICC profile: length mismatch');
  }
  // Verify 'acsp' signature
  var signature = buffer.slice(36, 40).toString();
  if (signature !== 'acsp') {
    throw new Error('Invalid ICC profile: missing signature');
  }
  // Integer attributes
  var profile = {
    version: versionMap[buffer.readUInt32BE(8)],
    intent: intentMap[buffer.readUInt32BE(64)]
  };
  // Four-byte string attributes
  [
    [ 4, 'cmm'],
    [12, 'deviceClass'],
    [16, 'colorSpace'],
    [20, 'connectionSpace'],
    [40, 'platform'],
    [48, 'manufacturer'],
    [52, 'model'],
    [80, 'creator']
  ].forEach(function(attr) {
    if (hasContentAtOffset(buffer, attr[0])) {
      profile[attr[1]] = getContentAtOffsetAsString(buffer, attr[0]);
    }
  });
  // Tags
  var tagCount = buffer.readUInt32BE(128);
  var tagHeaderOffset = 132;
  for (var i = 0; i < tagCount; i++) {
    var tagSignature = getContentAtOffsetAsString(buffer, tagHeaderOffset);
    if (tagSignature in tagMap) {
      var tagOffset = buffer.readUInt32BE(tagHeaderOffset + 4);
      var tagSize = buffer.readUInt32BE(tagHeaderOffset + 8);
      if (tagOffset > buffer.length) {
        throw new Error('Invalid ICC profile: Tag offset out of bounds');
      }
      var tagType = getContentAtOffsetAsString(buffer, tagOffset);
      // desc
      if (tagType === 'desc') {
        var tagValueSize = buffer.readUInt32BE(tagOffset + 8);
        if (tagValueSize > tagSize) {
          throw new Error('Invalid ICC profile: Description tag value size out of bounds for ' + tagSignature);
        }
        profile[tagMap[tagSignature]] = buffer.slice(tagOffset + 12, tagOffset + tagValueSize + 11).toString();
      }
      // text
      if (tagType === 'text') {
        profile[tagMap[tagSignature]] = buffer.slice(tagOffset + 8, tagOffset + tagSize - 7).toString();
      }
    }
    tagHeaderOffset = tagHeaderOffset + 12;
  }
  return profile;
};

},{}],15:[function(require,module,exports){
var icc = require('icc');
var Buffer = require('buffer').Buffer;
var arrayBufferConcat = require('array-buffer-concat');
var loadImage = require('blueimp-load-image');
var saveAs = require('browser-filesaver').saveAs;
require('blueimp-canvas-to-blob');

// Create parser array for APP2 segment
loadImage.metaDataParsers.jpeg[0xffe2] = [];

// Add parser
loadImage.metaDataParsers.jpeg[0xffe2].push(function (dataView, offset, length, data, options) {
  // Grab the ICC profile from the APP2 segment(s) of the header
  var iccChunk = dataView.buffer.slice(offset + 18, offset + length);

  if (iccChunk.byteLength > 0) {
    if (data.iccProfile) {
      // Profile is split accross multiple segments so we need to concatenate the chunks
      data.iccProfile = arrayBufferConcat(data.iccProfile, iccChunk);
    } else {
      data.iccProfile = iccChunk;
    }
  }
});

function fileHandler(event) {
  event.preventDefault();

  event = event.originalEvent || event;

  var target = event.dataTransfer || event.target;

  var fileOrBlob = target && target.files && target.files[0];

  if (!fileOrBlob) {
    return;
  }

  loadImage.parseMetaData(fileOrBlob, function (data) {
    if (!data.imageHead) {
      console.error('No image header', fileOrBlob);
      return;
    }

    console.log(data);

    // var exif = data.exif.getAll();
    // console.log(exif);

    if (data.iccProfile) {
      // Convert the profile ArrayBuffer into a normal buffer for the `icc` parser module
      var buffer = new Buffer(data.iccProfile.byteLength);
      var view = new Uint8Array(data.iccProfile);
      for (var i = 0; i < buffer.length; ++i) {
        buffer[i] = view[i];
      }

      // Parse the profile
      var profile = icc.parse(buffer);
      console.dir(profile);

      // Just for fun convert the profile into a blob for download
      var iccBlob = new Blob([data.iccProfile], { type: 'application/vnd.iccprofile' });
      saveAs(iccBlob, 'profile.icc');
    }

    loadImage(fileOrBlob, function (resizedImageCanvas) {
      resizedImageCanvas.toBlob(function (resizedBlob) {
        // Combine data.imageHead with the image body of a resized file
        // to create scaled images with the original image meta data, e.g.:
        var blob = new Blob([data.imageHead,
        // Resized images always have a head size of 20 bytes,
        // including the JPEG marker and a minimal JFIF header:
        loadImage.blobSlice.call(resizedBlob, 20)], {
          type: resizedBlob.type
        });

        // Download the resized image
        saveAs(blob, 'image.jpg');
      }, 'image/jpeg');
    }, {
      maxWidth: 500,
      maxHeight: 500,
      canvas: true
    });
  }, {
    // Increase the metadata size for CMYK profiles
    // these are larger as they contain more info
    // required to convert the colorspace(?):
    maxMetaDataSize: 1024000,
    disableImageHead: false
  });
}

document.getElementById('file-input').addEventListener('change', fileHandler);

},{"array-buffer-concat":5,"blueimp-canvas-to-blob":6,"blueimp-load-image":7,"browser-filesaver":13,"buffer":2,"icc":14}]},{},[15])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy5ub2RlL2xpYi9ub2RlX21vZHVsZXMvd2F0Y2hpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIi4uLy4uLy4uLy5ub2RlL2xpYi9ub2RlX21vZHVsZXMvd2F0Y2hpZnkvbm9kZV9tb2R1bGVzL2Jhc2U2NC1qcy9saWIvYjY0LmpzIiwiLi4vLi4vLi4vLm5vZGUvbGliL25vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL2luZGV4LmpzIiwiLi4vLi4vLi4vLm5vZGUvbGliL25vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9pc2FycmF5L2luZGV4LmpzIiwiLi4vLi4vLi4vLm5vZGUvbGliL25vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvaWVlZTc1NC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9hcnJheS1idWZmZXItY29uY2F0L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2JsdWVpbXAtY2FudmFzLXRvLWJsb2IvanMvY2FudmFzLXRvLWJsb2IuanMiLCJub2RlX21vZHVsZXMvYmx1ZWltcC1sb2FkLWltYWdlL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2JsdWVpbXAtbG9hZC1pbWFnZS9qcy9sb2FkLWltYWdlLWV4aWYtbWFwLmpzIiwibm9kZV9tb2R1bGVzL2JsdWVpbXAtbG9hZC1pbWFnZS9qcy9sb2FkLWltYWdlLWV4aWYuanMiLCJub2RlX21vZHVsZXMvYmx1ZWltcC1sb2FkLWltYWdlL2pzL2xvYWQtaW1hZ2UtbWV0YS5qcyIsIm5vZGVfbW9kdWxlcy9ibHVlaW1wLWxvYWQtaW1hZ2UvanMvbG9hZC1pbWFnZS1vcmllbnRhdGlvbi5qcyIsIm5vZGVfbW9kdWxlcy9ibHVlaW1wLWxvYWQtaW1hZ2UvanMvbG9hZC1pbWFnZS5qcyIsIm5vZGVfbW9kdWxlcy9icm93c2VyLWZpbGVzYXZlci9GaWxlU2F2ZXIuanMiLCJub2RlX21vZHVsZXMvaWNjL2luZGV4LmpzIiwic3JjL3NjcmlwdC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDbklBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUN0N0NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0dBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hZQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1U0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNVZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeFJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqSEEsSUFBSSxNQUFNLFFBQVEsS0FBUixDQUFWO0FBQ0EsSUFBSSxTQUFTLFFBQVEsUUFBUixFQUFrQixNQUEvQjtBQUNBLElBQUksb0JBQW9CLFFBQVEscUJBQVIsQ0FBeEI7QUFDQSxJQUFJLFlBQVksUUFBUSxvQkFBUixDQUFoQjtBQUNBLElBQUksU0FBUyxRQUFRLG1CQUFSLEVBQTZCLE1BQTFDO0FBQ0EsUUFBUSx3QkFBUjs7O0FBR0EsVUFBVSxlQUFWLENBQTBCLElBQTFCLENBQStCLE1BQS9CLElBQXlDLEVBQXpDOzs7QUFHQSxVQUFVLGVBQVYsQ0FBMEIsSUFBMUIsQ0FBK0IsTUFBL0IsRUFBdUMsSUFBdkMsQ0FBNEMsVUFBVSxRQUFWLEVBQW9CLE1BQXBCLEVBQTRCLE1BQTVCLEVBQW9DLElBQXBDLEVBQTBDLE9BQTFDLEVBQW1EOztBQUU3RixNQUFJLFdBQVcsU0FBUyxNQUFULENBQWdCLEtBQWhCLENBQXNCLFNBQVMsRUFBL0IsRUFBbUMsU0FBUyxNQUE1QyxDQUFmOztBQUVBLE1BQUksU0FBUyxVQUFULEdBQXNCLENBQTFCLEVBQTZCO0FBQzNCLFFBQUksS0FBSyxVQUFULEVBQXFCOztBQUVuQixXQUFLLFVBQUwsR0FBa0Isa0JBQWtCLEtBQUssVUFBdkIsRUFBbUMsUUFBbkMsQ0FBbEI7QUFDRCxLQUhELE1BR087QUFDTCxXQUFLLFVBQUwsR0FBa0IsUUFBbEI7QUFDRDtBQUNGO0FBQ0YsQ0FaRDs7QUFjQSxTQUFTLFdBQVQsQ0FBc0IsS0FBdEIsRUFBNkI7QUFDM0IsUUFBTSxjQUFOOztBQUVBLFVBQVEsTUFBTSxhQUFOLElBQXVCLEtBQS9COztBQUVBLE1BQUksU0FBUyxNQUFNLFlBQU4sSUFBc0IsTUFBTSxNQUF6Qzs7QUFFQSxNQUFJLGFBQWEsVUFBVSxPQUFPLEtBQWpCLElBQTBCLE9BQU8sS0FBUCxDQUFhLENBQWIsQ0FBM0M7O0FBRUEsTUFBSSxDQUFDLFVBQUwsRUFBaUI7QUFDZjtBQUNEOztBQUVELFlBQVUsYUFBVixDQUF3QixVQUF4QixFQUFvQyxVQUFVLElBQVYsRUFBZ0I7QUFDbEQsUUFBSSxDQUFDLEtBQUssU0FBVixFQUFxQjtBQUNuQixjQUFRLEtBQVIsQ0FBYyxpQkFBZCxFQUFpQyxVQUFqQztBQUNBO0FBQ0Q7O0FBRUQsWUFBUSxHQUFSLENBQVksSUFBWjs7Ozs7QUFLQSxRQUFJLEtBQUssVUFBVCxFQUFxQjs7QUFFbkIsVUFBSSxTQUFTLElBQUksTUFBSixDQUFXLEtBQUssVUFBTCxDQUFnQixVQUEzQixDQUFiO0FBQ0EsVUFBSSxPQUFPLElBQUksVUFBSixDQUFlLEtBQUssVUFBcEIsQ0FBWDtBQUNBLFdBQUssSUFBSSxJQUFJLENBQWIsRUFBZ0IsSUFBSSxPQUFPLE1BQTNCLEVBQW1DLEVBQUUsQ0FBckMsRUFBd0M7QUFDdEMsZUFBTyxDQUFQLElBQVksS0FBSyxDQUFMLENBQVo7QUFDRDs7O0FBR0QsVUFBSSxVQUFVLElBQUksS0FBSixDQUFVLE1BQVYsQ0FBZDtBQUNBLGNBQVEsR0FBUixDQUFZLE9BQVo7OztBQUdBLFVBQUksVUFBVSxJQUFJLElBQUosQ0FBUyxDQUFDLEtBQUssVUFBTixDQUFULEVBQTRCLEVBQUMsTUFBTSw0QkFBUCxFQUE1QixDQUFkO0FBQ0EsYUFBTyxPQUFQLEVBQWdCLGFBQWhCO0FBQ0Q7O0FBRUQsY0FBVSxVQUFWLEVBQXNCLFVBQVUsa0JBQVYsRUFBOEI7QUFDbEQseUJBQW1CLE1BQW5CLENBQTBCLFVBQVUsV0FBVixFQUF1Qjs7O0FBRy9DLFlBQUksT0FBTyxJQUFJLElBQUosQ0FBUyxDQUNsQixLQUFLLFNBRGE7OztBQUlsQixrQkFBVSxTQUFWLENBQW9CLElBQXBCLENBQXlCLFdBQXpCLEVBQXNDLEVBQXRDLENBSmtCLENBQVQsRUFLUjtBQUNELGdCQUFNLFlBQVk7QUFEakIsU0FMUSxDQUFYOzs7QUFVQSxlQUFPLElBQVAsRUFBYSxXQUFiO0FBRUQsT0FmRCxFQWdCRSxZQWhCRjtBQW1CRCxLQXBCRCxFQW9CRztBQUNELGdCQUFVLEdBRFQ7QUFFRCxpQkFBVyxHQUZWO0FBR0QsY0FBUTtBQUhQLEtBcEJIO0FBMEJELEdBdERELEVBc0RHOzs7O0FBSUQscUJBQWlCLE9BSmhCO0FBS0Qsc0JBQWtCO0FBTGpCLEdBdERIO0FBOEREOztBQUVELFNBQVMsY0FBVCxDQUF3QixZQUF4QixFQUFzQyxnQkFBdEMsQ0FBdUQsUUFBdkQsRUFBaUUsV0FBakUiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiOyhmdW5jdGlvbiAoZXhwb3J0cykge1xuICAndXNlIHN0cmljdCdcblxuICB2YXIgaVxuICB2YXIgY29kZSA9ICdBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWmFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6MDEyMzQ1Njc4OSsvJ1xuICB2YXIgbG9va3VwID0gW11cbiAgZm9yIChpID0gMDsgaSA8IGNvZGUubGVuZ3RoOyBpKyspIHtcbiAgICBsb29rdXBbaV0gPSBjb2RlW2ldXG4gIH1cbiAgdmFyIHJldkxvb2t1cCA9IFtdXG5cbiAgZm9yIChpID0gMDsgaSA8IGNvZGUubGVuZ3RoOyArK2kpIHtcbiAgICByZXZMb29rdXBbY29kZS5jaGFyQ29kZUF0KGkpXSA9IGlcbiAgfVxuICByZXZMb29rdXBbJy0nLmNoYXJDb2RlQXQoMCldID0gNjJcbiAgcmV2TG9va3VwWydfJy5jaGFyQ29kZUF0KDApXSA9IDYzXG5cbiAgdmFyIEFyciA9ICh0eXBlb2YgVWludDhBcnJheSAhPT0gJ3VuZGVmaW5lZCcpXG4gICAgPyBVaW50OEFycmF5XG4gICAgOiBBcnJheVxuXG4gIGZ1bmN0aW9uIGRlY29kZSAoZWx0KSB7XG4gICAgdmFyIHYgPSByZXZMb29rdXBbZWx0LmNoYXJDb2RlQXQoMCldXG4gICAgcmV0dXJuIHYgIT09IHVuZGVmaW5lZCA/IHYgOiAtMVxuICB9XG5cbiAgZnVuY3Rpb24gYjY0VG9CeXRlQXJyYXkgKGI2NCkge1xuICAgIHZhciBpLCBqLCBsLCB0bXAsIHBsYWNlSG9sZGVycywgYXJyXG5cbiAgICBpZiAoYjY0Lmxlbmd0aCAlIDQgPiAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgc3RyaW5nLiBMZW5ndGggbXVzdCBiZSBhIG11bHRpcGxlIG9mIDQnKVxuICAgIH1cblxuICAgIC8vIHRoZSBudW1iZXIgb2YgZXF1YWwgc2lnbnMgKHBsYWNlIGhvbGRlcnMpXG4gICAgLy8gaWYgdGhlcmUgYXJlIHR3byBwbGFjZWhvbGRlcnMsIHRoYW4gdGhlIHR3byBjaGFyYWN0ZXJzIGJlZm9yZSBpdFxuICAgIC8vIHJlcHJlc2VudCBvbmUgYnl0ZVxuICAgIC8vIGlmIHRoZXJlIGlzIG9ubHkgb25lLCB0aGVuIHRoZSB0aHJlZSBjaGFyYWN0ZXJzIGJlZm9yZSBpdCByZXByZXNlbnQgMiBieXRlc1xuICAgIC8vIHRoaXMgaXMganVzdCBhIGNoZWFwIGhhY2sgdG8gbm90IGRvIGluZGV4T2YgdHdpY2VcbiAgICB2YXIgbGVuID0gYjY0Lmxlbmd0aFxuICAgIHBsYWNlSG9sZGVycyA9IGI2NC5jaGFyQXQobGVuIC0gMikgPT09ICc9JyA/IDIgOiBiNjQuY2hhckF0KGxlbiAtIDEpID09PSAnPScgPyAxIDogMFxuXG4gICAgLy8gYmFzZTY0IGlzIDQvMyArIHVwIHRvIHR3byBjaGFyYWN0ZXJzIG9mIHRoZSBvcmlnaW5hbCBkYXRhXG4gICAgYXJyID0gbmV3IEFycihiNjQubGVuZ3RoICogMyAvIDQgLSBwbGFjZUhvbGRlcnMpXG5cbiAgICAvLyBpZiB0aGVyZSBhcmUgcGxhY2Vob2xkZXJzLCBvbmx5IGdldCB1cCB0byB0aGUgbGFzdCBjb21wbGV0ZSA0IGNoYXJzXG4gICAgbCA9IHBsYWNlSG9sZGVycyA+IDAgPyBiNjQubGVuZ3RoIC0gNCA6IGI2NC5sZW5ndGhcblxuICAgIHZhciBMID0gMFxuXG4gICAgZnVuY3Rpb24gcHVzaCAodikge1xuICAgICAgYXJyW0wrK10gPSB2XG4gICAgfVxuXG4gICAgZm9yIChpID0gMCwgaiA9IDA7IGkgPCBsOyBpICs9IDQsIGogKz0gMykge1xuICAgICAgdG1wID0gKGRlY29kZShiNjQuY2hhckF0KGkpKSA8PCAxOCkgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDEpKSA8PCAxMikgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDIpKSA8PCA2KSB8IGRlY29kZShiNjQuY2hhckF0KGkgKyAzKSlcbiAgICAgIHB1c2goKHRtcCAmIDB4RkYwMDAwKSA+PiAxNilcbiAgICAgIHB1c2goKHRtcCAmIDB4RkYwMCkgPj4gOClcbiAgICAgIHB1c2godG1wICYgMHhGRilcbiAgICB9XG5cbiAgICBpZiAocGxhY2VIb2xkZXJzID09PSAyKSB7XG4gICAgICB0bXAgPSAoZGVjb2RlKGI2NC5jaGFyQXQoaSkpIDw8IDIpIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAxKSkgPj4gNClcbiAgICAgIHB1c2godG1wICYgMHhGRilcbiAgICB9IGVsc2UgaWYgKHBsYWNlSG9sZGVycyA9PT0gMSkge1xuICAgICAgdG1wID0gKGRlY29kZShiNjQuY2hhckF0KGkpKSA8PCAxMCkgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDEpKSA8PCA0KSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMikpID4+IDIpXG4gICAgICBwdXNoKCh0bXAgPj4gOCkgJiAweEZGKVxuICAgICAgcHVzaCh0bXAgJiAweEZGKVxuICAgIH1cblxuICAgIHJldHVybiBhcnJcbiAgfVxuXG4gIGZ1bmN0aW9uIGVuY29kZSAobnVtKSB7XG4gICAgcmV0dXJuIGxvb2t1cFtudW1dXG4gIH1cblxuICBmdW5jdGlvbiB0cmlwbGV0VG9CYXNlNjQgKG51bSkge1xuICAgIHJldHVybiBlbmNvZGUobnVtID4+IDE4ICYgMHgzRikgKyBlbmNvZGUobnVtID4+IDEyICYgMHgzRikgKyBlbmNvZGUobnVtID4+IDYgJiAweDNGKSArIGVuY29kZShudW0gJiAweDNGKVxuICB9XG5cbiAgZnVuY3Rpb24gZW5jb2RlQ2h1bmsgKHVpbnQ4LCBzdGFydCwgZW5kKSB7XG4gICAgdmFyIHRlbXBcbiAgICB2YXIgb3V0cHV0ID0gW11cbiAgICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkgKz0gMykge1xuICAgICAgdGVtcCA9ICh1aW50OFtpXSA8PCAxNikgKyAodWludDhbaSArIDFdIDw8IDgpICsgKHVpbnQ4W2kgKyAyXSlcbiAgICAgIG91dHB1dC5wdXNoKHRyaXBsZXRUb0Jhc2U2NCh0ZW1wKSlcbiAgICB9XG4gICAgcmV0dXJuIG91dHB1dC5qb2luKCcnKVxuICB9XG5cbiAgZnVuY3Rpb24gdWludDhUb0Jhc2U2NCAodWludDgpIHtcbiAgICB2YXIgaVxuICAgIHZhciBleHRyYUJ5dGVzID0gdWludDgubGVuZ3RoICUgMyAvLyBpZiB3ZSBoYXZlIDEgYnl0ZSBsZWZ0LCBwYWQgMiBieXRlc1xuICAgIHZhciBvdXRwdXQgPSAnJ1xuICAgIHZhciBwYXJ0cyA9IFtdXG4gICAgdmFyIHRlbXAsIGxlbmd0aFxuICAgIHZhciBtYXhDaHVua0xlbmd0aCA9IDE2MzgzIC8vIG11c3QgYmUgbXVsdGlwbGUgb2YgM1xuXG4gICAgLy8gZ28gdGhyb3VnaCB0aGUgYXJyYXkgZXZlcnkgdGhyZWUgYnl0ZXMsIHdlJ2xsIGRlYWwgd2l0aCB0cmFpbGluZyBzdHVmZiBsYXRlclxuXG4gICAgZm9yIChpID0gMCwgbGVuZ3RoID0gdWludDgubGVuZ3RoIC0gZXh0cmFCeXRlczsgaSA8IGxlbmd0aDsgaSArPSBtYXhDaHVua0xlbmd0aCkge1xuICAgICAgcGFydHMucHVzaChlbmNvZGVDaHVuayh1aW50OCwgaSwgKGkgKyBtYXhDaHVua0xlbmd0aCkgPiBsZW5ndGggPyBsZW5ndGggOiAoaSArIG1heENodW5rTGVuZ3RoKSkpXG4gICAgfVxuXG4gICAgLy8gcGFkIHRoZSBlbmQgd2l0aCB6ZXJvcywgYnV0IG1ha2Ugc3VyZSB0byBub3QgZm9yZ2V0IHRoZSBleHRyYSBieXRlc1xuICAgIHN3aXRjaCAoZXh0cmFCeXRlcykge1xuICAgICAgY2FzZSAxOlxuICAgICAgICB0ZW1wID0gdWludDhbdWludDgubGVuZ3RoIC0gMV1cbiAgICAgICAgb3V0cHV0ICs9IGVuY29kZSh0ZW1wID4+IDIpXG4gICAgICAgIG91dHB1dCArPSBlbmNvZGUoKHRlbXAgPDwgNCkgJiAweDNGKVxuICAgICAgICBvdXRwdXQgKz0gJz09J1xuICAgICAgICBicmVha1xuICAgICAgY2FzZSAyOlxuICAgICAgICB0ZW1wID0gKHVpbnQ4W3VpbnQ4Lmxlbmd0aCAtIDJdIDw8IDgpICsgKHVpbnQ4W3VpbnQ4Lmxlbmd0aCAtIDFdKVxuICAgICAgICBvdXRwdXQgKz0gZW5jb2RlKHRlbXAgPj4gMTApXG4gICAgICAgIG91dHB1dCArPSBlbmNvZGUoKHRlbXAgPj4gNCkgJiAweDNGKVxuICAgICAgICBvdXRwdXQgKz0gZW5jb2RlKCh0ZW1wIDw8IDIpICYgMHgzRilcbiAgICAgICAgb3V0cHV0ICs9ICc9J1xuICAgICAgICBicmVha1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgYnJlYWtcbiAgICB9XG5cbiAgICBwYXJ0cy5wdXNoKG91dHB1dClcblxuICAgIHJldHVybiBwYXJ0cy5qb2luKCcnKVxuICB9XG5cbiAgZXhwb3J0cy50b0J5dGVBcnJheSA9IGI2NFRvQnl0ZUFycmF5XG4gIGV4cG9ydHMuZnJvbUJ5dGVBcnJheSA9IHVpbnQ4VG9CYXNlNjRcbn0odHlwZW9mIGV4cG9ydHMgPT09ICd1bmRlZmluZWQnID8gKHRoaXMuYmFzZTY0anMgPSB7fSkgOiBleHBvcnRzKSlcbiIsIi8qIVxuICogVGhlIGJ1ZmZlciBtb2R1bGUgZnJvbSBub2RlLmpzLCBmb3IgdGhlIGJyb3dzZXIuXG4gKlxuICogQGF1dGhvciAgIEZlcm9zcyBBYm91a2hhZGlqZWggPGZlcm9zc0BmZXJvc3Mub3JnPiA8aHR0cDovL2Zlcm9zcy5vcmc+XG4gKiBAbGljZW5zZSAgTUlUXG4gKi9cbi8qIGVzbGludC1kaXNhYmxlIG5vLXByb3RvICovXG5cbid1c2Ugc3RyaWN0J1xuXG52YXIgYmFzZTY0ID0gcmVxdWlyZSgnYmFzZTY0LWpzJylcbnZhciBpZWVlNzU0ID0gcmVxdWlyZSgnaWVlZTc1NCcpXG52YXIgaXNBcnJheSA9IHJlcXVpcmUoJ2lzYXJyYXknKVxuXG5leHBvcnRzLkJ1ZmZlciA9IEJ1ZmZlclxuZXhwb3J0cy5TbG93QnVmZmVyID0gU2xvd0J1ZmZlclxuZXhwb3J0cy5JTlNQRUNUX01BWF9CWVRFUyA9IDUwXG5CdWZmZXIucG9vbFNpemUgPSA4MTkyIC8vIG5vdCB1c2VkIGJ5IHRoaXMgaW1wbGVtZW50YXRpb25cblxudmFyIHJvb3RQYXJlbnQgPSB7fVxuXG4vKipcbiAqIElmIGBCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVGA6XG4gKiAgID09PSB0cnVlICAgIFVzZSBVaW50OEFycmF5IGltcGxlbWVudGF0aW9uIChmYXN0ZXN0KVxuICogICA9PT0gZmFsc2UgICBVc2UgT2JqZWN0IGltcGxlbWVudGF0aW9uIChtb3N0IGNvbXBhdGlibGUsIGV2ZW4gSUU2KVxuICpcbiAqIEJyb3dzZXJzIHRoYXQgc3VwcG9ydCB0eXBlZCBhcnJheXMgYXJlIElFIDEwKywgRmlyZWZveCA0KywgQ2hyb21lIDcrLCBTYWZhcmkgNS4xKyxcbiAqIE9wZXJhIDExLjYrLCBpT1MgNC4yKy5cbiAqXG4gKiBEdWUgdG8gdmFyaW91cyBicm93c2VyIGJ1Z3MsIHNvbWV0aW1lcyB0aGUgT2JqZWN0IGltcGxlbWVudGF0aW9uIHdpbGwgYmUgdXNlZCBldmVuXG4gKiB3aGVuIHRoZSBicm93c2VyIHN1cHBvcnRzIHR5cGVkIGFycmF5cy5cbiAqXG4gKiBOb3RlOlxuICpcbiAqICAgLSBGaXJlZm94IDQtMjkgbGFja3Mgc3VwcG9ydCBmb3IgYWRkaW5nIG5ldyBwcm9wZXJ0aWVzIHRvIGBVaW50OEFycmF5YCBpbnN0YW5jZXMsXG4gKiAgICAgU2VlOiBodHRwczovL2J1Z3ppbGxhLm1vemlsbGEub3JnL3Nob3dfYnVnLmNnaT9pZD02OTU0MzguXG4gKlxuICogICAtIENocm9tZSA5LTEwIGlzIG1pc3NpbmcgdGhlIGBUeXBlZEFycmF5LnByb3RvdHlwZS5zdWJhcnJheWAgZnVuY3Rpb24uXG4gKlxuICogICAtIElFMTAgaGFzIGEgYnJva2VuIGBUeXBlZEFycmF5LnByb3RvdHlwZS5zdWJhcnJheWAgZnVuY3Rpb24gd2hpY2ggcmV0dXJucyBhcnJheXMgb2ZcbiAqICAgICBpbmNvcnJlY3QgbGVuZ3RoIGluIHNvbWUgc2l0dWF0aW9ucy5cblxuICogV2UgZGV0ZWN0IHRoZXNlIGJ1Z2d5IGJyb3dzZXJzIGFuZCBzZXQgYEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUYCB0byBgZmFsc2VgIHNvIHRoZXlcbiAqIGdldCB0aGUgT2JqZWN0IGltcGxlbWVudGF0aW9uLCB3aGljaCBpcyBzbG93ZXIgYnV0IGJlaGF2ZXMgY29ycmVjdGx5LlxuICovXG5CdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCA9IGdsb2JhbC5UWVBFRF9BUlJBWV9TVVBQT1JUICE9PSB1bmRlZmluZWRcbiAgPyBnbG9iYWwuVFlQRURfQVJSQVlfU1VQUE9SVFxuICA6IHR5cGVkQXJyYXlTdXBwb3J0KClcblxuZnVuY3Rpb24gdHlwZWRBcnJheVN1cHBvcnQgKCkge1xuICB0cnkge1xuICAgIHZhciBhcnIgPSBuZXcgVWludDhBcnJheSgxKVxuICAgIGFyci5mb28gPSBmdW5jdGlvbiAoKSB7IHJldHVybiA0MiB9XG4gICAgcmV0dXJuIGFyci5mb28oKSA9PT0gNDIgJiYgLy8gdHlwZWQgYXJyYXkgaW5zdGFuY2VzIGNhbiBiZSBhdWdtZW50ZWRcbiAgICAgICAgdHlwZW9mIGFyci5zdWJhcnJheSA9PT0gJ2Z1bmN0aW9uJyAmJiAvLyBjaHJvbWUgOS0xMCBsYWNrIGBzdWJhcnJheWBcbiAgICAgICAgYXJyLnN1YmFycmF5KDEsIDEpLmJ5dGVMZW5ndGggPT09IDAgLy8gaWUxMCBoYXMgYnJva2VuIGBzdWJhcnJheWBcbiAgfSBjYXRjaCAoZSkge1xuICAgIHJldHVybiBmYWxzZVxuICB9XG59XG5cbmZ1bmN0aW9uIGtNYXhMZW5ndGggKCkge1xuICByZXR1cm4gQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlRcbiAgICA/IDB4N2ZmZmZmZmZcbiAgICA6IDB4M2ZmZmZmZmZcbn1cblxuLyoqXG4gKiBUaGUgQnVmZmVyIGNvbnN0cnVjdG9yIHJldHVybnMgaW5zdGFuY2VzIG9mIGBVaW50OEFycmF5YCB0aGF0IGhhdmUgdGhlaXJcbiAqIHByb3RvdHlwZSBjaGFuZ2VkIHRvIGBCdWZmZXIucHJvdG90eXBlYC4gRnVydGhlcm1vcmUsIGBCdWZmZXJgIGlzIGEgc3ViY2xhc3Mgb2ZcbiAqIGBVaW50OEFycmF5YCwgc28gdGhlIHJldHVybmVkIGluc3RhbmNlcyB3aWxsIGhhdmUgYWxsIHRoZSBub2RlIGBCdWZmZXJgIG1ldGhvZHNcbiAqIGFuZCB0aGUgYFVpbnQ4QXJyYXlgIG1ldGhvZHMuIFNxdWFyZSBicmFja2V0IG5vdGF0aW9uIHdvcmtzIGFzIGV4cGVjdGVkIC0tIGl0XG4gKiByZXR1cm5zIGEgc2luZ2xlIG9jdGV0LlxuICpcbiAqIFRoZSBgVWludDhBcnJheWAgcHJvdG90eXBlIHJlbWFpbnMgdW5tb2RpZmllZC5cbiAqL1xuZnVuY3Rpb24gQnVmZmVyIChhcmcpIHtcbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIEJ1ZmZlcikpIHtcbiAgICAvLyBBdm9pZCBnb2luZyB0aHJvdWdoIGFuIEFyZ3VtZW50c0FkYXB0b3JUcmFtcG9saW5lIGluIHRoZSBjb21tb24gY2FzZS5cbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDEpIHJldHVybiBuZXcgQnVmZmVyKGFyZywgYXJndW1lbnRzWzFdKVxuICAgIHJldHVybiBuZXcgQnVmZmVyKGFyZylcbiAgfVxuXG4gIGlmICghQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzLmxlbmd0aCA9IDBcbiAgICB0aGlzLnBhcmVudCA9IHVuZGVmaW5lZFxuICB9XG5cbiAgLy8gQ29tbW9uIGNhc2UuXG4gIGlmICh0eXBlb2YgYXJnID09PSAnbnVtYmVyJykge1xuICAgIHJldHVybiBmcm9tTnVtYmVyKHRoaXMsIGFyZylcbiAgfVxuXG4gIC8vIFNsaWdodGx5IGxlc3MgY29tbW9uIGNhc2UuXG4gIGlmICh0eXBlb2YgYXJnID09PSAnc3RyaW5nJykge1xuICAgIHJldHVybiBmcm9tU3RyaW5nKHRoaXMsIGFyZywgYXJndW1lbnRzLmxlbmd0aCA+IDEgPyBhcmd1bWVudHNbMV0gOiAndXRmOCcpXG4gIH1cblxuICAvLyBVbnVzdWFsLlxuICByZXR1cm4gZnJvbU9iamVjdCh0aGlzLCBhcmcpXG59XG5cbi8vIFRPRE86IExlZ2FjeSwgbm90IG5lZWRlZCBhbnltb3JlLiBSZW1vdmUgaW4gbmV4dCBtYWpvciB2ZXJzaW9uLlxuQnVmZmVyLl9hdWdtZW50ID0gZnVuY3Rpb24gKGFycikge1xuICBhcnIuX19wcm90b19fID0gQnVmZmVyLnByb3RvdHlwZVxuICByZXR1cm4gYXJyXG59XG5cbmZ1bmN0aW9uIGZyb21OdW1iZXIgKHRoYXQsIGxlbmd0aCkge1xuICB0aGF0ID0gYWxsb2NhdGUodGhhdCwgbGVuZ3RoIDwgMCA/IDAgOiBjaGVja2VkKGxlbmd0aCkgfCAwKVxuICBpZiAoIUJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgdGhhdFtpXSA9IDBcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHRoYXRcbn1cblxuZnVuY3Rpb24gZnJvbVN0cmluZyAodGhhdCwgc3RyaW5nLCBlbmNvZGluZykge1xuICBpZiAodHlwZW9mIGVuY29kaW5nICE9PSAnc3RyaW5nJyB8fCBlbmNvZGluZyA9PT0gJycpIGVuY29kaW5nID0gJ3V0ZjgnXG5cbiAgLy8gQXNzdW1wdGlvbjogYnl0ZUxlbmd0aCgpIHJldHVybiB2YWx1ZSBpcyBhbHdheXMgPCBrTWF4TGVuZ3RoLlxuICB2YXIgbGVuZ3RoID0gYnl0ZUxlbmd0aChzdHJpbmcsIGVuY29kaW5nKSB8IDBcbiAgdGhhdCA9IGFsbG9jYXRlKHRoYXQsIGxlbmd0aClcblxuICB0aGF0LndyaXRlKHN0cmluZywgZW5jb2RpbmcpXG4gIHJldHVybiB0aGF0XG59XG5cbmZ1bmN0aW9uIGZyb21PYmplY3QgKHRoYXQsIG9iamVjdCkge1xuICBpZiAoQnVmZmVyLmlzQnVmZmVyKG9iamVjdCkpIHJldHVybiBmcm9tQnVmZmVyKHRoYXQsIG9iamVjdClcblxuICBpZiAoaXNBcnJheShvYmplY3QpKSByZXR1cm4gZnJvbUFycmF5KHRoYXQsIG9iamVjdClcblxuICBpZiAob2JqZWN0ID09IG51bGwpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdtdXN0IHN0YXJ0IHdpdGggbnVtYmVyLCBidWZmZXIsIGFycmF5IG9yIHN0cmluZycpXG4gIH1cblxuICBpZiAodHlwZW9mIEFycmF5QnVmZmVyICE9PSAndW5kZWZpbmVkJykge1xuICAgIGlmIChvYmplY3QuYnVmZmVyIGluc3RhbmNlb2YgQXJyYXlCdWZmZXIpIHtcbiAgICAgIHJldHVybiBmcm9tVHlwZWRBcnJheSh0aGF0LCBvYmplY3QpXG4gICAgfVxuICAgIGlmIChvYmplY3QgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcikge1xuICAgICAgcmV0dXJuIGZyb21BcnJheUJ1ZmZlcih0aGF0LCBvYmplY3QpXG4gICAgfVxuICB9XG5cbiAgaWYgKG9iamVjdC5sZW5ndGgpIHJldHVybiBmcm9tQXJyYXlMaWtlKHRoYXQsIG9iamVjdClcblxuICByZXR1cm4gZnJvbUpzb25PYmplY3QodGhhdCwgb2JqZWN0KVxufVxuXG5mdW5jdGlvbiBmcm9tQnVmZmVyICh0aGF0LCBidWZmZXIpIHtcbiAgdmFyIGxlbmd0aCA9IGNoZWNrZWQoYnVmZmVyLmxlbmd0aCkgfCAwXG4gIHRoYXQgPSBhbGxvY2F0ZSh0aGF0LCBsZW5ndGgpXG4gIGJ1ZmZlci5jb3B5KHRoYXQsIDAsIDAsIGxlbmd0aClcbiAgcmV0dXJuIHRoYXRcbn1cblxuZnVuY3Rpb24gZnJvbUFycmF5ICh0aGF0LCBhcnJheSkge1xuICB2YXIgbGVuZ3RoID0gY2hlY2tlZChhcnJheS5sZW5ndGgpIHwgMFxuICB0aGF0ID0gYWxsb2NhdGUodGhhdCwgbGVuZ3RoKVxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSArPSAxKSB7XG4gICAgdGhhdFtpXSA9IGFycmF5W2ldICYgMjU1XG4gIH1cbiAgcmV0dXJuIHRoYXRcbn1cblxuLy8gRHVwbGljYXRlIG9mIGZyb21BcnJheSgpIHRvIGtlZXAgZnJvbUFycmF5KCkgbW9ub21vcnBoaWMuXG5mdW5jdGlvbiBmcm9tVHlwZWRBcnJheSAodGhhdCwgYXJyYXkpIHtcbiAgdmFyIGxlbmd0aCA9IGNoZWNrZWQoYXJyYXkubGVuZ3RoKSB8IDBcbiAgdGhhdCA9IGFsbG9jYXRlKHRoYXQsIGxlbmd0aClcbiAgLy8gVHJ1bmNhdGluZyB0aGUgZWxlbWVudHMgaXMgcHJvYmFibHkgbm90IHdoYXQgcGVvcGxlIGV4cGVjdCBmcm9tIHR5cGVkXG4gIC8vIGFycmF5cyB3aXRoIEJZVEVTX1BFUl9FTEVNRU5UID4gMSBidXQgaXQncyBjb21wYXRpYmxlIHdpdGggdGhlIGJlaGF2aW9yXG4gIC8vIG9mIHRoZSBvbGQgQnVmZmVyIGNvbnN0cnVjdG9yLlxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSArPSAxKSB7XG4gICAgdGhhdFtpXSA9IGFycmF5W2ldICYgMjU1XG4gIH1cbiAgcmV0dXJuIHRoYXRcbn1cblxuZnVuY3Rpb24gZnJvbUFycmF5QnVmZmVyICh0aGF0LCBhcnJheSkge1xuICBhcnJheS5ieXRlTGVuZ3RoIC8vIHRoaXMgdGhyb3dzIGlmIGBhcnJheWAgaXMgbm90IGEgdmFsaWQgQXJyYXlCdWZmZXJcblxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICAvLyBSZXR1cm4gYW4gYXVnbWVudGVkIGBVaW50OEFycmF5YCBpbnN0YW5jZSwgZm9yIGJlc3QgcGVyZm9ybWFuY2VcbiAgICB0aGF0ID0gbmV3IFVpbnQ4QXJyYXkoYXJyYXkpXG4gICAgdGhhdC5fX3Byb3RvX18gPSBCdWZmZXIucHJvdG90eXBlXG4gIH0gZWxzZSB7XG4gICAgLy8gRmFsbGJhY2s6IFJldHVybiBhbiBvYmplY3QgaW5zdGFuY2Ugb2YgdGhlIEJ1ZmZlciBjbGFzc1xuICAgIHRoYXQgPSBmcm9tVHlwZWRBcnJheSh0aGF0LCBuZXcgVWludDhBcnJheShhcnJheSkpXG4gIH1cbiAgcmV0dXJuIHRoYXRcbn1cblxuZnVuY3Rpb24gZnJvbUFycmF5TGlrZSAodGhhdCwgYXJyYXkpIHtcbiAgdmFyIGxlbmd0aCA9IGNoZWNrZWQoYXJyYXkubGVuZ3RoKSB8IDBcbiAgdGhhdCA9IGFsbG9jYXRlKHRoYXQsIGxlbmd0aClcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkgKz0gMSkge1xuICAgIHRoYXRbaV0gPSBhcnJheVtpXSAmIDI1NVxuICB9XG4gIHJldHVybiB0aGF0XG59XG5cbi8vIERlc2VyaWFsaXplIHsgdHlwZTogJ0J1ZmZlcicsIGRhdGE6IFsxLDIsMywuLi5dIH0gaW50byBhIEJ1ZmZlciBvYmplY3QuXG4vLyBSZXR1cm5zIGEgemVyby1sZW5ndGggYnVmZmVyIGZvciBpbnB1dHMgdGhhdCBkb24ndCBjb25mb3JtIHRvIHRoZSBzcGVjLlxuZnVuY3Rpb24gZnJvbUpzb25PYmplY3QgKHRoYXQsIG9iamVjdCkge1xuICB2YXIgYXJyYXlcbiAgdmFyIGxlbmd0aCA9IDBcblxuICBpZiAob2JqZWN0LnR5cGUgPT09ICdCdWZmZXInICYmIGlzQXJyYXkob2JqZWN0LmRhdGEpKSB7XG4gICAgYXJyYXkgPSBvYmplY3QuZGF0YVxuICAgIGxlbmd0aCA9IGNoZWNrZWQoYXJyYXkubGVuZ3RoKSB8IDBcbiAgfVxuICB0aGF0ID0gYWxsb2NhdGUodGhhdCwgbGVuZ3RoKVxuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpICs9IDEpIHtcbiAgICB0aGF0W2ldID0gYXJyYXlbaV0gJiAyNTVcbiAgfVxuICByZXR1cm4gdGhhdFxufVxuXG5pZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgQnVmZmVyLnByb3RvdHlwZS5fX3Byb3RvX18gPSBVaW50OEFycmF5LnByb3RvdHlwZVxuICBCdWZmZXIuX19wcm90b19fID0gVWludDhBcnJheVxuICBpZiAodHlwZW9mIFN5bWJvbCAhPT0gJ3VuZGVmaW5lZCcgJiYgU3ltYm9sLnNwZWNpZXMgJiZcbiAgICAgIEJ1ZmZlcltTeW1ib2wuc3BlY2llc10gPT09IEJ1ZmZlcikge1xuICAgIC8vIEZpeCBzdWJhcnJheSgpIGluIEVTMjAxNi4gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vZmVyb3NzL2J1ZmZlci9wdWxsLzk3XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KEJ1ZmZlciwgU3ltYm9sLnNwZWNpZXMsIHtcbiAgICAgIHZhbHVlOiBudWxsLFxuICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgfSlcbiAgfVxufSBlbHNlIHtcbiAgLy8gcHJlLXNldCBmb3IgdmFsdWVzIHRoYXQgbWF5IGV4aXN0IGluIHRoZSBmdXR1cmVcbiAgQnVmZmVyLnByb3RvdHlwZS5sZW5ndGggPSB1bmRlZmluZWRcbiAgQnVmZmVyLnByb3RvdHlwZS5wYXJlbnQgPSB1bmRlZmluZWRcbn1cblxuZnVuY3Rpb24gYWxsb2NhdGUgKHRoYXQsIGxlbmd0aCkge1xuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICAvLyBSZXR1cm4gYW4gYXVnbWVudGVkIGBVaW50OEFycmF5YCBpbnN0YW5jZSwgZm9yIGJlc3QgcGVyZm9ybWFuY2VcbiAgICB0aGF0ID0gbmV3IFVpbnQ4QXJyYXkobGVuZ3RoKVxuICAgIHRoYXQuX19wcm90b19fID0gQnVmZmVyLnByb3RvdHlwZVxuICB9IGVsc2Uge1xuICAgIC8vIEZhbGxiYWNrOiBSZXR1cm4gYW4gb2JqZWN0IGluc3RhbmNlIG9mIHRoZSBCdWZmZXIgY2xhc3NcbiAgICB0aGF0Lmxlbmd0aCA9IGxlbmd0aFxuICB9XG5cbiAgdmFyIGZyb21Qb29sID0gbGVuZ3RoICE9PSAwICYmIGxlbmd0aCA8PSBCdWZmZXIucG9vbFNpemUgPj4+IDFcbiAgaWYgKGZyb21Qb29sKSB0aGF0LnBhcmVudCA9IHJvb3RQYXJlbnRcblxuICByZXR1cm4gdGhhdFxufVxuXG5mdW5jdGlvbiBjaGVja2VkIChsZW5ndGgpIHtcbiAgLy8gTm90ZTogY2Fubm90IHVzZSBgbGVuZ3RoIDwga01heExlbmd0aGAgaGVyZSBiZWNhdXNlIHRoYXQgZmFpbHMgd2hlblxuICAvLyBsZW5ndGggaXMgTmFOICh3aGljaCBpcyBvdGhlcndpc2UgY29lcmNlZCB0byB6ZXJvLilcbiAgaWYgKGxlbmd0aCA+PSBrTWF4TGVuZ3RoKCkpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignQXR0ZW1wdCB0byBhbGxvY2F0ZSBCdWZmZXIgbGFyZ2VyIHRoYW4gbWF4aW11bSAnICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAnc2l6ZTogMHgnICsga01heExlbmd0aCgpLnRvU3RyaW5nKDE2KSArICcgYnl0ZXMnKVxuICB9XG4gIHJldHVybiBsZW5ndGggfCAwXG59XG5cbmZ1bmN0aW9uIFNsb3dCdWZmZXIgKHN1YmplY3QsIGVuY29kaW5nKSB7XG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBTbG93QnVmZmVyKSkgcmV0dXJuIG5ldyBTbG93QnVmZmVyKHN1YmplY3QsIGVuY29kaW5nKVxuXG4gIHZhciBidWYgPSBuZXcgQnVmZmVyKHN1YmplY3QsIGVuY29kaW5nKVxuICBkZWxldGUgYnVmLnBhcmVudFxuICByZXR1cm4gYnVmXG59XG5cbkJ1ZmZlci5pc0J1ZmZlciA9IGZ1bmN0aW9uIGlzQnVmZmVyIChiKSB7XG4gIHJldHVybiAhIShiICE9IG51bGwgJiYgYi5faXNCdWZmZXIpXG59XG5cbkJ1ZmZlci5jb21wYXJlID0gZnVuY3Rpb24gY29tcGFyZSAoYSwgYikge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihhKSB8fCAhQnVmZmVyLmlzQnVmZmVyKGIpKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignQXJndW1lbnRzIG11c3QgYmUgQnVmZmVycycpXG4gIH1cblxuICBpZiAoYSA9PT0gYikgcmV0dXJuIDBcblxuICB2YXIgeCA9IGEubGVuZ3RoXG4gIHZhciB5ID0gYi5sZW5ndGhcblxuICB2YXIgaSA9IDBcbiAgdmFyIGxlbiA9IE1hdGgubWluKHgsIHkpXG4gIHdoaWxlIChpIDwgbGVuKSB7XG4gICAgaWYgKGFbaV0gIT09IGJbaV0pIGJyZWFrXG5cbiAgICArK2lcbiAgfVxuXG4gIGlmIChpICE9PSBsZW4pIHtcbiAgICB4ID0gYVtpXVxuICAgIHkgPSBiW2ldXG4gIH1cblxuICBpZiAoeCA8IHkpIHJldHVybiAtMVxuICBpZiAoeSA8IHgpIHJldHVybiAxXG4gIHJldHVybiAwXG59XG5cbkJ1ZmZlci5pc0VuY29kaW5nID0gZnVuY3Rpb24gaXNFbmNvZGluZyAoZW5jb2RpbmcpIHtcbiAgc3dpdGNoIChTdHJpbmcoZW5jb2RpbmcpLnRvTG93ZXJDYXNlKCkpIHtcbiAgICBjYXNlICdoZXgnOlxuICAgIGNhc2UgJ3V0ZjgnOlxuICAgIGNhc2UgJ3V0Zi04JzpcbiAgICBjYXNlICdhc2NpaSc6XG4gICAgY2FzZSAnYmluYXJ5JzpcbiAgICBjYXNlICdiYXNlNjQnOlxuICAgIGNhc2UgJ3Jhdyc6XG4gICAgY2FzZSAndWNzMic6XG4gICAgY2FzZSAndWNzLTInOlxuICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgIHJldHVybiB0cnVlXG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBmYWxzZVxuICB9XG59XG5cbkJ1ZmZlci5jb25jYXQgPSBmdW5jdGlvbiBjb25jYXQgKGxpc3QsIGxlbmd0aCkge1xuICBpZiAoIWlzQXJyYXkobGlzdCkpIHRocm93IG5ldyBUeXBlRXJyb3IoJ2xpc3QgYXJndW1lbnQgbXVzdCBiZSBhbiBBcnJheSBvZiBCdWZmZXJzLicpXG5cbiAgaWYgKGxpc3QubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIG5ldyBCdWZmZXIoMClcbiAgfVxuXG4gIHZhciBpXG4gIGlmIChsZW5ndGggPT09IHVuZGVmaW5lZCkge1xuICAgIGxlbmd0aCA9IDBcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgbGVuZ3RoICs9IGxpc3RbaV0ubGVuZ3RoXG4gICAgfVxuICB9XG5cbiAgdmFyIGJ1ZiA9IG5ldyBCdWZmZXIobGVuZ3RoKVxuICB2YXIgcG9zID0gMFxuICBmb3IgKGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xuICAgIHZhciBpdGVtID0gbGlzdFtpXVxuICAgIGl0ZW0uY29weShidWYsIHBvcylcbiAgICBwb3MgKz0gaXRlbS5sZW5ndGhcbiAgfVxuICByZXR1cm4gYnVmXG59XG5cbmZ1bmN0aW9uIGJ5dGVMZW5ndGggKHN0cmluZywgZW5jb2RpbmcpIHtcbiAgaWYgKHR5cGVvZiBzdHJpbmcgIT09ICdzdHJpbmcnKSBzdHJpbmcgPSAnJyArIHN0cmluZ1xuXG4gIHZhciBsZW4gPSBzdHJpbmcubGVuZ3RoXG4gIGlmIChsZW4gPT09IDApIHJldHVybiAwXG5cbiAgLy8gVXNlIGEgZm9yIGxvb3AgdG8gYXZvaWQgcmVjdXJzaW9uXG4gIHZhciBsb3dlcmVkQ2FzZSA9IGZhbHNlXG4gIGZvciAoOzspIHtcbiAgICBzd2l0Y2ggKGVuY29kaW5nKSB7XG4gICAgICBjYXNlICdhc2NpaSc6XG4gICAgICBjYXNlICdiaW5hcnknOlxuICAgICAgLy8gRGVwcmVjYXRlZFxuICAgICAgY2FzZSAncmF3JzpcbiAgICAgIGNhc2UgJ3Jhd3MnOlxuICAgICAgICByZXR1cm4gbGVuXG4gICAgICBjYXNlICd1dGY4JzpcbiAgICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgICAgcmV0dXJuIHV0ZjhUb0J5dGVzKHN0cmluZykubGVuZ3RoXG4gICAgICBjYXNlICd1Y3MyJzpcbiAgICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgICByZXR1cm4gbGVuICogMlxuICAgICAgY2FzZSAnaGV4JzpcbiAgICAgICAgcmV0dXJuIGxlbiA+Pj4gMVxuICAgICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgICAgcmV0dXJuIGJhc2U2NFRvQnl0ZXMoc3RyaW5nKS5sZW5ndGhcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGlmIChsb3dlcmVkQ2FzZSkgcmV0dXJuIHV0ZjhUb0J5dGVzKHN0cmluZykubGVuZ3RoIC8vIGFzc3VtZSB1dGY4XG4gICAgICAgIGVuY29kaW5nID0gKCcnICsgZW5jb2RpbmcpLnRvTG93ZXJDYXNlKClcbiAgICAgICAgbG93ZXJlZENhc2UgPSB0cnVlXG4gICAgfVxuICB9XG59XG5CdWZmZXIuYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGhcblxuZnVuY3Rpb24gc2xvd1RvU3RyaW5nIChlbmNvZGluZywgc3RhcnQsIGVuZCkge1xuICB2YXIgbG93ZXJlZENhc2UgPSBmYWxzZVxuXG4gIHN0YXJ0ID0gc3RhcnQgfCAwXG4gIGVuZCA9IGVuZCA9PT0gdW5kZWZpbmVkIHx8IGVuZCA9PT0gSW5maW5pdHkgPyB0aGlzLmxlbmd0aCA6IGVuZCB8IDBcblxuICBpZiAoIWVuY29kaW5nKSBlbmNvZGluZyA9ICd1dGY4J1xuICBpZiAoc3RhcnQgPCAwKSBzdGFydCA9IDBcbiAgaWYgKGVuZCA+IHRoaXMubGVuZ3RoKSBlbmQgPSB0aGlzLmxlbmd0aFxuICBpZiAoZW5kIDw9IHN0YXJ0KSByZXR1cm4gJydcblxuICB3aGlsZSAodHJ1ZSkge1xuICAgIHN3aXRjaCAoZW5jb2RpbmcpIHtcbiAgICAgIGNhc2UgJ2hleCc6XG4gICAgICAgIHJldHVybiBoZXhTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICd1dGY4JzpcbiAgICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgICAgcmV0dXJuIHV0ZjhTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICdhc2NpaSc6XG4gICAgICAgIHJldHVybiBhc2NpaVNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICAgIHJldHVybiBiaW5hcnlTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICdiYXNlNjQnOlxuICAgICAgICByZXR1cm4gYmFzZTY0U2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAndWNzMic6XG4gICAgICBjYXNlICd1Y3MtMic6XG4gICAgICBjYXNlICd1dGYxNmxlJzpcbiAgICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgICAgcmV0dXJuIHV0ZjE2bGVTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBpZiAobG93ZXJlZENhc2UpIHRocm93IG5ldyBUeXBlRXJyb3IoJ1Vua25vd24gZW5jb2Rpbmc6ICcgKyBlbmNvZGluZylcbiAgICAgICAgZW5jb2RpbmcgPSAoZW5jb2RpbmcgKyAnJykudG9Mb3dlckNhc2UoKVxuICAgICAgICBsb3dlcmVkQ2FzZSA9IHRydWVcbiAgICB9XG4gIH1cbn1cblxuLy8gVGhlIHByb3BlcnR5IGlzIHVzZWQgYnkgYEJ1ZmZlci5pc0J1ZmZlcmAgYW5kIGBpcy1idWZmZXJgIChpbiBTYWZhcmkgNS03KSB0byBkZXRlY3Rcbi8vIEJ1ZmZlciBpbnN0YW5jZXMuXG5CdWZmZXIucHJvdG90eXBlLl9pc0J1ZmZlciA9IHRydWVcblxuQnVmZmVyLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uIHRvU3RyaW5nICgpIHtcbiAgdmFyIGxlbmd0aCA9IHRoaXMubGVuZ3RoIHwgMFxuICBpZiAobGVuZ3RoID09PSAwKSByZXR1cm4gJydcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHJldHVybiB1dGY4U2xpY2UodGhpcywgMCwgbGVuZ3RoKVxuICByZXR1cm4gc2xvd1RvU3RyaW5nLmFwcGx5KHRoaXMsIGFyZ3VtZW50cylcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5lcXVhbHMgPSBmdW5jdGlvbiBlcXVhbHMgKGIpIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYikpIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FyZ3VtZW50IG11c3QgYmUgYSBCdWZmZXInKVxuICBpZiAodGhpcyA9PT0gYikgcmV0dXJuIHRydWVcbiAgcmV0dXJuIEJ1ZmZlci5jb21wYXJlKHRoaXMsIGIpID09PSAwXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuaW5zcGVjdCA9IGZ1bmN0aW9uIGluc3BlY3QgKCkge1xuICB2YXIgc3RyID0gJydcbiAgdmFyIG1heCA9IGV4cG9ydHMuSU5TUEVDVF9NQVhfQllURVNcbiAgaWYgKHRoaXMubGVuZ3RoID4gMCkge1xuICAgIHN0ciA9IHRoaXMudG9TdHJpbmcoJ2hleCcsIDAsIG1heCkubWF0Y2goLy57Mn0vZykuam9pbignICcpXG4gICAgaWYgKHRoaXMubGVuZ3RoID4gbWF4KSBzdHIgKz0gJyAuLi4gJ1xuICB9XG4gIHJldHVybiAnPEJ1ZmZlciAnICsgc3RyICsgJz4nXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuY29tcGFyZSA9IGZ1bmN0aW9uIGNvbXBhcmUgKGIpIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYikpIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FyZ3VtZW50IG11c3QgYmUgYSBCdWZmZXInKVxuICBpZiAodGhpcyA9PT0gYikgcmV0dXJuIDBcbiAgcmV0dXJuIEJ1ZmZlci5jb21wYXJlKHRoaXMsIGIpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuaW5kZXhPZiA9IGZ1bmN0aW9uIGluZGV4T2YgKHZhbCwgYnl0ZU9mZnNldCkge1xuICBpZiAoYnl0ZU9mZnNldCA+IDB4N2ZmZmZmZmYpIGJ5dGVPZmZzZXQgPSAweDdmZmZmZmZmXG4gIGVsc2UgaWYgKGJ5dGVPZmZzZXQgPCAtMHg4MDAwMDAwMCkgYnl0ZU9mZnNldCA9IC0weDgwMDAwMDAwXG4gIGJ5dGVPZmZzZXQgPj49IDBcblxuICBpZiAodGhpcy5sZW5ndGggPT09IDApIHJldHVybiAtMVxuICBpZiAoYnl0ZU9mZnNldCA+PSB0aGlzLmxlbmd0aCkgcmV0dXJuIC0xXG5cbiAgLy8gTmVnYXRpdmUgb2Zmc2V0cyBzdGFydCBmcm9tIHRoZSBlbmQgb2YgdGhlIGJ1ZmZlclxuICBpZiAoYnl0ZU9mZnNldCA8IDApIGJ5dGVPZmZzZXQgPSBNYXRoLm1heCh0aGlzLmxlbmd0aCArIGJ5dGVPZmZzZXQsIDApXG5cbiAgaWYgKHR5cGVvZiB2YWwgPT09ICdzdHJpbmcnKSB7XG4gICAgaWYgKHZhbC5sZW5ndGggPT09IDApIHJldHVybiAtMSAvLyBzcGVjaWFsIGNhc2U6IGxvb2tpbmcgZm9yIGVtcHR5IHN0cmluZyBhbHdheXMgZmFpbHNcbiAgICByZXR1cm4gU3RyaW5nLnByb3RvdHlwZS5pbmRleE9mLmNhbGwodGhpcywgdmFsLCBieXRlT2Zmc2V0KVxuICB9XG4gIGlmIChCdWZmZXIuaXNCdWZmZXIodmFsKSkge1xuICAgIHJldHVybiBhcnJheUluZGV4T2YodGhpcywgdmFsLCBieXRlT2Zmc2V0KVxuICB9XG4gIGlmICh0eXBlb2YgdmFsID09PSAnbnVtYmVyJykge1xuICAgIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCAmJiBVaW50OEFycmF5LnByb3RvdHlwZS5pbmRleE9mID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICByZXR1cm4gVWludDhBcnJheS5wcm90b3R5cGUuaW5kZXhPZi5jYWxsKHRoaXMsIHZhbCwgYnl0ZU9mZnNldClcbiAgICB9XG4gICAgcmV0dXJuIGFycmF5SW5kZXhPZih0aGlzLCBbIHZhbCBdLCBieXRlT2Zmc2V0KVxuICB9XG5cbiAgZnVuY3Rpb24gYXJyYXlJbmRleE9mIChhcnIsIHZhbCwgYnl0ZU9mZnNldCkge1xuICAgIHZhciBmb3VuZEluZGV4ID0gLTFcbiAgICBmb3IgKHZhciBpID0gMDsgYnl0ZU9mZnNldCArIGkgPCBhcnIubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChhcnJbYnl0ZU9mZnNldCArIGldID09PSB2YWxbZm91bmRJbmRleCA9PT0gLTEgPyAwIDogaSAtIGZvdW5kSW5kZXhdKSB7XG4gICAgICAgIGlmIChmb3VuZEluZGV4ID09PSAtMSkgZm91bmRJbmRleCA9IGlcbiAgICAgICAgaWYgKGkgLSBmb3VuZEluZGV4ICsgMSA9PT0gdmFsLmxlbmd0aCkgcmV0dXJuIGJ5dGVPZmZzZXQgKyBmb3VuZEluZGV4XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmb3VuZEluZGV4ID0gLTFcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIC0xXG4gIH1cblxuICB0aHJvdyBuZXcgVHlwZUVycm9yKCd2YWwgbXVzdCBiZSBzdHJpbmcsIG51bWJlciBvciBCdWZmZXInKVxufVxuXG5mdW5jdGlvbiBoZXhXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIG9mZnNldCA9IE51bWJlcihvZmZzZXQpIHx8IDBcbiAgdmFyIHJlbWFpbmluZyA9IGJ1Zi5sZW5ndGggLSBvZmZzZXRcbiAgaWYgKCFsZW5ndGgpIHtcbiAgICBsZW5ndGggPSByZW1haW5pbmdcbiAgfSBlbHNlIHtcbiAgICBsZW5ndGggPSBOdW1iZXIobGVuZ3RoKVxuICAgIGlmIChsZW5ndGggPiByZW1haW5pbmcpIHtcbiAgICAgIGxlbmd0aCA9IHJlbWFpbmluZ1xuICAgIH1cbiAgfVxuXG4gIC8vIG11c3QgYmUgYW4gZXZlbiBudW1iZXIgb2YgZGlnaXRzXG4gIHZhciBzdHJMZW4gPSBzdHJpbmcubGVuZ3RoXG4gIGlmIChzdHJMZW4gJSAyICE9PSAwKSB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgaGV4IHN0cmluZycpXG5cbiAgaWYgKGxlbmd0aCA+IHN0ckxlbiAvIDIpIHtcbiAgICBsZW5ndGggPSBzdHJMZW4gLyAyXG4gIH1cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgIHZhciBwYXJzZWQgPSBwYXJzZUludChzdHJpbmcuc3Vic3RyKGkgKiAyLCAyKSwgMTYpXG4gICAgaWYgKGlzTmFOKHBhcnNlZCkpIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBoZXggc3RyaW5nJylcbiAgICBidWZbb2Zmc2V0ICsgaV0gPSBwYXJzZWRcbiAgfVxuICByZXR1cm4gaVxufVxuXG5mdW5jdGlvbiB1dGY4V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYmxpdEJ1ZmZlcih1dGY4VG9CeXRlcyhzdHJpbmcsIGJ1Zi5sZW5ndGggLSBvZmZzZXQpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiBhc2NpaVdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGJsaXRCdWZmZXIoYXNjaWlUb0J5dGVzKHN0cmluZyksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbmZ1bmN0aW9uIGJpbmFyeVdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGFzY2lpV3JpdGUoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiBiYXNlNjRXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBibGl0QnVmZmVyKGJhc2U2NFRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuZnVuY3Rpb24gdWNzMldyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGJsaXRCdWZmZXIodXRmMTZsZVRvQnl0ZXMoc3RyaW5nLCBidWYubGVuZ3RoIC0gb2Zmc2V0KSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZSA9IGZ1bmN0aW9uIHdyaXRlIChzdHJpbmcsIG9mZnNldCwgbGVuZ3RoLCBlbmNvZGluZykge1xuICAvLyBCdWZmZXIjd3JpdGUoc3RyaW5nKVxuICBpZiAob2Zmc2V0ID09PSB1bmRlZmluZWQpIHtcbiAgICBlbmNvZGluZyA9ICd1dGY4J1xuICAgIGxlbmd0aCA9IHRoaXMubGVuZ3RoXG4gICAgb2Zmc2V0ID0gMFxuICAvLyBCdWZmZXIjd3JpdGUoc3RyaW5nLCBlbmNvZGluZylcbiAgfSBlbHNlIGlmIChsZW5ndGggPT09IHVuZGVmaW5lZCAmJiB0eXBlb2Ygb2Zmc2V0ID09PSAnc3RyaW5nJykge1xuICAgIGVuY29kaW5nID0gb2Zmc2V0XG4gICAgbGVuZ3RoID0gdGhpcy5sZW5ndGhcbiAgICBvZmZzZXQgPSAwXG4gIC8vIEJ1ZmZlciN3cml0ZShzdHJpbmcsIG9mZnNldFssIGxlbmd0aF1bLCBlbmNvZGluZ10pXG4gIH0gZWxzZSBpZiAoaXNGaW5pdGUob2Zmc2V0KSkge1xuICAgIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgICBpZiAoaXNGaW5pdGUobGVuZ3RoKSkge1xuICAgICAgbGVuZ3RoID0gbGVuZ3RoIHwgMFxuICAgICAgaWYgKGVuY29kaW5nID09PSB1bmRlZmluZWQpIGVuY29kaW5nID0gJ3V0ZjgnXG4gICAgfSBlbHNlIHtcbiAgICAgIGVuY29kaW5nID0gbGVuZ3RoXG4gICAgICBsZW5ndGggPSB1bmRlZmluZWRcbiAgICB9XG4gIC8vIGxlZ2FjeSB3cml0ZShzdHJpbmcsIGVuY29kaW5nLCBvZmZzZXQsIGxlbmd0aCkgLSByZW1vdmUgaW4gdjAuMTNcbiAgfSBlbHNlIHtcbiAgICB2YXIgc3dhcCA9IGVuY29kaW5nXG4gICAgZW5jb2RpbmcgPSBvZmZzZXRcbiAgICBvZmZzZXQgPSBsZW5ndGggfCAwXG4gICAgbGVuZ3RoID0gc3dhcFxuICB9XG5cbiAgdmFyIHJlbWFpbmluZyA9IHRoaXMubGVuZ3RoIC0gb2Zmc2V0XG4gIGlmIChsZW5ndGggPT09IHVuZGVmaW5lZCB8fCBsZW5ndGggPiByZW1haW5pbmcpIGxlbmd0aCA9IHJlbWFpbmluZ1xuXG4gIGlmICgoc3RyaW5nLmxlbmd0aCA+IDAgJiYgKGxlbmd0aCA8IDAgfHwgb2Zmc2V0IDwgMCkpIHx8IG9mZnNldCA+IHRoaXMubGVuZ3RoKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ2F0dGVtcHQgdG8gd3JpdGUgb3V0c2lkZSBidWZmZXIgYm91bmRzJylcbiAgfVxuXG4gIGlmICghZW5jb2RpbmcpIGVuY29kaW5nID0gJ3V0ZjgnXG5cbiAgdmFyIGxvd2VyZWRDYXNlID0gZmFsc2VcbiAgZm9yICg7Oykge1xuICAgIHN3aXRjaCAoZW5jb2RpbmcpIHtcbiAgICAgIGNhc2UgJ2hleCc6XG4gICAgICAgIHJldHVybiBoZXhXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICd1dGY4JzpcbiAgICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgICAgcmV0dXJuIHV0ZjhXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICdhc2NpaSc6XG4gICAgICAgIHJldHVybiBhc2NpaVdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICAgIHJldHVybiBiaW5hcnlXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICdiYXNlNjQnOlxuICAgICAgICAvLyBXYXJuaW5nOiBtYXhMZW5ndGggbm90IHRha2VuIGludG8gYWNjb3VudCBpbiBiYXNlNjRXcml0ZVxuICAgICAgICByZXR1cm4gYmFzZTY0V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgY2FzZSAndWNzMic6XG4gICAgICBjYXNlICd1Y3MtMic6XG4gICAgICBjYXNlICd1dGYxNmxlJzpcbiAgICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgICAgcmV0dXJuIHVjczJXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBpZiAobG93ZXJlZENhc2UpIHRocm93IG5ldyBUeXBlRXJyb3IoJ1Vua25vd24gZW5jb2Rpbmc6ICcgKyBlbmNvZGluZylcbiAgICAgICAgZW5jb2RpbmcgPSAoJycgKyBlbmNvZGluZykudG9Mb3dlckNhc2UoKVxuICAgICAgICBsb3dlcmVkQ2FzZSA9IHRydWVcbiAgICB9XG4gIH1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS50b0pTT04gPSBmdW5jdGlvbiB0b0pTT04gKCkge1xuICByZXR1cm4ge1xuICAgIHR5cGU6ICdCdWZmZXInLFxuICAgIGRhdGE6IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKHRoaXMuX2FyciB8fCB0aGlzLCAwKVxuICB9XG59XG5cbmZ1bmN0aW9uIGJhc2U2NFNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgaWYgKHN0YXJ0ID09PSAwICYmIGVuZCA9PT0gYnVmLmxlbmd0aCkge1xuICAgIHJldHVybiBiYXNlNjQuZnJvbUJ5dGVBcnJheShidWYpXG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGJhc2U2NC5mcm9tQnl0ZUFycmF5KGJ1Zi5zbGljZShzdGFydCwgZW5kKSlcbiAgfVxufVxuXG5mdW5jdGlvbiB1dGY4U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICBlbmQgPSBNYXRoLm1pbihidWYubGVuZ3RoLCBlbmQpXG4gIHZhciByZXMgPSBbXVxuXG4gIHZhciBpID0gc3RhcnRcbiAgd2hpbGUgKGkgPCBlbmQpIHtcbiAgICB2YXIgZmlyc3RCeXRlID0gYnVmW2ldXG4gICAgdmFyIGNvZGVQb2ludCA9IG51bGxcbiAgICB2YXIgYnl0ZXNQZXJTZXF1ZW5jZSA9IChmaXJzdEJ5dGUgPiAweEVGKSA/IDRcbiAgICAgIDogKGZpcnN0Qnl0ZSA+IDB4REYpID8gM1xuICAgICAgOiAoZmlyc3RCeXRlID4gMHhCRikgPyAyXG4gICAgICA6IDFcblxuICAgIGlmIChpICsgYnl0ZXNQZXJTZXF1ZW5jZSA8PSBlbmQpIHtcbiAgICAgIHZhciBzZWNvbmRCeXRlLCB0aGlyZEJ5dGUsIGZvdXJ0aEJ5dGUsIHRlbXBDb2RlUG9pbnRcblxuICAgICAgc3dpdGNoIChieXRlc1BlclNlcXVlbmNlKSB7XG4gICAgICAgIGNhc2UgMTpcbiAgICAgICAgICBpZiAoZmlyc3RCeXRlIDwgMHg4MCkge1xuICAgICAgICAgICAgY29kZVBvaW50ID0gZmlyc3RCeXRlXG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgMjpcbiAgICAgICAgICBzZWNvbmRCeXRlID0gYnVmW2kgKyAxXVxuICAgICAgICAgIGlmICgoc2Vjb25kQnl0ZSAmIDB4QzApID09PSAweDgwKSB7XG4gICAgICAgICAgICB0ZW1wQ29kZVBvaW50ID0gKGZpcnN0Qnl0ZSAmIDB4MUYpIDw8IDB4NiB8IChzZWNvbmRCeXRlICYgMHgzRilcbiAgICAgICAgICAgIGlmICh0ZW1wQ29kZVBvaW50ID4gMHg3Rikge1xuICAgICAgICAgICAgICBjb2RlUG9pbnQgPSB0ZW1wQ29kZVBvaW50XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgMzpcbiAgICAgICAgICBzZWNvbmRCeXRlID0gYnVmW2kgKyAxXVxuICAgICAgICAgIHRoaXJkQnl0ZSA9IGJ1ZltpICsgMl1cbiAgICAgICAgICBpZiAoKHNlY29uZEJ5dGUgJiAweEMwKSA9PT0gMHg4MCAmJiAodGhpcmRCeXRlICYgMHhDMCkgPT09IDB4ODApIHtcbiAgICAgICAgICAgIHRlbXBDb2RlUG9pbnQgPSAoZmlyc3RCeXRlICYgMHhGKSA8PCAweEMgfCAoc2Vjb25kQnl0ZSAmIDB4M0YpIDw8IDB4NiB8ICh0aGlyZEJ5dGUgJiAweDNGKVxuICAgICAgICAgICAgaWYgKHRlbXBDb2RlUG9pbnQgPiAweDdGRiAmJiAodGVtcENvZGVQb2ludCA8IDB4RDgwMCB8fCB0ZW1wQ29kZVBvaW50ID4gMHhERkZGKSkge1xuICAgICAgICAgICAgICBjb2RlUG9pbnQgPSB0ZW1wQ29kZVBvaW50XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgNDpcbiAgICAgICAgICBzZWNvbmRCeXRlID0gYnVmW2kgKyAxXVxuICAgICAgICAgIHRoaXJkQnl0ZSA9IGJ1ZltpICsgMl1cbiAgICAgICAgICBmb3VydGhCeXRlID0gYnVmW2kgKyAzXVxuICAgICAgICAgIGlmICgoc2Vjb25kQnl0ZSAmIDB4QzApID09PSAweDgwICYmICh0aGlyZEJ5dGUgJiAweEMwKSA9PT0gMHg4MCAmJiAoZm91cnRoQnl0ZSAmIDB4QzApID09PSAweDgwKSB7XG4gICAgICAgICAgICB0ZW1wQ29kZVBvaW50ID0gKGZpcnN0Qnl0ZSAmIDB4RikgPDwgMHgxMiB8IChzZWNvbmRCeXRlICYgMHgzRikgPDwgMHhDIHwgKHRoaXJkQnl0ZSAmIDB4M0YpIDw8IDB4NiB8IChmb3VydGhCeXRlICYgMHgzRilcbiAgICAgICAgICAgIGlmICh0ZW1wQ29kZVBvaW50ID4gMHhGRkZGICYmIHRlbXBDb2RlUG9pbnQgPCAweDExMDAwMCkge1xuICAgICAgICAgICAgICBjb2RlUG9pbnQgPSB0ZW1wQ29kZVBvaW50XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChjb2RlUG9pbnQgPT09IG51bGwpIHtcbiAgICAgIC8vIHdlIGRpZCBub3QgZ2VuZXJhdGUgYSB2YWxpZCBjb2RlUG9pbnQgc28gaW5zZXJ0IGFcbiAgICAgIC8vIHJlcGxhY2VtZW50IGNoYXIgKFUrRkZGRCkgYW5kIGFkdmFuY2Ugb25seSAxIGJ5dGVcbiAgICAgIGNvZGVQb2ludCA9IDB4RkZGRFxuICAgICAgYnl0ZXNQZXJTZXF1ZW5jZSA9IDFcbiAgICB9IGVsc2UgaWYgKGNvZGVQb2ludCA+IDB4RkZGRikge1xuICAgICAgLy8gZW5jb2RlIHRvIHV0ZjE2IChzdXJyb2dhdGUgcGFpciBkYW5jZSlcbiAgICAgIGNvZGVQb2ludCAtPSAweDEwMDAwXG4gICAgICByZXMucHVzaChjb2RlUG9pbnQgPj4+IDEwICYgMHgzRkYgfCAweEQ4MDApXG4gICAgICBjb2RlUG9pbnQgPSAweERDMDAgfCBjb2RlUG9pbnQgJiAweDNGRlxuICAgIH1cblxuICAgIHJlcy5wdXNoKGNvZGVQb2ludClcbiAgICBpICs9IGJ5dGVzUGVyU2VxdWVuY2VcbiAgfVxuXG4gIHJldHVybiBkZWNvZGVDb2RlUG9pbnRzQXJyYXkocmVzKVxufVxuXG4vLyBCYXNlZCBvbiBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vYS8yMjc0NzI3Mi82ODA3NDIsIHRoZSBicm93c2VyIHdpdGhcbi8vIHRoZSBsb3dlc3QgbGltaXQgaXMgQ2hyb21lLCB3aXRoIDB4MTAwMDAgYXJncy5cbi8vIFdlIGdvIDEgbWFnbml0dWRlIGxlc3MsIGZvciBzYWZldHlcbnZhciBNQVhfQVJHVU1FTlRTX0xFTkdUSCA9IDB4MTAwMFxuXG5mdW5jdGlvbiBkZWNvZGVDb2RlUG9pbnRzQXJyYXkgKGNvZGVQb2ludHMpIHtcbiAgdmFyIGxlbiA9IGNvZGVQb2ludHMubGVuZ3RoXG4gIGlmIChsZW4gPD0gTUFYX0FSR1VNRU5UU19MRU5HVEgpIHtcbiAgICByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShTdHJpbmcsIGNvZGVQb2ludHMpIC8vIGF2b2lkIGV4dHJhIHNsaWNlKClcbiAgfVxuXG4gIC8vIERlY29kZSBpbiBjaHVua3MgdG8gYXZvaWQgXCJjYWxsIHN0YWNrIHNpemUgZXhjZWVkZWRcIi5cbiAgdmFyIHJlcyA9ICcnXG4gIHZhciBpID0gMFxuICB3aGlsZSAoaSA8IGxlbikge1xuICAgIHJlcyArPSBTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KFxuICAgICAgU3RyaW5nLFxuICAgICAgY29kZVBvaW50cy5zbGljZShpLCBpICs9IE1BWF9BUkdVTUVOVFNfTEVOR1RIKVxuICAgIClcbiAgfVxuICByZXR1cm4gcmVzXG59XG5cbmZ1bmN0aW9uIGFzY2lpU2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgcmV0ID0gJydcbiAgZW5kID0gTWF0aC5taW4oYnVmLmxlbmd0aCwgZW5kKVxuXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgcmV0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYnVmW2ldICYgMHg3RilcbiAgfVxuICByZXR1cm4gcmV0XG59XG5cbmZ1bmN0aW9uIGJpbmFyeVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHJldCA9ICcnXG4gIGVuZCA9IE1hdGgubWluKGJ1Zi5sZW5ndGgsIGVuZClcblxuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgIHJldCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ1ZltpXSlcbiAgfVxuICByZXR1cm4gcmV0XG59XG5cbmZ1bmN0aW9uIGhleFNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcblxuICBpZiAoIXN0YXJ0IHx8IHN0YXJ0IDwgMCkgc3RhcnQgPSAwXG4gIGlmICghZW5kIHx8IGVuZCA8IDAgfHwgZW5kID4gbGVuKSBlbmQgPSBsZW5cblxuICB2YXIgb3V0ID0gJydcbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICBvdXQgKz0gdG9IZXgoYnVmW2ldKVxuICB9XG4gIHJldHVybiBvdXRcbn1cblxuZnVuY3Rpb24gdXRmMTZsZVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGJ5dGVzID0gYnVmLnNsaWNlKHN0YXJ0LCBlbmQpXG4gIHZhciByZXMgPSAnJ1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGJ5dGVzLmxlbmd0aDsgaSArPSAyKSB7XG4gICAgcmVzICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYnl0ZXNbaV0gKyBieXRlc1tpICsgMV0gKiAyNTYpXG4gIH1cbiAgcmV0dXJuIHJlc1xufVxuXG5CdWZmZXIucHJvdG90eXBlLnNsaWNlID0gZnVuY3Rpb24gc2xpY2UgKHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGxlbiA9IHRoaXMubGVuZ3RoXG4gIHN0YXJ0ID0gfn5zdGFydFxuICBlbmQgPSBlbmQgPT09IHVuZGVmaW5lZCA/IGxlbiA6IH5+ZW5kXG5cbiAgaWYgKHN0YXJ0IDwgMCkge1xuICAgIHN0YXJ0ICs9IGxlblxuICAgIGlmIChzdGFydCA8IDApIHN0YXJ0ID0gMFxuICB9IGVsc2UgaWYgKHN0YXJ0ID4gbGVuKSB7XG4gICAgc3RhcnQgPSBsZW5cbiAgfVxuXG4gIGlmIChlbmQgPCAwKSB7XG4gICAgZW5kICs9IGxlblxuICAgIGlmIChlbmQgPCAwKSBlbmQgPSAwXG4gIH0gZWxzZSBpZiAoZW5kID4gbGVuKSB7XG4gICAgZW5kID0gbGVuXG4gIH1cblxuICBpZiAoZW5kIDwgc3RhcnQpIGVuZCA9IHN0YXJ0XG5cbiAgdmFyIG5ld0J1ZlxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICBuZXdCdWYgPSB0aGlzLnN1YmFycmF5KHN0YXJ0LCBlbmQpXG4gICAgbmV3QnVmLl9fcHJvdG9fXyA9IEJ1ZmZlci5wcm90b3R5cGVcbiAgfSBlbHNlIHtcbiAgICB2YXIgc2xpY2VMZW4gPSBlbmQgLSBzdGFydFxuICAgIG5ld0J1ZiA9IG5ldyBCdWZmZXIoc2xpY2VMZW4sIHVuZGVmaW5lZClcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNsaWNlTGVuOyBpKyspIHtcbiAgICAgIG5ld0J1ZltpXSA9IHRoaXNbaSArIHN0YXJ0XVxuICAgIH1cbiAgfVxuXG4gIGlmIChuZXdCdWYubGVuZ3RoKSBuZXdCdWYucGFyZW50ID0gdGhpcy5wYXJlbnQgfHwgdGhpc1xuXG4gIHJldHVybiBuZXdCdWZcbn1cblxuLypcbiAqIE5lZWQgdG8gbWFrZSBzdXJlIHRoYXQgYnVmZmVyIGlzbid0IHRyeWluZyB0byB3cml0ZSBvdXQgb2YgYm91bmRzLlxuICovXG5mdW5jdGlvbiBjaGVja09mZnNldCAob2Zmc2V0LCBleHQsIGxlbmd0aCkge1xuICBpZiAoKG9mZnNldCAlIDEpICE9PSAwIHx8IG9mZnNldCA8IDApIHRocm93IG5ldyBSYW5nZUVycm9yKCdvZmZzZXQgaXMgbm90IHVpbnQnKVxuICBpZiAob2Zmc2V0ICsgZXh0ID4gbGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignVHJ5aW5nIHRvIGFjY2VzcyBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnRMRSA9IGZ1bmN0aW9uIHJlYWRVSW50TEUgKG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCBieXRlTGVuZ3RoLCB0aGlzLmxlbmd0aClcblxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXRdXG4gIHZhciBtdWwgPSAxXG4gIHZhciBpID0gMFxuICB3aGlsZSAoKytpIDwgYnl0ZUxlbmd0aCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHZhbCArPSB0aGlzW29mZnNldCArIGldICogbXVsXG4gIH1cblxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnRCRSA9IGZ1bmN0aW9uIHJlYWRVSW50QkUgKG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aCB8IDBcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGNoZWNrT2Zmc2V0KG9mZnNldCwgYnl0ZUxlbmd0aCwgdGhpcy5sZW5ndGgpXG4gIH1cblxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXQgKyAtLWJ5dGVMZW5ndGhdXG4gIHZhciBtdWwgPSAxXG4gIHdoaWxlIChieXRlTGVuZ3RoID4gMCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHZhbCArPSB0aGlzW29mZnNldCArIC0tYnl0ZUxlbmd0aF0gKiBtdWxcbiAgfVxuXG4gIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDggPSBmdW5jdGlvbiByZWFkVUludDggKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAxLCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIHRoaXNbb2Zmc2V0XVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MTZMRSA9IGZ1bmN0aW9uIHJlYWRVSW50MTZMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDIsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gdGhpc1tvZmZzZXRdIHwgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDE2QkUgPSBmdW5jdGlvbiByZWFkVUludDE2QkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAyLCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuICh0aGlzW29mZnNldF0gPDwgOCkgfCB0aGlzW29mZnNldCArIDFdXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQzMkxFID0gZnVuY3Rpb24gcmVhZFVJbnQzMkxFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG5cbiAgcmV0dXJuICgodGhpc1tvZmZzZXRdKSB8XG4gICAgICAodGhpc1tvZmZzZXQgKyAxXSA8PCA4KSB8XG4gICAgICAodGhpc1tvZmZzZXQgKyAyXSA8PCAxNikpICtcbiAgICAgICh0aGlzW29mZnNldCArIDNdICogMHgxMDAwMDAwKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MzJCRSA9IGZ1bmN0aW9uIHJlYWRVSW50MzJCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAodGhpc1tvZmZzZXRdICogMHgxMDAwMDAwKSArXG4gICAgKCh0aGlzW29mZnNldCArIDFdIDw8IDE2KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMl0gPDwgOCkgfFxuICAgIHRoaXNbb2Zmc2V0ICsgM10pXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludExFID0gZnVuY3Rpb24gcmVhZEludExFIChvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgYnl0ZUxlbmd0aCwgdGhpcy5sZW5ndGgpXG5cbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0XVxuICB2YXIgbXVsID0gMVxuICB2YXIgaSA9IDBcbiAgd2hpbGUgKCsraSA8IGJ5dGVMZW5ndGggJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB2YWwgKz0gdGhpc1tvZmZzZXQgKyBpXSAqIG11bFxuICB9XG4gIG11bCAqPSAweDgwXG5cbiAgaWYgKHZhbCA+PSBtdWwpIHZhbCAtPSBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aClcblxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludEJFID0gZnVuY3Rpb24gcmVhZEludEJFIChvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgYnl0ZUxlbmd0aCwgdGhpcy5sZW5ndGgpXG5cbiAgdmFyIGkgPSBieXRlTGVuZ3RoXG4gIHZhciBtdWwgPSAxXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldCArIC0taV1cbiAgd2hpbGUgKGkgPiAwICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdmFsICs9IHRoaXNbb2Zmc2V0ICsgLS1pXSAqIG11bFxuICB9XG4gIG11bCAqPSAweDgwXG5cbiAgaWYgKHZhbCA+PSBtdWwpIHZhbCAtPSBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aClcblxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDggPSBmdW5jdGlvbiByZWFkSW50OCAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDEsIHRoaXMubGVuZ3RoKVxuICBpZiAoISh0aGlzW29mZnNldF0gJiAweDgwKSkgcmV0dXJuICh0aGlzW29mZnNldF0pXG4gIHJldHVybiAoKDB4ZmYgLSB0aGlzW29mZnNldF0gKyAxKSAqIC0xKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQxNkxFID0gZnVuY3Rpb24gcmVhZEludDE2TEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAyLCB0aGlzLmxlbmd0aClcbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0XSB8ICh0aGlzW29mZnNldCArIDFdIDw8IDgpXG4gIHJldHVybiAodmFsICYgMHg4MDAwKSA/IHZhbCB8IDB4RkZGRjAwMDAgOiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MTZCRSA9IGZ1bmN0aW9uIHJlYWRJbnQxNkJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldCArIDFdIHwgKHRoaXNbb2Zmc2V0XSA8PCA4KVxuICByZXR1cm4gKHZhbCAmIDB4ODAwMCkgPyB2YWwgfCAweEZGRkYwMDAwIDogdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDMyTEUgPSBmdW5jdGlvbiByZWFkSW50MzJMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAodGhpc1tvZmZzZXRdKSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOCkgfFxuICAgICh0aGlzW29mZnNldCArIDJdIDw8IDE2KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgM10gPDwgMjQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDMyQkUgPSBmdW5jdGlvbiByZWFkSW50MzJCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAodGhpc1tvZmZzZXRdIDw8IDI0KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgMTYpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAyXSA8PCA4KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgM10pXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEZsb2F0TEUgPSBmdW5jdGlvbiByZWFkRmxvYXRMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgdHJ1ZSwgMjMsIDQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEZsb2F0QkUgPSBmdW5jdGlvbiByZWFkRmxvYXRCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgZmFsc2UsIDIzLCA0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWREb3VibGVMRSA9IGZ1bmN0aW9uIHJlYWREb3VibGVMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDgsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgdHJ1ZSwgNTIsIDgpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZERvdWJsZUJFID0gZnVuY3Rpb24gcmVhZERvdWJsZUJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgOCwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiBpZWVlNzU0LnJlYWQodGhpcywgb2Zmc2V0LCBmYWxzZSwgNTIsIDgpXG59XG5cbmZ1bmN0aW9uIGNoZWNrSW50IChidWYsIHZhbHVlLCBvZmZzZXQsIGV4dCwgbWF4LCBtaW4pIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYnVmKSkgdGhyb3cgbmV3IFR5cGVFcnJvcignYnVmZmVyIG11c3QgYmUgYSBCdWZmZXIgaW5zdGFuY2UnKVxuICBpZiAodmFsdWUgPiBtYXggfHwgdmFsdWUgPCBtaW4pIHRocm93IG5ldyBSYW5nZUVycm9yKCd2YWx1ZSBpcyBvdXQgb2YgYm91bmRzJylcbiAgaWYgKG9mZnNldCArIGV4dCA+IGJ1Zi5sZW5ndGgpIHRocm93IG5ldyBSYW5nZUVycm9yKCdpbmRleCBvdXQgb2YgcmFuZ2UnKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludExFID0gZnVuY3Rpb24gd3JpdGVVSW50TEUgKHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoKSwgMClcblxuICB2YXIgbXVsID0gMVxuICB2YXIgaSA9IDBcbiAgdGhpc1tvZmZzZXRdID0gdmFsdWUgJiAweEZGXG4gIHdoaWxlICgrK2kgPCBieXRlTGVuZ3RoICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdGhpc1tvZmZzZXQgKyBpXSA9ICh2YWx1ZSAvIG11bCkgJiAweEZGXG4gIH1cblxuICByZXR1cm4gb2Zmc2V0ICsgYnl0ZUxlbmd0aFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludEJFID0gZnVuY3Rpb24gd3JpdGVVSW50QkUgKHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoKSwgMClcblxuICB2YXIgaSA9IGJ5dGVMZW5ndGggLSAxXG4gIHZhciBtdWwgPSAxXG4gIHRoaXNbb2Zmc2V0ICsgaV0gPSB2YWx1ZSAmIDB4RkZcbiAgd2hpbGUgKC0taSA+PSAwICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdGhpc1tvZmZzZXQgKyBpXSA9ICh2YWx1ZSAvIG11bCkgJiAweEZGXG4gIH1cblxuICByZXR1cm4gb2Zmc2V0ICsgYnl0ZUxlbmd0aFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDggPSBmdW5jdGlvbiB3cml0ZVVJbnQ4ICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDEsIDB4ZmYsIDApXG4gIGlmICghQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHZhbHVlID0gTWF0aC5mbG9vcih2YWx1ZSlcbiAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgcmV0dXJuIG9mZnNldCArIDFcbn1cblxuZnVuY3Rpb24gb2JqZWN0V3JpdGVVSW50MTYgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuKSB7XG4gIGlmICh2YWx1ZSA8IDApIHZhbHVlID0gMHhmZmZmICsgdmFsdWUgKyAxXG4gIGZvciAodmFyIGkgPSAwLCBqID0gTWF0aC5taW4oYnVmLmxlbmd0aCAtIG9mZnNldCwgMik7IGkgPCBqOyBpKyspIHtcbiAgICBidWZbb2Zmc2V0ICsgaV0gPSAodmFsdWUgJiAoMHhmZiA8PCAoOCAqIChsaXR0bGVFbmRpYW4gPyBpIDogMSAtIGkpKSkpID4+PlxuICAgICAgKGxpdHRsZUVuZGlhbiA/IGkgOiAxIC0gaSkgKiA4XG4gIH1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQxNkxFID0gZnVuY3Rpb24gd3JpdGVVSW50MTZMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAyLCAweGZmZmYsIDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MTZCRSA9IGZ1bmN0aW9uIHdyaXRlVUludDE2QkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHhmZmZmLCAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuZnVuY3Rpb24gb2JqZWN0V3JpdGVVSW50MzIgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuKSB7XG4gIGlmICh2YWx1ZSA8IDApIHZhbHVlID0gMHhmZmZmZmZmZiArIHZhbHVlICsgMVxuICBmb3IgKHZhciBpID0gMCwgaiA9IE1hdGgubWluKGJ1Zi5sZW5ndGggLSBvZmZzZXQsIDQpOyBpIDwgajsgaSsrKSB7XG4gICAgYnVmW29mZnNldCArIGldID0gKHZhbHVlID4+PiAobGl0dGxlRW5kaWFuID8gaSA6IDMgLSBpKSAqIDgpICYgMHhmZlxuICB9XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MzJMRSA9IGZ1bmN0aW9uIHdyaXRlVUludDMyTEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgNCwgMHhmZmZmZmZmZiwgMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXQgKyAzXSA9ICh2YWx1ZSA+Pj4gMjQpXG4gICAgdGhpc1tvZmZzZXQgKyAyXSA9ICh2YWx1ZSA+Pj4gMTYpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgJiAweGZmKVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQzMkJFID0gZnVuY3Rpb24gd3JpdGVVSW50MzJCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCA0LCAweGZmZmZmZmZmLCAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDI0KVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDE2KVxuICAgIHRoaXNbb2Zmc2V0ICsgMl0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAzXSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludExFID0gZnVuY3Rpb24gd3JpdGVJbnRMRSAodmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgdmFyIGxpbWl0ID0gTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGggLSAxKVxuXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbGltaXQgLSAxLCAtbGltaXQpXG4gIH1cblxuICB2YXIgaSA9IDBcbiAgdmFyIG11bCA9IDFcbiAgdmFyIHN1YiA9IHZhbHVlIDwgMCA/IDEgOiAwXG4gIHRoaXNbb2Zmc2V0XSA9IHZhbHVlICYgMHhGRlxuICB3aGlsZSAoKytpIDwgYnl0ZUxlbmd0aCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHRoaXNbb2Zmc2V0ICsgaV0gPSAoKHZhbHVlIC8gbXVsKSA+PiAwKSAtIHN1YiAmIDB4RkZcbiAgfVxuXG4gIHJldHVybiBvZmZzZXQgKyBieXRlTGVuZ3RoXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnRCRSA9IGZ1bmN0aW9uIHdyaXRlSW50QkUgKHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIHZhciBsaW1pdCA9IE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoIC0gMSlcblxuICAgIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIGxpbWl0IC0gMSwgLWxpbWl0KVxuICB9XG5cbiAgdmFyIGkgPSBieXRlTGVuZ3RoIC0gMVxuICB2YXIgbXVsID0gMVxuICB2YXIgc3ViID0gdmFsdWUgPCAwID8gMSA6IDBcbiAgdGhpc1tvZmZzZXQgKyBpXSA9IHZhbHVlICYgMHhGRlxuICB3aGlsZSAoLS1pID49IDAgJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB0aGlzW29mZnNldCArIGldID0gKCh2YWx1ZSAvIG11bCkgPj4gMCkgLSBzdWIgJiAweEZGXG4gIH1cblxuICByZXR1cm4gb2Zmc2V0ICsgYnl0ZUxlbmd0aFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50OCA9IGZ1bmN0aW9uIHdyaXRlSW50OCAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAxLCAweDdmLCAtMHg4MClcbiAgaWYgKCFCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkgdmFsdWUgPSBNYXRoLmZsb29yKHZhbHVlKVxuICBpZiAodmFsdWUgPCAwKSB2YWx1ZSA9IDB4ZmYgKyB2YWx1ZSArIDFcbiAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgcmV0dXJuIG9mZnNldCArIDFcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDE2TEUgPSBmdW5jdGlvbiB3cml0ZUludDE2TEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHg3ZmZmLCAtMHg4MDAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgJiAweGZmKVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDgpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgMlxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MTZCRSA9IGZ1bmN0aW9uIHdyaXRlSW50MTZCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAyLCAweDdmZmYsIC0weDgwMDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlICYgMHhmZilcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgMlxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MzJMRSA9IGZ1bmN0aW9uIHdyaXRlSW50MzJMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCA0LCAweDdmZmZmZmZmLCAtMHg4MDAwMDAwMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0ICsgMl0gPSAodmFsdWUgPj4+IDE2KVxuICAgIHRoaXNbb2Zmc2V0ICsgM10gPSAodmFsdWUgPj4+IDI0KVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDMyQkUgPSBmdW5jdGlvbiB3cml0ZUludDMyQkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgNCwgMHg3ZmZmZmZmZiwgLTB4ODAwMDAwMDApXG4gIGlmICh2YWx1ZSA8IDApIHZhbHVlID0gMHhmZmZmZmZmZiArIHZhbHVlICsgMVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDI0KVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDE2KVxuICAgIHRoaXNbb2Zmc2V0ICsgMl0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAzXSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuZnVuY3Rpb24gY2hlY2tJRUVFNzU0IChidWYsIHZhbHVlLCBvZmZzZXQsIGV4dCwgbWF4LCBtaW4pIHtcbiAgaWYgKG9mZnNldCArIGV4dCA+IGJ1Zi5sZW5ndGgpIHRocm93IG5ldyBSYW5nZUVycm9yKCdpbmRleCBvdXQgb2YgcmFuZ2UnKVxuICBpZiAob2Zmc2V0IDwgMCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ2luZGV4IG91dCBvZiByYW5nZScpXG59XG5cbmZ1bmN0aW9uIHdyaXRlRmxvYXQgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgY2hlY2tJRUVFNzU0KGJ1ZiwgdmFsdWUsIG9mZnNldCwgNCwgMy40MDI4MjM0NjYzODUyODg2ZSszOCwgLTMuNDAyODIzNDY2Mzg1Mjg4NmUrMzgpXG4gIH1cbiAgaWVlZTc1NC53cml0ZShidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgMjMsIDQpXG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVGbG9hdExFID0gZnVuY3Rpb24gd3JpdGVGbG9hdExFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVGbG9hdCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUZsb2F0QkUgPSBmdW5jdGlvbiB3cml0ZUZsb2F0QkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZUZsb2F0KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gd3JpdGVEb3VibGUgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgY2hlY2tJRUVFNzU0KGJ1ZiwgdmFsdWUsIG9mZnNldCwgOCwgMS43OTc2OTMxMzQ4NjIzMTU3RSszMDgsIC0xLjc5NzY5MzEzNDg2MjMxNTdFKzMwOClcbiAgfVxuICBpZWVlNzU0LndyaXRlKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCA1MiwgOClcbiAgcmV0dXJuIG9mZnNldCArIDhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZURvdWJsZUxFID0gZnVuY3Rpb24gd3JpdGVEb3VibGVMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRG91YmxlKHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRG91YmxlQkUgPSBmdW5jdGlvbiB3cml0ZURvdWJsZUJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVEb3VibGUodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG4vLyBjb3B5KHRhcmdldEJ1ZmZlciwgdGFyZ2V0U3RhcnQ9MCwgc291cmNlU3RhcnQ9MCwgc291cmNlRW5kPWJ1ZmZlci5sZW5ndGgpXG5CdWZmZXIucHJvdG90eXBlLmNvcHkgPSBmdW5jdGlvbiBjb3B5ICh0YXJnZXQsIHRhcmdldFN0YXJ0LCBzdGFydCwgZW5kKSB7XG4gIGlmICghc3RhcnQpIHN0YXJ0ID0gMFxuICBpZiAoIWVuZCAmJiBlbmQgIT09IDApIGVuZCA9IHRoaXMubGVuZ3RoXG4gIGlmICh0YXJnZXRTdGFydCA+PSB0YXJnZXQubGVuZ3RoKSB0YXJnZXRTdGFydCA9IHRhcmdldC5sZW5ndGhcbiAgaWYgKCF0YXJnZXRTdGFydCkgdGFyZ2V0U3RhcnQgPSAwXG4gIGlmIChlbmQgPiAwICYmIGVuZCA8IHN0YXJ0KSBlbmQgPSBzdGFydFxuXG4gIC8vIENvcHkgMCBieXRlczsgd2UncmUgZG9uZVxuICBpZiAoZW5kID09PSBzdGFydCkgcmV0dXJuIDBcbiAgaWYgKHRhcmdldC5sZW5ndGggPT09IDAgfHwgdGhpcy5sZW5ndGggPT09IDApIHJldHVybiAwXG5cbiAgLy8gRmF0YWwgZXJyb3IgY29uZGl0aW9uc1xuICBpZiAodGFyZ2V0U3RhcnQgPCAwKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ3RhcmdldFN0YXJ0IG91dCBvZiBib3VuZHMnKVxuICB9XG4gIGlmIChzdGFydCA8IDAgfHwgc3RhcnQgPj0gdGhpcy5sZW5ndGgpIHRocm93IG5ldyBSYW5nZUVycm9yKCdzb3VyY2VTdGFydCBvdXQgb2YgYm91bmRzJylcbiAgaWYgKGVuZCA8IDApIHRocm93IG5ldyBSYW5nZUVycm9yKCdzb3VyY2VFbmQgb3V0IG9mIGJvdW5kcycpXG5cbiAgLy8gQXJlIHdlIG9vYj9cbiAgaWYgKGVuZCA+IHRoaXMubGVuZ3RoKSBlbmQgPSB0aGlzLmxlbmd0aFxuICBpZiAodGFyZ2V0Lmxlbmd0aCAtIHRhcmdldFN0YXJ0IDwgZW5kIC0gc3RhcnQpIHtcbiAgICBlbmQgPSB0YXJnZXQubGVuZ3RoIC0gdGFyZ2V0U3RhcnQgKyBzdGFydFxuICB9XG5cbiAgdmFyIGxlbiA9IGVuZCAtIHN0YXJ0XG4gIHZhciBpXG5cbiAgaWYgKHRoaXMgPT09IHRhcmdldCAmJiBzdGFydCA8IHRhcmdldFN0YXJ0ICYmIHRhcmdldFN0YXJ0IDwgZW5kKSB7XG4gICAgLy8gZGVzY2VuZGluZyBjb3B5IGZyb20gZW5kXG4gICAgZm9yIChpID0gbGVuIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIHRhcmdldFtpICsgdGFyZ2V0U3RhcnRdID0gdGhpc1tpICsgc3RhcnRdXG4gICAgfVxuICB9IGVsc2UgaWYgKGxlbiA8IDEwMDAgfHwgIUJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgLy8gYXNjZW5kaW5nIGNvcHkgZnJvbSBzdGFydFxuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgdGFyZ2V0W2kgKyB0YXJnZXRTdGFydF0gPSB0aGlzW2kgKyBzdGFydF1cbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgVWludDhBcnJheS5wcm90b3R5cGUuc2V0LmNhbGwoXG4gICAgICB0YXJnZXQsXG4gICAgICB0aGlzLnN1YmFycmF5KHN0YXJ0LCBzdGFydCArIGxlbiksXG4gICAgICB0YXJnZXRTdGFydFxuICAgIClcbiAgfVxuXG4gIHJldHVybiBsZW5cbn1cblxuLy8gZmlsbCh2YWx1ZSwgc3RhcnQ9MCwgZW5kPWJ1ZmZlci5sZW5ndGgpXG5CdWZmZXIucHJvdG90eXBlLmZpbGwgPSBmdW5jdGlvbiBmaWxsICh2YWx1ZSwgc3RhcnQsIGVuZCkge1xuICBpZiAoIXZhbHVlKSB2YWx1ZSA9IDBcbiAgaWYgKCFzdGFydCkgc3RhcnQgPSAwXG4gIGlmICghZW5kKSBlbmQgPSB0aGlzLmxlbmd0aFxuXG4gIGlmIChlbmQgPCBzdGFydCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ2VuZCA8IHN0YXJ0JylcblxuICAvLyBGaWxsIDAgYnl0ZXM7IHdlJ3JlIGRvbmVcbiAgaWYgKGVuZCA9PT0gc3RhcnQpIHJldHVyblxuICBpZiAodGhpcy5sZW5ndGggPT09IDApIHJldHVyblxuXG4gIGlmIChzdGFydCA8IDAgfHwgc3RhcnQgPj0gdGhpcy5sZW5ndGgpIHRocm93IG5ldyBSYW5nZUVycm9yKCdzdGFydCBvdXQgb2YgYm91bmRzJylcbiAgaWYgKGVuZCA8IDAgfHwgZW5kID4gdGhpcy5sZW5ndGgpIHRocm93IG5ldyBSYW5nZUVycm9yKCdlbmQgb3V0IG9mIGJvdW5kcycpXG5cbiAgdmFyIGlcbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicpIHtcbiAgICBmb3IgKGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgICB0aGlzW2ldID0gdmFsdWVcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgdmFyIGJ5dGVzID0gdXRmOFRvQnl0ZXModmFsdWUudG9TdHJpbmcoKSlcbiAgICB2YXIgbGVuID0gYnl0ZXMubGVuZ3RoXG4gICAgZm9yIChpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgICAgdGhpc1tpXSA9IGJ5dGVzW2kgJSBsZW5dXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXNcbn1cblxuLy8gSEVMUEVSIEZVTkNUSU9OU1xuLy8gPT09PT09PT09PT09PT09PVxuXG52YXIgSU5WQUxJRF9CQVNFNjRfUkUgPSAvW14rXFwvMC05QS1aYS16LV9dL2dcblxuZnVuY3Rpb24gYmFzZTY0Y2xlYW4gKHN0cikge1xuICAvLyBOb2RlIHN0cmlwcyBvdXQgaW52YWxpZCBjaGFyYWN0ZXJzIGxpa2UgXFxuIGFuZCBcXHQgZnJvbSB0aGUgc3RyaW5nLCBiYXNlNjQtanMgZG9lcyBub3RcbiAgc3RyID0gc3RyaW5ndHJpbShzdHIpLnJlcGxhY2UoSU5WQUxJRF9CQVNFNjRfUkUsICcnKVxuICAvLyBOb2RlIGNvbnZlcnRzIHN0cmluZ3Mgd2l0aCBsZW5ndGggPCAyIHRvICcnXG4gIGlmIChzdHIubGVuZ3RoIDwgMikgcmV0dXJuICcnXG4gIC8vIE5vZGUgYWxsb3dzIGZvciBub24tcGFkZGVkIGJhc2U2NCBzdHJpbmdzIChtaXNzaW5nIHRyYWlsaW5nID09PSksIGJhc2U2NC1qcyBkb2VzIG5vdFxuICB3aGlsZSAoc3RyLmxlbmd0aCAlIDQgIT09IDApIHtcbiAgICBzdHIgPSBzdHIgKyAnPSdcbiAgfVxuICByZXR1cm4gc3RyXG59XG5cbmZ1bmN0aW9uIHN0cmluZ3RyaW0gKHN0cikge1xuICBpZiAoc3RyLnRyaW0pIHJldHVybiBzdHIudHJpbSgpXG4gIHJldHVybiBzdHIucmVwbGFjZSgvXlxccyt8XFxzKyQvZywgJycpXG59XG5cbmZ1bmN0aW9uIHRvSGV4IChuKSB7XG4gIGlmIChuIDwgMTYpIHJldHVybiAnMCcgKyBuLnRvU3RyaW5nKDE2KVxuICByZXR1cm4gbi50b1N0cmluZygxNilcbn1cblxuZnVuY3Rpb24gdXRmOFRvQnl0ZXMgKHN0cmluZywgdW5pdHMpIHtcbiAgdW5pdHMgPSB1bml0cyB8fCBJbmZpbml0eVxuICB2YXIgY29kZVBvaW50XG4gIHZhciBsZW5ndGggPSBzdHJpbmcubGVuZ3RoXG4gIHZhciBsZWFkU3Vycm9nYXRlID0gbnVsbFxuICB2YXIgYnl0ZXMgPSBbXVxuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICBjb2RlUG9pbnQgPSBzdHJpbmcuY2hhckNvZGVBdChpKVxuXG4gICAgLy8gaXMgc3Vycm9nYXRlIGNvbXBvbmVudFxuICAgIGlmIChjb2RlUG9pbnQgPiAweEQ3RkYgJiYgY29kZVBvaW50IDwgMHhFMDAwKSB7XG4gICAgICAvLyBsYXN0IGNoYXIgd2FzIGEgbGVhZFxuICAgICAgaWYgKCFsZWFkU3Vycm9nYXRlKSB7XG4gICAgICAgIC8vIG5vIGxlYWQgeWV0XG4gICAgICAgIGlmIChjb2RlUG9pbnQgPiAweERCRkYpIHtcbiAgICAgICAgICAvLyB1bmV4cGVjdGVkIHRyYWlsXG4gICAgICAgICAgaWYgKCh1bml0cyAtPSAzKSA+IC0xKSBieXRlcy5wdXNoKDB4RUYsIDB4QkYsIDB4QkQpXG4gICAgICAgICAgY29udGludWVcbiAgICAgICAgfSBlbHNlIGlmIChpICsgMSA9PT0gbGVuZ3RoKSB7XG4gICAgICAgICAgLy8gdW5wYWlyZWQgbGVhZFxuICAgICAgICAgIGlmICgodW5pdHMgLT0gMykgPiAtMSkgYnl0ZXMucHVzaCgweEVGLCAweEJGLCAweEJEKVxuICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgIH1cblxuICAgICAgICAvLyB2YWxpZCBsZWFkXG4gICAgICAgIGxlYWRTdXJyb2dhdGUgPSBjb2RlUG9pbnRcblxuICAgICAgICBjb250aW51ZVxuICAgICAgfVxuXG4gICAgICAvLyAyIGxlYWRzIGluIGEgcm93XG4gICAgICBpZiAoY29kZVBvaW50IDwgMHhEQzAwKSB7XG4gICAgICAgIGlmICgodW5pdHMgLT0gMykgPiAtMSkgYnl0ZXMucHVzaCgweEVGLCAweEJGLCAweEJEKVxuICAgICAgICBsZWFkU3Vycm9nYXRlID0gY29kZVBvaW50XG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG5cbiAgICAgIC8vIHZhbGlkIHN1cnJvZ2F0ZSBwYWlyXG4gICAgICBjb2RlUG9pbnQgPSAobGVhZFN1cnJvZ2F0ZSAtIDB4RDgwMCA8PCAxMCB8IGNvZGVQb2ludCAtIDB4REMwMCkgKyAweDEwMDAwXG4gICAgfSBlbHNlIGlmIChsZWFkU3Vycm9nYXRlKSB7XG4gICAgICAvLyB2YWxpZCBibXAgY2hhciwgYnV0IGxhc3QgY2hhciB3YXMgYSBsZWFkXG4gICAgICBpZiAoKHVuaXRzIC09IDMpID4gLTEpIGJ5dGVzLnB1c2goMHhFRiwgMHhCRiwgMHhCRClcbiAgICB9XG5cbiAgICBsZWFkU3Vycm9nYXRlID0gbnVsbFxuXG4gICAgLy8gZW5jb2RlIHV0ZjhcbiAgICBpZiAoY29kZVBvaW50IDwgMHg4MCkge1xuICAgICAgaWYgKCh1bml0cyAtPSAxKSA8IDApIGJyZWFrXG4gICAgICBieXRlcy5wdXNoKGNvZGVQb2ludClcbiAgICB9IGVsc2UgaWYgKGNvZGVQb2ludCA8IDB4ODAwKSB7XG4gICAgICBpZiAoKHVuaXRzIC09IDIpIDwgMCkgYnJlYWtcbiAgICAgIGJ5dGVzLnB1c2goXG4gICAgICAgIGNvZGVQb2ludCA+PiAweDYgfCAweEMwLFxuICAgICAgICBjb2RlUG9pbnQgJiAweDNGIHwgMHg4MFxuICAgICAgKVxuICAgIH0gZWxzZSBpZiAoY29kZVBvaW50IDwgMHgxMDAwMCkge1xuICAgICAgaWYgKCh1bml0cyAtPSAzKSA8IDApIGJyZWFrXG4gICAgICBieXRlcy5wdXNoKFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHhDIHwgMHhFMCxcbiAgICAgICAgY29kZVBvaW50ID4+IDB4NiAmIDB4M0YgfCAweDgwLFxuICAgICAgICBjb2RlUG9pbnQgJiAweDNGIHwgMHg4MFxuICAgICAgKVxuICAgIH0gZWxzZSBpZiAoY29kZVBvaW50IDwgMHgxMTAwMDApIHtcbiAgICAgIGlmICgodW5pdHMgLT0gNCkgPCAwKSBicmVha1xuICAgICAgYnl0ZXMucHVzaChcbiAgICAgICAgY29kZVBvaW50ID4+IDB4MTIgfCAweEYwLFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHhDICYgMHgzRiB8IDB4ODAsXG4gICAgICAgIGNvZGVQb2ludCA+PiAweDYgJiAweDNGIHwgMHg4MCxcbiAgICAgICAgY29kZVBvaW50ICYgMHgzRiB8IDB4ODBcbiAgICAgIClcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGNvZGUgcG9pbnQnKVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBieXRlc1xufVxuXG5mdW5jdGlvbiBhc2NpaVRvQnl0ZXMgKHN0cikge1xuICB2YXIgYnl0ZUFycmF5ID0gW11cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyBpKyspIHtcbiAgICAvLyBOb2RlJ3MgY29kZSBzZWVtcyB0byBiZSBkb2luZyB0aGlzIGFuZCBub3QgJiAweDdGLi5cbiAgICBieXRlQXJyYXkucHVzaChzdHIuY2hhckNvZGVBdChpKSAmIDB4RkYpXG4gIH1cbiAgcmV0dXJuIGJ5dGVBcnJheVxufVxuXG5mdW5jdGlvbiB1dGYxNmxlVG9CeXRlcyAoc3RyLCB1bml0cykge1xuICB2YXIgYywgaGksIGxvXG4gIHZhciBieXRlQXJyYXkgPSBbXVxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xuICAgIGlmICgodW5pdHMgLT0gMikgPCAwKSBicmVha1xuXG4gICAgYyA9IHN0ci5jaGFyQ29kZUF0KGkpXG4gICAgaGkgPSBjID4+IDhcbiAgICBsbyA9IGMgJSAyNTZcbiAgICBieXRlQXJyYXkucHVzaChsbylcbiAgICBieXRlQXJyYXkucHVzaChoaSlcbiAgfVxuXG4gIHJldHVybiBieXRlQXJyYXlcbn1cblxuZnVuY3Rpb24gYmFzZTY0VG9CeXRlcyAoc3RyKSB7XG4gIHJldHVybiBiYXNlNjQudG9CeXRlQXJyYXkoYmFzZTY0Y2xlYW4oc3RyKSlcbn1cblxuZnVuY3Rpb24gYmxpdEJ1ZmZlciAoc3JjLCBkc3QsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICBpZiAoKGkgKyBvZmZzZXQgPj0gZHN0Lmxlbmd0aCkgfHwgKGkgPj0gc3JjLmxlbmd0aCkpIGJyZWFrXG4gICAgZHN0W2kgKyBvZmZzZXRdID0gc3JjW2ldXG4gIH1cbiAgcmV0dXJuIGlcbn1cbiIsInZhciB0b1N0cmluZyA9IHt9LnRvU3RyaW5nO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEFycmF5LmlzQXJyYXkgfHwgZnVuY3Rpb24gKGFycikge1xuICByZXR1cm4gdG9TdHJpbmcuY2FsbChhcnIpID09ICdbb2JqZWN0IEFycmF5XSc7XG59O1xuIiwiZXhwb3J0cy5yZWFkID0gZnVuY3Rpb24gKGJ1ZmZlciwgb2Zmc2V0LCBpc0xFLCBtTGVuLCBuQnl0ZXMpIHtcbiAgdmFyIGUsIG1cbiAgdmFyIGVMZW4gPSBuQnl0ZXMgKiA4IC0gbUxlbiAtIDFcbiAgdmFyIGVNYXggPSAoMSA8PCBlTGVuKSAtIDFcbiAgdmFyIGVCaWFzID0gZU1heCA+PiAxXG4gIHZhciBuQml0cyA9IC03XG4gIHZhciBpID0gaXNMRSA/IChuQnl0ZXMgLSAxKSA6IDBcbiAgdmFyIGQgPSBpc0xFID8gLTEgOiAxXG4gIHZhciBzID0gYnVmZmVyW29mZnNldCArIGldXG5cbiAgaSArPSBkXG5cbiAgZSA9IHMgJiAoKDEgPDwgKC1uQml0cykpIC0gMSlcbiAgcyA+Pj0gKC1uQml0cylcbiAgbkJpdHMgKz0gZUxlblxuICBmb3IgKDsgbkJpdHMgPiAwOyBlID0gZSAqIDI1NiArIGJ1ZmZlcltvZmZzZXQgKyBpXSwgaSArPSBkLCBuQml0cyAtPSA4KSB7fVxuXG4gIG0gPSBlICYgKCgxIDw8ICgtbkJpdHMpKSAtIDEpXG4gIGUgPj49ICgtbkJpdHMpXG4gIG5CaXRzICs9IG1MZW5cbiAgZm9yICg7IG5CaXRzID4gMDsgbSA9IG0gKiAyNTYgKyBidWZmZXJbb2Zmc2V0ICsgaV0sIGkgKz0gZCwgbkJpdHMgLT0gOCkge31cblxuICBpZiAoZSA9PT0gMCkge1xuICAgIGUgPSAxIC0gZUJpYXNcbiAgfSBlbHNlIGlmIChlID09PSBlTWF4KSB7XG4gICAgcmV0dXJuIG0gPyBOYU4gOiAoKHMgPyAtMSA6IDEpICogSW5maW5pdHkpXG4gIH0gZWxzZSB7XG4gICAgbSA9IG0gKyBNYXRoLnBvdygyLCBtTGVuKVxuICAgIGUgPSBlIC0gZUJpYXNcbiAgfVxuICByZXR1cm4gKHMgPyAtMSA6IDEpICogbSAqIE1hdGgucG93KDIsIGUgLSBtTGVuKVxufVxuXG5leHBvcnRzLndyaXRlID0gZnVuY3Rpb24gKGJ1ZmZlciwgdmFsdWUsIG9mZnNldCwgaXNMRSwgbUxlbiwgbkJ5dGVzKSB7XG4gIHZhciBlLCBtLCBjXG4gIHZhciBlTGVuID0gbkJ5dGVzICogOCAtIG1MZW4gLSAxXG4gIHZhciBlTWF4ID0gKDEgPDwgZUxlbikgLSAxXG4gIHZhciBlQmlhcyA9IGVNYXggPj4gMVxuICB2YXIgcnQgPSAobUxlbiA9PT0gMjMgPyBNYXRoLnBvdygyLCAtMjQpIC0gTWF0aC5wb3coMiwgLTc3KSA6IDApXG4gIHZhciBpID0gaXNMRSA/IDAgOiAobkJ5dGVzIC0gMSlcbiAgdmFyIGQgPSBpc0xFID8gMSA6IC0xXG4gIHZhciBzID0gdmFsdWUgPCAwIHx8ICh2YWx1ZSA9PT0gMCAmJiAxIC8gdmFsdWUgPCAwKSA/IDEgOiAwXG5cbiAgdmFsdWUgPSBNYXRoLmFicyh2YWx1ZSlcblxuICBpZiAoaXNOYU4odmFsdWUpIHx8IHZhbHVlID09PSBJbmZpbml0eSkge1xuICAgIG0gPSBpc05hTih2YWx1ZSkgPyAxIDogMFxuICAgIGUgPSBlTWF4XG4gIH0gZWxzZSB7XG4gICAgZSA9IE1hdGguZmxvb3IoTWF0aC5sb2codmFsdWUpIC8gTWF0aC5MTjIpXG4gICAgaWYgKHZhbHVlICogKGMgPSBNYXRoLnBvdygyLCAtZSkpIDwgMSkge1xuICAgICAgZS0tXG4gICAgICBjICo9IDJcbiAgICB9XG4gICAgaWYgKGUgKyBlQmlhcyA+PSAxKSB7XG4gICAgICB2YWx1ZSArPSBydCAvIGNcbiAgICB9IGVsc2Uge1xuICAgICAgdmFsdWUgKz0gcnQgKiBNYXRoLnBvdygyLCAxIC0gZUJpYXMpXG4gICAgfVxuICAgIGlmICh2YWx1ZSAqIGMgPj0gMikge1xuICAgICAgZSsrXG4gICAgICBjIC89IDJcbiAgICB9XG5cbiAgICBpZiAoZSArIGVCaWFzID49IGVNYXgpIHtcbiAgICAgIG0gPSAwXG4gICAgICBlID0gZU1heFxuICAgIH0gZWxzZSBpZiAoZSArIGVCaWFzID49IDEpIHtcbiAgICAgIG0gPSAodmFsdWUgKiBjIC0gMSkgKiBNYXRoLnBvdygyLCBtTGVuKVxuICAgICAgZSA9IGUgKyBlQmlhc1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gdmFsdWUgKiBNYXRoLnBvdygyLCBlQmlhcyAtIDEpICogTWF0aC5wb3coMiwgbUxlbilcbiAgICAgIGUgPSAwXG4gICAgfVxuICB9XG5cbiAgZm9yICg7IG1MZW4gPj0gODsgYnVmZmVyW29mZnNldCArIGldID0gbSAmIDB4ZmYsIGkgKz0gZCwgbSAvPSAyNTYsIG1MZW4gLT0gOCkge31cblxuICBlID0gKGUgPDwgbUxlbikgfCBtXG4gIGVMZW4gKz0gbUxlblxuICBmb3IgKDsgZUxlbiA+IDA7IGJ1ZmZlcltvZmZzZXQgKyBpXSA9IGUgJiAweGZmLCBpICs9IGQsIGUgLz0gMjU2LCBlTGVuIC09IDgpIHt9XG5cbiAgYnVmZmVyW29mZnNldCArIGkgLSBkXSB8PSBzICogMTI4XG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGFycmF5QnVmZmVyQ29uY2F0XG5cbmZ1bmN0aW9uIGFycmF5QnVmZmVyQ29uY2F0ICgpIHtcbiAgdmFyIGxlbmd0aCA9IDBcbiAgdmFyIGJ1ZmZlciA9IG51bGxcblxuICBmb3IgKHZhciBpIGluIGFyZ3VtZW50cykge1xuICAgIGJ1ZmZlciA9IGFyZ3VtZW50c1tpXVxuICAgIGxlbmd0aCArPSBidWZmZXIuYnl0ZUxlbmd0aFxuICB9XG5cbiAgdmFyIGpvaW5lZCA9IG5ldyBVaW50OEFycmF5KGxlbmd0aClcbiAgdmFyIG9mZnNldCA9IDBcblxuICBmb3IgKHZhciBpIGluIGFyZ3VtZW50cykge1xuICAgIGJ1ZmZlciA9IGFyZ3VtZW50c1tpXVxuICAgIGpvaW5lZC5zZXQobmV3IFVpbnQ4QXJyYXkoYnVmZmVyKSwgb2Zmc2V0KVxuICAgIG9mZnNldCArPSBidWZmZXIuYnl0ZUxlbmd0aFxuICB9XG5cbiAgcmV0dXJuIGpvaW5lZC5idWZmZXJcbn1cbiIsIi8qXG4gKiBKYXZhU2NyaXB0IENhbnZhcyB0byBCbG9iXG4gKiBodHRwczovL2dpdGh1Yi5jb20vYmx1ZWltcC9KYXZhU2NyaXB0LUNhbnZhcy10by1CbG9iXG4gKlxuICogQ29weXJpZ2h0IDIwMTIsIFNlYmFzdGlhbiBUc2NoYW5cbiAqIGh0dHBzOi8vYmx1ZWltcC5uZXRcbiAqXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIGxpY2Vuc2U6XG4gKiBodHRwOi8vd3d3Lm9wZW5zb3VyY2Uub3JnL2xpY2Vuc2VzL01JVFxuICpcbiAqIEJhc2VkIG9uIHN0YWNrb3ZlcmZsb3cgdXNlciBTdG9pdmUncyBjb2RlIHNuaXBwZXQ6XG4gKiBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vcS80OTk4OTA4XG4gKi9cblxuLypnbG9iYWwgd2luZG93LCBhdG9iLCBCbG9iLCBBcnJheUJ1ZmZlciwgVWludDhBcnJheSwgZGVmaW5lLCBtb2R1bGUgKi9cblxuOyhmdW5jdGlvbiAod2luZG93KSB7XG4gICd1c2Ugc3RyaWN0J1xuXG4gIHZhciBDYW52YXNQcm90b3R5cGUgPSB3aW5kb3cuSFRNTENhbnZhc0VsZW1lbnQgJiZcbiAgICAgICAgICAgICAgICAgICAgICAgICAgd2luZG93LkhUTUxDYW52YXNFbGVtZW50LnByb3RvdHlwZVxuICB2YXIgaGFzQmxvYkNvbnN0cnVjdG9yID0gd2luZG93LkJsb2IgJiYgKGZ1bmN0aW9uICgpIHtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIEJvb2xlYW4obmV3IEJsb2IoKSlcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICByZXR1cm4gZmFsc2VcbiAgICB9XG4gIH0oKSlcbiAgdmFyIGhhc0FycmF5QnVmZmVyVmlld1N1cHBvcnQgPSBoYXNCbG9iQ29uc3RydWN0b3IgJiYgd2luZG93LlVpbnQ4QXJyYXkgJiZcbiAgICAoZnVuY3Rpb24gKCkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgcmV0dXJuIG5ldyBCbG9iKFtuZXcgVWludDhBcnJheSgxMDApXSkuc2l6ZSA9PT0gMTAwXG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgfVxuICAgIH0oKSlcbiAgdmFyIEJsb2JCdWlsZGVyID0gd2luZG93LkJsb2JCdWlsZGVyIHx8IHdpbmRvdy5XZWJLaXRCbG9iQnVpbGRlciB8fFxuICAgICAgICAgICAgICAgICAgICAgIHdpbmRvdy5Nb3pCbG9iQnVpbGRlciB8fCB3aW5kb3cuTVNCbG9iQnVpbGRlclxuICB2YXIgZGF0YVVSSVBhdHRlcm4gPSAvXmRhdGE6KCguKj8pKDtjaGFyc2V0PS4qPyk/KSg7YmFzZTY0KT8sL1xuICB2YXIgZGF0YVVSTHRvQmxvYiA9IChoYXNCbG9iQ29uc3RydWN0b3IgfHwgQmxvYkJ1aWxkZXIpICYmIHdpbmRvdy5hdG9iICYmXG4gICAgd2luZG93LkFycmF5QnVmZmVyICYmIHdpbmRvdy5VaW50OEFycmF5ICYmXG4gICAgZnVuY3Rpb24gKGRhdGFVUkkpIHtcbiAgICAgIHZhciBtYXRjaGVzLFxuICAgICAgICBtZWRpYVR5cGUsXG4gICAgICAgIGlzQmFzZTY0LFxuICAgICAgICBkYXRhU3RyaW5nLFxuICAgICAgICBieXRlU3RyaW5nLFxuICAgICAgICBhcnJheUJ1ZmZlcixcbiAgICAgICAgaW50QXJyYXksXG4gICAgICAgIGksXG4gICAgICAgIGJiXG4gICAgICAvLyBQYXJzZSB0aGUgZGF0YVVSSSBjb21wb25lbnRzIGFzIHBlciBSRkMgMjM5N1xuICAgICAgbWF0Y2hlcyA9IGRhdGFVUkkubWF0Y2goZGF0YVVSSVBhdHRlcm4pXG4gICAgICBpZiAoIW1hdGNoZXMpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdpbnZhbGlkIGRhdGEgVVJJJylcbiAgICAgIH1cbiAgICAgIC8vIERlZmF1bHQgdG8gdGV4dC9wbGFpbjtjaGFyc2V0PVVTLUFTQ0lJXG4gICAgICBtZWRpYVR5cGUgPSBtYXRjaGVzWzJdXG4gICAgICAgID8gbWF0Y2hlc1sxXVxuICAgICAgICA6ICd0ZXh0L3BsYWluJyArIChtYXRjaGVzWzNdIHx8ICc7Y2hhcnNldD1VUy1BU0NJSScpXG4gICAgICBpc0Jhc2U2NCA9ICEhbWF0Y2hlc1s0XVxuICAgICAgZGF0YVN0cmluZyA9IGRhdGFVUkkuc2xpY2UobWF0Y2hlc1swXS5sZW5ndGgpXG4gICAgICBpZiAoaXNCYXNlNjQpIHtcbiAgICAgICAgLy8gQ29udmVydCBiYXNlNjQgdG8gcmF3IGJpbmFyeSBkYXRhIGhlbGQgaW4gYSBzdHJpbmc6XG4gICAgICAgIGJ5dGVTdHJpbmcgPSBhdG9iKGRhdGFTdHJpbmcpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBDb252ZXJ0IGJhc2U2NC9VUkxFbmNvZGVkIGRhdGEgY29tcG9uZW50IHRvIHJhdyBiaW5hcnk6XG4gICAgICAgIGJ5dGVTdHJpbmcgPSBkZWNvZGVVUklDb21wb25lbnQoZGF0YVN0cmluZylcbiAgICAgIH1cbiAgICAgIC8vIFdyaXRlIHRoZSBieXRlcyBvZiB0aGUgc3RyaW5nIHRvIGFuIEFycmF5QnVmZmVyOlxuICAgICAgYXJyYXlCdWZmZXIgPSBuZXcgQXJyYXlCdWZmZXIoYnl0ZVN0cmluZy5sZW5ndGgpXG4gICAgICBpbnRBcnJheSA9IG5ldyBVaW50OEFycmF5KGFycmF5QnVmZmVyKVxuICAgICAgZm9yIChpID0gMDsgaSA8IGJ5dGVTdHJpbmcubGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgICAgaW50QXJyYXlbaV0gPSBieXRlU3RyaW5nLmNoYXJDb2RlQXQoaSlcbiAgICAgIH1cbiAgICAgIC8vIFdyaXRlIHRoZSBBcnJheUJ1ZmZlciAob3IgQXJyYXlCdWZmZXJWaWV3KSB0byBhIGJsb2I6XG4gICAgICBpZiAoaGFzQmxvYkNvbnN0cnVjdG9yKSB7XG4gICAgICAgIHJldHVybiBuZXcgQmxvYihcbiAgICAgICAgICBbaGFzQXJyYXlCdWZmZXJWaWV3U3VwcG9ydCA/IGludEFycmF5IDogYXJyYXlCdWZmZXJdLFxuICAgICAgICAgIHt0eXBlOiBtZWRpYVR5cGV9XG4gICAgICAgIClcbiAgICAgIH1cbiAgICAgIGJiID0gbmV3IEJsb2JCdWlsZGVyKClcbiAgICAgIGJiLmFwcGVuZChhcnJheUJ1ZmZlcilcbiAgICAgIHJldHVybiBiYi5nZXRCbG9iKG1lZGlhVHlwZSlcbiAgICB9XG4gIGlmICh3aW5kb3cuSFRNTENhbnZhc0VsZW1lbnQgJiYgIUNhbnZhc1Byb3RvdHlwZS50b0Jsb2IpIHtcbiAgICBpZiAoQ2FudmFzUHJvdG90eXBlLm1vekdldEFzRmlsZSkge1xuICAgICAgQ2FudmFzUHJvdG90eXBlLnRvQmxvYiA9IGZ1bmN0aW9uIChjYWxsYmFjaywgdHlwZSwgcXVhbGl0eSkge1xuICAgICAgICBpZiAocXVhbGl0eSAmJiBDYW52YXNQcm90b3R5cGUudG9EYXRhVVJMICYmIGRhdGFVUkx0b0Jsb2IpIHtcbiAgICAgICAgICBjYWxsYmFjayhkYXRhVVJMdG9CbG9iKHRoaXMudG9EYXRhVVJMKHR5cGUsIHF1YWxpdHkpKSlcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjYWxsYmFjayh0aGlzLm1vekdldEFzRmlsZSgnYmxvYicsIHR5cGUpKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChDYW52YXNQcm90b3R5cGUudG9EYXRhVVJMICYmIGRhdGFVUkx0b0Jsb2IpIHtcbiAgICAgIENhbnZhc1Byb3RvdHlwZS50b0Jsb2IgPSBmdW5jdGlvbiAoY2FsbGJhY2ssIHR5cGUsIHF1YWxpdHkpIHtcbiAgICAgICAgY2FsbGJhY2soZGF0YVVSTHRvQmxvYih0aGlzLnRvRGF0YVVSTCh0eXBlLCBxdWFsaXR5KSkpXG4gICAgICB9XG4gICAgfVxuICB9XG4gIGlmICh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQpIHtcbiAgICBkZWZpbmUoZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuIGRhdGFVUkx0b0Jsb2JcbiAgICB9KVxuICB9IGVsc2UgaWYgKHR5cGVvZiBtb2R1bGUgPT09ICdvYmplY3QnICYmIG1vZHVsZS5leHBvcnRzKSB7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSBkYXRhVVJMdG9CbG9iXG4gIH0gZWxzZSB7XG4gICAgd2luZG93LmRhdGFVUkx0b0Jsb2IgPSBkYXRhVVJMdG9CbG9iXG4gIH1cbn0od2luZG93KSlcbiIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9qcy9sb2FkLWltYWdlJylcblxucmVxdWlyZSgnLi9qcy9sb2FkLWltYWdlLWV4aWYnKVxucmVxdWlyZSgnLi9qcy9sb2FkLWltYWdlLWV4aWYtbWFwJylcbnJlcXVpcmUoJy4vanMvbG9hZC1pbWFnZS1tZXRhJylcbnJlcXVpcmUoJy4vanMvbG9hZC1pbWFnZS1vcmllbnRhdGlvbicpXG4iLCIvKlxuICogSmF2YVNjcmlwdCBMb2FkIEltYWdlIEV4aWYgTWFwXG4gKiBodHRwczovL2dpdGh1Yi5jb20vYmx1ZWltcC9KYXZhU2NyaXB0LUxvYWQtSW1hZ2VcbiAqXG4gKiBDb3B5cmlnaHQgMjAxMywgU2ViYXN0aWFuIFRzY2hhblxuICogaHR0cHM6Ly9ibHVlaW1wLm5ldFxuICpcbiAqIEV4aWYgdGFncyBtYXBwaW5nIGJhc2VkIG9uXG4gKiBodHRwczovL2dpdGh1Yi5jb20vanNlaWRlbGluL2V4aWYtanNcbiAqXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIGxpY2Vuc2U6XG4gKiBodHRwOi8vd3d3Lm9wZW5zb3VyY2Uub3JnL2xpY2Vuc2VzL01JVFxuICovXG5cbi8qZ2xvYmFsIGRlZmluZSwgbW9kdWxlLCByZXF1aXJlLCB3aW5kb3cgKi9cblxuOyhmdW5jdGlvbiAoZmFjdG9yeSkge1xuICAndXNlIHN0cmljdCdcbiAgaWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCkge1xuICAgIC8vIFJlZ2lzdGVyIGFzIGFuIGFub255bW91cyBBTUQgbW9kdWxlOlxuICAgIGRlZmluZShbJy4vbG9hZC1pbWFnZScsICcuL2xvYWQtaW1hZ2UtZXhpZiddLCBmYWN0b3J5KVxuICB9IGVsc2UgaWYgKHR5cGVvZiBtb2R1bGUgPT09ICdvYmplY3QnICYmIG1vZHVsZS5leHBvcnRzKSB7XG4gICAgZmFjdG9yeShyZXF1aXJlKCcuL2xvYWQtaW1hZ2UnKSwgcmVxdWlyZSgnLi9sb2FkLWltYWdlLWV4aWYnKSlcbiAgfSBlbHNlIHtcbiAgICAvLyBCcm93c2VyIGdsb2JhbHM6XG4gICAgZmFjdG9yeSh3aW5kb3cubG9hZEltYWdlKVxuICB9XG59KGZ1bmN0aW9uIChsb2FkSW1hZ2UpIHtcbiAgJ3VzZSBzdHJpY3QnXG5cbiAgbG9hZEltYWdlLkV4aWZNYXAucHJvdG90eXBlLnRhZ3MgPSB7XG4gICAgLy8gPT09PT09PT09PT09PT09PT1cbiAgICAvLyBUSUZGIHRhZ3MgKElGRDApOlxuICAgIC8vID09PT09PT09PT09PT09PT09XG4gICAgMHgwMTAwOiAnSW1hZ2VXaWR0aCcsXG4gICAgMHgwMTAxOiAnSW1hZ2VIZWlnaHQnLFxuICAgIDB4ODc2OTogJ0V4aWZJRkRQb2ludGVyJyxcbiAgICAweDg4MjU6ICdHUFNJbmZvSUZEUG9pbnRlcicsXG4gICAgMHhBMDA1OiAnSW50ZXJvcGVyYWJpbGl0eUlGRFBvaW50ZXInLFxuICAgIDB4MDEwMjogJ0JpdHNQZXJTYW1wbGUnLFxuICAgIDB4MDEwMzogJ0NvbXByZXNzaW9uJyxcbiAgICAweDAxMDY6ICdQaG90b21ldHJpY0ludGVycHJldGF0aW9uJyxcbiAgICAweDAxMTI6ICdPcmllbnRhdGlvbicsXG4gICAgMHgwMTE1OiAnU2FtcGxlc1BlclBpeGVsJyxcbiAgICAweDAxMUM6ICdQbGFuYXJDb25maWd1cmF0aW9uJyxcbiAgICAweDAyMTI6ICdZQ2JDclN1YlNhbXBsaW5nJyxcbiAgICAweDAyMTM6ICdZQ2JDclBvc2l0aW9uaW5nJyxcbiAgICAweDAxMUE6ICdYUmVzb2x1dGlvbicsXG4gICAgMHgwMTFCOiAnWVJlc29sdXRpb24nLFxuICAgIDB4MDEyODogJ1Jlc29sdXRpb25Vbml0JyxcbiAgICAweDAxMTE6ICdTdHJpcE9mZnNldHMnLFxuICAgIDB4MDExNjogJ1Jvd3NQZXJTdHJpcCcsXG4gICAgMHgwMTE3OiAnU3RyaXBCeXRlQ291bnRzJyxcbiAgICAweDAyMDE6ICdKUEVHSW50ZXJjaGFuZ2VGb3JtYXQnLFxuICAgIDB4MDIwMjogJ0pQRUdJbnRlcmNoYW5nZUZvcm1hdExlbmd0aCcsXG4gICAgMHgwMTJEOiAnVHJhbnNmZXJGdW5jdGlvbicsXG4gICAgMHgwMTNFOiAnV2hpdGVQb2ludCcsXG4gICAgMHgwMTNGOiAnUHJpbWFyeUNocm9tYXRpY2l0aWVzJyxcbiAgICAweDAyMTE6ICdZQ2JDckNvZWZmaWNpZW50cycsXG4gICAgMHgwMjE0OiAnUmVmZXJlbmNlQmxhY2tXaGl0ZScsXG4gICAgMHgwMTMyOiAnRGF0ZVRpbWUnLFxuICAgIDB4MDEwRTogJ0ltYWdlRGVzY3JpcHRpb24nLFxuICAgIDB4MDEwRjogJ01ha2UnLFxuICAgIDB4MDExMDogJ01vZGVsJyxcbiAgICAweDAxMzE6ICdTb2Z0d2FyZScsXG4gICAgMHgwMTNCOiAnQXJ0aXN0JyxcbiAgICAweDgyOTg6ICdDb3B5cmlnaHQnLFxuICAgIC8vID09PT09PT09PT09PT09PT09PVxuICAgIC8vIEV4aWYgU3ViIElGRCB0YWdzOlxuICAgIC8vID09PT09PT09PT09PT09PT09PVxuICAgIDB4OTAwMDogJ0V4aWZWZXJzaW9uJywgLy8gRVhJRiB2ZXJzaW9uXG4gICAgMHhBMDAwOiAnRmxhc2hwaXhWZXJzaW9uJywgLy8gRmxhc2hwaXggZm9ybWF0IHZlcnNpb25cbiAgICAweEEwMDE6ICdDb2xvclNwYWNlJywgLy8gQ29sb3Igc3BhY2UgaW5mb3JtYXRpb24gdGFnXG4gICAgMHhBMDAyOiAnUGl4ZWxYRGltZW5zaW9uJywgLy8gVmFsaWQgd2lkdGggb2YgbWVhbmluZ2Z1bCBpbWFnZVxuICAgIDB4QTAwMzogJ1BpeGVsWURpbWVuc2lvbicsIC8vIFZhbGlkIGhlaWdodCBvZiBtZWFuaW5nZnVsIGltYWdlXG4gICAgMHhBNTAwOiAnR2FtbWEnLFxuICAgIDB4OTEwMTogJ0NvbXBvbmVudHNDb25maWd1cmF0aW9uJywgLy8gSW5mb3JtYXRpb24gYWJvdXQgY2hhbm5lbHNcbiAgICAweDkxMDI6ICdDb21wcmVzc2VkQml0c1BlclBpeGVsJywgLy8gQ29tcHJlc3NlZCBiaXRzIHBlciBwaXhlbFxuICAgIDB4OTI3QzogJ01ha2VyTm90ZScsIC8vIEFueSBkZXNpcmVkIGluZm9ybWF0aW9uIHdyaXR0ZW4gYnkgdGhlIG1hbnVmYWN0dXJlclxuICAgIDB4OTI4NjogJ1VzZXJDb21tZW50JywgLy8gQ29tbWVudHMgYnkgdXNlclxuICAgIDB4QTAwNDogJ1JlbGF0ZWRTb3VuZEZpbGUnLCAvLyBOYW1lIG9mIHJlbGF0ZWQgc291bmQgZmlsZVxuICAgIDB4OTAwMzogJ0RhdGVUaW1lT3JpZ2luYWwnLCAvLyBEYXRlIGFuZCB0aW1lIHdoZW4gdGhlIG9yaWdpbmFsIGltYWdlIHdhcyBnZW5lcmF0ZWRcbiAgICAweDkwMDQ6ICdEYXRlVGltZURpZ2l0aXplZCcsIC8vIERhdGUgYW5kIHRpbWUgd2hlbiB0aGUgaW1hZ2Ugd2FzIHN0b3JlZCBkaWdpdGFsbHlcbiAgICAweDkyOTA6ICdTdWJTZWNUaW1lJywgLy8gRnJhY3Rpb25zIG9mIHNlY29uZHMgZm9yIERhdGVUaW1lXG4gICAgMHg5MjkxOiAnU3ViU2VjVGltZU9yaWdpbmFsJywgLy8gRnJhY3Rpb25zIG9mIHNlY29uZHMgZm9yIERhdGVUaW1lT3JpZ2luYWxcbiAgICAweDkyOTI6ICdTdWJTZWNUaW1lRGlnaXRpemVkJywgLy8gRnJhY3Rpb25zIG9mIHNlY29uZHMgZm9yIERhdGVUaW1lRGlnaXRpemVkXG4gICAgMHg4MjlBOiAnRXhwb3N1cmVUaW1lJywgLy8gRXhwb3N1cmUgdGltZSAoaW4gc2Vjb25kcylcbiAgICAweDgyOUQ6ICdGTnVtYmVyJyxcbiAgICAweDg4MjI6ICdFeHBvc3VyZVByb2dyYW0nLCAvLyBFeHBvc3VyZSBwcm9ncmFtXG4gICAgMHg4ODI0OiAnU3BlY3RyYWxTZW5zaXRpdml0eScsIC8vIFNwZWN0cmFsIHNlbnNpdGl2aXR5XG4gICAgMHg4ODI3OiAnUGhvdG9ncmFwaGljU2Vuc2l0aXZpdHknLCAvLyBFWElGIDIuMywgSVNPU3BlZWRSYXRpbmdzIGluIEVYSUYgMi4yXG4gICAgMHg4ODI4OiAnT0VDRicsIC8vIE9wdG9lbGVjdHJpYyBjb252ZXJzaW9uIGZhY3RvclxuICAgIDB4ODgzMDogJ1NlbnNpdGl2aXR5VHlwZScsXG4gICAgMHg4ODMxOiAnU3RhbmRhcmRPdXRwdXRTZW5zaXRpdml0eScsXG4gICAgMHg4ODMyOiAnUmVjb21tZW5kZWRFeHBvc3VyZUluZGV4JyxcbiAgICAweDg4MzM6ICdJU09TcGVlZCcsXG4gICAgMHg4ODM0OiAnSVNPU3BlZWRMYXRpdHVkZXl5eScsXG4gICAgMHg4ODM1OiAnSVNPU3BlZWRMYXRpdHVkZXp6eicsXG4gICAgMHg5MjAxOiAnU2h1dHRlclNwZWVkVmFsdWUnLCAvLyBTaHV0dGVyIHNwZWVkXG4gICAgMHg5MjAyOiAnQXBlcnR1cmVWYWx1ZScsIC8vIExlbnMgYXBlcnR1cmVcbiAgICAweDkyMDM6ICdCcmlnaHRuZXNzVmFsdWUnLCAvLyBWYWx1ZSBvZiBicmlnaHRuZXNzXG4gICAgMHg5MjA0OiAnRXhwb3N1cmVCaWFzJywgLy8gRXhwb3N1cmUgYmlhc1xuICAgIDB4OTIwNTogJ01heEFwZXJ0dXJlVmFsdWUnLCAvLyBTbWFsbGVzdCBGIG51bWJlciBvZiBsZW5zXG4gICAgMHg5MjA2OiAnU3ViamVjdERpc3RhbmNlJywgLy8gRGlzdGFuY2UgdG8gc3ViamVjdCBpbiBtZXRlcnNcbiAgICAweDkyMDc6ICdNZXRlcmluZ01vZGUnLCAvLyBNZXRlcmluZyBtb2RlXG4gICAgMHg5MjA4OiAnTGlnaHRTb3VyY2UnLCAvLyBLaW5kIG9mIGxpZ2h0IHNvdXJjZVxuICAgIDB4OTIwOTogJ0ZsYXNoJywgLy8gRmxhc2ggc3RhdHVzXG4gICAgMHg5MjE0OiAnU3ViamVjdEFyZWEnLCAvLyBMb2NhdGlvbiBhbmQgYXJlYSBvZiBtYWluIHN1YmplY3RcbiAgICAweDkyMEE6ICdGb2NhbExlbmd0aCcsIC8vIEZvY2FsIGxlbmd0aCBvZiB0aGUgbGVucyBpbiBtbVxuICAgIDB4QTIwQjogJ0ZsYXNoRW5lcmd5JywgLy8gU3Ryb2JlIGVuZXJneSBpbiBCQ1BTXG4gICAgMHhBMjBDOiAnU3BhdGlhbEZyZXF1ZW5jeVJlc3BvbnNlJyxcbiAgICAweEEyMEU6ICdGb2NhbFBsYW5lWFJlc29sdXRpb24nLCAvLyBOdW1iZXIgb2YgcGl4ZWxzIGluIHdpZHRoIGRpcmVjdGlvbiBwZXIgRlBSVW5pdFxuICAgIDB4QTIwRjogJ0ZvY2FsUGxhbmVZUmVzb2x1dGlvbicsIC8vIE51bWJlciBvZiBwaXhlbHMgaW4gaGVpZ2h0IGRpcmVjdGlvbiBwZXIgRlBSVW5pdFxuICAgIDB4QTIxMDogJ0ZvY2FsUGxhbmVSZXNvbHV0aW9uVW5pdCcsIC8vIFVuaXQgZm9yIG1lYXN1cmluZyB0aGUgZm9jYWwgcGxhbmUgcmVzb2x1dGlvblxuICAgIDB4QTIxNDogJ1N1YmplY3RMb2NhdGlvbicsIC8vIExvY2F0aW9uIG9mIHN1YmplY3QgaW4gaW1hZ2VcbiAgICAweEEyMTU6ICdFeHBvc3VyZUluZGV4JywgLy8gRXhwb3N1cmUgaW5kZXggc2VsZWN0ZWQgb24gY2FtZXJhXG4gICAgMHhBMjE3OiAnU2Vuc2luZ01ldGhvZCcsIC8vIEltYWdlIHNlbnNvciB0eXBlXG4gICAgMHhBMzAwOiAnRmlsZVNvdXJjZScsIC8vIEltYWdlIHNvdXJjZSAoMyA9PSBEU0MpXG4gICAgMHhBMzAxOiAnU2NlbmVUeXBlJywgLy8gU2NlbmUgdHlwZSAoMSA9PSBkaXJlY3RseSBwaG90b2dyYXBoZWQpXG4gICAgMHhBMzAyOiAnQ0ZBUGF0dGVybicsIC8vIENvbG9yIGZpbHRlciBhcnJheSBnZW9tZXRyaWMgcGF0dGVyblxuICAgIDB4QTQwMTogJ0N1c3RvbVJlbmRlcmVkJywgLy8gU3BlY2lhbCBwcm9jZXNzaW5nXG4gICAgMHhBNDAyOiAnRXhwb3N1cmVNb2RlJywgLy8gRXhwb3N1cmUgbW9kZVxuICAgIDB4QTQwMzogJ1doaXRlQmFsYW5jZScsIC8vIDEgPSBhdXRvIHdoaXRlIGJhbGFuY2UsIDIgPSBtYW51YWxcbiAgICAweEE0MDQ6ICdEaWdpdGFsWm9vbVJhdGlvJywgLy8gRGlnaXRhbCB6b29tIHJhdGlvXG4gICAgMHhBNDA1OiAnRm9jYWxMZW5ndGhJbjM1bW1GaWxtJyxcbiAgICAweEE0MDY6ICdTY2VuZUNhcHR1cmVUeXBlJywgLy8gVHlwZSBvZiBzY2VuZVxuICAgIDB4QTQwNzogJ0dhaW5Db250cm9sJywgLy8gRGVncmVlIG9mIG92ZXJhbGwgaW1hZ2UgZ2FpbiBhZGp1c3RtZW50XG4gICAgMHhBNDA4OiAnQ29udHJhc3QnLCAvLyBEaXJlY3Rpb24gb2YgY29udHJhc3QgcHJvY2Vzc2luZyBhcHBsaWVkIGJ5IGNhbWVyYVxuICAgIDB4QTQwOTogJ1NhdHVyYXRpb24nLCAvLyBEaXJlY3Rpb24gb2Ygc2F0dXJhdGlvbiBwcm9jZXNzaW5nIGFwcGxpZWQgYnkgY2FtZXJhXG4gICAgMHhBNDBBOiAnU2hhcnBuZXNzJywgLy8gRGlyZWN0aW9uIG9mIHNoYXJwbmVzcyBwcm9jZXNzaW5nIGFwcGxpZWQgYnkgY2FtZXJhXG4gICAgMHhBNDBCOiAnRGV2aWNlU2V0dGluZ0Rlc2NyaXB0aW9uJyxcbiAgICAweEE0MEM6ICdTdWJqZWN0RGlzdGFuY2VSYW5nZScsIC8vIERpc3RhbmNlIHRvIHN1YmplY3RcbiAgICAweEE0MjA6ICdJbWFnZVVuaXF1ZUlEJywgLy8gSWRlbnRpZmllciBhc3NpZ25lZCB1bmlxdWVseSB0byBlYWNoIGltYWdlXG4gICAgMHhBNDMwOiAnQ2FtZXJhT3duZXJOYW1lJyxcbiAgICAweEE0MzE6ICdCb2R5U2VyaWFsTnVtYmVyJyxcbiAgICAweEE0MzI6ICdMZW5zU3BlY2lmaWNhdGlvbicsXG4gICAgMHhBNDMzOiAnTGVuc01ha2UnLFxuICAgIDB4QTQzNDogJ0xlbnNNb2RlbCcsXG4gICAgMHhBNDM1OiAnTGVuc1NlcmlhbE51bWJlcicsXG4gICAgLy8gPT09PT09PT09PT09PT1cbiAgICAvLyBHUFMgSW5mbyB0YWdzOlxuICAgIC8vID09PT09PT09PT09PT09XG4gICAgMHgwMDAwOiAnR1BTVmVyc2lvbklEJyxcbiAgICAweDAwMDE6ICdHUFNMYXRpdHVkZVJlZicsXG4gICAgMHgwMDAyOiAnR1BTTGF0aXR1ZGUnLFxuICAgIDB4MDAwMzogJ0dQU0xvbmdpdHVkZVJlZicsXG4gICAgMHgwMDA0OiAnR1BTTG9uZ2l0dWRlJyxcbiAgICAweDAwMDU6ICdHUFNBbHRpdHVkZVJlZicsXG4gICAgMHgwMDA2OiAnR1BTQWx0aXR1ZGUnLFxuICAgIDB4MDAwNzogJ0dQU1RpbWVTdGFtcCcsXG4gICAgMHgwMDA4OiAnR1BTU2F0ZWxsaXRlcycsXG4gICAgMHgwMDA5OiAnR1BTU3RhdHVzJyxcbiAgICAweDAwMEE6ICdHUFNNZWFzdXJlTW9kZScsXG4gICAgMHgwMDBCOiAnR1BTRE9QJyxcbiAgICAweDAwMEM6ICdHUFNTcGVlZFJlZicsXG4gICAgMHgwMDBEOiAnR1BTU3BlZWQnLFxuICAgIDB4MDAwRTogJ0dQU1RyYWNrUmVmJyxcbiAgICAweDAwMEY6ICdHUFNUcmFjaycsXG4gICAgMHgwMDEwOiAnR1BTSW1nRGlyZWN0aW9uUmVmJyxcbiAgICAweDAwMTE6ICdHUFNJbWdEaXJlY3Rpb24nLFxuICAgIDB4MDAxMjogJ0dQU01hcERhdHVtJyxcbiAgICAweDAwMTM6ICdHUFNEZXN0TGF0aXR1ZGVSZWYnLFxuICAgIDB4MDAxNDogJ0dQU0Rlc3RMYXRpdHVkZScsXG4gICAgMHgwMDE1OiAnR1BTRGVzdExvbmdpdHVkZVJlZicsXG4gICAgMHgwMDE2OiAnR1BTRGVzdExvbmdpdHVkZScsXG4gICAgMHgwMDE3OiAnR1BTRGVzdEJlYXJpbmdSZWYnLFxuICAgIDB4MDAxODogJ0dQU0Rlc3RCZWFyaW5nJyxcbiAgICAweDAwMTk6ICdHUFNEZXN0RGlzdGFuY2VSZWYnLFxuICAgIDB4MDAxQTogJ0dQU0Rlc3REaXN0YW5jZScsXG4gICAgMHgwMDFCOiAnR1BTUHJvY2Vzc2luZ01ldGhvZCcsXG4gICAgMHgwMDFDOiAnR1BTQXJlYUluZm9ybWF0aW9uJyxcbiAgICAweDAwMUQ6ICdHUFNEYXRlU3RhbXAnLFxuICAgIDB4MDAxRTogJ0dQU0RpZmZlcmVudGlhbCcsXG4gICAgMHgwMDFGOiAnR1BTSFBvc2l0aW9uaW5nRXJyb3InXG4gIH1cblxuICBsb2FkSW1hZ2UuRXhpZk1hcC5wcm90b3R5cGUuc3RyaW5nVmFsdWVzID0ge1xuICAgIEV4cG9zdXJlUHJvZ3JhbToge1xuICAgICAgMDogJ1VuZGVmaW5lZCcsXG4gICAgICAxOiAnTWFudWFsJyxcbiAgICAgIDI6ICdOb3JtYWwgcHJvZ3JhbScsXG4gICAgICAzOiAnQXBlcnR1cmUgcHJpb3JpdHknLFxuICAgICAgNDogJ1NodXR0ZXIgcHJpb3JpdHknLFxuICAgICAgNTogJ0NyZWF0aXZlIHByb2dyYW0nLFxuICAgICAgNjogJ0FjdGlvbiBwcm9ncmFtJyxcbiAgICAgIDc6ICdQb3J0cmFpdCBtb2RlJyxcbiAgICAgIDg6ICdMYW5kc2NhcGUgbW9kZSdcbiAgICB9LFxuICAgIE1ldGVyaW5nTW9kZToge1xuICAgICAgMDogJ1Vua25vd24nLFxuICAgICAgMTogJ0F2ZXJhZ2UnLFxuICAgICAgMjogJ0NlbnRlcldlaWdodGVkQXZlcmFnZScsXG4gICAgICAzOiAnU3BvdCcsXG4gICAgICA0OiAnTXVsdGlTcG90JyxcbiAgICAgIDU6ICdQYXR0ZXJuJyxcbiAgICAgIDY6ICdQYXJ0aWFsJyxcbiAgICAgIDI1NTogJ090aGVyJ1xuICAgIH0sXG4gICAgTGlnaHRTb3VyY2U6IHtcbiAgICAgIDA6ICdVbmtub3duJyxcbiAgICAgIDE6ICdEYXlsaWdodCcsXG4gICAgICAyOiAnRmx1b3Jlc2NlbnQnLFxuICAgICAgMzogJ1R1bmdzdGVuIChpbmNhbmRlc2NlbnQgbGlnaHQpJyxcbiAgICAgIDQ6ICdGbGFzaCcsXG4gICAgICA5OiAnRmluZSB3ZWF0aGVyJyxcbiAgICAgIDEwOiAnQ2xvdWR5IHdlYXRoZXInLFxuICAgICAgMTE6ICdTaGFkZScsXG4gICAgICAxMjogJ0RheWxpZ2h0IGZsdW9yZXNjZW50IChEIDU3MDAgLSA3MTAwSyknLFxuICAgICAgMTM6ICdEYXkgd2hpdGUgZmx1b3Jlc2NlbnQgKE4gNDYwMCAtIDU0MDBLKScsXG4gICAgICAxNDogJ0Nvb2wgd2hpdGUgZmx1b3Jlc2NlbnQgKFcgMzkwMCAtIDQ1MDBLKScsXG4gICAgICAxNTogJ1doaXRlIGZsdW9yZXNjZW50IChXVyAzMjAwIC0gMzcwMEspJyxcbiAgICAgIDE3OiAnU3RhbmRhcmQgbGlnaHQgQScsXG4gICAgICAxODogJ1N0YW5kYXJkIGxpZ2h0IEInLFxuICAgICAgMTk6ICdTdGFuZGFyZCBsaWdodCBDJyxcbiAgICAgIDIwOiAnRDU1JyxcbiAgICAgIDIxOiAnRDY1JyxcbiAgICAgIDIyOiAnRDc1JyxcbiAgICAgIDIzOiAnRDUwJyxcbiAgICAgIDI0OiAnSVNPIHN0dWRpbyB0dW5nc3RlbicsXG4gICAgICAyNTU6ICdPdGhlcidcbiAgICB9LFxuICAgIEZsYXNoOiB7XG4gICAgICAweDAwMDA6ICdGbGFzaCBkaWQgbm90IGZpcmUnLFxuICAgICAgMHgwMDAxOiAnRmxhc2ggZmlyZWQnLFxuICAgICAgMHgwMDA1OiAnU3Ryb2JlIHJldHVybiBsaWdodCBub3QgZGV0ZWN0ZWQnLFxuICAgICAgMHgwMDA3OiAnU3Ryb2JlIHJldHVybiBsaWdodCBkZXRlY3RlZCcsXG4gICAgICAweDAwMDk6ICdGbGFzaCBmaXJlZCwgY29tcHVsc29yeSBmbGFzaCBtb2RlJyxcbiAgICAgIDB4MDAwRDogJ0ZsYXNoIGZpcmVkLCBjb21wdWxzb3J5IGZsYXNoIG1vZGUsIHJldHVybiBsaWdodCBub3QgZGV0ZWN0ZWQnLFxuICAgICAgMHgwMDBGOiAnRmxhc2ggZmlyZWQsIGNvbXB1bHNvcnkgZmxhc2ggbW9kZSwgcmV0dXJuIGxpZ2h0IGRldGVjdGVkJyxcbiAgICAgIDB4MDAxMDogJ0ZsYXNoIGRpZCBub3QgZmlyZSwgY29tcHVsc29yeSBmbGFzaCBtb2RlJyxcbiAgICAgIDB4MDAxODogJ0ZsYXNoIGRpZCBub3QgZmlyZSwgYXV0byBtb2RlJyxcbiAgICAgIDB4MDAxOTogJ0ZsYXNoIGZpcmVkLCBhdXRvIG1vZGUnLFxuICAgICAgMHgwMDFEOiAnRmxhc2ggZmlyZWQsIGF1dG8gbW9kZSwgcmV0dXJuIGxpZ2h0IG5vdCBkZXRlY3RlZCcsXG4gICAgICAweDAwMUY6ICdGbGFzaCBmaXJlZCwgYXV0byBtb2RlLCByZXR1cm4gbGlnaHQgZGV0ZWN0ZWQnLFxuICAgICAgMHgwMDIwOiAnTm8gZmxhc2ggZnVuY3Rpb24nLFxuICAgICAgMHgwMDQxOiAnRmxhc2ggZmlyZWQsIHJlZC1leWUgcmVkdWN0aW9uIG1vZGUnLFxuICAgICAgMHgwMDQ1OiAnRmxhc2ggZmlyZWQsIHJlZC1leWUgcmVkdWN0aW9uIG1vZGUsIHJldHVybiBsaWdodCBub3QgZGV0ZWN0ZWQnLFxuICAgICAgMHgwMDQ3OiAnRmxhc2ggZmlyZWQsIHJlZC1leWUgcmVkdWN0aW9uIG1vZGUsIHJldHVybiBsaWdodCBkZXRlY3RlZCcsXG4gICAgICAweDAwNDk6ICdGbGFzaCBmaXJlZCwgY29tcHVsc29yeSBmbGFzaCBtb2RlLCByZWQtZXllIHJlZHVjdGlvbiBtb2RlJyxcbiAgICAgIDB4MDA0RDogJ0ZsYXNoIGZpcmVkLCBjb21wdWxzb3J5IGZsYXNoIG1vZGUsIHJlZC1leWUgcmVkdWN0aW9uIG1vZGUsIHJldHVybiBsaWdodCBub3QgZGV0ZWN0ZWQnLFxuICAgICAgMHgwMDRGOiAnRmxhc2ggZmlyZWQsIGNvbXB1bHNvcnkgZmxhc2ggbW9kZSwgcmVkLWV5ZSByZWR1Y3Rpb24gbW9kZSwgcmV0dXJuIGxpZ2h0IGRldGVjdGVkJyxcbiAgICAgIDB4MDA1OTogJ0ZsYXNoIGZpcmVkLCBhdXRvIG1vZGUsIHJlZC1leWUgcmVkdWN0aW9uIG1vZGUnLFxuICAgICAgMHgwMDVEOiAnRmxhc2ggZmlyZWQsIGF1dG8gbW9kZSwgcmV0dXJuIGxpZ2h0IG5vdCBkZXRlY3RlZCwgcmVkLWV5ZSByZWR1Y3Rpb24gbW9kZScsXG4gICAgICAweDAwNUY6ICdGbGFzaCBmaXJlZCwgYXV0byBtb2RlLCByZXR1cm4gbGlnaHQgZGV0ZWN0ZWQsIHJlZC1leWUgcmVkdWN0aW9uIG1vZGUnXG4gICAgfSxcbiAgICBTZW5zaW5nTWV0aG9kOiB7XG4gICAgICAxOiAnVW5kZWZpbmVkJyxcbiAgICAgIDI6ICdPbmUtY2hpcCBjb2xvciBhcmVhIHNlbnNvcicsXG4gICAgICAzOiAnVHdvLWNoaXAgY29sb3IgYXJlYSBzZW5zb3InLFxuICAgICAgNDogJ1RocmVlLWNoaXAgY29sb3IgYXJlYSBzZW5zb3InLFxuICAgICAgNTogJ0NvbG9yIHNlcXVlbnRpYWwgYXJlYSBzZW5zb3InLFxuICAgICAgNzogJ1RyaWxpbmVhciBzZW5zb3InLFxuICAgICAgODogJ0NvbG9yIHNlcXVlbnRpYWwgbGluZWFyIHNlbnNvcidcbiAgICB9LFxuICAgIFNjZW5lQ2FwdHVyZVR5cGU6IHtcbiAgICAgIDA6ICdTdGFuZGFyZCcsXG4gICAgICAxOiAnTGFuZHNjYXBlJyxcbiAgICAgIDI6ICdQb3J0cmFpdCcsXG4gICAgICAzOiAnTmlnaHQgc2NlbmUnXG4gICAgfSxcbiAgICBTY2VuZVR5cGU6IHtcbiAgICAgIDE6ICdEaXJlY3RseSBwaG90b2dyYXBoZWQnXG4gICAgfSxcbiAgICBDdXN0b21SZW5kZXJlZDoge1xuICAgICAgMDogJ05vcm1hbCBwcm9jZXNzJyxcbiAgICAgIDE6ICdDdXN0b20gcHJvY2VzcydcbiAgICB9LFxuICAgIFdoaXRlQmFsYW5jZToge1xuICAgICAgMDogJ0F1dG8gd2hpdGUgYmFsYW5jZScsXG4gICAgICAxOiAnTWFudWFsIHdoaXRlIGJhbGFuY2UnXG4gICAgfSxcbiAgICBHYWluQ29udHJvbDoge1xuICAgICAgMDogJ05vbmUnLFxuICAgICAgMTogJ0xvdyBnYWluIHVwJyxcbiAgICAgIDI6ICdIaWdoIGdhaW4gdXAnLFxuICAgICAgMzogJ0xvdyBnYWluIGRvd24nLFxuICAgICAgNDogJ0hpZ2ggZ2FpbiBkb3duJ1xuICAgIH0sXG4gICAgQ29udHJhc3Q6IHtcbiAgICAgIDA6ICdOb3JtYWwnLFxuICAgICAgMTogJ1NvZnQnLFxuICAgICAgMjogJ0hhcmQnXG4gICAgfSxcbiAgICBTYXR1cmF0aW9uOiB7XG4gICAgICAwOiAnTm9ybWFsJyxcbiAgICAgIDE6ICdMb3cgc2F0dXJhdGlvbicsXG4gICAgICAyOiAnSGlnaCBzYXR1cmF0aW9uJ1xuICAgIH0sXG4gICAgU2hhcnBuZXNzOiB7XG4gICAgICAwOiAnTm9ybWFsJyxcbiAgICAgIDE6ICdTb2Z0JyxcbiAgICAgIDI6ICdIYXJkJ1xuICAgIH0sXG4gICAgU3ViamVjdERpc3RhbmNlUmFuZ2U6IHtcbiAgICAgIDA6ICdVbmtub3duJyxcbiAgICAgIDE6ICdNYWNybycsXG4gICAgICAyOiAnQ2xvc2UgdmlldycsXG4gICAgICAzOiAnRGlzdGFudCB2aWV3J1xuICAgIH0sXG4gICAgRmlsZVNvdXJjZToge1xuICAgICAgMzogJ0RTQydcbiAgICB9LFxuICAgIENvbXBvbmVudHNDb25maWd1cmF0aW9uOiB7XG4gICAgICAwOiAnJyxcbiAgICAgIDE6ICdZJyxcbiAgICAgIDI6ICdDYicsXG4gICAgICAzOiAnQ3InLFxuICAgICAgNDogJ1InLFxuICAgICAgNTogJ0cnLFxuICAgICAgNjogJ0InXG4gICAgfSxcbiAgICBPcmllbnRhdGlvbjoge1xuICAgICAgMTogJ3RvcC1sZWZ0JyxcbiAgICAgIDI6ICd0b3AtcmlnaHQnLFxuICAgICAgMzogJ2JvdHRvbS1yaWdodCcsXG4gICAgICA0OiAnYm90dG9tLWxlZnQnLFxuICAgICAgNTogJ2xlZnQtdG9wJyxcbiAgICAgIDY6ICdyaWdodC10b3AnLFxuICAgICAgNzogJ3JpZ2h0LWJvdHRvbScsXG4gICAgICA4OiAnbGVmdC1ib3R0b20nXG4gICAgfVxuICB9XG5cbiAgbG9hZEltYWdlLkV4aWZNYXAucHJvdG90eXBlLmdldFRleHQgPSBmdW5jdGlvbiAoaWQpIHtcbiAgICB2YXIgdmFsdWUgPSB0aGlzLmdldChpZClcbiAgICBzd2l0Y2ggKGlkKSB7XG4gICAgICBjYXNlICdMaWdodFNvdXJjZSc6XG4gICAgICBjYXNlICdGbGFzaCc6XG4gICAgICBjYXNlICdNZXRlcmluZ01vZGUnOlxuICAgICAgY2FzZSAnRXhwb3N1cmVQcm9ncmFtJzpcbiAgICAgIGNhc2UgJ1NlbnNpbmdNZXRob2QnOlxuICAgICAgY2FzZSAnU2NlbmVDYXB0dXJlVHlwZSc6XG4gICAgICBjYXNlICdTY2VuZVR5cGUnOlxuICAgICAgY2FzZSAnQ3VzdG9tUmVuZGVyZWQnOlxuICAgICAgY2FzZSAnV2hpdGVCYWxhbmNlJzpcbiAgICAgIGNhc2UgJ0dhaW5Db250cm9sJzpcbiAgICAgIGNhc2UgJ0NvbnRyYXN0JzpcbiAgICAgIGNhc2UgJ1NhdHVyYXRpb24nOlxuICAgICAgY2FzZSAnU2hhcnBuZXNzJzpcbiAgICAgIGNhc2UgJ1N1YmplY3REaXN0YW5jZVJhbmdlJzpcbiAgICAgIGNhc2UgJ0ZpbGVTb3VyY2UnOlxuICAgICAgY2FzZSAnT3JpZW50YXRpb24nOlxuICAgICAgICByZXR1cm4gdGhpcy5zdHJpbmdWYWx1ZXNbaWRdW3ZhbHVlXVxuICAgICAgY2FzZSAnRXhpZlZlcnNpb24nOlxuICAgICAgY2FzZSAnRmxhc2hwaXhWZXJzaW9uJzpcbiAgICAgICAgcmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUodmFsdWVbMF0sIHZhbHVlWzFdLCB2YWx1ZVsyXSwgdmFsdWVbM10pXG4gICAgICBjYXNlICdDb21wb25lbnRzQ29uZmlndXJhdGlvbic6XG4gICAgICAgIHJldHVybiB0aGlzLnN0cmluZ1ZhbHVlc1tpZF1bdmFsdWVbMF1dICtcbiAgICAgICAgdGhpcy5zdHJpbmdWYWx1ZXNbaWRdW3ZhbHVlWzFdXSArXG4gICAgICAgIHRoaXMuc3RyaW5nVmFsdWVzW2lkXVt2YWx1ZVsyXV0gK1xuICAgICAgICB0aGlzLnN0cmluZ1ZhbHVlc1tpZF1bdmFsdWVbM11dXG4gICAgICBjYXNlICdHUFNWZXJzaW9uSUQnOlxuICAgICAgICByZXR1cm4gdmFsdWVbMF0gKyAnLicgKyB2YWx1ZVsxXSArICcuJyArIHZhbHVlWzJdICsgJy4nICsgdmFsdWVbM11cbiAgICB9XG4gICAgcmV0dXJuIFN0cmluZyh2YWx1ZSlcbiAgfVxuXG4gIDsoZnVuY3Rpb24gKGV4aWZNYXBQcm90b3R5cGUpIHtcbiAgICB2YXIgdGFncyA9IGV4aWZNYXBQcm90b3R5cGUudGFnc1xuICAgIHZhciBtYXAgPSBleGlmTWFwUHJvdG90eXBlLm1hcFxuICAgIHZhciBwcm9wXG4gICAgLy8gTWFwIHRoZSB0YWcgbmFtZXMgdG8gdGFnczpcbiAgICBmb3IgKHByb3AgaW4gdGFncykge1xuICAgICAgaWYgKHRhZ3MuaGFzT3duUHJvcGVydHkocHJvcCkpIHtcbiAgICAgICAgbWFwW3RhZ3NbcHJvcF1dID0gcHJvcFxuICAgICAgfVxuICAgIH1cbiAgfShsb2FkSW1hZ2UuRXhpZk1hcC5wcm90b3R5cGUpKVxuXG4gIGxvYWRJbWFnZS5FeGlmTWFwLnByb3RvdHlwZS5nZXRBbGwgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIG1hcCA9IHt9XG4gICAgdmFyIHByb3BcbiAgICB2YXIgaWRcbiAgICBmb3IgKHByb3AgaW4gdGhpcykge1xuICAgICAgaWYgKHRoaXMuaGFzT3duUHJvcGVydHkocHJvcCkpIHtcbiAgICAgICAgaWQgPSB0aGlzLnRhZ3NbcHJvcF1cbiAgICAgICAgaWYgKGlkKSB7XG4gICAgICAgICAgbWFwW2lkXSA9IHRoaXMuZ2V0VGV4dChpZClcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbWFwXG4gIH1cbn0pKVxuIiwiLypcbiAqIEphdmFTY3JpcHQgTG9hZCBJbWFnZSBFeGlmIFBhcnNlclxuICogaHR0cHM6Ly9naXRodWIuY29tL2JsdWVpbXAvSmF2YVNjcmlwdC1Mb2FkLUltYWdlXG4gKlxuICogQ29weXJpZ2h0IDIwMTMsIFNlYmFzdGlhbiBUc2NoYW5cbiAqIGh0dHBzOi8vYmx1ZWltcC5uZXRcbiAqXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIGxpY2Vuc2U6XG4gKiBodHRwOi8vd3d3Lm9wZW5zb3VyY2Uub3JnL2xpY2Vuc2VzL01JVFxuICovXG5cbi8qZ2xvYmFsIGRlZmluZSwgbW9kdWxlLCByZXF1aXJlLCB3aW5kb3csIGNvbnNvbGUgKi9cblxuOyhmdW5jdGlvbiAoZmFjdG9yeSkge1xuICAndXNlIHN0cmljdCdcbiAgaWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCkge1xuICAgIC8vIFJlZ2lzdGVyIGFzIGFuIGFub255bW91cyBBTUQgbW9kdWxlOlxuICAgIGRlZmluZShbJy4vbG9hZC1pbWFnZScsICcuL2xvYWQtaW1hZ2UtbWV0YSddLCBmYWN0b3J5KVxuICB9IGVsc2UgaWYgKHR5cGVvZiBtb2R1bGUgPT09ICdvYmplY3QnICYmIG1vZHVsZS5leHBvcnRzKSB7XG4gICAgZmFjdG9yeShyZXF1aXJlKCcuL2xvYWQtaW1hZ2UnKSwgcmVxdWlyZSgnLi9sb2FkLWltYWdlLW1ldGEnKSlcbiAgfSBlbHNlIHtcbiAgICAvLyBCcm93c2VyIGdsb2JhbHM6XG4gICAgZmFjdG9yeSh3aW5kb3cubG9hZEltYWdlKVxuICB9XG59KGZ1bmN0aW9uIChsb2FkSW1hZ2UpIHtcbiAgJ3VzZSBzdHJpY3QnXG5cbiAgbG9hZEltYWdlLkV4aWZNYXAgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIGxvYWRJbWFnZS5FeGlmTWFwLnByb3RvdHlwZS5tYXAgPSB7XG4gICAgJ09yaWVudGF0aW9uJzogMHgwMTEyXG4gIH1cblxuICBsb2FkSW1hZ2UuRXhpZk1hcC5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24gKGlkKSB7XG4gICAgcmV0dXJuIHRoaXNbaWRdIHx8IHRoaXNbdGhpcy5tYXBbaWRdXVxuICB9XG5cbiAgbG9hZEltYWdlLmdldEV4aWZUaHVtYm5haWwgPSBmdW5jdGlvbiAoZGF0YVZpZXcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gICAgdmFyIGhleERhdGEsXG4gICAgICBpLFxuICAgICAgYlxuICAgIGlmICghbGVuZ3RoIHx8IG9mZnNldCArIGxlbmd0aCA+IGRhdGFWaWV3LmJ5dGVMZW5ndGgpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdJbnZhbGlkIEV4aWYgZGF0YTogSW52YWxpZCB0aHVtYm5haWwgZGF0YS4nKVxuICAgICAgcmV0dXJuXG4gICAgfVxuICAgIGhleERhdGEgPSBbXVxuICAgIGZvciAoaSA9IDA7IGkgPCBsZW5ndGg7IGkgKz0gMSkge1xuICAgICAgYiA9IGRhdGFWaWV3LmdldFVpbnQ4KG9mZnNldCArIGkpXG4gICAgICBoZXhEYXRhLnB1c2goKGIgPCAxNiA/ICcwJyA6ICcnKSArIGIudG9TdHJpbmcoMTYpKVxuICAgIH1cbiAgICByZXR1cm4gJ2RhdGE6aW1hZ2UvanBlZywlJyArIGhleERhdGEuam9pbignJScpXG4gIH1cblxuICBsb2FkSW1hZ2UuZXhpZlRhZ1R5cGVzID0ge1xuICAgIC8vIGJ5dGUsIDgtYml0IHVuc2lnbmVkIGludDpcbiAgICAxOiB7XG4gICAgICBnZXRWYWx1ZTogZnVuY3Rpb24gKGRhdGFWaWV3LCBkYXRhT2Zmc2V0KSB7XG4gICAgICAgIHJldHVybiBkYXRhVmlldy5nZXRVaW50OChkYXRhT2Zmc2V0KVxuICAgICAgfSxcbiAgICAgIHNpemU6IDFcbiAgICB9LFxuICAgIC8vIGFzY2lpLCA4LWJpdCBieXRlOlxuICAgIDI6IHtcbiAgICAgIGdldFZhbHVlOiBmdW5jdGlvbiAoZGF0YVZpZXcsIGRhdGFPZmZzZXQpIHtcbiAgICAgICAgcmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUoZGF0YVZpZXcuZ2V0VWludDgoZGF0YU9mZnNldCkpXG4gICAgICB9LFxuICAgICAgc2l6ZTogMSxcbiAgICAgIGFzY2lpOiB0cnVlXG4gICAgfSxcbiAgICAvLyBzaG9ydCwgMTYgYml0IGludDpcbiAgICAzOiB7XG4gICAgICBnZXRWYWx1ZTogZnVuY3Rpb24gKGRhdGFWaWV3LCBkYXRhT2Zmc2V0LCBsaXR0bGVFbmRpYW4pIHtcbiAgICAgICAgcmV0dXJuIGRhdGFWaWV3LmdldFVpbnQxNihkYXRhT2Zmc2V0LCBsaXR0bGVFbmRpYW4pXG4gICAgICB9LFxuICAgICAgc2l6ZTogMlxuICAgIH0sXG4gICAgLy8gbG9uZywgMzIgYml0IGludDpcbiAgICA0OiB7XG4gICAgICBnZXRWYWx1ZTogZnVuY3Rpb24gKGRhdGFWaWV3LCBkYXRhT2Zmc2V0LCBsaXR0bGVFbmRpYW4pIHtcbiAgICAgICAgcmV0dXJuIGRhdGFWaWV3LmdldFVpbnQzMihkYXRhT2Zmc2V0LCBsaXR0bGVFbmRpYW4pXG4gICAgICB9LFxuICAgICAgc2l6ZTogNFxuICAgIH0sXG4gICAgLy8gcmF0aW9uYWwgPSB0d28gbG9uZyB2YWx1ZXMsIGZpcnN0IGlzIG51bWVyYXRvciwgc2Vjb25kIGlzIGRlbm9taW5hdG9yOlxuICAgIDU6IHtcbiAgICAgIGdldFZhbHVlOiBmdW5jdGlvbiAoZGF0YVZpZXcsIGRhdGFPZmZzZXQsIGxpdHRsZUVuZGlhbikge1xuICAgICAgICByZXR1cm4gZGF0YVZpZXcuZ2V0VWludDMyKGRhdGFPZmZzZXQsIGxpdHRsZUVuZGlhbikgL1xuICAgICAgICBkYXRhVmlldy5nZXRVaW50MzIoZGF0YU9mZnNldCArIDQsIGxpdHRsZUVuZGlhbilcbiAgICAgIH0sXG4gICAgICBzaXplOiA4XG4gICAgfSxcbiAgICAvLyBzbG9uZywgMzIgYml0IHNpZ25lZCBpbnQ6XG4gICAgOToge1xuICAgICAgZ2V0VmFsdWU6IGZ1bmN0aW9uIChkYXRhVmlldywgZGF0YU9mZnNldCwgbGl0dGxlRW5kaWFuKSB7XG4gICAgICAgIHJldHVybiBkYXRhVmlldy5nZXRJbnQzMihkYXRhT2Zmc2V0LCBsaXR0bGVFbmRpYW4pXG4gICAgICB9LFxuICAgICAgc2l6ZTogNFxuICAgIH0sXG4gICAgLy8gc3JhdGlvbmFsLCB0d28gc2xvbmdzLCBmaXJzdCBpcyBudW1lcmF0b3IsIHNlY29uZCBpcyBkZW5vbWluYXRvcjpcbiAgICAxMDoge1xuICAgICAgZ2V0VmFsdWU6IGZ1bmN0aW9uIChkYXRhVmlldywgZGF0YU9mZnNldCwgbGl0dGxlRW5kaWFuKSB7XG4gICAgICAgIHJldHVybiBkYXRhVmlldy5nZXRJbnQzMihkYXRhT2Zmc2V0LCBsaXR0bGVFbmRpYW4pIC9cbiAgICAgICAgZGF0YVZpZXcuZ2V0SW50MzIoZGF0YU9mZnNldCArIDQsIGxpdHRsZUVuZGlhbilcbiAgICAgIH0sXG4gICAgICBzaXplOiA4XG4gICAgfVxuICB9XG4gIC8vIHVuZGVmaW5lZCwgOC1iaXQgYnl0ZSwgdmFsdWUgZGVwZW5kaW5nIG9uIGZpZWxkOlxuICBsb2FkSW1hZ2UuZXhpZlRhZ1R5cGVzWzddID0gbG9hZEltYWdlLmV4aWZUYWdUeXBlc1sxXVxuXG4gIGxvYWRJbWFnZS5nZXRFeGlmVmFsdWUgPSBmdW5jdGlvbiAoZGF0YVZpZXcsIHRpZmZPZmZzZXQsIG9mZnNldCwgdHlwZSwgbGVuZ3RoLCBsaXR0bGVFbmRpYW4pIHtcbiAgICB2YXIgdGFnVHlwZSA9IGxvYWRJbWFnZS5leGlmVGFnVHlwZXNbdHlwZV1cbiAgICB2YXIgdGFnU2l6ZVxuICAgIHZhciBkYXRhT2Zmc2V0XG4gICAgdmFyIHZhbHVlc1xuICAgIHZhciBpXG4gICAgdmFyIHN0clxuICAgIHZhciBjXG4gICAgaWYgKCF0YWdUeXBlKSB7XG4gICAgICBjb25zb2xlLmxvZygnSW52YWxpZCBFeGlmIGRhdGE6IEludmFsaWQgdGFnIHR5cGUuJylcbiAgICAgIHJldHVyblxuICAgIH1cbiAgICB0YWdTaXplID0gdGFnVHlwZS5zaXplICogbGVuZ3RoXG4gICAgLy8gRGV0ZXJtaW5lIGlmIHRoZSB2YWx1ZSBpcyBjb250YWluZWQgaW4gdGhlIGRhdGFPZmZzZXQgYnl0ZXMsXG4gICAgLy8gb3IgaWYgdGhlIHZhbHVlIGF0IHRoZSBkYXRhT2Zmc2V0IGlzIGEgcG9pbnRlciB0byB0aGUgYWN0dWFsIGRhdGE6XG4gICAgZGF0YU9mZnNldCA9IHRhZ1NpemUgPiA0XG4gICAgICA/IHRpZmZPZmZzZXQgKyBkYXRhVmlldy5nZXRVaW50MzIob2Zmc2V0ICsgOCwgbGl0dGxlRW5kaWFuKVxuICAgICAgOiAob2Zmc2V0ICsgOClcbiAgICBpZiAoZGF0YU9mZnNldCArIHRhZ1NpemUgPiBkYXRhVmlldy5ieXRlTGVuZ3RoKSB7XG4gICAgICBjb25zb2xlLmxvZygnSW52YWxpZCBFeGlmIGRhdGE6IEludmFsaWQgZGF0YSBvZmZzZXQuJylcbiAgICAgIHJldHVyblxuICAgIH1cbiAgICBpZiAobGVuZ3RoID09PSAxKSB7XG4gICAgICByZXR1cm4gdGFnVHlwZS5nZXRWYWx1ZShkYXRhVmlldywgZGF0YU9mZnNldCwgbGl0dGxlRW5kaWFuKVxuICAgIH1cbiAgICB2YWx1ZXMgPSBbXVxuICAgIGZvciAoaSA9IDA7IGkgPCBsZW5ndGg7IGkgKz0gMSkge1xuICAgICAgdmFsdWVzW2ldID0gdGFnVHlwZS5nZXRWYWx1ZShkYXRhVmlldywgZGF0YU9mZnNldCArIGkgKiB0YWdUeXBlLnNpemUsIGxpdHRsZUVuZGlhbilcbiAgICB9XG4gICAgaWYgKHRhZ1R5cGUuYXNjaWkpIHtcbiAgICAgIHN0ciA9ICcnXG4gICAgICAvLyBDb25jYXRlbmF0ZSB0aGUgY2hhcnM6XG4gICAgICBmb3IgKGkgPSAwOyBpIDwgdmFsdWVzLmxlbmd0aDsgaSArPSAxKSB7XG4gICAgICAgIGMgPSB2YWx1ZXNbaV1cbiAgICAgICAgLy8gSWdub3JlIHRoZSB0ZXJtaW5hdGluZyBOVUxMIGJ5dGUocyk6XG4gICAgICAgIGlmIChjID09PSAnXFx1MDAwMCcpIHtcbiAgICAgICAgICBicmVha1xuICAgICAgICB9XG4gICAgICAgIHN0ciArPSBjXG4gICAgICB9XG4gICAgICByZXR1cm4gc3RyXG4gICAgfVxuICAgIHJldHVybiB2YWx1ZXNcbiAgfVxuXG4gIGxvYWRJbWFnZS5wYXJzZUV4aWZUYWcgPSBmdW5jdGlvbiAoZGF0YVZpZXcsIHRpZmZPZmZzZXQsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBkYXRhKSB7XG4gICAgdmFyIHRhZyA9IGRhdGFWaWV3LmdldFVpbnQxNihvZmZzZXQsIGxpdHRsZUVuZGlhbilcbiAgICBkYXRhLmV4aWZbdGFnXSA9IGxvYWRJbWFnZS5nZXRFeGlmVmFsdWUoXG4gICAgICBkYXRhVmlldyxcbiAgICAgIHRpZmZPZmZzZXQsXG4gICAgICBvZmZzZXQsXG4gICAgICBkYXRhVmlldy5nZXRVaW50MTYob2Zmc2V0ICsgMiwgbGl0dGxlRW5kaWFuKSwgLy8gdGFnIHR5cGVcbiAgICAgIGRhdGFWaWV3LmdldFVpbnQzMihvZmZzZXQgKyA0LCBsaXR0bGVFbmRpYW4pLCAvLyB0YWcgbGVuZ3RoXG4gICAgICBsaXR0bGVFbmRpYW5cbiAgICApXG4gIH1cblxuICBsb2FkSW1hZ2UucGFyc2VFeGlmVGFncyA9IGZ1bmN0aW9uIChkYXRhVmlldywgdGlmZk9mZnNldCwgZGlyT2Zmc2V0LCBsaXR0bGVFbmRpYW4sIGRhdGEpIHtcbiAgICB2YXIgdGFnc051bWJlcixcbiAgICAgIGRpckVuZE9mZnNldCxcbiAgICAgIGlcbiAgICBpZiAoZGlyT2Zmc2V0ICsgNiA+IGRhdGFWaWV3LmJ5dGVMZW5ndGgpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdJbnZhbGlkIEV4aWYgZGF0YTogSW52YWxpZCBkaXJlY3Rvcnkgb2Zmc2V0LicpXG4gICAgICByZXR1cm5cbiAgICB9XG4gICAgdGFnc051bWJlciA9IGRhdGFWaWV3LmdldFVpbnQxNihkaXJPZmZzZXQsIGxpdHRsZUVuZGlhbilcbiAgICBkaXJFbmRPZmZzZXQgPSBkaXJPZmZzZXQgKyAyICsgMTIgKiB0YWdzTnVtYmVyXG4gICAgaWYgKGRpckVuZE9mZnNldCArIDQgPiBkYXRhVmlldy5ieXRlTGVuZ3RoKSB7XG4gICAgICBjb25zb2xlLmxvZygnSW52YWxpZCBFeGlmIGRhdGE6IEludmFsaWQgZGlyZWN0b3J5IHNpemUuJylcbiAgICAgIHJldHVyblxuICAgIH1cbiAgICBmb3IgKGkgPSAwOyBpIDwgdGFnc051bWJlcjsgaSArPSAxKSB7XG4gICAgICB0aGlzLnBhcnNlRXhpZlRhZyhcbiAgICAgICAgZGF0YVZpZXcsXG4gICAgICAgIHRpZmZPZmZzZXQsXG4gICAgICAgIGRpck9mZnNldCArIDIgKyAxMiAqIGksIC8vIHRhZyBvZmZzZXRcbiAgICAgICAgbGl0dGxlRW5kaWFuLFxuICAgICAgICBkYXRhXG4gICAgICApXG4gICAgfVxuICAgIC8vIFJldHVybiB0aGUgb2Zmc2V0IHRvIHRoZSBuZXh0IGRpcmVjdG9yeTpcbiAgICByZXR1cm4gZGF0YVZpZXcuZ2V0VWludDMyKGRpckVuZE9mZnNldCwgbGl0dGxlRW5kaWFuKVxuICB9XG5cbiAgbG9hZEltYWdlLnBhcnNlRXhpZkRhdGEgPSBmdW5jdGlvbiAoZGF0YVZpZXcsIG9mZnNldCwgbGVuZ3RoLCBkYXRhLCBvcHRpb25zKSB7XG4gICAgaWYgKG9wdGlvbnMuZGlzYWJsZUV4aWYpIHtcbiAgICAgIHJldHVyblxuICAgIH1cbiAgICB2YXIgdGlmZk9mZnNldCA9IG9mZnNldCArIDEwXG4gICAgdmFyIGxpdHRsZUVuZGlhblxuICAgIHZhciBkaXJPZmZzZXRcbiAgICB2YXIgdGh1bWJuYWlsRGF0YVxuICAgIC8vIENoZWNrIGZvciB0aGUgQVNDSUkgY29kZSBmb3IgXCJFeGlmXCIgKDB4NDU3ODY5NjYpOlxuICAgIGlmIChkYXRhVmlldy5nZXRVaW50MzIob2Zmc2V0ICsgNCkgIT09IDB4NDU3ODY5NjYpIHtcbiAgICAgIC8vIE5vIEV4aWYgZGF0YSwgbWlnaHQgYmUgWE1QIGRhdGEgaW5zdGVhZFxuICAgICAgcmV0dXJuXG4gICAgfVxuICAgIGlmICh0aWZmT2Zmc2V0ICsgOCA+IGRhdGFWaWV3LmJ5dGVMZW5ndGgpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdJbnZhbGlkIEV4aWYgZGF0YTogSW52YWxpZCBzZWdtZW50IHNpemUuJylcbiAgICAgIHJldHVyblxuICAgIH1cbiAgICAvLyBDaGVjayBmb3IgdGhlIHR3byBudWxsIGJ5dGVzOlxuICAgIGlmIChkYXRhVmlldy5nZXRVaW50MTYob2Zmc2V0ICsgOCkgIT09IDB4MDAwMCkge1xuICAgICAgY29uc29sZS5sb2coJ0ludmFsaWQgRXhpZiBkYXRhOiBNaXNzaW5nIGJ5dGUgYWxpZ25tZW50IG9mZnNldC4nKVxuICAgICAgcmV0dXJuXG4gICAgfVxuICAgIC8vIENoZWNrIHRoZSBieXRlIGFsaWdubWVudDpcbiAgICBzd2l0Y2ggKGRhdGFWaWV3LmdldFVpbnQxNih0aWZmT2Zmc2V0KSkge1xuICAgICAgY2FzZSAweDQ5NDk6XG4gICAgICAgIGxpdHRsZUVuZGlhbiA9IHRydWVcbiAgICAgICAgYnJlYWtcbiAgICAgIGNhc2UgMHg0RDREOlxuICAgICAgICBsaXR0bGVFbmRpYW4gPSBmYWxzZVxuICAgICAgICBicmVha1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgY29uc29sZS5sb2coJ0ludmFsaWQgRXhpZiBkYXRhOiBJbnZhbGlkIGJ5dGUgYWxpZ25tZW50IG1hcmtlci4nKVxuICAgICAgICByZXR1cm5cbiAgICB9XG4gICAgLy8gQ2hlY2sgZm9yIHRoZSBUSUZGIHRhZyBtYXJrZXIgKDB4MDAyQSk6XG4gICAgaWYgKGRhdGFWaWV3LmdldFVpbnQxNih0aWZmT2Zmc2V0ICsgMiwgbGl0dGxlRW5kaWFuKSAhPT0gMHgwMDJBKSB7XG4gICAgICBjb25zb2xlLmxvZygnSW52YWxpZCBFeGlmIGRhdGE6IE1pc3NpbmcgVElGRiBtYXJrZXIuJylcbiAgICAgIHJldHVyblxuICAgIH1cbiAgICAvLyBSZXRyaWV2ZSB0aGUgZGlyZWN0b3J5IG9mZnNldCBieXRlcywgdXN1YWxseSAweDAwMDAwMDA4IG9yIDggZGVjaW1hbDpcbiAgICBkaXJPZmZzZXQgPSBkYXRhVmlldy5nZXRVaW50MzIodGlmZk9mZnNldCArIDQsIGxpdHRsZUVuZGlhbilcbiAgICAvLyBDcmVhdGUgdGhlIGV4aWYgb2JqZWN0IHRvIHN0b3JlIHRoZSB0YWdzOlxuICAgIGRhdGEuZXhpZiA9IG5ldyBsb2FkSW1hZ2UuRXhpZk1hcCgpXG4gICAgLy8gUGFyc2UgdGhlIHRhZ3Mgb2YgdGhlIG1haW4gaW1hZ2UgZGlyZWN0b3J5IGFuZCByZXRyaWV2ZSB0aGVcbiAgICAvLyBvZmZzZXQgdG8gdGhlIG5leHQgZGlyZWN0b3J5LCB1c3VhbGx5IHRoZSB0aHVtYm5haWwgZGlyZWN0b3J5OlxuICAgIGRpck9mZnNldCA9IGxvYWRJbWFnZS5wYXJzZUV4aWZUYWdzKFxuICAgICAgZGF0YVZpZXcsXG4gICAgICB0aWZmT2Zmc2V0LFxuICAgICAgdGlmZk9mZnNldCArIGRpck9mZnNldCxcbiAgICAgIGxpdHRsZUVuZGlhbixcbiAgICAgIGRhdGFcbiAgICApXG4gICAgaWYgKGRpck9mZnNldCAmJiAhb3B0aW9ucy5kaXNhYmxlRXhpZlRodW1ibmFpbCkge1xuICAgICAgdGh1bWJuYWlsRGF0YSA9IHtleGlmOiB7fX1cbiAgICAgIGRpck9mZnNldCA9IGxvYWRJbWFnZS5wYXJzZUV4aWZUYWdzKFxuICAgICAgICBkYXRhVmlldyxcbiAgICAgICAgdGlmZk9mZnNldCxcbiAgICAgICAgdGlmZk9mZnNldCArIGRpck9mZnNldCxcbiAgICAgICAgbGl0dGxlRW5kaWFuLFxuICAgICAgICB0aHVtYm5haWxEYXRhXG4gICAgICApXG4gICAgICAvLyBDaGVjayBmb3IgSlBFRyBUaHVtYm5haWwgb2Zmc2V0OlxuICAgICAgaWYgKHRodW1ibmFpbERhdGEuZXhpZlsweDAyMDFdKSB7XG4gICAgICAgIGRhdGEuZXhpZi5UaHVtYm5haWwgPSBsb2FkSW1hZ2UuZ2V0RXhpZlRodW1ibmFpbChcbiAgICAgICAgICBkYXRhVmlldyxcbiAgICAgICAgICB0aWZmT2Zmc2V0ICsgdGh1bWJuYWlsRGF0YS5leGlmWzB4MDIwMV0sXG4gICAgICAgICAgdGh1bWJuYWlsRGF0YS5leGlmWzB4MDIwMl0gLy8gVGh1bWJuYWlsIGRhdGEgbGVuZ3RoXG4gICAgICAgIClcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gQ2hlY2sgZm9yIEV4aWYgU3ViIElGRCBQb2ludGVyOlxuICAgIGlmIChkYXRhLmV4aWZbMHg4NzY5XSAmJiAhb3B0aW9ucy5kaXNhYmxlRXhpZlN1Yikge1xuICAgICAgbG9hZEltYWdlLnBhcnNlRXhpZlRhZ3MoXG4gICAgICAgIGRhdGFWaWV3LFxuICAgICAgICB0aWZmT2Zmc2V0LFxuICAgICAgICB0aWZmT2Zmc2V0ICsgZGF0YS5leGlmWzB4ODc2OV0sIC8vIGRpcmVjdG9yeSBvZmZzZXRcbiAgICAgICAgbGl0dGxlRW5kaWFuLFxuICAgICAgICBkYXRhXG4gICAgICApXG4gICAgfVxuICAgIC8vIENoZWNrIGZvciBHUFMgSW5mbyBJRkQgUG9pbnRlcjpcbiAgICBpZiAoZGF0YS5leGlmWzB4ODgyNV0gJiYgIW9wdGlvbnMuZGlzYWJsZUV4aWZHcHMpIHtcbiAgICAgIGxvYWRJbWFnZS5wYXJzZUV4aWZUYWdzKFxuICAgICAgICBkYXRhVmlldyxcbiAgICAgICAgdGlmZk9mZnNldCxcbiAgICAgICAgdGlmZk9mZnNldCArIGRhdGEuZXhpZlsweDg4MjVdLCAvLyBkaXJlY3Rvcnkgb2Zmc2V0XG4gICAgICAgIGxpdHRsZUVuZGlhbixcbiAgICAgICAgZGF0YVxuICAgICAgKVxuICAgIH1cbiAgfVxuXG4gIC8vIFJlZ2lzdGVycyB0aGUgRXhpZiBwYXJzZXIgZm9yIHRoZSBBUFAxIEpQRUcgbWV0YSBkYXRhIHNlZ21lbnQ6XG4gIGxvYWRJbWFnZS5tZXRhRGF0YVBhcnNlcnMuanBlZ1sweGZmZTFdLnB1c2gobG9hZEltYWdlLnBhcnNlRXhpZkRhdGEpXG5cbiAgLy8gQWRkcyB0aGUgZm9sbG93aW5nIHByb3BlcnRpZXMgdG8gdGhlIHBhcnNlTWV0YURhdGEgY2FsbGJhY2sgZGF0YTpcbiAgLy8gKiBleGlmOiBUaGUgZXhpZiB0YWdzLCBwYXJzZWQgYnkgdGhlIHBhcnNlRXhpZkRhdGEgbWV0aG9kXG5cbiAgLy8gQWRkcyB0aGUgZm9sbG93aW5nIG9wdGlvbnMgdG8gdGhlIHBhcnNlTWV0YURhdGEgbWV0aG9kOlxuICAvLyAqIGRpc2FibGVFeGlmOiBEaXNhYmxlcyBFeGlmIHBhcnNpbmcuXG4gIC8vICogZGlzYWJsZUV4aWZUaHVtYm5haWw6IERpc2FibGVzIHBhcnNpbmcgb2YgdGhlIEV4aWYgVGh1bWJuYWlsLlxuICAvLyAqIGRpc2FibGVFeGlmU3ViOiBEaXNhYmxlcyBwYXJzaW5nIG9mIHRoZSBFeGlmIFN1YiBJRkQuXG4gIC8vICogZGlzYWJsZUV4aWZHcHM6IERpc2FibGVzIHBhcnNpbmcgb2YgdGhlIEV4aWYgR1BTIEluZm8gSUZELlxufSkpXG4iLCIvKlxuICogSmF2YVNjcmlwdCBMb2FkIEltYWdlIE1ldGFcbiAqIGh0dHBzOi8vZ2l0aHViLmNvbS9ibHVlaW1wL0phdmFTY3JpcHQtTG9hZC1JbWFnZVxuICpcbiAqIENvcHlyaWdodCAyMDEzLCBTZWJhc3RpYW4gVHNjaGFuXG4gKiBodHRwczovL2JsdWVpbXAubmV0XG4gKlxuICogSW1hZ2UgbWV0YSBkYXRhIGhhbmRsaW5nIGltcGxlbWVudGF0aW9uXG4gKiBiYXNlZCBvbiB0aGUgaGVscCBhbmQgY29udHJpYnV0aW9uIG9mXG4gKiBBY2hpbSBTdMO2aHIuXG4gKlxuICogTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBsaWNlbnNlOlxuICogaHR0cDovL3d3dy5vcGVuc291cmNlLm9yZy9saWNlbnNlcy9NSVRcbiAqL1xuXG4gIC8qZ2xvYmFsIGRlZmluZSwgbW9kdWxlLCByZXF1aXJlLCB3aW5kb3csIERhdGFWaWV3LCBCbG9iLCBVaW50OEFycmF5LCBjb25zb2xlICovKGZ1bmN0aW9uIChmYWN0b3J5KSB7XG4gICd1c2Ugc3RyaWN0JztcbiAgaWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCkge1xuICAgIC8vIFJlZ2lzdGVyIGFzIGFuIGFub255bW91cyBBTUQgbW9kdWxlOlxuICAgIGRlZmluZShbJy4vbG9hZC1pbWFnZSddLCBmYWN0b3J5KTtcbiAgfSBlbHNlIGlmICh0eXBlb2YgbW9kdWxlID09PSAnb2JqZWN0JyAmJiBtb2R1bGUuZXhwb3J0cykge1xuICAgIGZhY3RvcnkocmVxdWlyZSgnLi9sb2FkLWltYWdlJykpO1xuICB9IGVsc2Uge1xuICAgIC8vIEJyb3dzZXIgZ2xvYmFsczpcbiAgICBmYWN0b3J5KHdpbmRvdy5sb2FkSW1hZ2UpO1xuICB9XG59KGZ1bmN0aW9uIChsb2FkSW1hZ2UpIHtcbiAgJ3VzZSBzdHJpY3QnO1xuXG4gIHZhciBoYXNibG9iU2xpY2UgPSB3aW5kb3cuQmxvYiAmJiAoQmxvYi5wcm90b3R5cGUuc2xpY2UgfHxcbiAgICBCbG9iLnByb3RvdHlwZS53ZWJraXRTbGljZSB8fCBCbG9iLnByb3RvdHlwZS5tb3pTbGljZSk7XG5cbiAgbG9hZEltYWdlLmJsb2JTbGljZSA9IGhhc2Jsb2JTbGljZSAmJiBmdW5jdGlvbiAoKSB7XG4gICAgICB2YXIgc2xpY2UgPSB0aGlzLnNsaWNlIHx8IHRoaXMud2Via2l0U2xpY2UgfHwgdGhpcy5tb3pTbGljZTtcbiAgICAgIHJldHVybiBzbGljZS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICB9O1xuXG4gIGxvYWRJbWFnZS5tZXRhRGF0YVBhcnNlcnMgPSB7XG4gICAganBlZzoge1xuICAgICAgLy8gMHhmZmUwOiBbXSwgLy8gQVBQMCBtYXJrZXJcbiAgICAgIDB4ZmZlMTogW10sIC8vIEFQUDEgbWFya2VyXG4gICAgICAvLyAweGZmZTI6IFtdLCAvLyBBUFAyIG1hcmtlclxuICAgICAgLy8gMHhmZmUzOiBbXSwgLy8gQVBQMyBtYXJrZXJcbiAgICAgIC8vIDB4ZmZlYzogW10sIC8vIEFQUDEyIG1hcmtlclxuICAgICAgLy8gMHhmZmVkOiBbXSwgLy8gQVBQMTMgbWFya2VyXG4gICAgICAvLyAweGZmZWU6IFtdLCAvLyBBUFAxNCBtYXJrZXJcbiAgICB9XG4gIH07XG5cbiAgLy8gUGFyc2VzIGltYWdlIG1ldGEgZGF0YSBhbmQgY2FsbHMgdGhlIGNhbGxiYWNrIHdpdGggYW4gb2JqZWN0IGFyZ3VtZW50XG4gIC8vIHdpdGggdGhlIGZvbGxvd2luZyBwcm9wZXJ0aWVzOlxuICAvLyAqIGltYWdlSGVhZDogVGhlIGNvbXBsZXRlIGltYWdlIGhlYWQgYXMgQXJyYXlCdWZmZXIgKFVpbnQ4QXJyYXkgZm9yIElFMTApXG4gIC8vIFRoZSBvcHRpb25zIGFyZ3VtZW50cyBhY2NlcHRzIGFuIG9iamVjdCBhbmQgc3VwcG9ydHMgdGhlIGZvbGxvd2luZyBwcm9wZXJ0aWVzOlxuICAvLyAqIG1heE1ldGFEYXRhU2l6ZTogRGVmaW5lcyB0aGUgbWF4aW11bSBudW1iZXIgb2YgYnl0ZXMgdG8gcGFyc2UuXG4gIC8vICogZGlzYWJsZUltYWdlSGVhZDogRGlzYWJsZXMgY3JlYXRpbmcgdGhlIGltYWdlSGVhZCBwcm9wZXJ0eS5cbiAgbG9hZEltYWdlLnBhcnNlTWV0YURhdGEgPSBmdW5jdGlvbiAoZmlsZSwgY2FsbGJhY2ssIG9wdGlvbnMpIHtcbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgICB2YXIgdGhhdCA9IHRoaXM7XG4gICAgLy8gMjU2IEtpQiBzaG91bGQgY29udGFpbiBhbGwgRVhJRi9JQ0MvSVBUQyBzZWdtZW50czpcbiAgICB2YXIgbWF4TWV0YURhdGFTaXplID0gb3B0aW9ucy5tYXhNZXRhRGF0YVNpemUgfHwgMjYyMTQ0O1xuICAgIG1heE1ldGFEYXRhU2l6ZSA9IE1hdGgubWluKGZpbGUuc2l6ZSwgbWF4TWV0YURhdGFTaXplKTtcbiAgICB2YXIgZGF0YSA9IHt9O1xuICAgIHZhciBub01ldGFEYXRhID0gISh3aW5kb3cuRGF0YVZpZXcgJiYgZmlsZSAmJiBmaWxlLnNpemUgPj0gMTIgJiZcbiAgICAgIGZpbGUudHlwZSA9PT0gJ2ltYWdlL2pwZWcnICYmIGxvYWRJbWFnZS5ibG9iU2xpY2UpO1xuICAgIGlmIChub01ldGFEYXRhIHx8ICFsb2FkSW1hZ2UucmVhZEZpbGUoXG4gICAgICAgIGxvYWRJbWFnZS5ibG9iU2xpY2UuY2FsbChmaWxlLCAwLCBtYXhNZXRhRGF0YVNpemUpLFxuICAgICAgICBmdW5jdGlvbiAoZSkge1xuICAgICAgICAgIGlmIChlLnRhcmdldC5lcnJvcikge1xuICAgICAgICAgICAgLy8gRmlsZVJlYWRlciBlcnJvclxuICAgICAgICAgICAgY29uc29sZS5sb2coZS50YXJnZXQuZXJyb3IpO1xuICAgICAgICAgICAgY2FsbGJhY2soZGF0YSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIE5vdGUgb24gZW5kaWFubmVzczpcbiAgICAgICAgICAvLyBTaW5jZSB0aGUgbWFya2VyIGFuZCBsZW5ndGggYnl0ZXMgaW4gSlBFRyBmaWxlcyBhcmUgYWx3YXlzXG4gICAgICAgICAgLy8gc3RvcmVkIGluIGJpZyBlbmRpYW4gb3JkZXIsIHdlIGNhbiBsZWF2ZSB0aGUgZW5kaWFuIHBhcmFtZXRlclxuICAgICAgICAgIC8vIG9mIHRoZSBEYXRhVmlldyBtZXRob2RzIHVuZGVmaW5lZCwgZGVmYXVsdGluZyB0byBiaWcgZW5kaWFuLlxuICAgICAgICAgIHZhciBidWZmZXIgPSBlLnRhcmdldC5yZXN1bHQ7XG4gICAgICAgICAgdmFyIGRhdGFWaWV3ID0gbmV3IERhdGFWaWV3KGJ1ZmZlcik7XG4gICAgICAgICAgdmFyIG9mZnNldCA9IDI7XG4gICAgICAgICAgdmFyIG1heE9mZnNldCA9IGRhdGFWaWV3LmJ5dGVMZW5ndGggLSA0O1xuICAgICAgICAgIHZhciBoZWFkTGVuZ3RoID0gb2Zmc2V0O1xuICAgICAgICAgIHZhciBtYXJrZXJCeXRlcztcbiAgICAgICAgICB2YXIgbWFya2VyTGVuZ3RoO1xuICAgICAgICAgIHZhciBwYXJzZXJzO1xuICAgICAgICAgIHZhciBpO1xuICAgICAgICAgIC8vIENoZWNrIGZvciB0aGUgSlBFRyBtYXJrZXIgKDB4ZmZkOCk6XG4gICAgICAgICAgaWYgKGRhdGFWaWV3LmdldFVpbnQxNigwKSA9PT0gMHhmZmQ4KSB7XG4gICAgICAgICAgICB3aGlsZSAob2Zmc2V0IDwgbWF4T2Zmc2V0KSB7XG4gICAgICAgICAgICAgIG1hcmtlckJ5dGVzID0gZGF0YVZpZXcuZ2V0VWludDE2KG9mZnNldCk7XG4gICAgICAgICAgICAgIC8vIFNlYXJjaCBmb3IgQVBQbiAoMHhmZmVOKSBhbmQgQ09NICgweGZmZmUpIG1hcmtlcnMsXG4gICAgICAgICAgICAgIC8vIHdoaWNoIGNvbnRhaW4gYXBwbGljYXRpb24tc3BlY2lmaWMgbWV0YS1kYXRhIGxpa2VcbiAgICAgICAgICAgICAgLy8gRXhpZiwgSUNDIGFuZCBJUFRDIGRhdGEgYW5kIHRleHQgY29tbWVudHM6XG4gICAgICAgICAgICAgIGlmICgobWFya2VyQnl0ZXMgPj0gMHhmZmUwICYmIG1hcmtlckJ5dGVzIDw9IDB4ZmZlZCkgfHxcbiAgICAgICAgICAgICAgICBtYXJrZXJCeXRlcyA9PT0gMHhmZmZlKSB7XG4gICAgICAgICAgICAgICAgLy8gVGhlIG1hcmtlciBieXRlcyAoMikgYXJlIGFsd2F5cyBmb2xsb3dlZCBieVxuICAgICAgICAgICAgICAgIC8vIHRoZSBsZW5ndGggYnl0ZXMgKDIpLCBpbmRpY2F0aW5nIHRoZSBsZW5ndGggb2YgdGhlXG4gICAgICAgICAgICAgICAgLy8gbWFya2VyIHNlZ21lbnQsIHdoaWNoIGluY2x1ZGVzIHRoZSBsZW5ndGggYnl0ZXMsXG4gICAgICAgICAgICAgICAgLy8gYnV0IG5vdCB0aGUgbWFya2VyIGJ5dGVzLCBzbyB3ZSBhZGQgMjpcbiAgICAgICAgICAgICAgICBtYXJrZXJMZW5ndGggPSBkYXRhVmlldy5nZXRVaW50MTYob2Zmc2V0ICsgMikgKyAyO1xuXG4gICAgICAgICAgICAgICAgaWYgKG9mZnNldCArIG1hcmtlckxlbmd0aCA+IGRhdGFWaWV3LmJ5dGVMZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdJbnZhbGlkIG1ldGEgZGF0YTogSW52YWxpZCBzZWdtZW50IHNpemUuJyk7XG4gICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBwYXJzZXJzID0gbG9hZEltYWdlLm1ldGFEYXRhUGFyc2Vycy5qcGVnW21hcmtlckJ5dGVzXTtcblxuICAgICAgICAgICAgICAgIGlmIChwYXJzZXJzKSB7XG4gICAgICAgICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgcGFyc2Vycy5sZW5ndGg7IGkgKz0gMSkge1xuICAgICAgICAgICAgICAgICAgICBwYXJzZXJzW2ldLmNhbGwoXG4gICAgICAgICAgICAgICAgICAgICAgdGhhdCxcbiAgICAgICAgICAgICAgICAgICAgICBkYXRhVmlldyxcbiAgICAgICAgICAgICAgICAgICAgICBvZmZzZXQsXG4gICAgICAgICAgICAgICAgICAgICAgbWFya2VyTGVuZ3RoLFxuICAgICAgICAgICAgICAgICAgICAgIGRhdGEsXG4gICAgICAgICAgICAgICAgICAgICAgb3B0aW9uc1xuICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIG9mZnNldCArPSBtYXJrZXJMZW5ndGg7XG4gICAgICAgICAgICAgICAgaGVhZExlbmd0aCA9IG9mZnNldDtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBOb3QgYW4gQVBQbiBvciBDT00gbWFya2VyLCBwcm9iYWJseSBzYWZlIHRvXG4gICAgICAgICAgICAgICAgLy8gYXNzdW1lIHRoYXQgdGhpcyBpcyB0aGUgZW5kIG9mIHRoZSBtZXRhIGRhdGFcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gTWV0YSBsZW5ndGggbXVzdCBiZSBsb25nZXIgdGhhbiBKUEVHIG1hcmtlciAoMilcbiAgICAgICAgICAgIC8vIHBsdXMgQVBQbiBtYXJrZXIgKDIpLCBmb2xsb3dlZCBieSBsZW5ndGggYnl0ZXMgKDIpOlxuICAgICAgICAgICAgaWYgKCFvcHRpb25zLmRpc2FibGVJbWFnZUhlYWQgJiYgaGVhZExlbmd0aCA+IDYpIHtcbiAgICAgICAgICAgICAgaWYgKGJ1ZmZlci5zbGljZSkge1xuICAgICAgICAgICAgICAgIGRhdGEuaW1hZ2VIZWFkID0gYnVmZmVyLnNsaWNlKDAsIGhlYWRMZW5ndGgpO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIFdvcmthcm91bmQgZm9yIElFMTAsIHdoaWNoIGRvZXMgbm90IHlldFxuICAgICAgICAgICAgICAgIC8vIHN1cHBvcnQgQXJyYXlCdWZmZXIuc2xpY2U6XG4gICAgICAgICAgICAgICAgZGF0YS5pbWFnZUhlYWQgPSBuZXcgVWludDhBcnJheShidWZmZXIpXG4gICAgICAgICAgICAgICAgICAuc3ViYXJyYXkoMCwgaGVhZExlbmd0aCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ0ludmFsaWQgSlBFRyBmaWxlOiBNaXNzaW5nIEpQRUcgbWFya2VyLicpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjYWxsYmFjayhkYXRhKTtcbiAgICAgICAgfSxcbiAgICAgICAgJ3JlYWRBc0FycmF5QnVmZmVyJ1xuICAgICAgKSkge1xuICAgICAgY2FsbGJhY2soZGF0YSk7XG4gICAgfVxuICB9O1xufSkpO1xuIiwiLypcbiAqIEphdmFTY3JpcHQgTG9hZCBJbWFnZSBPcmllbnRhdGlvblxuICogaHR0cHM6Ly9naXRodWIuY29tL2JsdWVpbXAvSmF2YVNjcmlwdC1Mb2FkLUltYWdlXG4gKlxuICogQ29weXJpZ2h0IDIwMTMsIFNlYmFzdGlhbiBUc2NoYW5cbiAqIGh0dHBzOi8vYmx1ZWltcC5uZXRcbiAqXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIGxpY2Vuc2U6XG4gKiBodHRwOi8vd3d3Lm9wZW5zb3VyY2Uub3JnL2xpY2Vuc2VzL01JVFxuICovXG5cbi8qZ2xvYmFsIGRlZmluZSwgbW9kdWxlLCByZXF1aXJlLCB3aW5kb3cgKi9cblxuOyhmdW5jdGlvbiAoZmFjdG9yeSkge1xuICAndXNlIHN0cmljdCdcbiAgaWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCkge1xuICAgIC8vIFJlZ2lzdGVyIGFzIGFuIGFub255bW91cyBBTUQgbW9kdWxlOlxuICAgIGRlZmluZShbJy4vbG9hZC1pbWFnZSddLCBmYWN0b3J5KVxuICB9IGVsc2UgaWYgKHR5cGVvZiBtb2R1bGUgPT09ICdvYmplY3QnICYmIG1vZHVsZS5leHBvcnRzKSB7XG4gICAgZmFjdG9yeShyZXF1aXJlKCcuL2xvYWQtaW1hZ2UnKSlcbiAgfSBlbHNlIHtcbiAgICAvLyBCcm93c2VyIGdsb2JhbHM6XG4gICAgZmFjdG9yeSh3aW5kb3cubG9hZEltYWdlKVxuICB9XG59KGZ1bmN0aW9uIChsb2FkSW1hZ2UpIHtcbiAgJ3VzZSBzdHJpY3QnXG5cbiAgdmFyIG9yaWdpbmFsSGFzQ2FudmFzT3B0aW9uID0gbG9hZEltYWdlLmhhc0NhbnZhc09wdGlvblxuICB2YXIgb3JpZ2luYWxUcmFuc2Zvcm1Db29yZGluYXRlcyA9IGxvYWRJbWFnZS50cmFuc2Zvcm1Db29yZGluYXRlc1xuICB2YXIgb3JpZ2luYWxHZXRUcmFuc2Zvcm1lZE9wdGlvbnMgPSBsb2FkSW1hZ2UuZ2V0VHJhbnNmb3JtZWRPcHRpb25zXG5cbiAgLy8gVGhpcyBtZXRob2QgaXMgdXNlZCB0byBkZXRlcm1pbmUgaWYgdGhlIHRhcmdldCBpbWFnZVxuICAvLyBzaG91bGQgYmUgYSBjYW52YXMgZWxlbWVudDpcbiAgbG9hZEltYWdlLmhhc0NhbnZhc09wdGlvbiA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgcmV0dXJuICEhb3B0aW9ucy5vcmllbnRhdGlvbiB8fFxuICAgICAgb3JpZ2luYWxIYXNDYW52YXNPcHRpb24uY2FsbChsb2FkSW1hZ2UsIG9wdGlvbnMpXG4gIH1cblxuICAvLyBUcmFuc2Zvcm0gaW1hZ2Ugb3JpZW50YXRpb24gYmFzZWQgb25cbiAgLy8gdGhlIGdpdmVuIEVYSUYgb3JpZW50YXRpb24gb3B0aW9uOlxuICBsb2FkSW1hZ2UudHJhbnNmb3JtQ29vcmRpbmF0ZXMgPSBmdW5jdGlvbiAoY2FudmFzLCBvcHRpb25zKSB7XG4gICAgb3JpZ2luYWxUcmFuc2Zvcm1Db29yZGluYXRlcy5jYWxsKGxvYWRJbWFnZSwgY2FudmFzLCBvcHRpb25zKVxuICAgIHZhciBjdHggPSBjYW52YXMuZ2V0Q29udGV4dCgnMmQnKVxuICAgIHZhciB3aWR0aCA9IGNhbnZhcy53aWR0aFxuICAgIHZhciBoZWlnaHQgPSBjYW52YXMuaGVpZ2h0XG4gICAgdmFyIHN0eWxlV2lkdGggPSBjYW52YXMuc3R5bGUud2lkdGhcbiAgICB2YXIgc3R5bGVIZWlnaHQgPSBjYW52YXMuc3R5bGUuaGVpZ2h0XG4gICAgdmFyIG9yaWVudGF0aW9uID0gb3B0aW9ucy5vcmllbnRhdGlvblxuICAgIGlmICghb3JpZW50YXRpb24gfHwgb3JpZW50YXRpb24gPiA4KSB7XG4gICAgICByZXR1cm5cbiAgICB9XG4gICAgaWYgKG9yaWVudGF0aW9uID4gNCkge1xuICAgICAgY2FudmFzLndpZHRoID0gaGVpZ2h0XG4gICAgICBjYW52YXMuaGVpZ2h0ID0gd2lkdGhcbiAgICAgIGNhbnZhcy5zdHlsZS53aWR0aCA9IHN0eWxlSGVpZ2h0XG4gICAgICBjYW52YXMuc3R5bGUuaGVpZ2h0ID0gc3R5bGVXaWR0aFxuICAgIH1cbiAgICBzd2l0Y2ggKG9yaWVudGF0aW9uKSB7XG4gICAgICBjYXNlIDI6XG4gICAgICAgIC8vIGhvcml6b250YWwgZmxpcFxuICAgICAgICBjdHgudHJhbnNsYXRlKHdpZHRoLCAwKVxuICAgICAgICBjdHguc2NhbGUoLTEsIDEpXG4gICAgICAgIGJyZWFrXG4gICAgICBjYXNlIDM6XG4gICAgICAgIC8vIDE4MMKwIHJvdGF0ZSBsZWZ0XG4gICAgICAgIGN0eC50cmFuc2xhdGUod2lkdGgsIGhlaWdodClcbiAgICAgICAgY3R4LnJvdGF0ZShNYXRoLlBJKVxuICAgICAgICBicmVha1xuICAgICAgY2FzZSA0OlxuICAgICAgICAvLyB2ZXJ0aWNhbCBmbGlwXG4gICAgICAgIGN0eC50cmFuc2xhdGUoMCwgaGVpZ2h0KVxuICAgICAgICBjdHguc2NhbGUoMSwgLTEpXG4gICAgICAgIGJyZWFrXG4gICAgICBjYXNlIDU6XG4gICAgICAgIC8vIHZlcnRpY2FsIGZsaXAgKyA5MCByb3RhdGUgcmlnaHRcbiAgICAgICAgY3R4LnJvdGF0ZSgwLjUgKiBNYXRoLlBJKVxuICAgICAgICBjdHguc2NhbGUoMSwgLTEpXG4gICAgICAgIGJyZWFrXG4gICAgICBjYXNlIDY6XG4gICAgICAgIC8vIDkwwrAgcm90YXRlIHJpZ2h0XG4gICAgICAgIGN0eC5yb3RhdGUoMC41ICogTWF0aC5QSSlcbiAgICAgICAgY3R4LnRyYW5zbGF0ZSgwLCAtaGVpZ2h0KVxuICAgICAgICBicmVha1xuICAgICAgY2FzZSA3OlxuICAgICAgICAvLyBob3Jpem9udGFsIGZsaXAgKyA5MCByb3RhdGUgcmlnaHRcbiAgICAgICAgY3R4LnJvdGF0ZSgwLjUgKiBNYXRoLlBJKVxuICAgICAgICBjdHgudHJhbnNsYXRlKHdpZHRoLCAtaGVpZ2h0KVxuICAgICAgICBjdHguc2NhbGUoLTEsIDEpXG4gICAgICAgIGJyZWFrXG4gICAgICBjYXNlIDg6XG4gICAgICAgIC8vIDkwwrAgcm90YXRlIGxlZnRcbiAgICAgICAgY3R4LnJvdGF0ZSgtMC41ICogTWF0aC5QSSlcbiAgICAgICAgY3R4LnRyYW5zbGF0ZSgtd2lkdGgsIDApXG4gICAgICAgIGJyZWFrXG4gICAgfVxuICB9XG5cbiAgLy8gVHJhbnNmb3JtcyBjb29yZGluYXRlIGFuZCBkaW1lbnNpb24gb3B0aW9uc1xuICAvLyBiYXNlZCBvbiB0aGUgZ2l2ZW4gb3JpZW50YXRpb24gb3B0aW9uOlxuICBsb2FkSW1hZ2UuZ2V0VHJhbnNmb3JtZWRPcHRpb25zID0gZnVuY3Rpb24gKGltZywgb3B0cykge1xuICAgIHZhciBvcHRpb25zID0gb3JpZ2luYWxHZXRUcmFuc2Zvcm1lZE9wdGlvbnMuY2FsbChsb2FkSW1hZ2UsIGltZywgb3B0cylcbiAgICB2YXIgb3JpZW50YXRpb24gPSBvcHRpb25zLm9yaWVudGF0aW9uXG4gICAgdmFyIG5ld09wdGlvbnNcbiAgICB2YXIgaVxuICAgIGlmICghb3JpZW50YXRpb24gfHwgb3JpZW50YXRpb24gPiA4IHx8IG9yaWVudGF0aW9uID09PSAxKSB7XG4gICAgICByZXR1cm4gb3B0aW9uc1xuICAgIH1cbiAgICBuZXdPcHRpb25zID0ge31cbiAgICBmb3IgKGkgaW4gb3B0aW9ucykge1xuICAgICAgaWYgKG9wdGlvbnMuaGFzT3duUHJvcGVydHkoaSkpIHtcbiAgICAgICAgbmV3T3B0aW9uc1tpXSA9IG9wdGlvbnNbaV1cbiAgICAgIH1cbiAgICB9XG4gICAgc3dpdGNoIChvcHRpb25zLm9yaWVudGF0aW9uKSB7XG4gICAgICBjYXNlIDI6XG4gICAgICAgIC8vIGhvcml6b250YWwgZmxpcFxuICAgICAgICBuZXdPcHRpb25zLmxlZnQgPSBvcHRpb25zLnJpZ2h0XG4gICAgICAgIG5ld09wdGlvbnMucmlnaHQgPSBvcHRpb25zLmxlZnRcbiAgICAgICAgYnJlYWtcbiAgICAgIGNhc2UgMzpcbiAgICAgICAgLy8gMTgwwrAgcm90YXRlIGxlZnRcbiAgICAgICAgbmV3T3B0aW9ucy5sZWZ0ID0gb3B0aW9ucy5yaWdodFxuICAgICAgICBuZXdPcHRpb25zLnRvcCA9IG9wdGlvbnMuYm90dG9tXG4gICAgICAgIG5ld09wdGlvbnMucmlnaHQgPSBvcHRpb25zLmxlZnRcbiAgICAgICAgbmV3T3B0aW9ucy5ib3R0b20gPSBvcHRpb25zLnRvcFxuICAgICAgICBicmVha1xuICAgICAgY2FzZSA0OlxuICAgICAgICAvLyB2ZXJ0aWNhbCBmbGlwXG4gICAgICAgIG5ld09wdGlvbnMudG9wID0gb3B0aW9ucy5ib3R0b21cbiAgICAgICAgbmV3T3B0aW9ucy5ib3R0b20gPSBvcHRpb25zLnRvcFxuICAgICAgICBicmVha1xuICAgICAgY2FzZSA1OlxuICAgICAgICAvLyB2ZXJ0aWNhbCBmbGlwICsgOTAgcm90YXRlIHJpZ2h0XG4gICAgICAgIG5ld09wdGlvbnMubGVmdCA9IG9wdGlvbnMudG9wXG4gICAgICAgIG5ld09wdGlvbnMudG9wID0gb3B0aW9ucy5sZWZ0XG4gICAgICAgIG5ld09wdGlvbnMucmlnaHQgPSBvcHRpb25zLmJvdHRvbVxuICAgICAgICBuZXdPcHRpb25zLmJvdHRvbSA9IG9wdGlvbnMucmlnaHRcbiAgICAgICAgYnJlYWtcbiAgICAgIGNhc2UgNjpcbiAgICAgICAgLy8gOTDCsCByb3RhdGUgcmlnaHRcbiAgICAgICAgbmV3T3B0aW9ucy5sZWZ0ID0gb3B0aW9ucy50b3BcbiAgICAgICAgbmV3T3B0aW9ucy50b3AgPSBvcHRpb25zLnJpZ2h0XG4gICAgICAgIG5ld09wdGlvbnMucmlnaHQgPSBvcHRpb25zLmJvdHRvbVxuICAgICAgICBuZXdPcHRpb25zLmJvdHRvbSA9IG9wdGlvbnMubGVmdFxuICAgICAgICBicmVha1xuICAgICAgY2FzZSA3OlxuICAgICAgICAvLyBob3Jpem9udGFsIGZsaXAgKyA5MCByb3RhdGUgcmlnaHRcbiAgICAgICAgbmV3T3B0aW9ucy5sZWZ0ID0gb3B0aW9ucy5ib3R0b21cbiAgICAgICAgbmV3T3B0aW9ucy50b3AgPSBvcHRpb25zLnJpZ2h0XG4gICAgICAgIG5ld09wdGlvbnMucmlnaHQgPSBvcHRpb25zLnRvcFxuICAgICAgICBuZXdPcHRpb25zLmJvdHRvbSA9IG9wdGlvbnMubGVmdFxuICAgICAgICBicmVha1xuICAgICAgY2FzZSA4OlxuICAgICAgICAvLyA5MMKwIHJvdGF0ZSBsZWZ0XG4gICAgICAgIG5ld09wdGlvbnMubGVmdCA9IG9wdGlvbnMuYm90dG9tXG4gICAgICAgIG5ld09wdGlvbnMudG9wID0gb3B0aW9ucy5sZWZ0XG4gICAgICAgIG5ld09wdGlvbnMucmlnaHQgPSBvcHRpb25zLnRvcFxuICAgICAgICBuZXdPcHRpb25zLmJvdHRvbSA9IG9wdGlvbnMucmlnaHRcbiAgICAgICAgYnJlYWtcbiAgICB9XG4gICAgaWYgKG9wdGlvbnMub3JpZW50YXRpb24gPiA0KSB7XG4gICAgICBuZXdPcHRpb25zLm1heFdpZHRoID0gb3B0aW9ucy5tYXhIZWlnaHRcbiAgICAgIG5ld09wdGlvbnMubWF4SGVpZ2h0ID0gb3B0aW9ucy5tYXhXaWR0aFxuICAgICAgbmV3T3B0aW9ucy5taW5XaWR0aCA9IG9wdGlvbnMubWluSGVpZ2h0XG4gICAgICBuZXdPcHRpb25zLm1pbkhlaWdodCA9IG9wdGlvbnMubWluV2lkdGhcbiAgICAgIG5ld09wdGlvbnMuc291cmNlV2lkdGggPSBvcHRpb25zLnNvdXJjZUhlaWdodFxuICAgICAgbmV3T3B0aW9ucy5zb3VyY2VIZWlnaHQgPSBvcHRpb25zLnNvdXJjZVdpZHRoXG4gICAgfVxuICAgIHJldHVybiBuZXdPcHRpb25zXG4gIH1cbn0pKVxuIiwiLypcbiAqIEphdmFTY3JpcHQgTG9hZCBJbWFnZVxuICogaHR0cHM6Ly9naXRodWIuY29tL2JsdWVpbXAvSmF2YVNjcmlwdC1Mb2FkLUltYWdlXG4gKlxuICogQ29weXJpZ2h0IDIwMTEsIFNlYmFzdGlhbiBUc2NoYW5cbiAqIGh0dHBzOi8vYmx1ZWltcC5uZXRcbiAqXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIGxpY2Vuc2U6XG4gKiBodHRwOi8vd3d3Lm9wZW5zb3VyY2Uub3JnL2xpY2Vuc2VzL01JVFxuICovXG5cbi8qZ2xvYmFsIGRlZmluZSwgbW9kdWxlLCB3aW5kb3csIGRvY3VtZW50LCBVUkwsIHdlYmtpdFVSTCwgRmlsZVJlYWRlciAqL1xuXG47KGZ1bmN0aW9uICgkKSB7XG4gICd1c2Ugc3RyaWN0J1xuXG4gIC8vIExvYWRzIGFuIGltYWdlIGZvciBhIGdpdmVuIEZpbGUgb2JqZWN0LlxuICAvLyBJbnZva2VzIHRoZSBjYWxsYmFjayB3aXRoIGFuIGltZyBvciBvcHRpb25hbCBjYW52YXNcbiAgLy8gZWxlbWVudCAoaWYgc3VwcG9ydGVkIGJ5IHRoZSBicm93c2VyKSBhcyBwYXJhbWV0ZXI6XG4gIHZhciBsb2FkSW1hZ2UgPSBmdW5jdGlvbiAoZmlsZSwgY2FsbGJhY2ssIG9wdGlvbnMpIHtcbiAgICB2YXIgaW1nID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaW1nJylcbiAgICB2YXIgdXJsXG4gICAgdmFyIG9VcmxcbiAgICBpbWcub25lcnJvciA9IGNhbGxiYWNrXG4gICAgaW1nLm9ubG9hZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIGlmIChvVXJsICYmICEob3B0aW9ucyAmJiBvcHRpb25zLm5vUmV2b2tlKSkge1xuICAgICAgICBsb2FkSW1hZ2UucmV2b2tlT2JqZWN0VVJMKG9VcmwpXG4gICAgICB9XG4gICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgY2FsbGJhY2sobG9hZEltYWdlLnNjYWxlKGltZywgb3B0aW9ucykpXG4gICAgICB9XG4gICAgfVxuICAgIGlmIChsb2FkSW1hZ2UuaXNJbnN0YW5jZU9mKCdCbG9iJywgZmlsZSkgfHxcbiAgICAgIC8vIEZpbGVzIGFyZSBhbHNvIEJsb2IgaW5zdGFuY2VzLCBidXQgc29tZSBicm93c2Vyc1xuICAgICAgLy8gKEZpcmVmb3ggMy42KSBzdXBwb3J0IHRoZSBGaWxlIEFQSSBidXQgbm90IEJsb2JzOlxuICAgICAgbG9hZEltYWdlLmlzSW5zdGFuY2VPZignRmlsZScsIGZpbGUpKSB7XG4gICAgICB1cmwgPSBvVXJsID0gbG9hZEltYWdlLmNyZWF0ZU9iamVjdFVSTChmaWxlKVxuICAgICAgLy8gU3RvcmUgdGhlIGZpbGUgdHlwZSBmb3IgcmVzaXplIHByb2Nlc3Npbmc6XG4gICAgICBpbWcuX3R5cGUgPSBmaWxlLnR5cGVcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBmaWxlID09PSAnc3RyaW5nJykge1xuICAgICAgdXJsID0gZmlsZVxuICAgICAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy5jcm9zc09yaWdpbikge1xuICAgICAgICBpbWcuY3Jvc3NPcmlnaW4gPSBvcHRpb25zLmNyb3NzT3JpZ2luXG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cbiAgICBpZiAodXJsKSB7XG4gICAgICBpbWcuc3JjID0gdXJsXG4gICAgICByZXR1cm4gaW1nXG4gICAgfVxuICAgIHJldHVybiBsb2FkSW1hZ2UucmVhZEZpbGUoZmlsZSwgZnVuY3Rpb24gKGUpIHtcbiAgICAgIHZhciB0YXJnZXQgPSBlLnRhcmdldFxuICAgICAgaWYgKHRhcmdldCAmJiB0YXJnZXQucmVzdWx0KSB7XG4gICAgICAgIGltZy5zcmMgPSB0YXJnZXQucmVzdWx0XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgICBjYWxsYmFjayhlKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSlcbiAgfVxuICAvLyBUaGUgY2hlY2sgZm9yIFVSTC5yZXZva2VPYmplY3RVUkwgZml4ZXMgYW4gaXNzdWUgd2l0aCBPcGVyYSAxMixcbiAgLy8gd2hpY2ggcHJvdmlkZXMgVVJMLmNyZWF0ZU9iamVjdFVSTCBidXQgZG9lc24ndCBwcm9wZXJseSBpbXBsZW1lbnQgaXQ6XG4gIHZhciB1cmxBUEkgPSAod2luZG93LmNyZWF0ZU9iamVjdFVSTCAmJiB3aW5kb3cpIHx8XG4gICAgICAgICAgICAgICAgKHdpbmRvdy5VUkwgJiYgVVJMLnJldm9rZU9iamVjdFVSTCAmJiBVUkwpIHx8XG4gICAgICAgICAgICAgICAgKHdpbmRvdy53ZWJraXRVUkwgJiYgd2Via2l0VVJMKVxuXG4gIGxvYWRJbWFnZS5pc0luc3RhbmNlT2YgPSBmdW5jdGlvbiAodHlwZSwgb2JqKSB7XG4gICAgLy8gQ3Jvc3MtZnJhbWUgaW5zdGFuY2VvZiBjaGVja1xuICAgIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqKSA9PT0gJ1tvYmplY3QgJyArIHR5cGUgKyAnXSdcbiAgfVxuXG4gIC8vIFRyYW5zZm9ybSBpbWFnZSBjb29yZGluYXRlcywgYWxsb3dzIHRvIG92ZXJyaWRlIGUuZy5cbiAgLy8gdGhlIGNhbnZhcyBvcmllbnRhdGlvbiBiYXNlZCBvbiB0aGUgb3JpZW50YXRpb24gb3B0aW9uLFxuICAvLyBnZXRzIGNhbnZhcywgb3B0aW9ucyBwYXNzZWQgYXMgYXJndW1lbnRzOlxuICBsb2FkSW1hZ2UudHJhbnNmb3JtQ29vcmRpbmF0ZXMgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuXG4gIH1cblxuICAvLyBSZXR1cm5zIHRyYW5zZm9ybWVkIG9wdGlvbnMsIGFsbG93cyB0byBvdmVycmlkZSBlLmcuXG4gIC8vIG1heFdpZHRoLCBtYXhIZWlnaHQgYW5kIGNyb3Agb3B0aW9ucyBiYXNlZCBvbiB0aGUgYXNwZWN0UmF0aW8uXG4gIC8vIGdldHMgaW1nLCBvcHRpb25zIHBhc3NlZCBhcyBhcmd1bWVudHM6XG4gIGxvYWRJbWFnZS5nZXRUcmFuc2Zvcm1lZE9wdGlvbnMgPSBmdW5jdGlvbiAoaW1nLCBvcHRpb25zKSB7XG4gICAgdmFyIGFzcGVjdFJhdGlvID0gb3B0aW9ucy5hc3BlY3RSYXRpb1xuICAgIHZhciBuZXdPcHRpb25zXG4gICAgdmFyIGlcbiAgICB2YXIgd2lkdGhcbiAgICB2YXIgaGVpZ2h0XG4gICAgaWYgKCFhc3BlY3RSYXRpbykge1xuICAgICAgcmV0dXJuIG9wdGlvbnNcbiAgICB9XG4gICAgbmV3T3B0aW9ucyA9IHt9XG4gICAgZm9yIChpIGluIG9wdGlvbnMpIHtcbiAgICAgIGlmIChvcHRpb25zLmhhc093blByb3BlcnR5KGkpKSB7XG4gICAgICAgIG5ld09wdGlvbnNbaV0gPSBvcHRpb25zW2ldXG4gICAgICB9XG4gICAgfVxuICAgIG5ld09wdGlvbnMuY3JvcCA9IHRydWVcbiAgICB3aWR0aCA9IGltZy5uYXR1cmFsV2lkdGggfHwgaW1nLndpZHRoXG4gICAgaGVpZ2h0ID0gaW1nLm5hdHVyYWxIZWlnaHQgfHwgaW1nLmhlaWdodFxuICAgIGlmICh3aWR0aCAvIGhlaWdodCA+IGFzcGVjdFJhdGlvKSB7XG4gICAgICBuZXdPcHRpb25zLm1heFdpZHRoID0gaGVpZ2h0ICogYXNwZWN0UmF0aW9cbiAgICAgIG5ld09wdGlvbnMubWF4SGVpZ2h0ID0gaGVpZ2h0XG4gICAgfSBlbHNlIHtcbiAgICAgIG5ld09wdGlvbnMubWF4V2lkdGggPSB3aWR0aFxuICAgICAgbmV3T3B0aW9ucy5tYXhIZWlnaHQgPSB3aWR0aCAvIGFzcGVjdFJhdGlvXG4gICAgfVxuICAgIHJldHVybiBuZXdPcHRpb25zXG4gIH1cblxuICAvLyBDYW52YXMgcmVuZGVyIG1ldGhvZCwgYWxsb3dzIHRvIGltcGxlbWVudCBhIGRpZmZlcmVudCByZW5kZXJpbmcgYWxnb3JpdGhtOlxuICBsb2FkSW1hZ2UucmVuZGVySW1hZ2VUb0NhbnZhcyA9IGZ1bmN0aW9uIChcbiAgICBjYW52YXMsXG4gICAgaW1nLFxuICAgIHNvdXJjZVgsXG4gICAgc291cmNlWSxcbiAgICBzb3VyY2VXaWR0aCxcbiAgICBzb3VyY2VIZWlnaHQsXG4gICAgZGVzdFgsXG4gICAgZGVzdFksXG4gICAgZGVzdFdpZHRoLFxuICAgIGRlc3RIZWlnaHRcbiAgKSB7XG4gICAgY2FudmFzLmdldENvbnRleHQoJzJkJykuZHJhd0ltYWdlKFxuICAgICAgaW1nLFxuICAgICAgc291cmNlWCxcbiAgICAgIHNvdXJjZVksXG4gICAgICBzb3VyY2VXaWR0aCxcbiAgICAgIHNvdXJjZUhlaWdodCxcbiAgICAgIGRlc3RYLFxuICAgICAgZGVzdFksXG4gICAgICBkZXN0V2lkdGgsXG4gICAgICBkZXN0SGVpZ2h0XG4gICAgKVxuICAgIHJldHVybiBjYW52YXNcbiAgfVxuXG4gIC8vIFRoaXMgbWV0aG9kIGlzIHVzZWQgdG8gZGV0ZXJtaW5lIGlmIHRoZSB0YXJnZXQgaW1hZ2VcbiAgLy8gc2hvdWxkIGJlIGEgY2FudmFzIGVsZW1lbnQ6XG4gIGxvYWRJbWFnZS5oYXNDYW52YXNPcHRpb24gPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgIHJldHVybiBvcHRpb25zLmNhbnZhcyB8fCBvcHRpb25zLmNyb3AgfHwgISFvcHRpb25zLmFzcGVjdFJhdGlvXG4gIH1cblxuICAvLyBTY2FsZXMgYW5kL29yIGNyb3BzIHRoZSBnaXZlbiBpbWFnZSAoaW1nIG9yIGNhbnZhcyBIVE1MIGVsZW1lbnQpXG4gIC8vIHVzaW5nIHRoZSBnaXZlbiBvcHRpb25zLlxuICAvLyBSZXR1cm5zIGEgY2FudmFzIG9iamVjdCBpZiB0aGUgYnJvd3NlciBzdXBwb3J0cyBjYW52YXNcbiAgLy8gYW5kIHRoZSBoYXNDYW52YXNPcHRpb24gbWV0aG9kIHJldHVybnMgdHJ1ZSBvciBhIGNhbnZhc1xuICAvLyBvYmplY3QgaXMgcGFzc2VkIGFzIGltYWdlLCBlbHNlIHRoZSBzY2FsZWQgaW1hZ2U6XG4gIGxvYWRJbWFnZS5zY2FsZSA9IGZ1bmN0aW9uIChpbWcsIG9wdGlvbnMpIHtcbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fVxuICAgIHZhciBjYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKVxuICAgIHZhciB1c2VDYW52YXMgPSBpbWcuZ2V0Q29udGV4dCB8fFxuICAgICAgICAgICAgICAgICAgICAobG9hZEltYWdlLmhhc0NhbnZhc09wdGlvbihvcHRpb25zKSAmJiBjYW52YXMuZ2V0Q29udGV4dClcbiAgICB2YXIgd2lkdGggPSBpbWcubmF0dXJhbFdpZHRoIHx8IGltZy53aWR0aFxuICAgIHZhciBoZWlnaHQgPSBpbWcubmF0dXJhbEhlaWdodCB8fCBpbWcuaGVpZ2h0XG4gICAgdmFyIGRlc3RXaWR0aCA9IHdpZHRoXG4gICAgdmFyIGRlc3RIZWlnaHQgPSBoZWlnaHRcbiAgICB2YXIgbWF4V2lkdGhcbiAgICB2YXIgbWF4SGVpZ2h0XG4gICAgdmFyIG1pbldpZHRoXG4gICAgdmFyIG1pbkhlaWdodFxuICAgIHZhciBzb3VyY2VXaWR0aFxuICAgIHZhciBzb3VyY2VIZWlnaHRcbiAgICB2YXIgc291cmNlWFxuICAgIHZhciBzb3VyY2VZXG4gICAgdmFyIHBpeGVsUmF0aW9cbiAgICB2YXIgZG93bnNhbXBsaW5nUmF0aW9cbiAgICB2YXIgdG1wXG4gICAgZnVuY3Rpb24gc2NhbGVVcCAoKSB7XG4gICAgICB2YXIgc2NhbGUgPSBNYXRoLm1heChcbiAgICAgICAgKG1pbldpZHRoIHx8IGRlc3RXaWR0aCkgLyBkZXN0V2lkdGgsXG4gICAgICAgIChtaW5IZWlnaHQgfHwgZGVzdEhlaWdodCkgLyBkZXN0SGVpZ2h0XG4gICAgICApXG4gICAgICBpZiAoc2NhbGUgPiAxKSB7XG4gICAgICAgIGRlc3RXaWR0aCAqPSBzY2FsZVxuICAgICAgICBkZXN0SGVpZ2h0ICo9IHNjYWxlXG4gICAgICB9XG4gICAgfVxuICAgIGZ1bmN0aW9uIHNjYWxlRG93biAoKSB7XG4gICAgICB2YXIgc2NhbGUgPSBNYXRoLm1pbihcbiAgICAgICAgKG1heFdpZHRoIHx8IGRlc3RXaWR0aCkgLyBkZXN0V2lkdGgsXG4gICAgICAgIChtYXhIZWlnaHQgfHwgZGVzdEhlaWdodCkgLyBkZXN0SGVpZ2h0XG4gICAgICApXG4gICAgICBpZiAoc2NhbGUgPCAxKSB7XG4gICAgICAgIGRlc3RXaWR0aCAqPSBzY2FsZVxuICAgICAgICBkZXN0SGVpZ2h0ICo9IHNjYWxlXG4gICAgICB9XG4gICAgfVxuICAgIGlmICh1c2VDYW52YXMpIHtcbiAgICAgIG9wdGlvbnMgPSBsb2FkSW1hZ2UuZ2V0VHJhbnNmb3JtZWRPcHRpb25zKGltZywgb3B0aW9ucylcbiAgICAgIHNvdXJjZVggPSBvcHRpb25zLmxlZnQgfHwgMFxuICAgICAgc291cmNlWSA9IG9wdGlvbnMudG9wIHx8IDBcbiAgICAgIGlmIChvcHRpb25zLnNvdXJjZVdpZHRoKSB7XG4gICAgICAgIHNvdXJjZVdpZHRoID0gb3B0aW9ucy5zb3VyY2VXaWR0aFxuICAgICAgICBpZiAob3B0aW9ucy5yaWdodCAhPT0gdW5kZWZpbmVkICYmIG9wdGlvbnMubGVmdCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgc291cmNlWCA9IHdpZHRoIC0gc291cmNlV2lkdGggLSBvcHRpb25zLnJpZ2h0XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNvdXJjZVdpZHRoID0gd2lkdGggLSBzb3VyY2VYIC0gKG9wdGlvbnMucmlnaHQgfHwgMClcbiAgICAgIH1cbiAgICAgIGlmIChvcHRpb25zLnNvdXJjZUhlaWdodCkge1xuICAgICAgICBzb3VyY2VIZWlnaHQgPSBvcHRpb25zLnNvdXJjZUhlaWdodFxuICAgICAgICBpZiAob3B0aW9ucy5ib3R0b20gIT09IHVuZGVmaW5lZCAmJiBvcHRpb25zLnRvcCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgc291cmNlWSA9IGhlaWdodCAtIHNvdXJjZUhlaWdodCAtIG9wdGlvbnMuYm90dG9tXG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNvdXJjZUhlaWdodCA9IGhlaWdodCAtIHNvdXJjZVkgLSAob3B0aW9ucy5ib3R0b20gfHwgMClcbiAgICAgIH1cbiAgICAgIGRlc3RXaWR0aCA9IHNvdXJjZVdpZHRoXG4gICAgICBkZXN0SGVpZ2h0ID0gc291cmNlSGVpZ2h0XG4gICAgfVxuICAgIG1heFdpZHRoID0gb3B0aW9ucy5tYXhXaWR0aFxuICAgIG1heEhlaWdodCA9IG9wdGlvbnMubWF4SGVpZ2h0XG4gICAgbWluV2lkdGggPSBvcHRpb25zLm1pbldpZHRoXG4gICAgbWluSGVpZ2h0ID0gb3B0aW9ucy5taW5IZWlnaHRcbiAgICBpZiAodXNlQ2FudmFzICYmIG1heFdpZHRoICYmIG1heEhlaWdodCAmJiBvcHRpb25zLmNyb3ApIHtcbiAgICAgIGRlc3RXaWR0aCA9IG1heFdpZHRoXG4gICAgICBkZXN0SGVpZ2h0ID0gbWF4SGVpZ2h0XG4gICAgICB0bXAgPSBzb3VyY2VXaWR0aCAvIHNvdXJjZUhlaWdodCAtIG1heFdpZHRoIC8gbWF4SGVpZ2h0XG4gICAgICBpZiAodG1wIDwgMCkge1xuICAgICAgICBzb3VyY2VIZWlnaHQgPSBtYXhIZWlnaHQgKiBzb3VyY2VXaWR0aCAvIG1heFdpZHRoXG4gICAgICAgIGlmIChvcHRpb25zLnRvcCA9PT0gdW5kZWZpbmVkICYmIG9wdGlvbnMuYm90dG9tID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBzb3VyY2VZID0gKGhlaWdodCAtIHNvdXJjZUhlaWdodCkgLyAyXG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAodG1wID4gMCkge1xuICAgICAgICBzb3VyY2VXaWR0aCA9IG1heFdpZHRoICogc291cmNlSGVpZ2h0IC8gbWF4SGVpZ2h0XG4gICAgICAgIGlmIChvcHRpb25zLmxlZnQgPT09IHVuZGVmaW5lZCAmJiBvcHRpb25zLnJpZ2h0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBzb3VyY2VYID0gKHdpZHRoIC0gc291cmNlV2lkdGgpIC8gMlxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChvcHRpb25zLmNvbnRhaW4gfHwgb3B0aW9ucy5jb3Zlcikge1xuICAgICAgICBtaW5XaWR0aCA9IG1heFdpZHRoID0gbWF4V2lkdGggfHwgbWluV2lkdGhcbiAgICAgICAgbWluSGVpZ2h0ID0gbWF4SGVpZ2h0ID0gbWF4SGVpZ2h0IHx8IG1pbkhlaWdodFxuICAgICAgfVxuICAgICAgaWYgKG9wdGlvbnMuY292ZXIpIHtcbiAgICAgICAgc2NhbGVEb3duKClcbiAgICAgICAgc2NhbGVVcCgpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzY2FsZVVwKClcbiAgICAgICAgc2NhbGVEb3duKClcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHVzZUNhbnZhcykge1xuICAgICAgcGl4ZWxSYXRpbyA9IG9wdGlvbnMucGl4ZWxSYXRpb1xuICAgICAgaWYgKHBpeGVsUmF0aW8gPiAxKSB7XG4gICAgICAgIGNhbnZhcy5zdHlsZS53aWR0aCA9IGRlc3RXaWR0aCArICdweCdcbiAgICAgICAgY2FudmFzLnN0eWxlLmhlaWdodCA9IGRlc3RIZWlnaHQgKyAncHgnXG4gICAgICAgIGRlc3RXaWR0aCAqPSBwaXhlbFJhdGlvXG4gICAgICAgIGRlc3RIZWlnaHQgKj0gcGl4ZWxSYXRpb1xuICAgICAgICBjYW52YXMuZ2V0Q29udGV4dCgnMmQnKS5zY2FsZShwaXhlbFJhdGlvLCBwaXhlbFJhdGlvKVxuICAgICAgfVxuICAgICAgZG93bnNhbXBsaW5nUmF0aW8gPSBvcHRpb25zLmRvd25zYW1wbGluZ1JhdGlvXG4gICAgICBpZiAoZG93bnNhbXBsaW5nUmF0aW8gPiAwICYmIGRvd25zYW1wbGluZ1JhdGlvIDwgMSAmJlxuICAgICAgICAgICAgZGVzdFdpZHRoIDwgc291cmNlV2lkdGggJiYgZGVzdEhlaWdodCA8IHNvdXJjZUhlaWdodCkge1xuICAgICAgICB3aGlsZSAoc291cmNlV2lkdGggKiBkb3duc2FtcGxpbmdSYXRpbyA+IGRlc3RXaWR0aCkge1xuICAgICAgICAgIGNhbnZhcy53aWR0aCA9IHNvdXJjZVdpZHRoICogZG93bnNhbXBsaW5nUmF0aW9cbiAgICAgICAgICBjYW52YXMuaGVpZ2h0ID0gc291cmNlSGVpZ2h0ICogZG93bnNhbXBsaW5nUmF0aW9cbiAgICAgICAgICBsb2FkSW1hZ2UucmVuZGVySW1hZ2VUb0NhbnZhcyhcbiAgICAgICAgICAgIGNhbnZhcyxcbiAgICAgICAgICAgIGltZyxcbiAgICAgICAgICAgIHNvdXJjZVgsXG4gICAgICAgICAgICBzb3VyY2VZLFxuICAgICAgICAgICAgc291cmNlV2lkdGgsXG4gICAgICAgICAgICBzb3VyY2VIZWlnaHQsXG4gICAgICAgICAgICAwLFxuICAgICAgICAgICAgMCxcbiAgICAgICAgICAgIGNhbnZhcy53aWR0aCxcbiAgICAgICAgICAgIGNhbnZhcy5oZWlnaHRcbiAgICAgICAgICApXG4gICAgICAgICAgc291cmNlV2lkdGggPSBjYW52YXMud2lkdGhcbiAgICAgICAgICBzb3VyY2VIZWlnaHQgPSBjYW52YXMuaGVpZ2h0XG4gICAgICAgICAgaW1nID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnY2FudmFzJylcbiAgICAgICAgICBpbWcud2lkdGggPSBzb3VyY2VXaWR0aFxuICAgICAgICAgIGltZy5oZWlnaHQgPSBzb3VyY2VIZWlnaHRcbiAgICAgICAgICBsb2FkSW1hZ2UucmVuZGVySW1hZ2VUb0NhbnZhcyhcbiAgICAgICAgICAgIGltZyxcbiAgICAgICAgICAgIGNhbnZhcyxcbiAgICAgICAgICAgIDAsXG4gICAgICAgICAgICAwLFxuICAgICAgICAgICAgc291cmNlV2lkdGgsXG4gICAgICAgICAgICBzb3VyY2VIZWlnaHQsXG4gICAgICAgICAgICAwLFxuICAgICAgICAgICAgMCxcbiAgICAgICAgICAgIHNvdXJjZVdpZHRoLFxuICAgICAgICAgICAgc291cmNlSGVpZ2h0XG4gICAgICAgICAgKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBjYW52YXMud2lkdGggPSBkZXN0V2lkdGhcbiAgICAgIGNhbnZhcy5oZWlnaHQgPSBkZXN0SGVpZ2h0XG4gICAgICBsb2FkSW1hZ2UudHJhbnNmb3JtQ29vcmRpbmF0ZXMoXG4gICAgICAgIGNhbnZhcyxcbiAgICAgICAgb3B0aW9uc1xuICAgICAgKVxuICAgICAgcmV0dXJuIGxvYWRJbWFnZS5yZW5kZXJJbWFnZVRvQ2FudmFzKFxuICAgICAgICBjYW52YXMsXG4gICAgICAgIGltZyxcbiAgICAgICAgc291cmNlWCxcbiAgICAgICAgc291cmNlWSxcbiAgICAgICAgc291cmNlV2lkdGgsXG4gICAgICAgIHNvdXJjZUhlaWdodCxcbiAgICAgICAgMCxcbiAgICAgICAgMCxcbiAgICAgICAgZGVzdFdpZHRoLFxuICAgICAgICBkZXN0SGVpZ2h0XG4gICAgICApXG4gICAgfVxuICAgIGltZy53aWR0aCA9IGRlc3RXaWR0aFxuICAgIGltZy5oZWlnaHQgPSBkZXN0SGVpZ2h0XG4gICAgcmV0dXJuIGltZ1xuICB9XG5cbiAgbG9hZEltYWdlLmNyZWF0ZU9iamVjdFVSTCA9IGZ1bmN0aW9uIChmaWxlKSB7XG4gICAgcmV0dXJuIHVybEFQSSA/IHVybEFQSS5jcmVhdGVPYmplY3RVUkwoZmlsZSkgOiBmYWxzZVxuICB9XG5cbiAgbG9hZEltYWdlLnJldm9rZU9iamVjdFVSTCA9IGZ1bmN0aW9uICh1cmwpIHtcbiAgICByZXR1cm4gdXJsQVBJID8gdXJsQVBJLnJldm9rZU9iamVjdFVSTCh1cmwpIDogZmFsc2VcbiAgfVxuXG4gIC8vIExvYWRzIGEgZ2l2ZW4gRmlsZSBvYmplY3QgdmlhIEZpbGVSZWFkZXIgaW50ZXJmYWNlLFxuICAvLyBpbnZva2VzIHRoZSBjYWxsYmFjayB3aXRoIHRoZSBldmVudCBvYmplY3QgKGxvYWQgb3IgZXJyb3IpLlxuICAvLyBUaGUgcmVzdWx0IGNhbiBiZSByZWFkIHZpYSBldmVudC50YXJnZXQucmVzdWx0OlxuICBsb2FkSW1hZ2UucmVhZEZpbGUgPSBmdW5jdGlvbiAoZmlsZSwgY2FsbGJhY2ssIG1ldGhvZCkge1xuICAgIGlmICh3aW5kb3cuRmlsZVJlYWRlcikge1xuICAgICAgdmFyIGZpbGVSZWFkZXIgPSBuZXcgRmlsZVJlYWRlcigpXG4gICAgICBmaWxlUmVhZGVyLm9ubG9hZCA9IGZpbGVSZWFkZXIub25lcnJvciA9IGNhbGxiYWNrXG4gICAgICBtZXRob2QgPSBtZXRob2QgfHwgJ3JlYWRBc0RhdGFVUkwnXG4gICAgICBpZiAoZmlsZVJlYWRlclttZXRob2RdKSB7XG4gICAgICAgIGZpbGVSZWFkZXJbbWV0aG9kXShmaWxlKVxuICAgICAgICByZXR1cm4gZmlsZVJlYWRlclxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZmFsc2VcbiAgfVxuXG4gIGlmICh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQpIHtcbiAgICBkZWZpbmUoZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuIGxvYWRJbWFnZVxuICAgIH0pXG4gIH0gZWxzZSBpZiAodHlwZW9mIG1vZHVsZSA9PT0gJ29iamVjdCcgJiYgbW9kdWxlLmV4cG9ydHMpIHtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IGxvYWRJbWFnZVxuICB9IGVsc2Uge1xuICAgICQubG9hZEltYWdlID0gbG9hZEltYWdlXG4gIH1cbn0od2luZG93KSlcbiIsIi8qIEZpbGVTYXZlci5qc1xuICogQSBzYXZlQXMoKSBGaWxlU2F2ZXIgaW1wbGVtZW50YXRpb24uXG4gKiAxLjEuMjAxNjAzMjhcbiAqXG4gKiBCeSBFbGkgR3JleSwgaHR0cDovL2VsaWdyZXkuY29tXG4gKiBMaWNlbnNlOiBNSVRcbiAqICAgU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9lbGlncmV5L0ZpbGVTYXZlci5qcy9ibG9iL21hc3Rlci9MSUNFTlNFLm1kXG4gKi9cblxuLypnbG9iYWwgc2VsZiAqL1xuLypqc2xpbnQgYml0d2lzZTogdHJ1ZSwgaW5kZW50OiA0LCBsYXhicmVhazogdHJ1ZSwgbGF4Y29tbWE6IHRydWUsIHNtYXJ0dGFiczogdHJ1ZSwgcGx1c3BsdXM6IHRydWUgKi9cblxuLyohIEBzb3VyY2UgaHR0cDovL3B1cmwuZWxpZ3JleS5jb20vZ2l0aHViL0ZpbGVTYXZlci5qcy9ibG9iL21hc3Rlci9GaWxlU2F2ZXIuanMgKi9cblxudmFyIHNhdmVBcyA9IHNhdmVBcyB8fCAoZnVuY3Rpb24odmlldykge1xuXHRcInVzZSBzdHJpY3RcIjtcblx0Ly8gSUUgPDEwIGlzIGV4cGxpY2l0bHkgdW5zdXBwb3J0ZWRcblx0aWYgKHR5cGVvZiBuYXZpZ2F0b3IgIT09IFwidW5kZWZpbmVkXCIgJiYgL01TSUUgWzEtOV1cXC4vLnRlc3QobmF2aWdhdG9yLnVzZXJBZ2VudCkpIHtcblx0XHRyZXR1cm47XG5cdH1cblx0dmFyXG5cdFx0ICBkb2MgPSB2aWV3LmRvY3VtZW50XG5cdFx0ICAvLyBvbmx5IGdldCBVUkwgd2hlbiBuZWNlc3NhcnkgaW4gY2FzZSBCbG9iLmpzIGhhc24ndCBvdmVycmlkZGVuIGl0IHlldFxuXHRcdCwgZ2V0X1VSTCA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0cmV0dXJuIHZpZXcuVVJMIHx8IHZpZXcud2Via2l0VVJMIHx8IHZpZXc7XG5cdFx0fVxuXHRcdCwgc2F2ZV9saW5rID0gZG9jLmNyZWF0ZUVsZW1lbnROUyhcImh0dHA6Ly93d3cudzMub3JnLzE5OTkveGh0bWxcIiwgXCJhXCIpXG5cdFx0LCBjYW5fdXNlX3NhdmVfbGluayA9IFwiZG93bmxvYWRcIiBpbiBzYXZlX2xpbmtcblx0XHQsIGNsaWNrID0gZnVuY3Rpb24obm9kZSkge1xuXHRcdFx0dmFyIGV2ZW50ID0gbmV3IE1vdXNlRXZlbnQoXCJjbGlja1wiKTtcblx0XHRcdG5vZGUuZGlzcGF0Y2hFdmVudChldmVudCk7XG5cdFx0fVxuXHRcdCwgaXNfc2FmYXJpID0gL1ZlcnNpb25cXC9bXFxkXFwuXSsuKlNhZmFyaS8udGVzdChuYXZpZ2F0b3IudXNlckFnZW50KVxuXHRcdCwgd2Via2l0X3JlcV9mcyA9IHZpZXcud2Via2l0UmVxdWVzdEZpbGVTeXN0ZW1cblx0XHQsIHJlcV9mcyA9IHZpZXcucmVxdWVzdEZpbGVTeXN0ZW0gfHwgd2Via2l0X3JlcV9mcyB8fCB2aWV3Lm1velJlcXVlc3RGaWxlU3lzdGVtXG5cdFx0LCB0aHJvd19vdXRzaWRlID0gZnVuY3Rpb24oZXgpIHtcblx0XHRcdCh2aWV3LnNldEltbWVkaWF0ZSB8fCB2aWV3LnNldFRpbWVvdXQpKGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR0aHJvdyBleDtcblx0XHRcdH0sIDApO1xuXHRcdH1cblx0XHQsIGZvcmNlX3NhdmVhYmxlX3R5cGUgPSBcImFwcGxpY2F0aW9uL29jdGV0LXN0cmVhbVwiXG5cdFx0LCBmc19taW5fc2l6ZSA9IDBcblx0XHQvLyB0aGUgQmxvYiBBUEkgaXMgZnVuZGFtZW50YWxseSBicm9rZW4gYXMgdGhlcmUgaXMgbm8gXCJkb3dubG9hZGZpbmlzaGVkXCIgZXZlbnQgdG8gc3Vic2NyaWJlIHRvXG5cdFx0LCBhcmJpdHJhcnlfcmV2b2tlX3RpbWVvdXQgPSAxMDAwICogNDAgLy8gaW4gbXNcblx0XHQsIHJldm9rZSA9IGZ1bmN0aW9uKGZpbGUpIHtcblx0XHRcdHZhciByZXZva2VyID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGlmICh0eXBlb2YgZmlsZSA9PT0gXCJzdHJpbmdcIikgeyAvLyBmaWxlIGlzIGFuIG9iamVjdCBVUkxcblx0XHRcdFx0XHRnZXRfVVJMKCkucmV2b2tlT2JqZWN0VVJMKGZpbGUpO1xuXHRcdFx0XHR9IGVsc2UgeyAvLyBmaWxlIGlzIGEgRmlsZVxuXHRcdFx0XHRcdGZpbGUucmVtb3ZlKCk7XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0XHQvKiAvLyBUYWtlIG5vdGUgVzNDOlxuXHRcdFx0dmFyXG5cdFx0XHQgIHVyaSA9IHR5cGVvZiBmaWxlID09PSBcInN0cmluZ1wiID8gZmlsZSA6IGZpbGUudG9VUkwoKVxuXHRcdFx0LCByZXZva2VyID0gZnVuY3Rpb24oZXZ0KSB7XG5cdFx0XHRcdC8vIGlkZWFseSBEb3dubG9hZEZpbmlzaGVkRXZlbnQuZGF0YSB3b3VsZCBiZSB0aGUgVVJMIHJlcXVlc3RlZFxuXHRcdFx0XHRpZiAoZXZ0LmRhdGEgPT09IHVyaSkge1xuXHRcdFx0XHRcdGlmICh0eXBlb2YgZmlsZSA9PT0gXCJzdHJpbmdcIikgeyAvLyBmaWxlIGlzIGFuIG9iamVjdCBVUkxcblx0XHRcdFx0XHRcdGdldF9VUkwoKS5yZXZva2VPYmplY3RVUkwoZmlsZSk7XG5cdFx0XHRcdFx0fSBlbHNlIHsgLy8gZmlsZSBpcyBhIEZpbGVcblx0XHRcdFx0XHRcdGZpbGUucmVtb3ZlKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHQ7XG5cdFx0XHR2aWV3LmFkZEV2ZW50TGlzdGVuZXIoXCJkb3dubG9hZGZpbmlzaGVkXCIsIHJldm9rZXIpO1xuXHRcdFx0Ki9cblx0XHRcdHNldFRpbWVvdXQocmV2b2tlciwgYXJiaXRyYXJ5X3Jldm9rZV90aW1lb3V0KTtcblx0XHR9XG5cdFx0LCBkaXNwYXRjaCA9IGZ1bmN0aW9uKGZpbGVzYXZlciwgZXZlbnRfdHlwZXMsIGV2ZW50KSB7XG5cdFx0XHRldmVudF90eXBlcyA9IFtdLmNvbmNhdChldmVudF90eXBlcyk7XG5cdFx0XHR2YXIgaSA9IGV2ZW50X3R5cGVzLmxlbmd0aDtcblx0XHRcdHdoaWxlIChpLS0pIHtcblx0XHRcdFx0dmFyIGxpc3RlbmVyID0gZmlsZXNhdmVyW1wib25cIiArIGV2ZW50X3R5cGVzW2ldXTtcblx0XHRcdFx0aWYgKHR5cGVvZiBsaXN0ZW5lciA9PT0gXCJmdW5jdGlvblwiKSB7XG5cdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdGxpc3RlbmVyLmNhbGwoZmlsZXNhdmVyLCBldmVudCB8fCBmaWxlc2F2ZXIpO1xuXHRcdFx0XHRcdH0gY2F0Y2ggKGV4KSB7XG5cdFx0XHRcdFx0XHR0aHJvd19vdXRzaWRlKGV4KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0LCBhdXRvX2JvbSA9IGZ1bmN0aW9uKGJsb2IpIHtcblx0XHRcdC8vIHByZXBlbmQgQk9NIGZvciBVVEYtOCBYTUwgYW5kIHRleHQvKiB0eXBlcyAoaW5jbHVkaW5nIEhUTUwpXG5cdFx0XHRpZiAoL15cXHMqKD86dGV4dFxcL1xcUyp8YXBwbGljYXRpb25cXC94bWx8XFxTKlxcL1xcUypcXCt4bWwpXFxzKjsuKmNoYXJzZXRcXHMqPVxccyp1dGYtOC9pLnRlc3QoYmxvYi50eXBlKSkge1xuXHRcdFx0XHRyZXR1cm4gbmV3IEJsb2IoW1wiXFx1ZmVmZlwiLCBibG9iXSwge3R5cGU6IGJsb2IudHlwZX0pO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGJsb2I7XG5cdFx0fVxuXHRcdCwgRmlsZVNhdmVyID0gZnVuY3Rpb24oYmxvYiwgbmFtZSwgbm9fYXV0b19ib20pIHtcblx0XHRcdGlmICghbm9fYXV0b19ib20pIHtcblx0XHRcdFx0YmxvYiA9IGF1dG9fYm9tKGJsb2IpO1xuXHRcdFx0fVxuXHRcdFx0Ly8gRmlyc3QgdHJ5IGEuZG93bmxvYWQsIHRoZW4gd2ViIGZpbGVzeXN0ZW0sIHRoZW4gb2JqZWN0IFVSTHNcblx0XHRcdHZhclxuXHRcdFx0XHQgIGZpbGVzYXZlciA9IHRoaXNcblx0XHRcdFx0LCB0eXBlID0gYmxvYi50eXBlXG5cdFx0XHRcdCwgYmxvYl9jaGFuZ2VkID0gZmFsc2Vcblx0XHRcdFx0LCBvYmplY3RfdXJsXG5cdFx0XHRcdCwgdGFyZ2V0X3ZpZXdcblx0XHRcdFx0LCBkaXNwYXRjaF9hbGwgPSBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRkaXNwYXRjaChmaWxlc2F2ZXIsIFwid3JpdGVzdGFydCBwcm9ncmVzcyB3cml0ZSB3cml0ZWVuZFwiLnNwbGl0KFwiIFwiKSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0Ly8gb24gYW55IGZpbGVzeXMgZXJyb3JzIHJldmVydCB0byBzYXZpbmcgd2l0aCBvYmplY3QgVVJMc1xuXHRcdFx0XHQsIGZzX2Vycm9yID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0aWYgKHRhcmdldF92aWV3ICYmIGlzX3NhZmFyaSAmJiB0eXBlb2YgRmlsZVJlYWRlciAhPT0gXCJ1bmRlZmluZWRcIikge1xuXHRcdFx0XHRcdFx0Ly8gU2FmYXJpIGRvZXNuJ3QgYWxsb3cgZG93bmxvYWRpbmcgb2YgYmxvYiB1cmxzXG5cdFx0XHRcdFx0XHR2YXIgcmVhZGVyID0gbmV3IEZpbGVSZWFkZXIoKTtcblx0XHRcdFx0XHRcdHJlYWRlci5vbmxvYWRlbmQgPSBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdFx0dmFyIGJhc2U2NERhdGEgPSByZWFkZXIucmVzdWx0O1xuXHRcdFx0XHRcdFx0XHR0YXJnZXRfdmlldy5sb2NhdGlvbi5ocmVmID0gXCJkYXRhOmF0dGFjaG1lbnQvZmlsZVwiICsgYmFzZTY0RGF0YS5zbGljZShiYXNlNjREYXRhLnNlYXJjaCgvWyw7XS8pKTtcblx0XHRcdFx0XHRcdFx0ZmlsZXNhdmVyLnJlYWR5U3RhdGUgPSBmaWxlc2F2ZXIuRE9ORTtcblx0XHRcdFx0XHRcdFx0ZGlzcGF0Y2hfYWxsKCk7XG5cdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdFx0cmVhZGVyLnJlYWRBc0RhdGFVUkwoYmxvYik7XG5cdFx0XHRcdFx0XHRmaWxlc2F2ZXIucmVhZHlTdGF0ZSA9IGZpbGVzYXZlci5JTklUO1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHQvLyBkb24ndCBjcmVhdGUgbW9yZSBvYmplY3QgVVJMcyB0aGFuIG5lZWRlZFxuXHRcdFx0XHRcdGlmIChibG9iX2NoYW5nZWQgfHwgIW9iamVjdF91cmwpIHtcblx0XHRcdFx0XHRcdG9iamVjdF91cmwgPSBnZXRfVVJMKCkuY3JlYXRlT2JqZWN0VVJMKGJsb2IpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAodGFyZ2V0X3ZpZXcpIHtcblx0XHRcdFx0XHRcdHRhcmdldF92aWV3LmxvY2F0aW9uLmhyZWYgPSBvYmplY3RfdXJsO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHR2YXIgbmV3X3RhYiA9IHZpZXcub3BlbihvYmplY3RfdXJsLCBcIl9ibGFua1wiKTtcblx0XHRcdFx0XHRcdGlmIChuZXdfdGFiID09PSB1bmRlZmluZWQgJiYgaXNfc2FmYXJpKSB7XG5cdFx0XHRcdFx0XHRcdC8vQXBwbGUgZG8gbm90IGFsbG93IHdpbmRvdy5vcGVuLCBzZWUgaHR0cDovL2JpdC5seS8xa1pmZlJJXG5cdFx0XHRcdFx0XHRcdHZpZXcubG9jYXRpb24uaHJlZiA9IG9iamVjdF91cmxcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0ZmlsZXNhdmVyLnJlYWR5U3RhdGUgPSBmaWxlc2F2ZXIuRE9ORTtcblx0XHRcdFx0XHRkaXNwYXRjaF9hbGwoKTtcblx0XHRcdFx0XHRyZXZva2Uob2JqZWN0X3VybCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0LCBhYm9ydGFibGUgPSBmdW5jdGlvbihmdW5jKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdFx0aWYgKGZpbGVzYXZlci5yZWFkeVN0YXRlICE9PSBmaWxlc2F2ZXIuRE9ORSkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gZnVuYy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH1cblx0XHRcdFx0LCBjcmVhdGVfaWZfbm90X2ZvdW5kID0ge2NyZWF0ZTogdHJ1ZSwgZXhjbHVzaXZlOiBmYWxzZX1cblx0XHRcdFx0LCBzbGljZVxuXHRcdFx0O1xuXHRcdFx0ZmlsZXNhdmVyLnJlYWR5U3RhdGUgPSBmaWxlc2F2ZXIuSU5JVDtcblx0XHRcdGlmICghbmFtZSkge1xuXHRcdFx0XHRuYW1lID0gXCJkb3dubG9hZFwiO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGNhbl91c2Vfc2F2ZV9saW5rKSB7XG5cdFx0XHRcdG9iamVjdF91cmwgPSBnZXRfVVJMKCkuY3JlYXRlT2JqZWN0VVJMKGJsb2IpO1xuXHRcdFx0XHRzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdHNhdmVfbGluay5ocmVmID0gb2JqZWN0X3VybDtcblx0XHRcdFx0XHRzYXZlX2xpbmsuZG93bmxvYWQgPSBuYW1lO1xuXHRcdFx0XHRcdGNsaWNrKHNhdmVfbGluayk7XG5cdFx0XHRcdFx0ZGlzcGF0Y2hfYWxsKCk7XG5cdFx0XHRcdFx0cmV2b2tlKG9iamVjdF91cmwpO1xuXHRcdFx0XHRcdGZpbGVzYXZlci5yZWFkeVN0YXRlID0gZmlsZXNhdmVyLkRPTkU7XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHQvLyBPYmplY3QgYW5kIHdlYiBmaWxlc3lzdGVtIFVSTHMgaGF2ZSBhIHByb2JsZW0gc2F2aW5nIGluIEdvb2dsZSBDaHJvbWUgd2hlblxuXHRcdFx0Ly8gdmlld2VkIGluIGEgdGFiLCBzbyBJIGZvcmNlIHNhdmUgd2l0aCBhcHBsaWNhdGlvbi9vY3RldC1zdHJlYW1cblx0XHRcdC8vIGh0dHA6Ly9jb2RlLmdvb2dsZS5jb20vcC9jaHJvbWl1bS9pc3N1ZXMvZGV0YWlsP2lkPTkxMTU4XG5cdFx0XHQvLyBVcGRhdGU6IEdvb2dsZSBlcnJhbnRseSBjbG9zZWQgOTExNTgsIEkgc3VibWl0dGVkIGl0IGFnYWluOlxuXHRcdFx0Ly8gaHR0cHM6Ly9jb2RlLmdvb2dsZS5jb20vcC9jaHJvbWl1bS9pc3N1ZXMvZGV0YWlsP2lkPTM4OTY0MlxuXHRcdFx0aWYgKHZpZXcuY2hyb21lICYmIHR5cGUgJiYgdHlwZSAhPT0gZm9yY2Vfc2F2ZWFibGVfdHlwZSkge1xuXHRcdFx0XHRzbGljZSA9IGJsb2Iuc2xpY2UgfHwgYmxvYi53ZWJraXRTbGljZTtcblx0XHRcdFx0YmxvYiA9IHNsaWNlLmNhbGwoYmxvYiwgMCwgYmxvYi5zaXplLCBmb3JjZV9zYXZlYWJsZV90eXBlKTtcblx0XHRcdFx0YmxvYl9jaGFuZ2VkID0gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdC8vIFNpbmNlIEkgY2FuJ3QgYmUgc3VyZSB0aGF0IHRoZSBndWVzc2VkIG1lZGlhIHR5cGUgd2lsbCB0cmlnZ2VyIGEgZG93bmxvYWRcblx0XHRcdC8vIGluIFdlYktpdCwgSSBhcHBlbmQgLmRvd25sb2FkIHRvIHRoZSBmaWxlbmFtZS5cblx0XHRcdC8vIGh0dHBzOi8vYnVncy53ZWJraXQub3JnL3Nob3dfYnVnLmNnaT9pZD02NTQ0MFxuXHRcdFx0aWYgKHdlYmtpdF9yZXFfZnMgJiYgbmFtZSAhPT0gXCJkb3dubG9hZFwiKSB7XG5cdFx0XHRcdG5hbWUgKz0gXCIuZG93bmxvYWRcIjtcblx0XHRcdH1cblx0XHRcdGlmICh0eXBlID09PSBmb3JjZV9zYXZlYWJsZV90eXBlIHx8IHdlYmtpdF9yZXFfZnMpIHtcblx0XHRcdFx0dGFyZ2V0X3ZpZXcgPSB2aWV3O1xuXHRcdFx0fVxuXHRcdFx0aWYgKCFyZXFfZnMpIHtcblx0XHRcdFx0ZnNfZXJyb3IoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0ZnNfbWluX3NpemUgKz0gYmxvYi5zaXplO1xuXHRcdFx0cmVxX2ZzKHZpZXcuVEVNUE9SQVJZLCBmc19taW5fc2l6ZSwgYWJvcnRhYmxlKGZ1bmN0aW9uKGZzKSB7XG5cdFx0XHRcdGZzLnJvb3QuZ2V0RGlyZWN0b3J5KFwic2F2ZWRcIiwgY3JlYXRlX2lmX25vdF9mb3VuZCwgYWJvcnRhYmxlKGZ1bmN0aW9uKGRpcikge1xuXHRcdFx0XHRcdHZhciBzYXZlID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XHRkaXIuZ2V0RmlsZShuYW1lLCBjcmVhdGVfaWZfbm90X2ZvdW5kLCBhYm9ydGFibGUoZnVuY3Rpb24oZmlsZSkge1xuXHRcdFx0XHRcdFx0XHRmaWxlLmNyZWF0ZVdyaXRlcihhYm9ydGFibGUoZnVuY3Rpb24od3JpdGVyKSB7XG5cdFx0XHRcdFx0XHRcdFx0d3JpdGVyLm9ud3JpdGVlbmQgPSBmdW5jdGlvbihldmVudCkge1xuXHRcdFx0XHRcdFx0XHRcdFx0dGFyZ2V0X3ZpZXcubG9jYXRpb24uaHJlZiA9IGZpbGUudG9VUkwoKTtcblx0XHRcdFx0XHRcdFx0XHRcdGZpbGVzYXZlci5yZWFkeVN0YXRlID0gZmlsZXNhdmVyLkRPTkU7XG5cdFx0XHRcdFx0XHRcdFx0XHRkaXNwYXRjaChmaWxlc2F2ZXIsIFwid3JpdGVlbmRcIiwgZXZlbnQpO1xuXHRcdFx0XHRcdFx0XHRcdFx0cmV2b2tlKGZpbGUpO1xuXHRcdFx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0XHRcdFx0d3JpdGVyLm9uZXJyb3IgPSBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdFx0XHRcdHZhciBlcnJvciA9IHdyaXRlci5lcnJvcjtcblx0XHRcdFx0XHRcdFx0XHRcdGlmIChlcnJvci5jb2RlICE9PSBlcnJvci5BQk9SVF9FUlIpIHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0ZnNfZXJyb3IoKTtcblx0XHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdFx0XHRcdFwid3JpdGVzdGFydCBwcm9ncmVzcyB3cml0ZSBhYm9ydFwiLnNwbGl0KFwiIFwiKS5mb3JFYWNoKGZ1bmN0aW9uKGV2ZW50KSB7XG5cdFx0XHRcdFx0XHRcdFx0XHR3cml0ZXJbXCJvblwiICsgZXZlbnRdID0gZmlsZXNhdmVyW1wib25cIiArIGV2ZW50XTtcblx0XHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdFx0XHR3cml0ZXIud3JpdGUoYmxvYik7XG5cdFx0XHRcdFx0XHRcdFx0ZmlsZXNhdmVyLmFib3J0ID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHR3cml0ZXIuYWJvcnQoKTtcblx0XHRcdFx0XHRcdFx0XHRcdGZpbGVzYXZlci5yZWFkeVN0YXRlID0gZmlsZXNhdmVyLkRPTkU7XG5cdFx0XHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRcdFx0XHRmaWxlc2F2ZXIucmVhZHlTdGF0ZSA9IGZpbGVzYXZlci5XUklUSU5HO1xuXHRcdFx0XHRcdFx0XHR9KSwgZnNfZXJyb3IpO1xuXHRcdFx0XHRcdFx0fSksIGZzX2Vycm9yKTtcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdGRpci5nZXRGaWxlKG5hbWUsIHtjcmVhdGU6IGZhbHNlfSwgYWJvcnRhYmxlKGZ1bmN0aW9uKGZpbGUpIHtcblx0XHRcdFx0XHRcdC8vIGRlbGV0ZSBmaWxlIGlmIGl0IGFscmVhZHkgZXhpc3RzXG5cdFx0XHRcdFx0XHRmaWxlLnJlbW92ZSgpO1xuXHRcdFx0XHRcdFx0c2F2ZSgpO1xuXHRcdFx0XHRcdH0pLCBhYm9ydGFibGUoZnVuY3Rpb24oZXgpIHtcblx0XHRcdFx0XHRcdGlmIChleC5jb2RlID09PSBleC5OT1RfRk9VTkRfRVJSKSB7XG5cdFx0XHRcdFx0XHRcdHNhdmUoKTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdGZzX2Vycm9yKCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSkpO1xuXHRcdFx0XHR9KSwgZnNfZXJyb3IpO1xuXHRcdFx0fSksIGZzX2Vycm9yKTtcblx0XHR9XG5cdFx0LCBGU19wcm90byA9IEZpbGVTYXZlci5wcm90b3R5cGVcblx0XHQsIHNhdmVBcyA9IGZ1bmN0aW9uKGJsb2IsIG5hbWUsIG5vX2F1dG9fYm9tKSB7XG5cdFx0XHRyZXR1cm4gbmV3IEZpbGVTYXZlcihibG9iLCBuYW1lLCBub19hdXRvX2JvbSk7XG5cdFx0fVxuXHQ7XG5cdC8vIElFIDEwKyAobmF0aXZlIHNhdmVBcylcblx0aWYgKHR5cGVvZiBuYXZpZ2F0b3IgIT09IFwidW5kZWZpbmVkXCIgJiYgbmF2aWdhdG9yLm1zU2F2ZU9yT3BlbkJsb2IpIHtcblx0XHRyZXR1cm4gZnVuY3Rpb24oYmxvYiwgbmFtZSwgbm9fYXV0b19ib20pIHtcblx0XHRcdGlmICghbm9fYXV0b19ib20pIHtcblx0XHRcdFx0YmxvYiA9IGF1dG9fYm9tKGJsb2IpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIG5hdmlnYXRvci5tc1NhdmVPck9wZW5CbG9iKGJsb2IsIG5hbWUgfHwgXCJkb3dubG9hZFwiKTtcblx0XHR9O1xuXHR9XG5cblx0RlNfcHJvdG8uYWJvcnQgPSBmdW5jdGlvbigpIHtcblx0XHR2YXIgZmlsZXNhdmVyID0gdGhpcztcblx0XHRmaWxlc2F2ZXIucmVhZHlTdGF0ZSA9IGZpbGVzYXZlci5ET05FO1xuXHRcdGRpc3BhdGNoKGZpbGVzYXZlciwgXCJhYm9ydFwiKTtcblx0fTtcblx0RlNfcHJvdG8ucmVhZHlTdGF0ZSA9IEZTX3Byb3RvLklOSVQgPSAwO1xuXHRGU19wcm90by5XUklUSU5HID0gMTtcblx0RlNfcHJvdG8uRE9ORSA9IDI7XG5cblx0RlNfcHJvdG8uZXJyb3IgPVxuXHRGU19wcm90by5vbndyaXRlc3RhcnQgPVxuXHRGU19wcm90by5vbnByb2dyZXNzID1cblx0RlNfcHJvdG8ub253cml0ZSA9XG5cdEZTX3Byb3RvLm9uYWJvcnQgPVxuXHRGU19wcm90by5vbmVycm9yID1cblx0RlNfcHJvdG8ub253cml0ZWVuZCA9XG5cdFx0bnVsbDtcblxuXHRyZXR1cm4gc2F2ZUFzO1xufShcblx0ICAgdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgJiYgc2VsZlxuXHR8fCB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiICYmIHdpbmRvd1xuXHR8fCB0aGlzLmNvbnRlbnRcbikpO1xuLy8gYHNlbGZgIGlzIHVuZGVmaW5lZCBpbiBGaXJlZm94IGZvciBBbmRyb2lkIGNvbnRlbnQgc2NyaXB0IGNvbnRleHRcbi8vIHdoaWxlIGB0aGlzYCBpcyBuc0lDb250ZW50RnJhbWVNZXNzYWdlTWFuYWdlclxuLy8gd2l0aCBhbiBhdHRyaWJ1dGUgYGNvbnRlbnRgIHRoYXQgY29ycmVzcG9uZHMgdG8gdGhlIHdpbmRvd1xuXG5pZiAodHlwZW9mIG1vZHVsZSAhPT0gXCJ1bmRlZmluZWRcIiAmJiBtb2R1bGUuZXhwb3J0cykge1xuICBtb2R1bGUuZXhwb3J0cy5zYXZlQXMgPSBzYXZlQXM7XG59IGVsc2UgaWYgKCh0eXBlb2YgZGVmaW5lICE9PSBcInVuZGVmaW5lZFwiICYmIGRlZmluZSAhPT0gbnVsbCkgJiYgKGRlZmluZS5hbWQgIT09IG51bGwpKSB7XG4gIGRlZmluZShbXSwgZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHNhdmVBcztcbiAgfSk7XG59XG4iLCIndXNlIHN0cmljdCc7XG5cbi8vIGh0dHA6Ly93d3cuY29sb3Iub3JnL3Byb2ZpbGVoZWFkZXIueGFsdGVyXG5cbnZhciB2ZXJzaW9uTWFwID0ge1xuICAweDAyMDAwMDAwOiAnMi4wJyxcbiAgMHgwMjEwMDAwMDogJzIuMScsXG4gIDB4MDI0MDAwMDA6ICcyLjQnLFxuICAweDA0MDAwMDAwOiAnNC4wJyxcbiAgMHgwNDIwMDAwMDogJzQuMidcbn07XG5cbnZhciBpbnRlbnRNYXAgPSB7XG4gIDA6ICdQZXJjZXB0dWFsJyxcbiAgMTogJ1JlbGF0aXZlJyxcbiAgMjogJ1NhdHVyYXRpb24nLFxuICAzOiAnQWJzb2x1dGUnXG59O1xuXG52YXIgdmFsdWVNYXAgPSB7XG4gIC8vIERldmljZVxuICAnc2Nucic6ICdTY2FubmVyJyxcbiAgJ21udHInOiAnTW9uaXRvcicsXG4gICdwcnRyJzogJ1ByaW50ZXInLFxuICAnbGluayc6ICdMaW5rJyxcbiAgJ2Fic3QnOiAnQWJzdHJhY3QnLFxuICAnc3BhYyc6ICdTcGFjZScsXG4gICdubWNsJzogJ05hbWVkIGNvbG9yJyxcbiAgLy8gUGxhdGZvcm1cbiAgJ2FwcGwnOiAnQXBwbGUnLFxuICAnYWRiZSc6ICdBZG9iZScsXG4gICdtc2Z0JzogJ01pY3Jvc29mdCcsXG4gICdzdW53JzogJ1N1biBNaWNyb3N5c3RlbXMnLFxuICAnc2dpJyA6ICdTaWxpY29uIEdyYXBoaWNzJyxcbiAgJ3RnbnQnOiAnVGFsaWdlbnQnXG59O1xuXG52YXIgdGFnTWFwID0ge1xuICAnZGVzYyc6ICdkZXNjcmlwdGlvbicsXG4gICdjcHJ0JzogJ2NvcHlyaWdodCcsXG4gICdkbWRkJzogJ2RldmljZU1vZGVsRGVzY3JpcHRpb24nLFxuICAndnVlZCc6ICd2aWV3aW5nQ29uZGl0aW9uc0Rlc2NyaXB0aW9uJ1xufTtcblxudmFyIGdldENvbnRlbnRBdE9mZnNldEFzU3RyaW5nID0gZnVuY3Rpb24oYnVmZmVyLCBvZmZzZXQpIHtcbiAgdmFyIHZhbHVlID0gYnVmZmVyLnNsaWNlKG9mZnNldCwgb2Zmc2V0ICsgNCkudG9TdHJpbmcoKS50cmltKCk7XG4gIHJldHVybiAodmFsdWUudG9Mb3dlckNhc2UoKSBpbiB2YWx1ZU1hcCkgPyB2YWx1ZU1hcFt2YWx1ZS50b0xvd2VyQ2FzZSgpXSA6IHZhbHVlO1xufTtcblxudmFyIGhhc0NvbnRlbnRBdE9mZnNldCA9IGZ1bmN0aW9uKGJ1ZmZlciwgb2Zmc2V0KSB7XG4gIHJldHVybiAoYnVmZmVyLnJlYWRVSW50MzJCRShvZmZzZXQpICE9PSAwKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzLnBhcnNlID0gZnVuY3Rpb24oYnVmZmVyKSB7XG4gIC8vIFZlcmlmeSBleHBlY3RlZCBsZW5ndGhcbiAgdmFyIHNpemUgPSBidWZmZXIucmVhZFVJbnQzMkJFKDApO1xuICBpZiAoc2l6ZSAhPT0gYnVmZmVyLmxlbmd0aCkge1xuICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBJQ0MgcHJvZmlsZTogbGVuZ3RoIG1pc21hdGNoJyk7XG4gIH1cbiAgLy8gVmVyaWZ5ICdhY3NwJyBzaWduYXR1cmVcbiAgdmFyIHNpZ25hdHVyZSA9IGJ1ZmZlci5zbGljZSgzNiwgNDApLnRvU3RyaW5nKCk7XG4gIGlmIChzaWduYXR1cmUgIT09ICdhY3NwJykge1xuICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBJQ0MgcHJvZmlsZTogbWlzc2luZyBzaWduYXR1cmUnKTtcbiAgfVxuICAvLyBJbnRlZ2VyIGF0dHJpYnV0ZXNcbiAgdmFyIHByb2ZpbGUgPSB7XG4gICAgdmVyc2lvbjogdmVyc2lvbk1hcFtidWZmZXIucmVhZFVJbnQzMkJFKDgpXSxcbiAgICBpbnRlbnQ6IGludGVudE1hcFtidWZmZXIucmVhZFVJbnQzMkJFKDY0KV1cbiAgfTtcbiAgLy8gRm91ci1ieXRlIHN0cmluZyBhdHRyaWJ1dGVzXG4gIFtcbiAgICBbIDQsICdjbW0nXSxcbiAgICBbMTIsICdkZXZpY2VDbGFzcyddLFxuICAgIFsxNiwgJ2NvbG9yU3BhY2UnXSxcbiAgICBbMjAsICdjb25uZWN0aW9uU3BhY2UnXSxcbiAgICBbNDAsICdwbGF0Zm9ybSddLFxuICAgIFs0OCwgJ21hbnVmYWN0dXJlciddLFxuICAgIFs1MiwgJ21vZGVsJ10sXG4gICAgWzgwLCAnY3JlYXRvciddXG4gIF0uZm9yRWFjaChmdW5jdGlvbihhdHRyKSB7XG4gICAgaWYgKGhhc0NvbnRlbnRBdE9mZnNldChidWZmZXIsIGF0dHJbMF0pKSB7XG4gICAgICBwcm9maWxlW2F0dHJbMV1dID0gZ2V0Q29udGVudEF0T2Zmc2V0QXNTdHJpbmcoYnVmZmVyLCBhdHRyWzBdKTtcbiAgICB9XG4gIH0pO1xuICAvLyBUYWdzXG4gIHZhciB0YWdDb3VudCA9IGJ1ZmZlci5yZWFkVUludDMyQkUoMTI4KTtcbiAgdmFyIHRhZ0hlYWRlck9mZnNldCA9IDEzMjtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCB0YWdDb3VudDsgaSsrKSB7XG4gICAgdmFyIHRhZ1NpZ25hdHVyZSA9IGdldENvbnRlbnRBdE9mZnNldEFzU3RyaW5nKGJ1ZmZlciwgdGFnSGVhZGVyT2Zmc2V0KTtcbiAgICBpZiAodGFnU2lnbmF0dXJlIGluIHRhZ01hcCkge1xuICAgICAgdmFyIHRhZ09mZnNldCA9IGJ1ZmZlci5yZWFkVUludDMyQkUodGFnSGVhZGVyT2Zmc2V0ICsgNCk7XG4gICAgICB2YXIgdGFnU2l6ZSA9IGJ1ZmZlci5yZWFkVUludDMyQkUodGFnSGVhZGVyT2Zmc2V0ICsgOCk7XG4gICAgICBpZiAodGFnT2Zmc2V0ID4gYnVmZmVyLmxlbmd0aCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgSUNDIHByb2ZpbGU6IFRhZyBvZmZzZXQgb3V0IG9mIGJvdW5kcycpO1xuICAgICAgfVxuICAgICAgdmFyIHRhZ1R5cGUgPSBnZXRDb250ZW50QXRPZmZzZXRBc1N0cmluZyhidWZmZXIsIHRhZ09mZnNldCk7XG4gICAgICAvLyBkZXNjXG4gICAgICBpZiAodGFnVHlwZSA9PT0gJ2Rlc2MnKSB7XG4gICAgICAgIHZhciB0YWdWYWx1ZVNpemUgPSBidWZmZXIucmVhZFVJbnQzMkJFKHRhZ09mZnNldCArIDgpO1xuICAgICAgICBpZiAodGFnVmFsdWVTaXplID4gdGFnU2l6ZSkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBJQ0MgcHJvZmlsZTogRGVzY3JpcHRpb24gdGFnIHZhbHVlIHNpemUgb3V0IG9mIGJvdW5kcyBmb3IgJyArIHRhZ1NpZ25hdHVyZSk7XG4gICAgICAgIH1cbiAgICAgICAgcHJvZmlsZVt0YWdNYXBbdGFnU2lnbmF0dXJlXV0gPSBidWZmZXIuc2xpY2UodGFnT2Zmc2V0ICsgMTIsIHRhZ09mZnNldCArIHRhZ1ZhbHVlU2l6ZSArIDExKS50b1N0cmluZygpO1xuICAgICAgfVxuICAgICAgLy8gdGV4dFxuICAgICAgaWYgKHRhZ1R5cGUgPT09ICd0ZXh0Jykge1xuICAgICAgICBwcm9maWxlW3RhZ01hcFt0YWdTaWduYXR1cmVdXSA9IGJ1ZmZlci5zbGljZSh0YWdPZmZzZXQgKyA4LCB0YWdPZmZzZXQgKyB0YWdTaXplIC0gNykudG9TdHJpbmcoKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGFnSGVhZGVyT2Zmc2V0ID0gdGFnSGVhZGVyT2Zmc2V0ICsgMTI7XG4gIH1cbiAgcmV0dXJuIHByb2ZpbGU7XG59O1xuIiwidmFyIGljYyA9IHJlcXVpcmUoJ2ljYycpO1xudmFyIEJ1ZmZlciA9IHJlcXVpcmUoJ2J1ZmZlcicpLkJ1ZmZlcjtcbnZhciBhcnJheUJ1ZmZlckNvbmNhdCA9IHJlcXVpcmUoJ2FycmF5LWJ1ZmZlci1jb25jYXQnKTtcbnZhciBsb2FkSW1hZ2UgPSByZXF1aXJlKCdibHVlaW1wLWxvYWQtaW1hZ2UnKTtcbnZhciBzYXZlQXMgPSByZXF1aXJlKCdicm93c2VyLWZpbGVzYXZlcicpLnNhdmVBcztcbnJlcXVpcmUoJ2JsdWVpbXAtY2FudmFzLXRvLWJsb2InKTtcblxuLy8gQ3JlYXRlIHBhcnNlciBhcnJheSBmb3IgQVBQMiBzZWdtZW50XG5sb2FkSW1hZ2UubWV0YURhdGFQYXJzZXJzLmpwZWdbMHhmZmUyXSA9IFtdO1xuXG4vLyBBZGQgcGFyc2VyXG5sb2FkSW1hZ2UubWV0YURhdGFQYXJzZXJzLmpwZWdbMHhmZmUyXS5wdXNoKGZ1bmN0aW9uIChkYXRhVmlldywgb2Zmc2V0LCBsZW5ndGgsIGRhdGEsIG9wdGlvbnMpIHtcbiAgLy8gR3JhYiB0aGUgSUNDIHByb2ZpbGUgZnJvbSB0aGUgQVBQMiBzZWdtZW50KHMpIG9mIHRoZSBoZWFkZXJcbiAgdmFyIGljY0NodW5rID0gZGF0YVZpZXcuYnVmZmVyLnNsaWNlKG9mZnNldCArIDE4LCBvZmZzZXQgKyBsZW5ndGgpO1xuXG4gIGlmIChpY2NDaHVuay5ieXRlTGVuZ3RoID4gMCkge1xuICAgIGlmIChkYXRhLmljY1Byb2ZpbGUpIHtcbiAgICAgIC8vIFByb2ZpbGUgaXMgc3BsaXQgYWNjcm9zcyBtdWx0aXBsZSBzZWdtZW50cyBzbyB3ZSBuZWVkIHRvIGNvbmNhdGVuYXRlIHRoZSBjaHVua3NcbiAgICAgIGRhdGEuaWNjUHJvZmlsZSA9IGFycmF5QnVmZmVyQ29uY2F0KGRhdGEuaWNjUHJvZmlsZSwgaWNjQ2h1bmspO1xuICAgIH0gZWxzZSB7XG4gICAgICBkYXRhLmljY1Byb2ZpbGUgPSBpY2NDaHVuaztcbiAgICB9XG4gIH1cbn0pO1xuXG5mdW5jdGlvbiBmaWxlSGFuZGxlciAoZXZlbnQpIHtcbiAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcblxuICBldmVudCA9IGV2ZW50Lm9yaWdpbmFsRXZlbnQgfHwgZXZlbnQ7XG5cbiAgdmFyIHRhcmdldCA9IGV2ZW50LmRhdGFUcmFuc2ZlciB8fCBldmVudC50YXJnZXQ7XG5cbiAgdmFyIGZpbGVPckJsb2IgPSB0YXJnZXQgJiYgdGFyZ2V0LmZpbGVzICYmIHRhcmdldC5maWxlc1swXTtcblxuICBpZiAoIWZpbGVPckJsb2IpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICBsb2FkSW1hZ2UucGFyc2VNZXRhRGF0YShmaWxlT3JCbG9iLCBmdW5jdGlvbiAoZGF0YSkge1xuICAgIGlmICghZGF0YS5pbWFnZUhlYWQpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ05vIGltYWdlIGhlYWRlcicsIGZpbGVPckJsb2IpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnNvbGUubG9nKGRhdGEpO1xuXG4gICAgLy8gdmFyIGV4aWYgPSBkYXRhLmV4aWYuZ2V0QWxsKCk7XG4gICAgLy8gY29uc29sZS5sb2coZXhpZik7XG5cbiAgICBpZiAoZGF0YS5pY2NQcm9maWxlKSB7XG4gICAgICAvLyBDb252ZXJ0IHRoZSBwcm9maWxlIEFycmF5QnVmZmVyIGludG8gYSBub3JtYWwgYnVmZmVyIGZvciB0aGUgYGljY2AgcGFyc2VyIG1vZHVsZVxuICAgICAgdmFyIGJ1ZmZlciA9IG5ldyBCdWZmZXIoZGF0YS5pY2NQcm9maWxlLmJ5dGVMZW5ndGgpO1xuICAgICAgdmFyIHZpZXcgPSBuZXcgVWludDhBcnJheShkYXRhLmljY1Byb2ZpbGUpO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBidWZmZXIubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgYnVmZmVyW2ldID0gdmlld1tpXTtcbiAgICAgIH1cblxuICAgICAgLy8gUGFyc2UgdGhlIHByb2ZpbGVcbiAgICAgIHZhciBwcm9maWxlID0gaWNjLnBhcnNlKGJ1ZmZlcik7XG4gICAgICBjb25zb2xlLmRpcihwcm9maWxlKTtcblxuICAgICAgLy8gSnVzdCBmb3IgZnVuIGNvbnZlcnQgdGhlIHByb2ZpbGUgaW50byBhIGJsb2IgZm9yIGRvd25sb2FkXG4gICAgICB2YXIgaWNjQmxvYiA9IG5ldyBCbG9iKFtkYXRhLmljY1Byb2ZpbGVdLCB7dHlwZTogJ2FwcGxpY2F0aW9uL3ZuZC5pY2Nwcm9maWxlJ30pO1xuICAgICAgc2F2ZUFzKGljY0Jsb2IsICdwcm9maWxlLmljYycpO1xuICAgIH1cblxuICAgIGxvYWRJbWFnZShmaWxlT3JCbG9iLCBmdW5jdGlvbiAocmVzaXplZEltYWdlQ2FudmFzKSB7XG4gICAgICByZXNpemVkSW1hZ2VDYW52YXMudG9CbG9iKGZ1bmN0aW9uIChyZXNpemVkQmxvYikge1xuICAgICAgICAvLyBDb21iaW5lIGRhdGEuaW1hZ2VIZWFkIHdpdGggdGhlIGltYWdlIGJvZHkgb2YgYSByZXNpemVkIGZpbGVcbiAgICAgICAgLy8gdG8gY3JlYXRlIHNjYWxlZCBpbWFnZXMgd2l0aCB0aGUgb3JpZ2luYWwgaW1hZ2UgbWV0YSBkYXRhLCBlLmcuOlxuICAgICAgICB2YXIgYmxvYiA9IG5ldyBCbG9iKFtcbiAgICAgICAgICBkYXRhLmltYWdlSGVhZCxcbiAgICAgICAgICAvLyBSZXNpemVkIGltYWdlcyBhbHdheXMgaGF2ZSBhIGhlYWQgc2l6ZSBvZiAyMCBieXRlcyxcbiAgICAgICAgICAvLyBpbmNsdWRpbmcgdGhlIEpQRUcgbWFya2VyIGFuZCBhIG1pbmltYWwgSkZJRiBoZWFkZXI6XG4gICAgICAgICAgbG9hZEltYWdlLmJsb2JTbGljZS5jYWxsKHJlc2l6ZWRCbG9iLCAyMCksXG4gICAgICAgIF0sIHtcbiAgICAgICAgICB0eXBlOiByZXNpemVkQmxvYi50eXBlLFxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBEb3dubG9hZCB0aGUgcmVzaXplZCBpbWFnZVxuICAgICAgICBzYXZlQXMoYmxvYiwgJ2ltYWdlLmpwZycpO1xuXG4gICAgICB9LFxuICAgICAgICAnaW1hZ2UvanBlZydcbiAgICAgICk7XG5cbiAgICB9LCB7XG4gICAgICBtYXhXaWR0aDogNTAwLFxuICAgICAgbWF4SGVpZ2h0OiA1MDAsXG4gICAgICBjYW52YXM6IHRydWUsXG4gICAgfSk7XG5cbiAgfSwge1xuICAgIC8vIEluY3JlYXNlIHRoZSBtZXRhZGF0YSBzaXplIGZvciBDTVlLIHByb2ZpbGVzXG4gICAgLy8gdGhlc2UgYXJlIGxhcmdlciBhcyB0aGV5IGNvbnRhaW4gbW9yZSBpbmZvXG4gICAgLy8gcmVxdWlyZWQgdG8gY29udmVydCB0aGUgY29sb3JzcGFjZSg/KTpcbiAgICBtYXhNZXRhRGF0YVNpemU6IDEwMjQwMDAsXG4gICAgZGlzYWJsZUltYWdlSGVhZDogZmFsc2UsXG4gIH1cbiAgKTtcbn1cblxuZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2ZpbGUtaW5wdXQnKS5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCBmaWxlSGFuZGxlcik7XG4iXX0=
