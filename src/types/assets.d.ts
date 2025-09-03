declare module "*.xlsx" {
  const url: string;
  export default url;
}
declare module "*.xlsx?url" {
  const url: string;
  export default url;
}
