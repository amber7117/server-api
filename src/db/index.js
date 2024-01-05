/**
 * Initialize DB and Storage Adapters here
 */
import { FirebaseAdmin, FirebaseCommon } from "arivaa-utils-firebase";
import Config from "../config";
import DB from "./adapter";
import createInitialData from "./initial-data";
export default (apiDefinitions,callback) => {

  const firebaseAdmin = new FirebaseAdmin(
    Config.database.firebase.admin,
    Config.database.firebase.url
  );
  const firebaseCommon = new FirebaseCommon(
    Config.database.firebase.config,
    Config.database.firebase.url
  );
  const firebaseDB = new DB({
    adapter: "firebase",
    firebaseAdmin,
    firebaseCommon,
  });
  let obj = {
    firebaseAdmin,
    firebaseCommon,
    firebaseDB,
  };
  if (Config.database.mysql) {
    try {
      obj.mysqlDB = new DB({
        adapter : "mysql",
        ...Config.database.mysql
      },apiDefinitions.filter(({db})=>{
        return (db || "").toLowerCase() === "mysql"
      }));
    } catch(e){
      console.warn("DB Adapter not found for mysql")
    }
  }
  callback(obj);
};

export { createInitialData };
