export function shouldRetryGroupWithoutStructuredSchema(status:number){
  return status===400;
}
