import mailgunHelper from "arivaa-utils-mail";
import emailHelper from 'utils-email';
import storageHelper from "arivaa-utils-storage";
import smsHelper from "arivaa-utils-sms";
import { getFromCache, putInCache } from "arivaa-utils/lib/cache";


/**
 * Helper Map
 * todo : Refactor code to merge both server configuration and code configuration
 */
let helpers = {};

/**
 * Get Helper
 * @param key
 * @returns {*}
 */
export function helper(key) {
  if (!helpers[key]) {
    throw `No helper found with key - ${key}`;
  }
  return helpers[key];
}

/**
 * Get Helper
 * @param key
 * @returns {*}
 */
export async function configureHelpers() {
  const { config, getServerConfig } = this;
  /**
   * Configure Email helper
   */
  helpers.email = getEmailHelper.apply(this, [config, getServerConfig]);
  helpers.generateWebClientLink = generateWebClientLink.bind(this);
  helpers.storage = getStorageHelper.apply(this, [config, getServerConfig]);
  helpers.getEmailConfig = getEmailConfig.bind(this);
  helpers.getResourceUrl = getResourceUrl.bind(this);
  helpers.addInCache = addInCache; //.bind(this);
  helpers.updateInCache = updateInCache; //.bind(this);
  helpers.getIndexName = getIndexName.bind(this);
  helpers.sms = getSMSHelper.apply(this, [config, getServerConfig]);
  helpers.pingServer = pingServer.apply(this);
}

/**
 * Configure SMS Helper
 * @param {*} config
 * @param {*} getServerConfig
 */
async function getSMSHelper(config, getServerConfig) {
  let adapter = getServerConfig("sms", "adapter") || {};
  adapter = adapter.value || config.sms.adapter;
  if (!adapter) {
    throw "No SMS Adapter Configuration found while configuring sms helper";
  }
  const { value: sid } = await this.service("configuration").get({
    id: "TWILIO_SID",
  });
  const { value: authToken } = await this.service("configuration").get({
    id: "TWILIO_AUTH_TOKEN",
  });
  return new smsHelper({
    adapter,
    sid,
    authToken,
    lazyLoading: true,
    statusCallback: "",
  });
}

/**
 * Configure Email helper
 * @param config
 * @param getServerConfig
 */
async function getEmailHelper(config, getServerConfig) {
  let adapter;
  try {
    const { value } = await this.service('configuration').get({
      id: 'EMAIL_ADAPTER'
    });
    adapter = value;
  } catch (e) {
    console.log('Email Adapter is missing in configuration using config adapter');
  }
  if(!adapter){
    adapter=config.email.adapter;
  }
  if (adapter === 'nodemailer') {
    let params = {};
    try {
      let data = await this.service('configuration').get({
        id: 'NODEMAILER_HOST,NODEMAILER_USER,NODEMAILER_PASS,NODEMAILER_PORT,NODEMAILER_SECURE'
      });
      if (data && data.length < 5) {
        throw 'Some Nodemailer configuration is missing';
      }
      data = data.map(item => item || {});
      const [{ value: host }, { value: user }, { value: pass }, { value: port }, { value: secure }] = data;
      params = {
        adapter,
        host, user, pass,
        port: parseInt(port),
        secure,
        options : {
          rejectUnauthorized: false
        }
      };
      let helper = new emailHelper({
        adapter,
        ...params
      });
      return helper;
    } catch (e) {
      console.log('nodemailer is not properly configured', { e });
    }
  }
  if (adapter === 'mailgun') {
    try {
      let data = await this.service('configuration').get({
        id: 'MAILGUN_API_KEY,MAILGUN_DOMAIN,MAILGUN_HOST'
      });
      if (data && data.length < 3) {
        throw 'Some Mailgun configuration is missing';
      }
      data=data.map(item=>item||{});
      const [{value:apiKey},{value:domain},{value:host}]=data;
      const params = {
        apiKey,
        domain,
        host
      };
      let helper = new  mailgunHelper({
        adapter,
        ...params
      });

      return helper;
    } catch (e) {
      console.log("Mailgun host not set", { e });
    }
  }
}


/**
 * Configure Storage helper
 * @param config
 * @param getServerConfig
 */
async function getStorageHelper(config, getServerConfig) {
  let adapter = getServerConfig("storage", "adapter") || {};
  adapter = adapter.value || config.storage.adapter;
  if (!adapter) {
    throw "No Storage Adapter configuration found while configuring storage helper";
  }
  let configurationFromServer = getServerConfig("storage", adapter);
  const { database } = config;
  const { config: firebaseConfig, admin } = database.firebase;
  let storageConfiguration = {};
  if (adapter === "firebase") {
    storageConfiguration = {
      adapter,
      ...firebaseConfig,
      ...admin,
    };
  }
  if (adapter === "aws") {
    const { value: bucket } = await this.service("configuration").get({
      id: "AWS_BUCKET",
    });
    const { value: region } = await this.service("configuration").get({
      id: "AWS_REGION",
    });
    const { value: accessKeyId } = await this.service("configuration").get({
      id: "AWS_ACCESS_KEY_ID",
    });
    const { value: secretAccessKey } = await this.service("configuration").get({
      id: "AWS_SECRET_KEY",
    });
    storageConfiguration = {
      adapter,
      accessKeyId,
      secretAccessKey,
      region,
      bucket,
    };
  }
  if (configurationFromServer) {
    configurationFromServer = configurationFromServer.value;
  }
  let helper = new storageHelper({
    ...config.storage[adapter],
    ...configurationFromServer,
    ...storageConfiguration,
  });
  return helper;
}

/**
 * Generate Email Links from the
 * supported path and params
 */
async function generateWebClientLink(path, params) {
  const { config, getServerConfig } = this;
  const { value: host } = await this.service("configuration").get({
    id: "HOST",
  });
  let webClientConfig = getServerConfig("webClient");
  webClientConfig = {
    ...config.webClient,
    ...webClientConfig,
  };

  let queryParams = "";
  Object.keys(params || {}).map((key) => {
    queryParams += `${key}=${params[key]}`;
  });
  if (queryParams != "") {
    queryParams = "?" + queryParams;
  }

  return `${host}/${path}${queryParams}`;
}

/**
 * Get Email configuration for a specific type
 * @param type
 */
function getEmailConfig(type) {
  const { config, getServerConfig } = this;
  let emailTypesConfig = getServerConfig("email", "types");
  emailTypesConfig = {
    ...config.email.types,
    ...emailTypesConfig,
  };
  return emailTypesConfig[type] || null;
}

/**
 * Get Resource url
 * @param resourceId
 * @returns {string}
 */
async function getResourceUrl(resourceId) {
  const { config } = this;
  const { value: host } = await this.service("configuration").get({
    id: "API_HOST",
  });

  return `${host}/${config.apiPrefix}/storage/download/${resourceId}`;
}
/**
 * active host url after a time interval
 */
export async function pingServer() {
  const { config } = this;
  let pingServer = config.pingServer;
  if (pingServer) {
    const { value: host } = await this.service("configuration").get({
      id: "API_HOST",
    });
    setInterval(function () {
      axios.options(host);
    }, 3000);
  }
}
/**
 * Add  in cache
 * @param quote
 */
function addInCache(obj) {
  let data = getFromCache(this.key) || [];
  data.push(obj);
  putInCache(this.key, data);
}

/**
 * Update Quote in cache
 * @param quote
 */
function updateInCache(obj) {
  let data = getFromCache(this.key) || [];
  data.find((item, index) => {
    if (item.key === obj.key) {
      data[index] = obj;
    }
  });
  putInCache(this.key, data);
}

/**
 * Get Index name
 * @param key
 * @returns {*}
 */
function getIndexName(key) {
  const indexPrefix = (this.config.searchIndexer || {}).indexPrefix || "";
  return indexPrefix + key;
}
