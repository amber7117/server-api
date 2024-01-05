/**
 * This API Definition for concatenating
 * all the configuration that is to be used
 * on web client so that web-client does not
 * have to do separate network calls here
 */
import Joi from "joi";
import { encrypt } from "../../utils/crypto";
import { getRecord } from "../helpers/common";
/**
 * Find Method Config
 * @type {{method: *}}
 */
const all = {
  callback: async function () {
    const configurations = await this.service("configuration").get({
      id: "WEBSITELOGO,CURRENCY",
    });
    const gateway = (await this.service("gateway").find({ from: -1 })).data;
    return {
      config: [
        {
          package: "sample",
          key: "test",
          value: "value",
        },
        ...(
          (configurations instanceof Array
            ? configurations
            : [configurations]) || []
        ).map((configuration) => {
          const { key, value } = configuration;
          return {
            package: "configuration",
            key,
            value,
          };
        }),
        {
          package: "payment",
          key: "gateway",
          value: (gateway || [])
            .filter(({ enabled }) => enabled)
            .map(({ apiSecret, ...data }) => data),
        },
      ],
    };
  },
  security: false,
};

/**
 * Schema for create
 * @type {{password: *, email: *}}
 */
const createSchema = {
  key: Joi.string().required(),
  value: Joi.alternatives().try(Joi.object(), Joi.string()).required(),
  package: Joi.string().required(),
  description: Joi.string().required(),
};

/**
 * Create Method configuration
 */
const create = {
  validateSchema: createSchema,
};
function convertConfigToObject(arr) {
  try {
    let obj = {};
    arr.forEach((element) => {
      obj[element.key] = element.value;
    });
    return obj;
  } catch (e) {
    console.error("Error while converting obj to array ", { e });
    return [];
  }
}
export default {
  create,
  security: {
    role: "admin",
  },
  additionalPaths: {
    all,
    web: {
      callback: async function () {
        return encrypt(
          JSON.stringify({
            firebase: this.config.database.firebase.config,
            confirmNewRegistration: !!this.config.confirmNewRegistration,
            ui: convertConfigToObject(
              await this.service("configuration").get({
                id: "PAGE_TITLE,FEVICON,TAWK_ID,GOOGLE_ANALYTICS_ID",
              })
            ),
            theme: (await this.service("theme").find({ from: -1 })).data,
            faqs: (await this.service("faq").find({ from: -1 })).data,
            testimonials: (await this.service("testimonials").find({ from: -1 })).data,
            host: (await this.service("configuration").get({ id: "HOST" }))
              .value,
            isDemoEnabled : this.config.isDemoEnabled,
            currency: (
              await this.service("configuration").get({ id: "CURRENCY" })
            ).value,
          })
        );
      },
      security: false,
    },
  },
};
