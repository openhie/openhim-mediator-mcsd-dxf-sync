const winston = require('winston');
const http = require('http');
const https = require('https');
const url = require('url');
const URI = require('urijs');
const isJSON = require('is-json');
const request = require('request');


module.exports = function (config) {
  return {
    resetSync() {
      const dhis2URL = url.parse(config.url);
      const auth = `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`;

      winston.info(`Attempting to reset time on ${config.url}\n`);

      const req = (dhis2URL.protocol == 'https:' ? https : http).request({
        hostname: dhis2URL.hostname,
        port: dhis2URL.port,
        path: `${dhis2URL.path}/api/dataStore/CSD-Loader-Last-Export/mCSDServer`,
        headers: {
          Authorization: auth,
        },
        method: 'DELETE',
      }, (res) => {
        winston.info(`Reset request returned with code ${res.statusCode}`);
        res.on('end', () => {});
        res.on('error', (e) => {
          console.log(`ERROR: ${e.message}`);
        });
      }).end();
    },
    getLastUpdate(callback) {
      return callback(false)
      const dhis2URL = url.parse(config.url);
      const auth = `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`;
      winston.info('getting lastupdated time');
      if (dhis2URL.port < 0 || dhis2URL.port >= 65536) {
        winston.error('port number is out of range');
        return callback(false);
      }
      const req = (dhis2URL.protocol == 'https:' ? https : http).request({
        hostname: dhis2URL.hostname,
        port: dhis2URL.port,
        path: `${dhis2URL.path}/api/dataStore/CSD-Loader-Last-Export/mCSDServer`,
        headers: {
          Authorization: auth,
        },
        method: 'GET',
      });
      req.on('response', (res) => {
        winston.info(`Request to get lastupdated time has responded with code ${res.statusCode}`);
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          let dataStore;
          try {
            dataStore = JSON.parse(body);
          } catch (error) {
            return callback(false);
          }
          if (!dataStore.hasOwnProperty('value')) {
            return callback(false);
          }
          return callback(dataStore.value);
        });
        res.on('error', (e) => {
          winston.error(`ERROR: ${e.message}`);
          return callback(false);
        });
      });
      req.on('error', (err) => {
        winston.error(err);
        return callback(false);
      });
      req.end();
    },
    getOrgUnits(callback) {
      let full = config.full
      let dousers = config.dousers
      let doservices = config.doservices

      // const hasKey = true // await checkLoaderDataStore();
      /* let lastUpdate = false;
      if (!full && hasKey) {
        lastUpdate = await getLastUpdate(credentials.name, credentials.dhis2URL, credentials.auth);
        // Convert to yyyy-mm-dd format (dropping time as it is ignored by DHIS2)
        lastUpdate = new Date(Date.parse(lastUpdate)).toISOString().substr(0, 10);
      } */

      this.getLastUpdate((lastUpdate) => {
        if (!full && lastUpdate) {
          lastUpdate = new Date(Date.parse(lastUpdate)).toISOString().substr(0, 10);
        }
        let uflag = 'false';
        if (dousers) {
          uflag = 'true';
        }
        let sflag = 'false';
        if (doservices) {
          sflag = 'true';
        }

        const metadataOpts = {
          assumeTrue: false,
          organisationUnits: true,
          organisationUnitGroups: true,
          organisationUnitLevels: true,
          organisationUnitGroupSets: true,
          categoryOptions: sflag,
          optionSets: sflag,
          dataElementGroupSets: sflag,
          categoryOptionGroupSets: sflag,
          categoryCombos: sflag,
          options: sflag,
          categoryOptionCombos: sflag,
          dataSets: sflag,
          dataElementGroups: sflag,
          dataElements: sflag,
          categoryOptionGroups: sflag,
          categories: sflag,
          users: uflag,
          userGroups: uflag,
          userRoles: uflag,
        };
        if (!full && lastUpdate) {
          metadataOpts.push(`filter=lastUpdated:gt:${lastUpdate}`);
        }
        // const dhis2URL = url.parse(config.url);
        const auth = `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`;

        dhis2URL = URI(config.url).segment('api').segment('metadata.json');
        for (let metadataOpt in metadataOpts) {
          dhis2URL.addQuery(metadataOpt, metadataOpts[metadataOpt])
        }
        winston.info(`GETTING ${dhis2URL.toString()}`);
        options = {
          url: dhis2URL.toString(),
          headers: {
            Authorization: auth,
          }
        };
        request.get(options, (err, res, body) => {
          winston.info(`Request to get Metadata responded with code ${res.statusCode}`);
          if (err) {
            winston.error(err)
            return callback(true, null, null)
          }
          if (!isJSON(body)) {
            winston.error(body);
            winston.error('Non JSON response received while getting DHIS2 data');
            callback(true, null, null)
          } else {
            let metadata;
            try {
              metadata = JSON.parse(body);
            } catch (error) {
              winston.error(error);
              winston.error(body);
              winston.error('An error occured while parsing response from DHIS2 server');
              return callback(true, null, null)
            }

            if (!metadata.hasOwnProperty('organisationUnits')) {
              winston.info('No organization unit found in metadata');
              const thisRunTime = new Date().toISOString();
              setLastUpdate(lastUpdate, thisRunTime);
              return callback(false, null, lastUpdate)
            } else {
              return callback(false, metadata, lastUpdate)
            }
          }
        })
      });
    },
  };
};

function checkLoaderDataStore() {
  const name = credentials.name;
  const dhis2URL = credentials.dhis2URL;
  const auth = credentials.auth;
  winston.info('Checking loader datastore');
  return new Promise((resolve, reject) => {
    const req = (dhis2URL.protocol == 'https:' ? https : http).request({
      hostname: dhis2URL.hostname,
      port: dhis2URL.port,
      path: `${dhis2URL.path}api/dataStore/CSD-Loader-Last-Export/${mixin.toTitleCase(name)}`,
      headers: {
        Authorization: auth,
      },
      method: 'GET',
    });
    req.on('response', (res) => {
      winston.info(`Loader datastore responded with code ${res.statusCode}`);
      if (res.statusCode == 200 || res.statusCode == 201) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
    req.on('error', (err) => {
      reject(err);
    });
    req.end();
  });
}