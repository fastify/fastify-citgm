'use strict'

const ora = require('ora')

function Logger (text) {
  if (!(this instanceof Logger)) {
    return new Logger(text)
  }
  this.spinner = ora(text).start()
}

Logger.prototype.text = function (text) {
  this.spinner.text = text
}

Logger.prototype.color = function (color) {
  this.spinner.color = color
}

Logger.prototype.succeed = function (text) {
  this.spinner.succeed(text)
}

Logger.prototype.fail = function (text) {
  this.spinner.fail(text)
}

Logger.prototype.warn = function (text) {
  this.spinner.warn(text)
}

Logger.prototype.info = function (text) {
  this.spinner.info(text)
}

module.exports = Logger
