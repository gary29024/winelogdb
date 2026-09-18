/** Remove only WineLog's own credit wrapper fields before strict route schemas validate a response.
 * This is a rollout guard: model/provider fields are not stripped, so unexpected AI output still fails closed.
 */
export function stripAiTransportMetadata(value:unknown):unknown{
 if(!value||typeof value!=='object'||Array.isArray(value))return value;
 const payload={...(value as Record<string,unknown>)};
 delete payload.creditOperationId;delete payload.creditSettlement;
 return payload;
}
