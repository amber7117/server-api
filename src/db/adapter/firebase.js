export default class FirebaseDB {
  constructor(config) {
    this.config = config;
    this.firebaseAdmin = config.firebaseAdmin;
  }

  async create(key, data, config) {
    const output = await this.firebaseAdmin.createRecord(`/${key}`, data);
    output.key = data.key ? data.key : output.path.split("/")[2];
    return output;
  }

  async update(key, data, config) {
    return await this.firebaseAdmin.updateRecord(
      `/${key}/${data.id}`,
      data.data,
      config && config.overrideIfNotExist
    );
  }

  async find(key, data, config) {
    if (data && data.all) {
      return this.convertResultToArray(
        await this.firebaseAdmin.getRecord(`/${key}`)
      );
    }
    return this.convertResultToArray(
      await this.firebaseAdmin.getPaginatedRecords(`/${key}`, data)
    );
  }

  async get(key, data, config) {
    return await this.firebaseAdmin.getRecord(`/${key}/${data}`);
  }

  async remove(key, data, config) {
    return await this.firebaseAdmin.deleteRecord(`/${key}/${data}`);
  }

  convertResultToArray(obj) {
    if (obj && obj.val instanceof Function) {
      obj = obj.val();
    }
    return Object.keys(obj || {}).map((key) => {
      return {
        key,
        ...obj[key],
      };
    });
  }

  /**
   * Get Default Schemas for each method
   */
  getDefaultSchema() {
    return {
      find: {
        nextPageToken: "string",
        count: "number",
        equalTo: "string",
        orderBy: "string",
        startAt: "string",
        startAtKey: "string",
        endAt: "string",
        endAtKey: "string",
      },
    };
  }
}
