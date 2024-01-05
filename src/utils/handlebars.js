import { compile as handlebarsCompile } from 'handlebars';
export const compile = template => data => {
    if (Object.keys(data).length) {
        return handlebarsCompile(template)(data);
    } else {
        return template;
    }
}