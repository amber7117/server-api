/**
 * Set Req.file in req.body
 * @param req
 * @param res
 * @param next
 * @returns {Promise<void>}
 */
export default async function (req, res, next){
    if(req.file){
        if(req.file instanceof Array){
            req.body.files = req.file;
            req.body.file = req.file[0];
        }  else {
            req.body.file = req.file;
        }
    }
    next()
};
