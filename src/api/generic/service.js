import Joi from "joi";
import { getAuthErrorObject } from "../../utils/firebase-util";
import { getServerTimestamp } from "arivaa-utils/lib/date";

const defaultGetSchema = {
  id: Joi.string().required(),
};
const defaultRemoveSchema = {
  id: Joi.string().required(),
};
const defaultFindSchema = {
  all: Joi.boolean(),
};

/**
 * Check if response was already sent
 * @param res
 * @returns {*}
 */
function checkIfResponseAlreadySent(res) {
  return res && res.headersSent;
}

/**
 * Create Schema
 */
function createSchema(schema) {
  const newSchema = {};
  Object.keys(schema || {}).forEach((key) => {
    const validation =
      Joi[schema[key]] instanceof Function && Joi[schema[key]]();
    newSchema[key] = validation;
  });
  return Object.keys(newSchema).length > 0 ? newSchema : undefined;
}

/**
 * Send Success Response
 * @param res
 * @param data
 * @returns {*}
 */
function sendSuccessResponse(res, data) {
  if (res) {
    let output;
    if (data instanceof Array) {
      output = [...data];
    } else if (data && data instanceof Object) {
      output = {
        ...data,
      };
    } else {
      output = data;
    }
    return res.status(200).send(output);
  } else {
    return data;
  }
}

/**
 * create firebase record
 * @param req
 * @param res
 * @return {Promise<*|void|boolean>}
 */
export async function create(obj, req, res, additionalConfig) {
  const { db, create, key, config } = this;
  let { indexingConfig } = this;
  const { onBefore, onAfter, onError, validateSchema, method, responseSchema } =
    create || {};
  additionalConfig = additionalConfig || {};
  try {
    additionalConfig.validate !== false &&
      (await validateData(obj, {
        ...createSchema(
          (db ? this[db + "DB"] : this.firebaseDB).getDefaultSchema().create
        ),
        ...validateSchema,
      }));
    let output;
    obj = obj || {};
    obj.createdAt = getServerTimestamp();
    if (req && req.user && !obj.createdBy) {
      obj.createdBy = req.user.uid;
    }
    /**
     * onBefore callback is intended to return false in case it has
     * already sent response and throw onError normally in case there is
     * a validation onError or any onError onBefore creating the record
     */
    onBefore instanceof Function &&
      (await onBefore.apply(this, [...arguments]));

    if (checkIfResponseAlreadySent()) {
      return;
    }

    if (method instanceof Function) {
      output = await method.apply(this, [...arguments]);
    } else {
      output = await (db ? this[db + "DB"] : this.firebaseDB).create(
        `${key}`,
        obj
      );
    }

    if (indexingConfig && this.searchIndexer) {
      /**
       * Here we have to take care that same key should not exist in query and params
       * @type {{[p: string]: *}}
       */
      if (indexingConfig instanceof Function) {
        indexingConfig =await indexingConfig(obj);
      }
      const indexPrefix = (config.searchIndexer || {}).indexPrefix || "";
      if (indexingConfig.populate instanceof Function) {
        await this.searchIndexer.put(
          indexPrefix + key,
          await indexingConfig.populate.apply(this, [output, "create"])
        );
      } else {
        await this.searchIndexer.put(indexPrefix + key, output);
      }
    }

    /**
     * onAfter callback is intended to return false in case it has
     * already sent response and throw onError normally in case there is
     * a validation onError or any onError onBefore creating the record
     */
    onAfter instanceof Function &&
      (await onAfter.apply(this, [output, ...arguments]));
    /**
     * Filter Response acc to response schema
     */
    if (responseSchema) {
      output = await Joi.validate(output, Joi.object().keys(responseSchema), {
        stripUnknown: true,
      });
    }
    if (checkIfResponseAlreadySent()) {
      return;
    }
    return sendSuccessResponse(res, output);
  } catch (e) {
    /**
     * Handle Error
     */
    handleError.apply(this, [
      e,
      { onError: onError, input: obj },
      ...arguments,
    ]);
  }
}

/**
 * get All firebase records
 * @param req
 * @param res
 * @return {Promise<*|void|boolean>}
 */
export async function find(obj, req, res) {
  const { db, find, key, config } = this;
  let { indexingConfig } = this;
  const { onBefore, onAfter, onError, validateSchema, method, responseSchema } =
    find || {};
  try {
    let output;
    if (indexingConfig && this.searchIndexer) {
      /**
       * Here we have to take care that same key should not exist in query and params
       * @type {{[p: string]: *}}
       */
      if (indexingConfig instanceof Function) {
        indexingConfig = await indexingConfig.apply(this,[...arguments]);
      }
      await validateData(
        obj,
        {
          all: Joi.boolean(),
          ...config.searchIndexer.validateSchema,
          ...validateSchema,
        },{
          allowUnknown : true
        }
      );
    } else {
      await validateData(
        obj,
        {
          ...defaultFindSchema,
          ...createSchema(
            (db ? this[db + "DB"] : this.firebaseDB).getDefaultSchema().find
          ),
          ...validateSchema,
        }
      );
    }
    /**
     * onBefore callback is intended to return false in case it has
     * already sent response and throw onError normally in case there is
     * a validation onError or any onError onBefore creating the record
     */
    onBefore instanceof Function &&
      (await onBefore.apply(this, [...arguments]));
    if (checkIfResponseAlreadySent()) {
      return;
    }
    if (method instanceof Function) {
      output = await method.apply(this, [obj, ...arguments]);
    } else {
      /**
       * If we want to get all records
       */
      if (obj && obj.all) {
        console.log("Getting whole data from firebase", key);
        output = await (db ? this[db + "DB"] : this.firebaseDB).find(key, {
          all: true,
          ...obj
        });
        if (indexingConfig && indexingConfig.populate instanceof Function) {
          output = await Promise.all(
            output.map(async (item) => {
              return await indexingConfig.populate.apply(this, [item, "find"]);
            })
          );
        }
      } else if (indexingConfig && this.searchIndexer) {
        let requestConfig;
        if (
          config.searchIndexer &&
          config.searchIndexer.getRequestConfig instanceof Function
        ) {
          requestConfig = config.searchIndexer.getRequestConfig(obj);
        }
        const indexPrefix = (config.searchIndexer || {}).indexPrefix || "";
        if (indexingConfig instanceof Function) {
          indexingConfig = indexingConfig.apply(this, [...arguments]);
        }
        //As of now allowing only string based search
        output = await this.searchIndexer.search(
          indexPrefix + key,
          obj.search,
          {
            ...indexingConfig,
            ...requestConfig,
            searchField: obj.searchField,
          }
        );
        if (
          config.searchIndexer &&
          config.searchIndexer.responseFilter instanceof Function
        ) {
          output = config.searchIndexer.responseFilter(output);
        }
      } else {
        console.warn(
          "No indexer found, returning from firebase, Use firebase pagination parameters"
        );
        output = await (db ? this[db + "DB"] : this.firebaseDB).find(
          `${key}`,
          obj
        );
      }
    }

    /**
     * onAfter callback is intended to return false in case it has
     * already sent response and throw onError normally in case there is
     * a validation onError or any onError onBefore creating the record
     */
    onAfter instanceof Function &&
      (await onAfter.apply(this, [output, ...arguments]));
    /**
     * Filter Response acc to response schema
     */
    if (responseSchema) {
      output = await Promise.all(
        output.map(async function (item) {
          return await Joi.validate(item, Joi.object().keys(responseSchema), {
            stripUnknown: true,
          });
        })
      );
    }
    if (checkIfResponseAlreadySent()) {
      return;
    }
    return sendSuccessResponse(res, output);
  } catch (e) {
    /**
     * Handle Error
     */
    handleError.apply(this, [
      e,
      { onError: onError, input: obj },
      ...arguments,
    ]);
  }
}

/**
 * get firebase records
 * @param req
 * @param res
 * @return {Promise<*|void|boolean>}
 */
export async function get(obj, req, res) {
  const { db, get, key, indexingConfig, config } = this;
  const {
    onBefore,
    onAfter,
    onError,
    validateSchema,
    method,
    onBeforeEach,
    onAfterEach,
    responseSchema,
  } = get || {};
  try {
    await validateData(
      obj,
      {
        ...defaultGetSchema,
        ...createSchema(
          (db ? this[db + "DB"] : this.firebaseDB).getDefaultSchema().get
        ),
        ...validateSchema,
      }
    );

    obj.id = obj.id.split(",");
    let output = {};
    let hasError = false;
    /**
     * onBefore callback is intended to return false in case it has
     * already sent response and throw onError normally in case there is
     * a validation onError or any onError onBefore creating the record
     */
    onBefore instanceof Function &&
      (await onBefore.apply(this, [...arguments]));
    if (checkIfResponseAlreadySent()) {
      return;
    }

    await Promise.all(
      obj.id.map(async (id) => {
        try {
          onBeforeEach instanceof Function &&
            (await onBeforeEach.apply(this, [id, ...arguments]));
          if (method instanceof Function) {
            output[id] = await method.apply(this, [id, ...arguments]);
          } else {
            if (indexingConfig && this.searchIndexer) {
              const indexPrefix =
                (config.searchIndexer || {}).indexPrefix || "";
              output[id] = await this.searchIndexer.get(indexPrefix + key, id);
            } else {
              output[id] = await (
                (db ? this[db + "DB"] : this.firebaseDB)
              ).get(key, id);
            }
          }
          if (output[id] === null) {
            throw {
              status: 404,
              message: "Record does not exist",
            };
          }
          onAfterEach instanceof Function &&
            (await onAfterEach.apply(this, [output[id], id, ...arguments]));
          /**
           * Filter Response acc to response schema
           */
          if (responseSchema) {
            output[id] = await Joi.validate(
              output[id],
              Joi.object().keys(responseSchema),
              {
                stripUnknown: true,
              }
            );
          }
        } catch (error) {
          output[id] = parseSingleError(error);
          hasError = hasError || true;
        }
        return output;
      })
    );
    /**
     * Send 404 only if length is 1 else return the found elements
     */
    if (hasError && obj.id.length === 1) {
      let errors = combineMultipleErrors.apply(this, [output, key, "get"]);
      //todo : May be send record specific error detail - but its not as such needed in this case since it will only cause error if not found
      throw {
        status: 404,
        message:
          "Error occured during deletion of one or more records since they were not found.",
        ...errors,
      };
    } else {
      output = Object.keys(output || {})
        .filter((key) => output[key] && !output[key].error)
        .map((key) => {
          if (typeof output[key] == "object" && !output[key] instanceof Array) {
            return {
              key,
              ...output[key],
            };
          } else {
            return output[key];
          }
        });
      if (obj.id.length == 1) {
        output = output[0];
      }
    }
    /**
     * onAfter callback is intended to return false in case it has
     * already sent response and throw onError normally in case there is
     * a validation onError or any onError onBefore creating the record
     */
    onAfter instanceof Function &&
      (await onAfter.apply(this, [output, ...arguments]));
    if (checkIfResponseAlreadySent()) {
      return;
    }

    return sendSuccessResponse(res, output);
  } catch (e) {
    /**
     * Handle Error
     */
    handleError.apply(this, [
      e,
      { onError: onError, input: obj },
      ...arguments,
    ]);
  }
}

/**
 * update a firebase record
 * @param req
 * @param res
 * @return {Promise<*|void|boolean>}
 */
export async function update(obj, req, res) {
  const { db, update, key, config } = this;
  let { indexingConfig } = this;
  const {
    onBefore,
    onAfter,
    onError,
    validateSchema,
    method,
    responseSchema,
    overrideIfNotExist,
  } = update || {};
  const { data } = obj;

  try {
    await validateData(
      data,
      {
        ...createSchema(
          (db ? this[db + "DB"] : this.firebaseDB).getDefaultSchema().update
        ),
        ...validateSchema,
      }
    );
    let output;
    data.updatedAt = getServerTimestamp();
    if (req && req.user) {
      data.updatedBy = req.user.uid;
    }
    onBefore instanceof Function &&
      (await onBefore.apply(this, [...arguments]));
    const { id } = obj;
    if (checkIfResponseAlreadySent()) {
      return;
    }
    if (method instanceof Function) {
      output = await method.apply(this, [id, data, ...arguments]);
    } else {
      output = await (db ? this[db + "DB"] : this.firebaseDB).update(
        key,
        { id, data },
        { overrideIfNotExist }
      );
      output.key = id; // output.path.split("/")[2];
    }
    //Need to check that it merges the doc in store instead of replacing
    if (indexingConfig && this.searchIndexer) {
      /**
       * Here we have to take care that same key should not exist in query and params
       * @type {{[p: string]: *}}
       */
      if (indexingConfig instanceof Function) {
        indexingConfig = await indexingConfig(obj);
      }
      const indexPrefix = (config.searchIndexer || {}).indexPrefix || "";

      if (indexingConfig.populate instanceof Function) {
        await this.searchIndexer.update(
          indexPrefix + key,
          await indexingConfig.populate.apply(this, [output, "update"])
        );
      } else {
        await this.searchIndexer.update(indexPrefix + key, output);
      }
    }
    /**
     * onAfter callback is intended to return false in case it has
     * already sent response and throw onError normally in case there is
     * a validation onError or any onError onBefore creating the record
     */
    onAfter instanceof Function &&
      (await onAfter.apply(this, [output, ...arguments]));
    if (responseSchema) {
      output = await Joi.validate(output, Joi.object().keys(responseSchema), {
        stripUnknown: true,
      });
    }
    if (checkIfResponseAlreadySent()) {
      return;
    }

    return sendSuccessResponse(res, output);
  } catch (e) {
    /**
     * Handle Error
     */
    handleError.apply(this, [
      e,
      { onError: onError, input: obj },
      ...arguments,
    ]);
  }
}

/**
 * remove firebase records
 * @param req
 * @param res
 * @param next
 * @return {Promise<*|void|boolean>}
 */
export async function remove(obj, req, res, next) {
  const { db, remove, key, config } = this;
  let { indexingConfig } = this;
  const {
    onBefore,
    onAfter,
    onError,
    validateSchema,
    method,
    onBeforeEach,
    onAfterEach,
  } = remove || {};
  try {
    let output = {};
    let hasError = false;
    await validateData(
      obj,
      {
        ...defaultRemoveSchema,
        ...createSchema(
          (db ? this[db + "DB"] : this.firebaseDB).getDefaultSchema().remove
        ),
        ...validateSchema,
      }
    );
    obj.id = obj.id.toString().split(",");
    /**
     * onBefore callback is intended to return false in case it has
     * already sent response and throw onError normally in case there is
     * a validation onError or any onError onBefore creating the record
     */
    onBefore instanceof Function &&
      (await onBefore.apply(this, [...arguments]));
    if (checkIfResponseAlreadySent()) {
      return;
    }
    await Promise.all(
      obj.id.map(async (id) => {
        try {
          onBeforeEach instanceof Function &&
            (await onBeforeEach.apply(this, [id, ...arguments]));
          if (method instanceof Function) {
            output[id] = await method.apply(this, [id, ...arguments]);
          } else {
            output[id] = await (db ? this[db + "DB"] : this.firebaseDB).remove(
              key,
              id
            );
          }

          if (output[id] === null) {
            throw {
              status: 404,
              message: "Record does not exist",
            };
          }
          if (indexingConfig && this.searchIndexer) {
            /**
             * Here we have to take care that same key should not exist in query and params
             * @type {{[p: string]: *}}
             */
            if (indexingConfig instanceof Function) {
              indexingConfig = await indexingConfig(obj);
            }
            const indexPrefix = (config.searchIndexer || {}).indexPrefix || "";
            await this.searchIndexer.remove(indexPrefix + key, { key: id });
          }
          onAfterEach instanceof Function &&
            (await onAfterEach.apply(this, [output[id], id, ...arguments]));
        } catch (error) {
          output[id] = parseSingleError(error);
          hasError = hasError || true;
        }
      })
    );
    if (hasError && obj.id.length === 1) {
      let errors = combineMultipleErrors.apply(this, [output, key, "delete"]);
      //todo : May be send record specific error detail - but its not as such needed in this case since it will only cause error if not found
      throw {
        status: 404,
        message:
          "Error occured during deletion of one or more records since they were not found.",
        ...errors,
      };
    }

    /**
     * onAfter callback is intended to return false in case it has
     * already sent response and throw onError normally in case there is
     * a validation onError or any onError onBefore creating the record
     */
    onAfter instanceof Function &&
      (await onAfter.apply(this, [output, ...arguments]));
    if (checkIfResponseAlreadySent()) {
      return;
    }
    return sendSuccessResponse(res, output);
  } catch (e) {
    /**
     * Handle Error
     */
    handleError.apply(this, [
      e,
      { onError: onError, input: obj },
      ...arguments,
    ]);
  }
}

/**
 * Execute additional Callbacks in a error
 * handled context
 * @param callback
 * @returns {Promise<Function>}
 */
export function executeCallback(callback) {
  return async function (req, res, next) {
    try {
      const response = await callback.apply(this, [...arguments]);
      /**
       * If the response is not sent from callback, Send 200 as status
       */
      if (!res.headersSent) {
        return res.status(200).send(response || null);
      }
    } catch (e) {
      handleError.apply(this, [e, null, null, ...arguments]);
    }
  };
}

/**
 * Parse Single Errors
 * @param error
 * @returns {{error: boolean}}
 */
function parseSingleError(error) {
  let output = {
    error: true,
  };
  if (error) {
    if (error.status) {
      output.status = error.status;
    }

    if (error.message) {
      output.message = error.message;
    }

    if (error.details) {
      output.details = error.details;
    }

    if (error.stack) {
      output.stack = error.stack.toString();
    }
  }
  return output;
}

/**
 * Combine Multiple Record Errors
 * @param output
 */
function combineMultipleErrors(output) {
  let details = {};
  let status;
  let message = "";
  Object.keys(output || {})
    .filter((key) => {
      return !!output[key].error;
    })
    .map((key) => {
      details[key] = output[key];
      if (details[key].error) {
        status = message || details[key].status;
        message = message || details[key].message;
      }
    });
  return {
    details,
    status,
    message,
    api: arguments[1],
    method: arguments[2],
  };
}

/**
 * Handle Error
 * @param req
 * @param res
 * @param data - Data for that method e.g input data in case of create
 * @param next
 * @param e
 * @param config
 * @return {*|void|boolean}
 */
function handleError(e, config, data, req, res, next) {
  config = config || {};
  const { onError } = config;
  if (e && e.isJoi) {
    delete e.isJoi;
    delete e._object;
    e.status = 400;
  }

  e = getAuthErrorObject(e);
  /**
   * Execute on Error
   */
  if (onError instanceof Function) {
    /**
     * Check in case onError has returned any status or
     * message field
     * @type {*|{}}
     */
    onError.apply(this, [arguments]);
  }
  if (res && !res.headersSent && typeof next != "undefined") {
    next(e);
  } else {
    throw e;
  }
}

/**
 * Validate Data
 */
async function validateData(data,schema,options){
  if(schema && Object.keys(schema).length>0){
    return await Joi.validate(data,Joi.object().keys(schema),options)
  }
}
