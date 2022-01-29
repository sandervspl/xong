export default function redirect(res) {
  res.setHeader('location', '/');
  res.statusCode = 302;
  res.end();

  return {
    props: {},
  };
}
