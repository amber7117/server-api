export function fileToSize(file){
    if(typeof file==='object'){
        return file.size;
    } else {
        file=file.split('base64,')[1];
        return 3*Math.ceil((file.length/4));
    }
}
