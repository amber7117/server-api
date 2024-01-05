import {putInCache} from 'arivaa-utils/lib/cache';
export default async function (apiDefinitions) {
    const contentTobeCached = apiDefinitions.filter((api)=>{
        return !!api.cachingConfig
    });
    contentTobeCached.map(async ({path}) => {
        if (this.config.searchIndexer) {
            const content = await this.service(path).find({
                all: true
            });
            console.log("Caching " + path + " Total - " + content.length);
            putInCache(path,content)
            console.log("Finished Caching " + path)
        }
    });
} 