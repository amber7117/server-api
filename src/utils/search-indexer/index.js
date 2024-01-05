/**
 * Base Search Indexer Classes
 * Various classes can inherit its signature methods
 * and this class will recognize the type of indexer
 * through its adapter name.
 * It will require the file with the same name from the same
 * directory
 */
export default class {
    /**
     * Constructor
     * @param config
     */
    constructor(config) {
        this.config = config || {};
        //Load Adapter 
        this.setAdapter(config);
    }

    /**
     * Create Index in the search engine
     * @param name - Name of Index
     * @param config - Additional Config options that may be required
     * @returns {Promise<*>}
     */
    async createIndex(name, config) {
        return (this.adapter.createIndex instanceof Function) ? this.adapter.createIndex(name, config) : null;
    }

    /**
     * Remove Index in the search engine
     * @param name - Name of Index
     * @param config - Additional Config options that may be required
     * @returns {Promise<*>}
     */
    async removeIndex(name, config) {
        return (this.adapter.removeIndex instanceof Function) ? this.adapter.removeIndex(name, config) : null;
    }

    /**
     * Get Index in the search engine
     * @param name - Name of Index
     * @param config - Additional Config options that may be required
     * @returns {Promise<*>}
     */
    async getIndex(name, config) {
        return (this.adapter.getIndex instanceof Function) ? this.adapter.getIndex(name, config) : null;
    }

    /**
     * Put a doc in Index in the search engine
     * @param name - Name of Index
     * @param value - Value of the document
     * @param config - Additional Config options that may be required
     * @returns {Promise<*>}
     */
    async put(index, value, config) {
        return (this.adapter.put instanceof Function) ? this.adapter.put(index, value, config) : null;
    }

     /**
     * Get a doc in Index in the search engine
     * @param name - Name of Index
     * @param key - Key of the document
     * @param config - Additional Config options that may be required
     * @returns {Promise<*>}
     */
    async get(index, key, config) {
        return (this.adapter.get instanceof Function) ? this.adapter.get(index, key, config) : null;
    }

    /**
     * Update a doc in Index in the search engine
     * @param name - Name of Index
     * @param value - Value of the document
     * @param config - Additional Config options that may be required
     * @returns {Promise<*>}
     */
    async update(index, value, config) {
        return (this.adapter.put instanceof Function) ? this.adapter.update(index, value, config) : null;
    }

    /**
     * Search text in the search engine
     * @param name - Name of Index
     * @param text - Text to be searched
     * @param config - Additional Config options that may be required
     * @returns {Promise<*>}
     */
    async search(index, text, config) {
        return (this.adapter.search instanceof Function) ? this.adapter.search(index, text, config) : null;
    }

    /**
     * Remove a doc in Index in the search engine
     * @param name - Name of Index
     * @param value - Value of the document
     * @param config - Additional Config options that may be required
     * @returns {Promise<*>}
     */
    async remove(index, value, config) {
        return (this.adapter.remove instanceof Function) ? this.adapter.remove(index, value, config) : null;
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
            throw `Search adapter with the name ${config.adapter} not found`;
        }
        this.adapter = new adapter(config.config);
    }

    /**
     * Get Adapter
     * @returns {*|{}|string}
     */
    getAdapter() {
        return this.config.adapter;
    }

    /**
     * Build Index
     * @param index
     * @param data
     * @param config
     * @returns {Promise<null>}
     */
    async buildIndex(index,data,config){
        return (this.adapter.remove instanceof Function) ? this.adapter.buildIndex(index, data, config) : null;
    }

    /**
     * Get Total Count of documents
     * @param index
     * @param config
     * @returns {Promise<null>}
     */
    async getTotalCount(index,config){
        return (this.adapter.getTotalCount instanceof Function) ? this.adapter.getTotalCount(index, config) : null;
    }
}
