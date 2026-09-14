// Keep links to the previous subject selector working.
const subject=new URLSearchParams(location.search).get('subject');
if(subject==='law'||subject==='it')location.replace(new URL(`../${subject}-quiz/`,location.href));
