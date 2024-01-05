import Joi from "joi";
require("dotenv").config();
const noReplyEmail = "no-reply@appforsite.com";
const readJsonFromEnv = function (key) {
  let data;
  if (process.env[key]) {
    try {
      data = JSON.parse(process.env[key]);
    } catch (e) {
      console.warn(
        "Error while reading  json from env. Seems like a invalid json -- ", key,
        e
      );
    }
  }
  return data;
};
const firebaseConfig = readJsonFromEnv("FIREBASE_CONFIG");
const firebaseAdminConfig = readJsonFromEnv("FIREBASE_ADMIN_CONFIG");

/**
 * Common configuration for each environment
 * @type {{}}
 */
export default {
  fileCodes: ["profileImage", "userImage", "configurationFile", "mediaFile","serviceAttachment"],
  host: process.env.BACKEND_URI || "http://localhost:8080",
  encryptionKey: process.env.ENCRYPTION_KEY || "hor22kida",
  apiPrefix: "api",
  isDemoEnabled: !!process.env.DEMO || false,
  // ssl:{
  //   passphrase:'hello'
  // },
  clearInterval: process.env.DEMO_RESTORE_INTERVAL || 60 , // In Minutes
  backupUrl: process.env.DEMO_BACKUP_URL,
  admin: {
    name: "Admin User",
    email: "admin@admin.com",
    password: "123456",
  },
  role: [
    {
      code: "CUSTOMER",
      description: "Customer",
    },
    {
      code: "ENGINEER",
      description: "Engineer",
    },
  ],
  /**
   * Whether new register user should be confirmed or not
   * In case we want a flow that user registers and admin should confirm,
   * simply comment the confirm-email process in register and let the admin approve
   */
  confirmNewRegistration: true,
  /**
   * Whether new  user created by admin should be confirmed or not
   * In this case, user will not be confirmed by default and whatever
   * value is sent in the api, it will be used
   */
  confirmNewUserAdmin: false,
  defaultUserRole: "ENGINEER",
  email: {
    adapter: "nodemailer",
    from: {
      noReply: noReplyEmail,
    },
    types: {
      passwordReset: {
        expiry: 60,
        /**
         * Generate OTP means link will not be used
         */
        generateOtp: true,
      },
      confirmEmail: {
        expiry: 60,
        /**
         * Generate OTP means link will not be used
         */
        //generateOtp : true
      },
    },
  },
  database: {
    firebase: {
      config: firebaseConfig,
      admin: firebaseAdminConfig,
      url: (firebaseConfig ? firebaseConfig.databaseURL : null) || process.env.DATABASE_URL,
    }
  },
  server: {
    port: 8080,
    bodyLimit: "100000kb",
    corsHeaders: ["Link"],
  },
  storage: {
    adapter: "firebase",
  },
  sms: {
    adapter: "twilio",
  },
  /**
   * For Search Indexer We have 2 options, either to use a search indexer or not
   * As of now 2 search indexers are supported
   * 1. Memory
   * 2. Elastic search
   *
   * Different Parameters are supported
   * validateSchema - Schema to validate Request Parameters,
   * defaultIndexingConfig - The Default Indexing config that gets applied to index and is passed during search if no config is
   * defined on a path level
   * responseFilter - Filter Response from Search Indexer
   * getRequestConfig - Construct Request Config object to indexer consisting of additionalOptions, additionalQuery, additionalParams
   *
   * Sorting = For in memory we can sort easily on client side or may be on onAfter Hook
   * For ES or any query related indexer we can perhaps use in query sorting
   */
  searchIndexer: {
    adapter: "memory", // Mandatory Field
    indexPrefix: "arivaa-suite-",
    validateSchema: {
      // Mandatory Field
      search: Joi.string(),
      searchField: Joi.string().optional(),
      from: Joi.number(),
      size: Joi.number(),
      sort: Joi.string(),
      sortType: Joi.string().valid("asc", "desc", "ASC", "DESC"),
      operator: Joi.string().valid("equals"),
      preFilter : Joi.any(),
    },
    getRequestConfig: function (data) {
      const additionalOptions = {
        from: isNaN(data.from) ? 0 : parseInt(data.from),
        size: isNaN(data.size) ? 10 : parseInt(data.size),
        sort: data.sort || "createdAt",
        sortType: data.sortType || "asc",
      };
      if (additionalOptions.from === -1) {
        additionalOptions.all = true;
      }
      additionalOptions.operator = data.operator;
      if(data.preFilter instanceof Function){
        additionalOptions.preFilter = data.preFilter;
      }
      return {
        ...additionalOptions,
      };
    },
    defaultIndexingConfig: {
      ref: "key",
      fields: ["name", "key"],
      saveDocument: true,
    },
  },
  // searchIndexer: {
  //     adapter: 'elasticsearch',
  //     validateSchema: {
  //         search: Joi.string(),
  //         from: Joi.number(),
  //         size: Joi.number(),
  //         sort : Joi.string(),
  //         sortType : Joi.string().valid("asc","desc","ASC","DESC"),
  //     },
  //     responseFilter: function (resp) {
  //         let output = resp.hits;
  //         output.data = output.hits;
  //         delete output.hits;
  //         output.data = (output.data || []).map((item) => {
  //             return item._source;
  //         });
  //         return output;
  //     },
  //     getRequestConfig: function (data) {
  //         const additionalOptions = {
  //             from: isNaN(data.from) ? 0 : parseInt(data.from),
  //             size: isNaN(data.from) ? 10 : parseInt(data.size)
  //         };
  //         const additionalParams = {
  //             filterPath: "hits.hits._source,hits.total"
  //         };
  //         additionalOptions.sort = {};
  //         if(data.sort){
  //             additionalOptions.sort[data.sort] = data.sortType || "asc";
  //         } else {
  //             additionalOptions.sort['createdAt'] ="desc";
  //         }
  //         return {
  //             additionalOptions,
  //             additionalParams
  //         }
  //     },
  //     config: {
  //         ref: 'key',
  //         hosts: ['http://localhost:9200']
  //     }
  // }
};
