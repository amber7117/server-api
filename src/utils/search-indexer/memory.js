import elasticlunr from "elasticlunr";
import { naturalSort } from "../arrayutil";
elasticlunr.clearStopWords();
/**
 * In Memory Search Indexer
 * It uses elasticlunr to create
 * a in memory index
 */
export default class {
  /**
   * Constructor
   * @param config
   */
  constructor(config) {
    this.config = config || {};
    //Maintain a in memory map of indexes
    this.indexes = {};
  }

  /**
   * Create Index in the search engine
   * @param name - Name of Index
   * @param config - Additional Config options that may be required
   * @returns {Promise<*>}
   */
  createIndex(name, config) {
    //console.log("Creating Index with config - ", name,config);
    let { fields, ref, saveDocument } = config || {};
    const index = elasticlunr(function () {
      if (ref) {
        this.setRef(ref);
      }
      (fields || []).map((field) => {
        this.addField(field);
      });
      this.saveDocument(!!saveDocument);
    });

    index.pipeline.add(
      elasticlunr.trimmer,
      elasticlunr.stopWordFilter,
      elasticlunr.stemmer
    );
    this.indexes[name] = index;
    return index;
  }

  /**
   * Remove Index in the search engine
   * @param name - Name of Index
   * @param config - Additional Config options that may be required
   * @returns {Promise<*>}
   */
  removeIndex(name) {
    delete this.indexes[name];
    return true;
  }

  /**
   * Get Index in the search engine
   * @param name - Name of Index
   * @param config - Additional Config options that may be required
   * @returns {Promise<*>}
   */
  getIndex(index, config) {
    this.checkIndex(index);
    return this.indexes[index];
  }

  /**
   * Check if index exists
   * @param name
   * @returns {boolean}
   */
  checkIndex(name) {
    if (!this.indexes[name]) {
      throw "No index with name " + name + " exists";
    }
    return true;
  }

  /**
   * Put a doc in Index in the search engine
   * @param name - Name of Index
   * @param value - Value of the document
   * @param config - Additional Config options that may be required
   * @returns {Promise<*>}
   */
  put(index, value, config) {
    this.checkIndex(index);
    //console.log("Indexing -- ",value);
    return this.indexes[index].addDoc(value);
  }

  /**
   * Update a doc in Index in the search engine
   * @param name - Name of Index
   * @param value - Value of the document
   * @param config - Additional Config options that may be required
   * @returns {Promise<*>}
   */
  update(index, value, config) {
    //console.log(value, this.config, value[this.indexes[index]._ref]);
    const existingDoc = this.indexes[index].documentStore.getDoc(
      value[this.indexes[index]._ref]
    );

    return this.indexes[index].updateDoc({
      ...existingDoc,
      ...value,
    });
  }
  /**
   * Update a doc in Index in the search engine
   * @param name - Name of Index
   * @param value - Value of the document
   * @param config - Additional Config options that may be required
   * @returns {Promise<*>}
   */
  get(index, key, config) {
    //console.log(value, this.config, value[this.indexes[index]._ref]);
    const existingDoc = this.indexes[index].documentStore.getDoc(key);
    return existingDoc
      ? {
          ...existingDoc,
        }
      : existingDoc;
  }

  /**
   * Search text in the search engine
   * @param name - Name of Index
   * @param text - Text to be searched
   * @param config - Additional Config options that may be required
   * @returns {Promise<*>}
   */
  search(index, text, query) {
    let {
      sort,
      sortType,
      from,
      size,
      all,
      additionalQuery,
      preFilter,
      searchField,
      operator,
    } = query || {};
    from = from || 0;
    size = size || 10;
    this.checkIndex(index);
    let results = [];
    if (typeof text !== "undefined") {
      if (searchField) {
        additionalQuery = additionalQuery || {};
        additionalQuery.fields = {};
        additionalQuery.fields[searchField] = {
          boost: 1,
        };
        /**
         * Required to search In in Inderdeep
         */
        additionalQuery.expand = true;
      }
      // Take params from query if needed
      results = this.indexes[index].search(text, {
        ...additionalQuery,
      });
      results = results.map((result) => {
        return this.indexes[index].documentStore.getDoc(result.ref);
      });
    } else {
      const store = this.indexes[index].documentStore;
      if (store.length > 0) {
        results = Object.values(this.indexes[index].documentStore.docs);
      } else {
        results = [];
      }
    }
    results = results.filter((item) => {
      return item !== null && item !== undefined;
    });
    if (preFilter instanceof Function) {
      results = results.filter(preFilter);
    }
    if (sort) {
      sortType = (sortType || "asc").toLowerCase();

      results = results.sort((obj1, obj2) => {
        if (
          obj1 == null ||
          obj2 == null ||
          obj1 === undefined ||
          obj2 === undefined
        ) {
          return 0;
        }
        let a = obj1[sort];
        let b = obj2[sort];

        if (sortType === "asc") {
          return naturalSort(a, b);
        } else {
          return naturalSort(b, a);
        }
      });
    }

    if (operator && operator === "equals") {
      results = results.filter((item) => {
        return (
          (item[searchField] || "").toLowerCase() === (text || "").toLowerCase()
        );
      });
    }

    let total = results.length;

    if (!all) {
      results = results.splice(from, size);
    }
    // results = results.map(result => {
    //   return {...result};
    // });

    return {
      total,
      data: results,
    };
  }

  /**
   * Remove a doc in Index in the search engine
   * @param name - Name of Index
   * @param value - Value of the document
   * @param config - Additional Config options that may be required
   * @returns {Promise<*>}
   */
  remove(index, value, config) {
    this.checkIndex(index);
    return this.indexes[index].removeDoc(value);
  }

  /**
   * Build Index from data
   * @param index
   * @param data
   * @param config
   * @returns {Promise<void>}
   */
  async buildIndex(index, data, config) {
    data = data || [];
    data = data.map((item) => {
      return this.put(index, item);
    });
    return await Promise.all(data);
  }

  // async clearIndex(index) {
  //   this.removeIndex(index);
  //   this.createIndex(index,)
  // }

  /**
   * Get Total Count of documents
   * @param index
   * @param config
   * @returns {Promise<null>}
   */
  async getTotalCount(index, config) {
    this.checkIndex(index);
    return this.indexes[index].documentStore.length;
  }
}
