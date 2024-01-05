import {getApiSecurity, parseRequestMethod, isMethodPresent, getMethodSecurity} from '../api'

/**
 * Middleware to populate security info for a API
 * @param req
 * @param res
 * @param next
 * @returns {Promise.<void>}
 */
export default async function (req, res, next) {
    const {method,key} = parseRequestMethod(req,this.config.apiPrefix);
    try {
        req.apiKey = key;
        if (method) {
            req.security = getMethodSecurity(key, method);
        }
        if(typeof req.security == "undefined"){
            req.security = getApiSecurity(key);
        }
        next();
    } catch (e) {
        throw e;
    }

}
