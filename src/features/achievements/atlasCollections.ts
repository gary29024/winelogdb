/** Live collections whose rows name Burgundy places the Atlas mapping covers.
 * Keep this frontend membership list small; curatedLaunch validates it against
 * the complete catalogue, which the detail page already receives from the API.
 *
 * A row is not required to link. The Domaine de la Romanée-Conti checklist is a
 * producer's range, and `Cuvée Duvault-Blochet` is a cuvée name rather than an
 * appellation, so the matcher withholds it instead of guessing at the Vosne-
 * Romanée Premier Cru behind it - which is the behaviour that lets a producer
 * collection join at all. What a row may never do is link somewhere broader
 * than it names, so a title or producer name still has to resolve to nothing.
 *
 * The destination is the appellation, never the Domaine's parcel inside it: a
 * DRC Échezeaux and anyone else's point at the same Échezeaux page. */
export const atlasCollections=new Set(['burgundy-33-grand-crus','domaine-romanee-conti']);
