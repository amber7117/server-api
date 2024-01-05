export default async function (apiDefinitions) {
  const contentTobeIndexed = apiDefinitions.filter((api) => {
    return !!api.indexingConfig;
  });
  await Promise.all(
    contentTobeIndexed.sort(({ indexingConfig: a }, { indexingConfig: b }) => {
      a = a.order || 1;
      b = b.order || 1;
      return a - b;
    }).map(async ({ path, ...api }) => {
      if (this.config.searchIndexer) {
        let indexingConfig = api.indexingConfig;
        if (indexingConfig instanceof Function) {
          indexingConfig = await indexingConfig();
        }
        let content;
        if (
          indexingConfig &&
          indexingConfig.populateIndex instanceof Function
        ) {
          content = await indexingConfig.populateIndex.apply(this, [
            indexingConfig,
          ]);
        } else {
          content = await this.service(path).find({
            all: true,
          });
        }
        if (
          indexingConfig &&
          indexingConfig.dataFormatter instanceof Function
        ) {
          content = indexingConfig.dataFormatter(content);
        }
        console.log("Indexing " + path + " Total - " + content.length);
        await this.searchIndexer.buildIndex(
          (this.config.searchIndexer.indexPrefix || "") + path,
          content
        );
        console.log("Finished Indexing " + path);
      }
    })
  );
}
