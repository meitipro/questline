/**
 * The dot between two pieces of metadata.
 *
 * It is punctuation, not content, and it is hidden from assistive technology
 * for that reason: a chronicle line read aloud should say "0x88a1, the sunken
 * archive, rules v3", not "0x88a1 dot the sunken archive dot rules v3".
 *
 * Being decoration is also why its colour is allowed to sit below the contrast
 * floor. It is deliberately the faintest thing on the line - darkening it to
 * pass a check it does not have to pass would make the separators compete with
 * the metadata they separate.
 */
export function Sep() {
  return (
    <span className="sep" aria-hidden="true">
      .
    </span>
  );
}
