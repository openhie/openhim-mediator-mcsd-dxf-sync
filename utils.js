'use strict'

const URI = require('urijs')

exports.buildOrchestration = (name, beforeTimestamp, method, url, requestContent, res, body) => {
  let uri = new URI(url)
  var body = JSON.stringify({"response":"Response Disabled"})
  if(res == undefined || res == null || res == false) {
    var statusCode = 503
  }
  else if('statusCode' in res) {
    var statusCode = res.statusCode
    var header = res.headers
  }
  return {
    name: name,
    request: {
      method: method,
      body: requestContent,
      timestamp: beforeTimestamp,
      path: uri.path(),
      querystring: uri.query()

    },
    response: {
      status: statusCode,
      headers: header,
      body: body,
      timestamp: new Date()
    }
  }
}
