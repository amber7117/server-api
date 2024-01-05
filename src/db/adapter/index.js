const fnNames = ["create", "get", "remove", "find", "update","model","getDbInstance"];
/**
 * @class DB
 * General DB Interface for interacting with different type of DBs
 * to adapters like AWS, Firebase etc.
 * Methods to be supported as given per this class
 */
export default class DB {
  constructor(config, apiDefinitions) {
    fnNames.map(this.createFunction.bind(this));
    this.setAdapter(config);
    this.processDefinitions(apiDefinitions);
  }

  /**
   * Creates the Fn for
   * DB provider
   */
  createFunction(fnName) {
    /**
     * Fn for DB Provider
     * @param {*} key
     * @param {*} data
     * @param {*} config
     */
    this[fnName] = async (key, data, config) => {
      return await (this.adapter[fnName] instanceof Function
        ? this.adapter[fnName](key, data, config)
        : null);
    };
  }

  async processDefinitions(apiDefinitions) {
    await (this.adapter.processDefinitions instanceof Function
      ? this.adapter.processDefinitions(apiDefinitions)
      : null);
  }

  /**
   * Set Adapter
   * @param config
   */
  setAdapter(config) {
    config = config || {};
    this.config = config;
    let adapter;
    try {
      adapter = require(`./${config.adapter}`).default;
    } catch (e) {
      throw `Storage adapter with the name ${config.adapter} not found`;
    }
    this.adapter = new adapter(config);
  }

  /**
   * Get Adapter
   * @returns {*|{}|string}
   */
  getAdapter() {
    return this.config.adapter;
  }

  /**
   * Get Default Schemas for each method
   */
  getDefaultSchema() {
    return ((this.adapter.getDefaultSchema instanceof Function
      ? this.adapter.getDefaultSchema()
      : null)) || {};
  }
}
