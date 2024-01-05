import {createError} from './error'

const errorCodeMap = {
    "auth/invalid-email" : 400,
    "auth/wrong-password" : 401,
    "auth/id-token-expired" : 401,
    "auth/email-already-exists" : 409,
    'auth/phone-number-already-exists' : 409,
    "auth/user-not-found" : 404
};

/**
 * Is Auth Error
 * @param e
 * @returns {boolean}
 */
export function isAuthError(e) {
    if (!e) {
        return false;
    }
    if (e.codePrefix == "auth") {
        return true;
    } else if (e.code && e.code.indexOf && e.code.indexOf("auth/") != "-1") {
        return true;
    }
    return false;
}

/**
 * Get Authentication Error Object
 * @param e
 * @returns {*}
 */
export function getAuthErrorObject(e) {

    if (!e || !isAuthError(e)) {
        return e;
    }
    let status = errorCodeMap[e.code] || 500;
    return createError(status,e.message,e);
}

/**
 * Convert Object into array
 */
export function convertResultToArray(obj) {
    return Object.keys(obj || {}).map((key)=>{
        return {
            key,
            ...obj[key]
        }
    })
}