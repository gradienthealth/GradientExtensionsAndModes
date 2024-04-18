export default function (url: string): { bucket: string; fileName: string } {
  const urlObject = new URL(url);
  urlObject.searchParams.delete('generation');
  url = urlObject.toString();
  
  const domain = 'https://storage.googleapis.com';
  const bucket = url.split(`${domain}/`)[1].split('/')[0];
  const fileName = url.split(`${domain}/${bucket}/`)[1];

  return { bucket, fileName };
}
