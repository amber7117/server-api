import Joi from "joi";
import { getDuplicateApi } from "../helpers/common";
import { scheduleBackup, stopScheduledBackup } from "../../utils/backup";
const types = ["file", "text", "html", "boolean"];
const createSchema = {
  key: Joi.string().required(),
  type: Joi.valid.apply(Joi, types).required(),
  value: Joi.when("type", {
    is: types[3],
    then: Joi.boolean(),
    otherwise: Joi.string(),
  }).required(),
  description: Joi.string().required(),
};
const updateSchema = {
  value: Joi.alternatives(Joi.string(), Joi.boolean()),
  type: Joi.valid.apply(Joi, types).optional(),
  description: Joi.string().optional(),
};
const create = {
  onBefore: async function (input) {
    const { key } = input;
    let isExist = false;
    try {
      await this.service("configuration").get({
        id: key,
      });
      isExist = true;
    } catch (e) {}
    if (isExist) {
      throw {
        status: 404,
        message: "Key Already Exists",
      };
    }
  },
  onAfter: async function (output, input, req) {
    // Special Handling for BACKUP_CRON_SCHEDULE, Probably use event emitter here
    if (req && output.key === "BACKUP_CRON_SCHEDULE") {
      scheduleBackup.apply(this, [output.value]);
    }
  },
  validateSchema: createSchema,
};
const update = {
  validateSchema: updateSchema,
  onBefore: async function () {
    if (this.config.isDemoEnabled) {
      throw {
        status: 409,
        message: "Demo Mode Enabled",
      };
    }
  },
  onAfter: async function (output, input, req) {
    // Special Handling for BACKUP_CRON_SCHEDULE, Probably use event emitter here
    if (
      req &&
      input.id === "BACKUP_CRON_SCHEDULE" &&
      input.data &&
      input.data.value
    ) {
      scheduleBackup.apply(this, [output.value]);
    }
  },
};
const find = {
  onAfter: async function (output, input, req) {
    if (this.config.isDemoEnabled && !Array.isArray(output) && req) {

      output.data = output.data.map((item) => {
        let { type, value } = item;
        if (type === "boolean") {
          value = false;
        } else {
          value = Array(value.length).fill("*").join("");
        }
        return {
          ...item,
          value
        };
      });
    }
  },
};
export default {
  security: {
    role: "admin",
  },
  create,
  update,
  find,
  indexingConfig: {
    fields: ["key"],
  },
  remove: {
    onAfterEach: function (output, id) {
      if (id === "BACKUP_CRON_SCHEDULE") {
        stopScheduledBackup();
      }
    },
  },
  additionalPaths: {
    duplicate: getDuplicateApi({
      schema: {
        key: Joi.string().required(),
      },
    }),
  },
};
