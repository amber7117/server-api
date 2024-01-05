/**
 * Error Handler Middleware
 * @param e
 * @param req
 * @param res
 * @param next
 * @return {*|void|boolean}
 */
export default async function (e, req, res, next) {
    console.error("Error Received",e)
    if (e) {
        let payload = {};
        switch(typeof e){
            case "string" :
                payload = this.createError(500,e);
                break;
            case "object":
                payload =  this.createError(e.status || 500,e.message || "Server Error");
                delete e.status;
                delete e.message;
                payload.details = e.details || e;
                break;
            default :
                payload = this.createError(500,"Unknown Server Error");
                break;
        }

        return res.status(payload.status).send(payload);
    } else {
        next();
    }
};

/**
 * Whether it should be registered after or before registering the API
 * @type {string}
 */
export const type = "after";
