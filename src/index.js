/**
 * Application configuration and bootstrapping is done
 * in this file
 */

import http from "http";
import https from "https";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import bodyParser from "body-parser";
import initializeDb, { createInitialData } from "./db";
import createApi, { service, getDefinitions } from "./api";
import configureMiddlewares from "./middlewares";
import { helper, configureHelpers } from "./helpers";
import Config from "./config";
import "arivaa-logging";
import { createError } from "./utils/error";
import Indexer from "./utils/search-indexer";
import { putInCache, getFromCache } from "arivaa-utils/lib/cache";
import multer from "multer";
import initializeCache from "./intitialize-cache";
import initializeIndexes from "./intitialize-indexes";
import demo from "./utils/demo";
import { readFileSync, readdirSync } from "fs";
import { initializeScheduledBackup } from "./utils/backup";
const { server, apiPrefix, ssl } = Config;
const { corsHeaders, bodyLimit, port } = server;
let app = express();
const multipartMiddleware = multer();
if (ssl) {
  const { passphrase } = ssl;
  const { NODE_ENV } = process.env;
  const path = NODE_ENV === "production" ? "./assets/ssl/" : "src/assets/ssl/";
  app.server = https.createServer(
    {
      passphrase,
      key: readdirSync(path+'keys').map((name) => {
        return readFileSync(path + "keys/" + name);
      }),
      cert: readdirSync(path+'certs').map((name) => {
        return readFileSync(path + "certs/" + name);
      }),
    },
    app
  );
} else {
  app.server = http.createServer(app);
}

// logger
app.use(morgan("dev"));

// 3rd party middleware
app.use(
  cors({
    exposedHeaders: corsHeaders,
  })
);

app.use(
  bodyParser.json({
    limit: bodyLimit,
  })
);
//
app.use(multipartMiddleware.single("file"));

/**
 * Set Server Config in memory cache
 * @returns {Promise<void>}
 */
async function setServerConfig() {
  const serverConfig = await service("server-config").find();
  let config = {};
  Object.values(serverConfig || {}).map((obj) => {
    if (obj.package && !config[obj.package]) {
      config[obj.package] = {};
    }
    config[obj.package][obj.key] = obj;
  });

  putInCache("serverConfig", config || {});
}

/**
 * Get Server Config via key from memory cache
 * @returns {Promise<void>}
 */
function getServerConfig(packageName, key) {
  const serverConfig = getFromCache("serverConfig");
  return serverConfig[packageName] ? serverConfig[packageName][key] : null;
}

/**
 * Create Search Indexer
 * @returns {Promise<void>}
 */
function createSearchIndexer(config) {
  const { searchIndexer } = config;
  let indexer = null;
  if (searchIndexer) {
    indexer = new Indexer(searchIndexer);
  }
  return indexer;
}
let apiDefinitions = getDefinitions();
apiDefinitions = Object.keys(apiDefinitions).map((key) => {
  return {
    path: key,
    ...apiDefinitions[key],
  };
});
/**
 * Initialize DB
 */
initializeDb(apiDefinitions, async (db) => {
  /**
   * Put commonly used definitions in scope
   * which will be bound to each API and each service
   *
   */
  let scope = {
    config: Config,
    ...db,
    createError,
    service,
    getServerConfig,
    helper,
  };
  scope.initializeIndexes = () => {
    return initializeIndexes.apply(scope, [apiDefinitions]);
  };
  scope.initializeMultipleIndexes = (apis) => {
    let defs = [...apiDefinitions];
    if (apis && apis.length && apis.indexOf instanceof Function) {
      defs = defs.filter((item) => {
        const { path } = item;
        return apis.indexOf(path) !== -1;
      });
      if (!defs.length) {
        return;
      }
      return initializeIndexes.apply(scope, [defs]);
    }
  };
  //
  createInitialData.apply(scope, []);
  /**
        Set Search Indexer
     */
  scope.searchIndexer = createSearchIndexer(scope.config);
  /**
   * Create APIs and Services
   */
  const apis = createApi(scope);
  /**
   * Fetch Server Configuration using server-config service
   */
  await setServerConfig();

  /**
   * Configure Before Middlewares which will be run before all APIS
   */
  configureMiddlewares(app, scope, "before");
  /**
   * Configure API Router
   */
  app.use(`/${apiPrefix}`, apis);
  app.get(`/${apiPrefix}/initialize-indexes`, (req, res) => {
    scope.initializeIndexes();
    return res.sendStatus(200);
  });
  app.get(`/${apiPrefix}/initialize-cache`, (req, res) => {
    scope.initializeIndexes();
    return res.sendStatus(200);
  });
  /**
   * Configure Before Middlewares which will be run after all APIS
   */
  configureMiddlewares(app, scope, "after");

  /**
   * Initialize Cache
   */
  initializeCache.apply(scope, [apiDefinitions]);

  /**
   * Initialize indexes and configure helpers
   */
  scope.initializeIndexes().then(() => {
    configureHelpers.call(scope);
    demo.call(scope);
    initializeScheduledBackup.call(scope)
  });

  /**
   * Start Server
   */
  app.server.listen(process.env.PORT || port, () => {
    console.log(`Started on port ${app.server.address().port}`);
  });
});
process.on("unhandledRejection", (reason, p) => {
  console.log("Unhandled Rejection at: Promise", p, "reason:", reason);
  // application specific logging, throwing an error, or other logic here
});
export default app;
