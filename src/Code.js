/* global DataStudioApp */

if (typeof(require) !== 'undefined') {
  var retrieveOrGet = require('./utils.js')['retrieveOrGet'];
}

// eslint-disable-next-line no-unused-vars
function getAuthType(request) {
  var response = { type: 'NONE' };
  return response;
}

// eslint-disable-next-line no-unused-vars
function getConfig() {
  var cc = DataStudioApp.createCommunityConnector();
  var config = cc.getConfig();

  config.newInfo()
    .setId('instructions')
    .setText('You can find your SimilarWeb API key or create a new one here (a SimilarWeb Pro account is needed): https://account.similarweb.com/#/api-management');

  config.newTextInput()
    .setId('apiKey')
    .setName('Your SimilarWeb API key')
    .setHelpText('Enter your 32-character SimilarWeb API key')
    .setPlaceholder('1234567890abcdef1234567890abcdef');

  config.newTextInput()
    .setId('domains')
    .setName('Domains')
    .setHelpText('Enter the name of up to 10 domains you would like to analyze, separated by commas (e.g. cnn.com, bbc.com, nytimes.com)')
    .setPlaceholder('cnn.com, bbc.com, nytimes.com')
    .setAllowOverride(true);

  config.newTextInput()
    .setId('country')
    .setName('Country Code')
    .setHelpText('ISO 2-letter country code of the country (e.g. us, gb - world for Worldwide)')
    .setPlaceholder('us')
    .setAllowOverride(true);

  return config.build();
}

// eslint-disable-next-line no-unused-vars
function getFields() {
  var cc = DataStudioApp.createCommunityConnector();
  var fields = cc.getFields();
  var types = cc.FieldType;
  var aggregations = cc.AggregationType;

  fields.newDimension()
    .setId('date')
    .setName('Date')
    .setType(types.YEAR_MONTH_DAY);

  fields.newDimension()
    .setId('domain')
    .setName('Domain')
    .setGroup('Dimensions')
    .setType(types.TEXT);

  fields.newDimension()
    .setId('device')
    .setName('Device')
    .setGroup('Dimensions')
    .setDescription('Device type: Desktop or Mobile Web')
    .setType(types.TEXT);

  fields.newMetric()
    .setId('visits')
    .setName('Visits')
    .setDescription('SimilarWeb estimated number of visits')
    .setType(types.NUMBER)
    .setIsReaggregatable(true)
    .setAggregation(aggregations.SUM);

  fields.newMetric()
    .setId('page_views')
    .setName('Total Page Views')
    .setDescription('SimilarWeb estimated number of pages views')
    .setType(types.NUMBER)
    .setIsReaggregatable(true)
    .setAggregation(aggregations.SUM)
    .setIsHidden(true);

  fields.newMetric()
    .setId('ppv')
    .setName('Pages per Visit')
    .setDescription('Average number of pages visited per session')
    .setType(types.NUMBER)
    .setFormula('sum($page_views)/sum($visits)')
    .setIsReaggregatable(false);

  fields.newMetric()
    .setId('visits_duration')
    .setName('Total Visits Duration')
    .setDescription('SimilarWeb estimated amount of time spent on domain')
    .setType(types.NUMBER)
    .setIsReaggregatable(true)
    .setAggregation(aggregations.SUM)
    .setIsHidden(true);

  fields.newMetric()
    .setId('avg_visit_duration')
    .setName('Avg. Visit Duration')
    .setDescription('Average time spent per visit, in seconds')
    .setType(types.DURATION)
    .setFormula('sum($visits_duration)/sum($visits)')
    .setIsReaggregatable(false);

  fields.newMetric()
    .setId('bounced_visits')
    .setName('Bounced Visits')
    .setDescription('SimilarWeb estimated number of bounced visits')
    .setType(types.NUMBER)
    .setIsReaggregatable(true)
    .setAggregation(aggregations.SUM)
    .setIsHidden(true);

  fields.newMetric()
    .setId('bounce_rate')
    .setName('Bounce rate')
    .setDescription('Rate of visits for which no other interaction has been detected 30 minutes after the user first accessed the page')
    .setType(types.PERCENT)
    .setFormula('sum($bounced_visits)/sum($visits)')
    .setIsReaggregatable(false);

  fields.setDefaultDimension('domain');
  fields.setDefaultMetric('visits');

  return fields;
}

// eslint-disable-next-line no-unused-vars
function getSchema(request) {
  var fields = getFields().build();
  return { schema: fields };
}

// eslint-disable-next-line no-unused-vars
function getData(request) {
  var MAX_NB_DOMAINS = 10;
  var country = request.configParams.country;
  var apiKey = request.configParams.apiKey;
  var domains = request.configParams.domains.split(',').slice(0, MAX_NB_DOMAINS).map(function(domain) {
    return domain.trim().replace(/^(?:https?:\/\/)?(?:www\.)?/i, '').replace(/\/.*$/i, '').toLowerCase();
  });

  var requestedFieldIDs = request.fields.map(function(field) {
    return field.name;
  });
  console.log('requested fields ids', JSON.stringify(requestedFieldIDs));
  var requestedFields = getFields().forIds(requestedFieldIDs);

  // Prepare data to be fetched
  var endpoints = {
    desktopVisits: {
      url: 'https://api.similarweb.com/v1/website/xxx/traffic-and-engagement/visits-full',
      objectName: 'visits',
      device: 'desktop',
      isRequired: false
    },
    mobileVisits: {
      url: 'https://api.similarweb.com/v2/website/xxx/mobile-web/visits-full',
      objectName: 'visits',
      device: 'mobile',
      isRequired: false
    },
    desktopPagesPerVisit: {
      url: 'https://api.similarweb.com/v1/website/xxx/traffic-and-engagement/pages-per-visit-full',
      objectName: 'pages_per_visit',
      device: 'desktop',
      isRequired: false
    },
    mobilePagesPerVisit: {
      url: 'https://api.similarweb.com/v2/website/xxx/mobile-web/pages-per-visit-full',
      objectName: 'pages_per_visit',
      device: 'mobile',
      isRequired: false
    },
    desktopAvgVisitDuration: {
      url: 'https://api.similarweb.com/v1/website/xxx/traffic-and-engagement/average-visit-duration-full',
      objectName: 'average_visit_duration',
      device: 'desktop',
      isRequired: false
    },
    mobileAvgVisitDuration: {
      url: 'https://api.similarweb.com/v2/website/xxx/mobile-web/average-visit-duration-full',
      objectName: 'average_visit_duration',
      device: 'mobile',
      isRequired: false
    },
    desktopBounceRate: {
      url: 'https://api.similarweb.com/v1/website/xxx/traffic-and-engagement/bounce-rate-full',
      objectName: 'bounce_rate',
      device: 'desktop',
      isRequired: false
    },
    mobileBounceRate: {
      url: 'https://api.similarweb.com/v2/website/xxx/mobile-web/bounce-rate-full',
      objectName: 'bounce_rate',
      device: 'mobile',
      isRequired: false
    }
  };

  requestedFields.asArray().forEach(function (field) {
    switch (field.getId()) {
    case 'visits':
      endpoints.desktopVisits.isRequired = true;
      endpoints.mobileVisits.isRequired = true;
      break;
    case 'page_views':
      endpoints.desktopVisits.isRequired = true;
      endpoints.desktopPagesPerVisit.isRequired = true;
      endpoints.mobileVisits.isRequired = true;
      endpoints.mobilePagesPerVisit.isRequired = true;
      break;
    case 'visits_duration':
      endpoints.desktopVisits.isRequired = true;
      endpoints.desktopAvgVisitDuration.isRequired = true;
      endpoints.mobileVisits.isRequired = true;
      endpoints.mobileAvgVisitDuration.isRequired = true;
      break;
    case 'bounced_visits':
      endpoints.desktopVisits.isRequired = true;
      endpoints.desktopBounceRate.isRequired = true;
      endpoints.mobileVisits.isRequired = true;
      endpoints.mobileBounceRate.isRequired = true;
      break;
    }
  });

  var data = {};
  domains.forEach(function(domain) {
    data[domain] = collectData(endpoints, domain, country, apiKey);
  });

  return {
    schema: requestedFields.build(),
    rows: buildTabularData(requestedFields, data)
  };
}

// eslint-disable-next-line no-unused-vars
function isAdminUser() {
  return true;
}

// eslint-disable-next-line no-unused-vars
function throwError (message, userSafe) {
  if (userSafe) {
    message = 'DS_USER:' + message;
  }
  throw new Error(message);
}

function buildTabularData(requestedFields, data) {
  var requestedData = [];

  Object.keys(data).forEach(function(dom) {
    var desktopData = data[dom].desktop;
    Object.keys(desktopData).forEach(function(date) {
      var values = desktopData[date];
      var row = buildRow(date, dom, 'Desktop', requestedFields, values);

      requestedData.push({ values: row });
    });

    var mobileData = data[dom].mobile;
    Object.keys(mobileData).forEach(function(date) {
      var values = mobileData[date];
      var row = buildRow(date, dom, 'Mobile Web', requestedFields, values);

      requestedData.push({ values: row });
    });
  });

  return requestedData;
}

function buildRow(date, dom, deviceName, requestedFields, values) {
  var row = [];
  requestedFields.asArray().forEach(function (field) {
    switch (field.getId()) {
    case 'visits':
      row.push(values.visits);
      break;
    case 'page_views':
      row.push(values.visits * values.pages_per_visit);
      break;
    case 'visits_duration':
      row.push(values.visits * values.average_visit_duration);
      break;
    case 'bounced_visits':
      row.push(values.visits * values.bounce_rate);
      break;
    case 'date':
      row.push(date.replace(/-/g, ''));
      break;
    case 'domain':
      row.push(dom);
      break;
    case 'device':
      row.push(deviceName);
      break;
    default:
      row.push('');
    }
  });

  return row;
}
/**
 * Creates an object with the results for the required endpoints
 *
 * @param {Set} endpoints - set of objects with endpoint details (url, object name, device type & isRequired boolean)
 * @param {string} domain - domain name
 * @param {string} country - country code
 * @param {string} apiKey - SimilarWeb API key
 * @return {object} - Results
 */
function collectData(endpoints, domain, country, apiKey) {
  var result = { desktop: {}, mobile: {} };

  var params = {
    api_key: apiKey,
    country: country,
    domain: domain,
    main_domain_only: 'false',
    show_verified: 'false'
  };

  Object.keys(endpoints).forEach(function(epName) {
    var ep = endpoints[epName];
    // Retrieve data from cache or API
    if (ep.isRequired) {
      var data = retrieveOrGet(ep.url, params);
      if (data && data[ep.objectName]) {
        data[ep.objectName].forEach(function(dailyValues) {
          var date = dailyValues.date;

          var deviceResult = result[ep.device];
          if (!deviceResult.hasOwnProperty(date)) {
            deviceResult[date] = {};
          }
          deviceResult[date][ep.objectName] = dailyValues[ep.objectName];
        });
      }
    }
  });

  return result;
}
