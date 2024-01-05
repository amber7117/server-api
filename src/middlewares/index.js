const middlewares = [
    require('./populate-security'),
    require('./check-token-expiry'),
    require('./admin-authorize'),
    require('./multipart'),
    require('./error-handler')
];
export default function (app, scope, middlewareType) {
    middlewares.map((middleware) => {
        const {default: fn, path} = middleware;
        /**
         * If middleware type not defined, take it as before
         */
        if ((middleware.type || "before") == middlewareType) {
            app.use(path || "*", fn.bind(scope));
        }
    })
}