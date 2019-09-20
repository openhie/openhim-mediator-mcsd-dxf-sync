#!/usr/bin/env node

'use strict'

const winston = require('winston');
const medUtils = require('openhim-mediator-utils')
const express = require('express')
const request = require('request');
const DHIS2 = require('./dhis2');
const mCSD = require('./mcsd')
const MIXIN = require('./mixin')

const port = 9002
// Config
var config = {} // this will vary depending on whats set in openhim-core
const apiConf = require('./config/config')
const mediatorConfig = require('./config/mediator')

// socket config - large documents can cause machine to max files open
const https = require('https')
const http = require('http')

https.globalAgent.maxSockets = 32
http.globalAgent.maxSockets = 32

// Logging setup
winston.remove(winston.transports.Console)
winston.add(winston.transports.Console, {
  level: 'info',
  timestamp: true,
  colorize: true
})

//set environment variable so that the mediator can be registered
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;

/**
 * setupApp - configures the http server for this mediator
 *
 * @return {express.App}  the configured http server
 */
function setupApp() {
  const app = express()

  function updateTransaction(req, body, statatusText, statusCode, orchestrations) {
    const transactionId = req.headers['x-openhim-transactionid']
    var update = {
      'x-mediator-urn': mediatorConfig.urn,
      status: statatusText,
      response: {
        status: statusCode,
        timestamp: new Date(),
        body: body
      },
      orchestrations: orchestrations
    }
    medUtils.authenticate(apiConf.api, function (err) {
      if (err) {
        return winston.error(err.stack);
      }
      var headers = medUtils.genAuthHeaders(apiConf.api)
      var options = {
        url: apiConf.api.apiURL + '/transactions/' + transactionId,
        headers: headers,
        json: update
      }

      request.put(options, function (err, apiRes, body) {
        if (err) {
          return winston.error(err);
        }
        if (apiRes.statusCode !== 200) {
          return winston.error(new Error('Unable to save updated transaction to OpenHIM-core, received status code ' + apiRes.statusCode + ' with body ' + body).stack);
        }
        winston.info('Successfully updated transaction with id ' + transactionId);
      });
    })
  }

  app.get('/DXFTomCSD', (req, res) => {
    winston.info('Received a request to convert DXF to mCSD')
    const dhis2 = DHIS2(config.dhis2)
    const mcsd = mCSD(config.mcsdServer)
    const mixin = MIXIN(config.dhis2)
    res.end();
    updateTransaction(req, 'Still Processing', 'Processing', '200', '');
    let orchestrations = [];
    const thisRunTime = new Date().toISOString();
    mixin.setLastUpdate(false, thisRunTime)
    dhis2.getOrgUnits((error, metadata, hasLastUpdate) => {
      if (error) {
        updateTransaction(req, '', 'Failed', '500', orchestrations);
      } else {
        const thisRunTime = new Date().toISOString();
        mixin.setLastUpdate(hasLastUpdate, thisRunTime)
      }
      if (metadata) {
        mcsd.saveDXF(metadata, () => {
          updateTransaction(req, '', 'Successful', '200', orchestrations);
        })
      }
    })
  })

  return app
}

/**
 * start - starts the mediator
 *
 * @param  {Function} callback a node style callback that is called once the
 * server is started
 */
function start(callback) {
  if (apiConf.register) {
    medUtils.registerMediator(apiConf.api, mediatorConfig, (err) => {
      if (err) {
        winston.error('Failed to register this mediator, check your config')
        winston.error(err.stack)
        process.exit(1)
      }
      apiConf.api.urn = mediatorConfig.urn
      medUtils.fetchConfig(apiConf.api, (err, newConfig) => {
        winston.info('Received initial config:', newConfig)
        config = newConfig
        if (err) {
          winston.info('Failed to fetch initial config')
          winston.info(err.stack)
          process.exit(1)
        } else {
          winston.info('Successfully registered mediator!')
          let app = setupApp()
          const server = app.listen(port, () => {
            let configEmitter = medUtils.activateHeartbeat(apiConf.api)
            configEmitter.on('config', (newConfig) => {
              winston.info('Received updated config:', newConfig)
              // set new config for mediator
              config = newConfig
            })
            callback(server)
          })
        }
      })
    })
  } else {
    // default to config from mediator registration
    config = mediatorConfig.config
    let app = setupApp()
    const server = app.listen(port, () => callback(server))
  }
}
exports.start = start

if (!module.parent) {
  // if this script is run directly, start the server
  start(() => winston.info('Listening on ' + port + '...'))
}