export function shouldRetryWithoutStructuredSchema(status:number){
  return status===400;
}
