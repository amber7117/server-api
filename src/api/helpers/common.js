import Joi from 'joi'

//ADDED FUNCTIONS FOR PARTICULAR FUNCTIONALITY:-

//1. To check the duplicate key in a service
//used in -> create(onBefore function)

/**
 * 
 * @param {*} service -> name of the service in which we are checking
 * @param {*} input -> the input field that we are getting in the onbefore in create
 */
export async function checkServiceKeyDuplicacy(service, input, name) {
  var key;
  let message;
  if(name){
    message=`The ${name} already exists `
  }
  try {
    key = await this.service(service).get({
      id: input.key
    })
  }
  catch (e) {
  }
  if (key) {
    throw {
      status: 409,
      message: name?message:"This key already exists please try changing the key"
    }
  }
}

//2. This function check if the service with key is a valid key in that service.
//  this function is mainly used in the apis where we have to check if the field that is
//  specified is a valid field or not 

/**
 * 
 * @param {*} service ->Name of the service in which we are checking
 * @param {*} key -> The Key of the service that we are checking for existance
 */
export async function checkValidKeyInService(service, key) {
  let data;
  try {
    data = await this.service(service).get({
      id: key
    })
  }
  catch (e) {
    throw {
      status: 400,
      message: `the ${key} does not exist in the service-> ${service}`
    }
  }
  return data
}
/**
 * 
 * @param {*} service  ->name of the service in which you want to check
 * @param {*} key -> array of keys for service
 */
export async function checkValidKeyInServiceForMany(service, key) {
  return await Promise.all(key.map(async element => {
    try {
     return await this.service(service).get({
        id: element
      })

    }
    catch (e) {
      throw {
        status: 404,
        message: `the ${service} with this id ->${element} does not exist `
      }
    }
  }))
}


/**
 * 
 * @param {*} service ->Name of the service 
 * @param {*} key -> key of the service to check
 */
export async function getEntityData(service, key) {
  let data;
  try {
    data = await this.service(service).get({
      id: key
    })
  }
  catch (e) {
    throw {
      status: 400,
      message: `Check if all the key are valid in the service-> ${service}`
    }
  }
  return data
}


/**
 * convert the data from json form to rdbms
 * @param {*} object the object to convert in rdbms form 
 */
export function convertDataForOnBefore(object) {
  var keys = Object.keys(object)
  keys.map((key) => {
    if (Array.isArray(object[key])) {
      object['array_' + `${key}`] = object[key].join(",");
      delete object[key];
    }
    if (object[key] && typeof object[key] === 'object') {
      const output = convertObjectForOnBefore(object[key], key);
      Object.keys(output).forEach(key => {
        object[key] = output[key];
      })
      delete object[key]
    }

  })
  return object
}

/**
 * convert the data of the object of the convertDataForOnBefore in rdbms form 
 * @param {*} object -> object 
 * @param {*} name  -> name of the object for naming convention
 */

function convertObjectForOnBefore(object, name) {
  var keys = Object.keys(object)

  keys.map((key) => {
    if (Array.isArray(object[key])) {
      object['array_' + `${name}_${key}`] = object[key].join(",");
      delete object[key];
    }
    else {
      object[`${name}_${key}`] = object[key];
      delete object[key];
    }
  })
  return object
}

/**
 * used to convert the rdbms form to json form 
 * 
 * @param {*} object which is converted to the json object form from rdbms form 
 */

export function convertDataForOnAfter(object) {
  var keys = Object.keys(object)
  keys.map((key) => {
    if (object[key] !== null) {
      var tempKeyArray = key.split("_")
      if (tempKeyArray.length === 2) {
        const [key1, key2] = tempKeyArray;
        if (key1 !== 'array') {
          object[key1] = {
            ...object[key1],
            [key2]: object[key]
          }
          delete object[key]
        }
        else {

          object[key2] = object[key].split(',')
          delete object[key]

        }
      }
      else if (tempKeyArray.length === 3) {
        const [key1, key2, key3] = tempKeyArray;
        object[key2] = {
          ...object[key2],
          [key3]: object[key].split(',')
        }
        delete object[key]
      }
      else {
      }
    }
    else {
      delete object[key]
    }
  })
  return object
}

/**
 * Get Duplicate Api
 * @param {} options
 */
export function getDuplicateApi(options) {
  options = options || {};
  const schema = {
    id: Joi.string().required(),
    ...options.schema,
  };
  return {
    ...options,
    method: "POST",
    callback: async function (req) {
      await Joi.validate(req.body, Joi.object().keys(schema));
      const { id, ...body } = req.body;
      const {
        createdAt,
        createdBy,
        updatedAt,
        updatedBy,
        key, // New Key will come from body
        ...data
      } = await this.service(this.key).get({
        id,
      });
      return await this.service(this.key).create(
        {
          ...data,
          ...body,
        },
        undefined,
        undefined,
        { validate: false }
      );
    },
  };
}

/**
 *
 * @param {*} service ->Name of the service in which we are checking
 * @param {*} key -> The Key of the service that we are checking for existance
 */
export async function getRecord(service, key, throwError) {
  try {
    return await this.service(service).get({
      id: key,
    });
  } catch (e) {
    if (throwError) {
      console.warn(`Key - ${key} not found in ${service}`);
      throw {
        status: 400,
        message: `the ${key} does not exist in the service-> ${service}`,
      };
    }
    return null;
  }
}


