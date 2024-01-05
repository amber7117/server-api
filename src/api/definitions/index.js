let api = {};
export default api;

function requireAll(r) {
  r.keys()
    .map((r) => {
      if (r !== "index.js") {
        const name = r.replace(".js", "");
        const file = require(`${name}`).default;
        if(file){
          api[name.replace("./","")] = require(`${name}`).default;        
        }        
      }
      return r;
    })
    .forEach(r);
}
requireAll(require.context("./", true, /\.js$/));
 