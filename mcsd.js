const winston = require('winston');
const async = require('async');
const request = require('request');
const URI = require('urijs');
const moment = require('moment');
const uuid5 = require('uuid/v5');
const namespace = '7a49e794-db80-11e9-8a34-2a2ae2dbcce4'
module.exports = function (config) {
  return {
    saveDXF(metadata, callback) {
      winston.info('Now writting org units into the database');

      const max = metadata.organisationUnits.length;

      let i = 0;
      async.eachSeries(metadata.organisationUnits, (org, nxtOrg) => {
        winston.info(`Processing (${++i}/${max}) ${org.id}`);
        let OrganizationResource
        const LocationResource = {
          resourceType: 'Location',
          id: uuid5('Location' + org.id, namespace),
          status: 'active',
          mode: 'instance',
        };
        LocationResource.identifier = [{
            system: 'http://dhis2.org/code',
            value: org.code,
          },
          {
            system: 'http://dhis2.org/id',
            value: org.id,
          },
        ];
        LocationResource.meta = {
          lastUpdated: org.lastUpdated,
        };
        const path = org.path.split('/');
        LocationResource.name = org.name;
        LocationResource.alias = [org.shortName];
        if (metadata.organisationUnits.find(x => x.parent && x.parent.id && x.parent.id == org.id)) {
          if (!LocationResource.meta) {
            LocationResource.meta = {};
          }
          LocationResource.meta.profile = [];
          LocationResource.meta.profile.push('http://ihe.net/LocationResource/StructureDefinition/IHE_mCSD_Location');
          LocationResource.physicalType = {
            coding: [{
              system: 'http://hl7.org/LocationResource/location-physical-type',
              code: 'ju',
              display: 'Jurisdiction',
            }],
            text: 'Jurisdiction',
          };
        } else {
          if (!LocationResource.meta) {
            LocationResource.meta = {};
          }
          LocationResource.meta.profile = [];
          LocationResource.meta.profile.push('http://ihe.net/LocationResource/StructureDefinition/IHE_mCSD_Location');
          LocationResource.meta.profile.push('http://ihe.net/LocationResource/StructureDefinition/IHE_mCSD_FacilityLocation');
          LocationResource.physicalType = {
            coding: [{
              system: 'http://hl7.org/LocationResource/location-physical-type',
              code: 'bu',
              display: 'Building',
            }],
            text: 'Facility',
          };
          LocationResource.type = [];
          const coding = [];
          coding.push({
            system: 'urn:ietf:rfc:3986',
            code: 'urn:ihe:iti:mcsd:2019:facility',
            display: 'Facility',
            userSelected: false,
          });
          LocationResource.type.push({
            coding,
          });
          OrganizationResource = {}
          OrganizationResource.id = uuid5('Organization' + org.id, namespace);
          OrganizationResource.resourceType = 'Organization';
          OrganizationResource.meta = {};
          OrganizationResource.meta.profile = [];
          OrganizationResource.meta.profile.push('http://ihe.net/fhir/StructureDefinition/IHE_mCSD_Organization');
          OrganizationResource.meta.profile.push('http://ihe.net/fhir/StructureDefinition/IHE_mCSD_FacilityOrganization');
          OrganizationResource.name = org.name;
          LocationResource.managingOrganization = {
            reference: `Organization/${OrganizationResource.id}`,
          };
        }

        if (org.featureType == 'POINT' && org.coordinates) {
          try {
            const coords = JSON.parse(org.coordinates);
            LocationResource.position = {
              longitude: coords[0],
              latitude: coords[1],
            };
          } catch (e) {
            winston.error(`Failed to load coordinates. ${e.message}`);
          }
        }
        if (org.hasOwnProperty('parent') && org.parent.id) {
          LocationResource.partOf = {
            reference: `Location/${org.parent.id}`,
          };
        }
        if (!LocationResource.extension) {
          LocationResource.extension = []
        }
        if (org.attributeValues) {
          for (const attr of org.attributeValues) {
            let attrExtension = {
              url: 'http://datim.org/fhir/StructureDefinition/DHIS2Attribute',
              extension: []
            }
            attrExtension.extension.push({
              url: 'id',
              valueString: attr.attribute.id
            })
            attrExtension.extension.push({
              url: 'value',
              valueString: attr.value
            })
            attrExtension.extension.push({
              url: 'lastUpdated',
              valueDateTime: moment(attr.lastUpdated).format('YYYY-MM-DDTHH:mm:ssZ')
            })
            attrExtension.extension.push({
              url: 'created',
              valueDateTime: moment(attr.created).format('YYYY-MM-DDTHH:mm:ssZ')
            })
            LocationResource.extension.push(attrExtension)
          }
        }
        if (org.openingDate) {
          LocationResource.extension.push({
            url: 'http://datim.org/fhir/StructureDefinition/openingDate',
            valueDateTime: moment(org.openingDate).format('YYYY-MM-DDTHH:mm:ssZ')
          })
        }
        if (org.lastUpdated) {
          LocationResource.extension.push({
            url: 'http://datim.org/fhir/StructureDefinition/lastUpdated',
            valueDateTime: moment(org.lastUpdated).format('YYYY-MM-DDTHH:mm:ssZ')
          })
        }
        if (org.created) {
          LocationResource.extension.push({
            url: 'http://datim.org/fhir/StructureDefinition/created',
            valueDateTime: moment(org.created).format('YYYY-MM-DDTHH:mm:ssZ')
          })
        }
        if (org.featureType) {
          LocationResource.extension.push({
            url: 'http://datim.org/fhir/StructureDefinition/featureType',
            valueString: org.featureType
          })
        }
        let level;
        if (metadata.hasOwnProperty('organisationUnitLevels')) {
          level = metadata.organisationUnitLevels.find(x => x.level == path.length - 1);
        }
        if (level) {
          let levelsExtension = {
            url: 'http://datim.org/fhir/StructureDefinition/organistionUnitLevels',
            extension: []
          }
          levelsExtension.extension.push({
            url: 'id',
            valueString: level.id
          })
          levelsExtension.extension.push({
            url: 'name',
            valueString: level.name
          })
          LocationResource.extension.push(levelsExtension)
        }
        const mcsd = {};
        mcsd.entry = [];
        mcsd.type = 'batch';
        mcsd.resourceType = 'Bundle';
        mcsd.entry.push({
          resource: LocationResource,
          request: {
            method: 'PUT',
            url: `Location/${LocationResource.id}`,
          },
        });
        if (OrganizationResource) {
          mcsd.entry.push({
            resource: OrganizationResource,
            request: {
              method: 'PUT',
              url: `Organization/${OrganizationResource.id}`,
            },
          });
        }
        winston.error(JSON.stringify(mcsd, 0, 2))
        hostURL = URI(config.url).segment('fhir').toString();
        options = {
          url: hostURL.toString(),
          headers: {
            'Content-Type': 'application/json',
          },
          json: mcsd,
        };
        request.post(options, (err, res, body) => {
          if (err) {
            winston.error(err);
          } else {
            winston.info(body);
          }
          return nxtOrg();
        });
      }, () => {
        return callback()
      });
    }
  }
}