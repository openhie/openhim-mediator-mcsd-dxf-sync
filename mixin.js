const winston = require('winston');
const request = require('request');
const URI = require('urijs');
module.exports = function (dhis2Config, mcsdConfig) {
  return {
    setLastUpdate(hasKey, lastUpdate) {
      winston.info('setting lastupdated time');
      const dhis2URL = URI(dhis2Config.url).segment('api').segment('dataStore').segment('CSD-Loader-Last-Export').segment('mCSDServer').toString();
      const auth = `Basic ${Buffer.from(`${dhis2Config.username}:${dhis2Config.password}`).toString('base64')}`;
      const payload = {
        value: lastUpdate,
      };
      const options = {
        url: dhis2URL,
        headers: {
          Authorization: auth,
          'Content-Type': 'application/json',
        },
        json: payload,
      };
      let method = 'POST'
      if (hasKey) {
        method = 'PUT'
      }
      winston.error(dhis2URL)
      request({
        method,
        uri: dhis2URL
      }, options, (err, res, body) => {
        if (err) {
          winston.error(err)
        }
        winston.info(`request to set lastupdated time has responded with code ${res.statusCode}`);
        if (res.statusCode == 200 || res.statusCode == 201) {
          winston.info('Last update dataStore set.');
        } else {
          winston.error('Last update dataStore FAILED.');
        }
        const dataStore = JSON.parse(body);
        winston.info(dataStore);
      })
    }
  }
}