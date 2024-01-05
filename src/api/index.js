import { Router } from "express";
import * as genericApiMethods from "./generic";
import * as genericServiceMethods from "./generic/service";
import genericApi from "./definitions";
const router = Router();
let apis = {};
let securityMap = {};
let services = {};

/**
 * Check if argument is a valid function
 * @param fn
 * @returns {*|boolean}
 */
function isValidFunction(fn) {
  return fn && fn instanceof Function;
}

const methods = ["get", "find", "create", "update", "remove"];

export function service(path) {
  if (!services[path]) {
    throw `${path} service does not exist`;
  }
  return services[path];
}

export function getDefinitions() {
  return genericApi;
}

/**
 * Export All the APIs here
 * todo : Read this directory and automatically export the files
 */
export default function (scope) {
  scope = scope || {};

  Object.keys(genericApi).map((key) => {
    let modifiedScope = {
      ...scope,
      ...genericApi[key],
      key,
    };
    apis[key] = {};
    services[key] = {};
    securityMap[key] = {};
    if (typeof genericApi[key].security != "undefined") {
      securityMap[key].security = genericApi[key].security;
    }
    /**
     * Initialize search indexing
     */
    if (genericApi[key].indexingConfig && scope.searchIndexer) {
      setTimeout(async () => {
        if (genericApi[key].indexingConfig instanceof Function) {
          genericApi[key].indexingConfig = await genericApi[key].indexingConfig(
            {}
          );
        }
        const { searchIndexer } = scope.config || {};
        scope.searchIndexer.createIndex(
          (searchIndexer.indexPrefix || "") + key,
          {
            ...searchIndexer.defaultIndexingConfig,
            ...genericApi[key].indexingConfig,
          }
        );
      });
    }

    methods.map((method) => {
      /**
       * Don't create the method which is not defined
       */
      if (
        genericApi[key][method] ||
        (typeof genericApi[key][method] == "undefined" &&
          !genericApi[key].disableNotDefinedMethods)
      ) {
        apis[key][method] = genericApiMethods[method].bind(modifiedScope);
        services[key][method] = genericServiceMethods[method].bind(
          modifiedScope
        );
        if (
          genericApi[key][method] &&
          typeof genericApi[key][method].security != "undefined"
        ) {
          securityMap[key][method] = genericApi[key][method].security;
        }
      }
    });

    // Configure Additional Paths
    apis[key].additionalPaths = {};
    Object.keys(genericApi[key].additionalPaths || {}).map((path) => {
      const pathObj = genericApi[key].additionalPaths[path];
      if (isValidFunction(pathObj.callback)) {
        apis[key].additionalPaths[path] = {
          method: (pathObj.method || "get").toLowerCase(),
          callback: pathObj.callback.bind(modifiedScope),
        };
        services[key][path] = pathObj.callback.bind(modifiedScope);
      }
      if (typeof pathObj.security != "undefined") {
        securityMap[key][path] =
          pathObj.security == "undefined" ? null : pathObj.security;
      }
    });
  });

  Object.keys(apis).map((key) => {
    const { get, find, create, update, remove, additionalPaths } = apis[key];
    let prefix = "";

    // Additonal paths will not be called if we don't define them here.
    Object.keys(additionalPaths || {}).map((path) => {
      const pathObj = additionalPaths[path];
      router[pathObj.method](
        `${prefix}/${key}/${path}`,
        genericServiceMethods.executeCallback(pathObj.callback)
      );
    });
    isValidFunction(get) && router.get(`${prefix}/${key}/:id`, get);
    isValidFunction(find) && router.get(`${prefix}/${key}`, find);
    isValidFunction(create) && router.post(`${prefix}/${key}`, create);
    isValidFunction(update) && router.patch(`${prefix}/${key}/:id`, update);
    isValidFunction(remove) && router.delete(`${prefix}/${key}/:id`, remove);
  });

  return router;
}

/**
 * Get Security for API
 * @param key
 * @returns
 */
export function getApiSecurity(key) {
  // If API Security is undefined that means its false
  if (!securityMap[key] || !securityMap[key].security) {
    return false;
  }
  return securityMap[key].security;
}

/**
 * Get Security for API
 * @param key
 * @returns
 */
export function getMethodSecurity(key, method) {
  if (!securityMap[key]) {
    return undefined;
  }
  
  let security =
    securityMap[key] && typeof securityMap[key][method] !== "undefined"
      ? securityMap[key][method]
      : undefined;
  // console.log({security : securityMap[key],method})   
  if (
    typeof security !== "boolean" &&   
    securityMap[key] &&
    securityMap[key].security &&
    securityMap[key].security.defaultPermissions
  ) {
    security = security || {};
    let permissionName =
      method === "get" || method === "find" ? "read" : method;
    security.permissions = [
      ...(security.permissions || []),
      key.toUpperCase() + "_" + permissionName.toUpperCase(),
    ];
  }
  return security;
}

/**
 * Is Method present for a API
 * @param key
 * @param method
 * @returns {*}
 */
export function isMethodPresent(key, method) {
  return (
    apis[key] && apis[key].additionalPaths && apis[key].additionalPaths[method]
  );
}

/**
 * Get API Method from request
 * @param req
 * @param apiPrefix
 * @returns {}
 */
export function parseRequestMethod(req, apiPrefix) {
  const baseUrl = req.baseUrl;
  const parts = baseUrl.replace("/" + apiPrefix + "/", "").split("/");
  const key = parts[0];
  // After the api key everything is considered as custom method
  const params = parts.slice(1).join("/");
  let apiMethod;
  const method = req.method.toLowerCase();
  switch (method) {
    case "get":
      if (isMethodPresent(key, params)) {
        apiMethod = params;
      } else {
        if (parts.length > 1) {
          apiMethod = "get";
        } else {
          apiMethod = "find";
        }
      }
      break;
    case "delete":
      if (isMethodPresent(key, params)) {
        apiMethod = params;
      } else {
        apiMethod = "remove";
      }
      break;
    case "patch":
      if (isMethodPresent(key, params)) {
        apiMethod = params;
      } else {
        apiMethod = "update";
      }
      break;
    case "post":
      if (isMethodPresent(key, params)) {
        apiMethod = params;
      } else {
        apiMethod = "create";
      }
      break;
  }
  return {
    method: apiMethod,
    key,
  };
}
