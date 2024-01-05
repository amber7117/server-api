import moment from 'moment';
export function formatDate(date,format='MM/DD/YYYY'){
    const dateObj = moment(date);
    return dateObj.isValid() ? dateObj.format(format) : "";
}